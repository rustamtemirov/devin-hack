import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRun, getRunDetail } from "@/marketplace/runs";
import { createTask, transitionTask } from "@/marketplace/tasks";
import { transfer, LedgerError } from "@/marketplace/ledger";
import { RunEmitter } from "@/marketplace/events";
import { assertDevRoutes } from "@/lib/dev-guard";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  run_id: z.string().optional(),
  capability: z.string(),
  worker_id: z.string(),
  cost: z.number().positive(),
});

export async function POST(req: NextRequest) {
  const guard = assertDevRoutes();
  if (guard) return guard;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.message } },
      { status: 400 }
    );
  }
  const { run_id, capability, worker_id, cost } = parsed.data;

  try {
    const run =
      run_id !== undefined
        ? { id: run_id }
        : await createRun({
            objective: `simulate-task: ${capability}`,
            budgetCredits: cost,
          });

    const emitter = new RunEmitter(run.id);
    const task = await createTask({
      runId: run.id,
      capability,
      requesterId: "orchestrator",
    });

    await transitionTask(task.id, "hired", { workerId: worker_id });
    await emitter.emit({
      type: "task.status",
      task_id: task.id,
      status: "hired",
    });

    await transitionTask(task.id, "running");
    await emitter.emit({
      type: "task.status",
      task_id: task.id,
      status: "running",
    });

    await transitionTask(task.id, "completed", { cost });
    await emitter.emit({
      type: "task.status",
      task_id: task.id,
      status: "completed",
    });

    await transfer({
      from: "orchestrator",
      to: worker_id,
      amount: cost,
      taskId: task.id,
    });
    await emitter.emit({
      type: "ledger.transfer",
      from: "orchestrator",
      to: worker_id,
      amount: cost,
      task_id: task.id,
    });

    const detail = await getRunDetail(run.id);
    return NextResponse.json(detail);
  } catch (e) {
    if (e instanceof LedgerError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message } },
        { status: 400 }
      );
    }
    throw e;
  }
}
