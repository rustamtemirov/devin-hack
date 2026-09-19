import { db } from "@/db/client";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  TaskRequestSchema,
  TaskResponseSchema,
  type Permission,
  type TaskResponse,
} from "@/protocol";
import { getAgent } from "./registry";
import { getAgentImpl, AgentError, type AgentContext } from "@/agents";
import { checkPermission, envelopeFor, filterInputs } from "./permissions";
import { recordPermissionEvent } from "./permission-log";
import { createTask, transitionTask, type Task } from "./tasks";
import { transfer, LedgerError } from "./ledger";
import { recordOutcome } from "./reputation";
import type { RunEmitter } from "./events";

const LATENCY_SCALE = Number(process.env.AGENT_LATENCY_SCALE ?? "0.3");

function deadline(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new AgentError("DEADLINE_EXCEEDED", `exceeded ${ms}ms deadline`)),
      ms
    )
  );
}

export async function dispatch(p: {
  runId: string;
  requesterId: string;
  workerId: string;
  capability: string;
  inputs: Record<string, unknown>;
  budgetMaxCredits: number;
  deadlineMs?: number;
  parentTaskId?: string | null;
  taskId?: string;
  emitter: RunEmitter;
}): Promise<{ task: Task; response: TaskResponse }> {
  const emitter = p.emitter;
  const startedAt = Date.now();

  const requesterRows = await db
    .select()
    .from(agents)
    .where(eq(agents.id, p.requesterId))
    .limit(1);
  const requester = requesterRows[0];
  if (!requester) throw new Error(`unknown requester ${p.requesterId}`);
  const requesterGrants = requester.grantedPermissions as Permission[];

  const worker = await getAgent(p.workerId);
  const impl = getAgentImpl(p.workerId);

  let task = await createTask({
    id: p.taskId,
    runId: p.runId,
    capability: p.capability,
    requesterId: p.requesterId,
    parentTaskId: p.parentTaskId ?? null,
  });
  await emitter.emit({
    type: "task.status",
    task_id: task.id,
    status: "pending",
  });

  const failEarly = async (code: string, message: string): Promise<TaskResponse> => {
    task = await transitionTask(task.id, "failed");
    await emitter.emit({
      type: "task.status",
      task_id: task.id,
      status: "failed",
    });
    return TaskResponseSchema.parse({
      protocol: "amp/0.1",
      task_id: task.id,
      status: "failed",
      error: { code, message },
      cost: 0,
      execution_time_ms: Date.now() - startedAt,
      metadata: { agent_id: p.workerId },
    });
  };

  // 1. capability / impl
  if (!worker || !impl || !worker.profile.capabilities.includes(p.capability)) {
    const response = await failEarly(
      "CAPABILITY_MISMATCH",
      `agent ${p.workerId} cannot handle capability ${p.capability}`
    );
    return { task, response };
  }
  const profile = worker.profile;

  // 2. budget
  if (profile.pricing.amount > p.budgetMaxCredits) {
    const response = await failEarly(
      "BUDGET_EXCEEDED",
      `price ${profile.pricing.amount} exceeds budget ${p.budgetMaxCredits}`
    );
    return { task, response };
  }

  // 3. permission envelope
  const { envelope, missing } = envelopeFor({
    requesterGrants,
    workerRequired: profile.permissions_required,
  });
  if (missing.length) {
    for (const perm of missing) {
      const reason = `requester lacks ${perm} so cannot delegate it`;
      await recordPermissionEvent({
        runId: p.runId,
        taskId: task.id,
        agentId: p.workerId,
        permission: perm,
        decision: "denied",
        reason,
      });
      await emitter.emit({
        type: "permission.checked",
        task_id: task.id,
        agent_id: p.workerId,
        permission: perm,
        decision: "denied",
        reason,
      });
    }
    task = await transitionTask(task.id, "denied");
    await emitter.emit({
      type: "task.status",
      task_id: task.id,
      status: "denied",
    });
    const response = TaskResponseSchema.parse({
      protocol: "amp/0.1",
      task_id: task.id,
      status: "denied",
      error: {
        code: "PERMISSION_ENVELOPE",
        message: `worker requires permissions outside requester grants: ${missing.join(", ")}`,
      },
      cost: 0,
      execution_time_ms: Date.now() - startedAt,
      metadata: { agent_id: p.workerId },
    });
    return { task, response };
  }

  // 4. input filtering + requirements
  const { inputs: filteredInputs, redacted } = filterInputs(
    p.inputs,
    requesterGrants
  );
  await emitter.emit({
    type: "agent.message",
    task_id: task.id,
    from: p.requesterId,
    to: p.workerId,
    content: `Delegating ${p.capability} with inputs [${Object.keys(filteredInputs).join(", ")}]`,
  });
  if (redacted.length) {
    await emitter.emit({
      type: "agent.message",
      task_id: task.id,
      from: p.requesterId,
      to: p.workerId,
      content: `Redacted before sending: [${redacted.join(", ")}]`,
    });
  }
  const missingReqs = profile.requirements.filter(
    (k) => !(k in filteredInputs)
  );
  if (missingReqs.length) {
    const response = await failEarly(
      "MISSING_REQUIREMENTS",
      `required inputs missing after filtering: ${missingReqs.join(", ")}`
    );
    return { task, response };
  }

  // 5. hire
  const request = TaskRequestSchema.parse({
    protocol: "amp/0.1",
    task_id: task.id,
    run_id: p.runId,
    parent_task_id: p.parentTaskId ?? undefined,
    capability: p.capability,
    requester: { agent_id: p.requesterId },
    inputs: filteredInputs,
    budget: { max_credits: p.budgetMaxCredits, currency: "CREDIT" },
    deadline_ms: p.deadlineMs ?? 20000,
    permissions: envelope,
  });
  task = await transitionTask(task.id, "hired", {
    workerId: p.workerId,
    request,
  });
  await emitter.emit({
    type: "task.status",
    task_id: task.id,
    status: "hired",
  });
  await emitter.emit({
    type: "agent.hired",
    task_id: task.id,
    agent_id: p.workerId,
    capability: p.capability,
    price: profile.pricing.amount,
  });
  task = await transitionTask(task.id, "running");
  await emitter.emit({
    type: "task.status",
    task_id: task.id,
    status: "running",
  });

  // 6. context
  const ctx: AgentContext = {
    async requestPermission(permission, justification) {
      const check = checkPermission({ permission, envelope });
      const { decision } = check;
      const reason = `${check.reason}. Agent justification: "${justification}"`;
      await recordPermissionEvent({
        runId: p.runId,
        taskId: task.id,
        agentId: p.workerId,
        permission,
        decision,
        reason,
      });
      await emitter.emit({
        type: "permission.checked",
        task_id: task.id,
        agent_id: p.workerId,
        permission,
        decision,
        reason,
      });
      return decision;
    },
    async say(content) {
      await emitter.emit({
        type: "agent.message",
        task_id: task.id,
        from: p.workerId,
        to: p.requesterId,
        content,
      });
    },
    async sleep(ms) {
      const scaled = Math.min(ms * LATENCY_SCALE, 3000);
      if (scaled > 0) await new Promise((r) => setTimeout(r, scaled));
    },
  };

  // 7. execute
  const execStart = Date.now();
  try {
    const out = await Promise.race([
      impl.handle(request, ctx),
      deadline(p.deadlineMs ?? 20000),
    ]);
    const latencyMs = Date.now() - execStart;

    // 8. settle payment
    try {
      await transfer({
        from: p.requesterId,
        to: p.workerId,
        amount: profile.pricing.amount,
        taskId: task.id,
        type: "hire",
      });
    } catch (e) {
      if (e instanceof LedgerError) {
        task = await transitionTask(task.id, "failed");
        await emitter.emit({
          type: "task.status",
          task_id: task.id,
          status: "failed",
        });
        const response = TaskResponseSchema.parse({
          protocol: "amp/0.1",
          task_id: task.id,
          status: "failed",
          error: { code: "PAYMENT_FAILED", message: e.message },
          cost: 0,
          execution_time_ms: latencyMs,
          metadata: { agent_id: p.workerId },
        });
        return { task, response };
      }
      throw e;
    }
    await emitter.emit({
      type: "ledger.transfer",
      from: p.requesterId,
      to: p.workerId,
      amount: profile.pricing.amount,
      task_id: task.id,
    });
    await recordOutcome(p.workerId, { success: true, latencyMs }, emitter);

    const response = TaskResponseSchema.parse({
      protocol: "amp/0.1",
      task_id: task.id,
      status: "completed",
      result: out.result,
      cost: profile.pricing.amount,
      execution_time_ms: latencyMs,
      metadata: { agent_id: p.workerId, confidence: out.confidence },
    });
    task = await transitionTask(task.id, "completed", {
      response,
      cost: profile.pricing.amount,
    });
    await emitter.emit({
      type: "task.status",
      task_id: task.id,
      status: "completed",
    });
    return { task, response };
  } catch (e) {
    const latencyMs = Date.now() - execStart;
    const code = e instanceof AgentError ? e.code : "AGENT_ERROR";
    const message = e instanceof Error ? e.message : String(e);
    await recordOutcome(p.workerId, { success: false, latencyMs }, emitter);
    const response = TaskResponseSchema.parse({
      protocol: "amp/0.1",
      task_id: task.id,
      status: "failed",
      error: { code, message },
      cost: 0,
      execution_time_ms: latencyMs,
      metadata: { agent_id: p.workerId },
    });
    task = await transitionTask(task.id, "failed", { response });
    await emitter.emit({
      type: "task.status",
      task_id: task.id,
      status: "failed",
    });
    return { task, response };
  }
}
