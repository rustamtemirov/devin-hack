import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agents } from "@/db/schema";
import type { Permission } from "@/protocol";
import { RunEmitter, type EventSink } from "@/marketplace/events";
import { updateRun } from "@/marketplace/runs";
import { searchAgents } from "@/marketplace/registry";
import { dispatch } from "@/marketplace/dispatch";
import { decompose } from "./decompose";
import { scoreCandidates } from "./score";
import { synthesize, type SubtaskResult } from "./synthesize";
import { llmLabel, llmProvider } from "@/llm/client";

const STAGE_DELAY_MS = Number(process.env.STAGE_DELAY_MS ?? "600");
const pause = () =>
  STAGE_DELAY_MS > 0
    ? new Promise((r) => setTimeout(r, STAGE_DELAY_MS))
    : Promise.resolve();

export async function runOrchestration(p: {
  runId: string;
  objective: string;
  budgetCredits: number;
  sink?: EventSink;
}): Promise<void> {
  const emitter = new RunEmitter(p.runId, p.sink);
  try {
    await updateRun(p.runId, { status: "running" });
    await emitter.emit({
      type: "run.started",
      objective: p.objective,
      budget: p.budgetCredits,
    });
    await pause();

    // decompose
    const { plan, source: planSource } = await decompose(p.objective, emitter);
    await emitter.emit({
      type: "run.decomposed",
      subtasks: plan.subtasks.map((s) => ({
        capability: s.capability,
        inputs: s.inputs,
        budget_share: s.budget_share,
      })),
    });
    await pause();

    const requesterGrants = (
      (
        await db
          .select({ granted: agents.grantedPermissions })
          .from(agents)
          .where(eq(agents.id, "orchestrator"))
          .limit(1)
      )[0]?.granted ?? []
    ) as Permission[];

    // search + evaluate each subtask
    interface Hire {
      capability: string;
      agentId: string;
      agentName: string;
      price: number;
      inputs: Record<string, unknown>;
      budgetCredits: number;
    }
    const hires: Hire[] = [];
    for (const sub of plan.subtasks) {
      const subtaskBudget =
        Math.round(sub.budget_share * p.budgetCredits * 1e4) / 1e4;
      const inputs = {
        ...sub.inputs,
        traveler_name: "Demo User",
        passport_number: `P${Math.floor(1000000 + Math.random() * 9000000)}`,
      };

      const candidates = await searchAgents({ capability: sub.capability });
      await emitter.emit({
        type: "market.searched",
        capability: sub.capability,
        candidates: candidates.length,
      });

      const scored = scoreCandidates({
        candidates,
        budgetCredits: subtaskBudget,
        requesterGrants,
        inputKeys: Object.keys(inputs),
      });
      await emitter.emit({
        type: "market.evaluated",
        capability: sub.capability,
        scores: scored.map((s) => ({
          agent_id: s.agent_id,
          score: s.score,
          breakdown: { ...s.breakdown, eligible: s.eligible ? 1 : 0 },
        })),
      });
      await pause();

      const winner = scored.find((s) => s.eligible);
      if (!winner) {
        await emitter.emit({
          type: "agent.message",
          task_id: "plan",
          from: "orchestrator",
          to: "user",
          content: `No eligible agent for ${sub.capability} within ${subtaskBudget} credits`,
        });
        continue;
      }
      hires.push({
        capability: sub.capability,
        agentId: winner.agent_id,
        agentName: winner.name,
        price: winner.price,
        inputs,
        budgetCredits: subtaskBudget,
      });
    }

    // dispatch all hires in parallel
    const settled = await Promise.all(
      hires.map(async (h) => {
        const { task, response } = await dispatch({
          runId: p.runId,
          requesterId: "orchestrator",
          workerId: h.agentId,
          capability: h.capability,
          inputs: h.inputs,
          budgetMaxCredits: h.budgetCredits,
          emitter,
        });
        return { hire: h, task, response };
      })
    );

    // synthesize
    const results: SubtaskResult[] = settled.map((s) => ({
      capability: s.hire.capability,
      agent_id: s.hire.agentId,
      agent_name: s.hire.agentName,
      cost: s.response.cost,
      status: s.response.status,
      result: s.response.result,
    }));
    const synthesis = await synthesize({
      objective: p.objective,
      plan,
      results,
    });
    if (synthesis.error) {
      await emitter.emit({
        type: "agent.message",
        task_id: "synthesize",
        from: "orchestrator",
        to: "user",
        content: /quota|429/i.test(synthesis.error)
          ? `LLM quota exceeded (${llmProvider()}); using fallback itinerary`
          : `LLM synthesis unavailable (${synthesis.error}); using fallback itinerary`,
      });
    }

    const totalCost = settled.reduce((s, x) => s + x.response.cost, 0);
    const result = {
      itinerary_markdown: synthesis.markdown,
      plan_source: planSource,
      synthesis_source: synthesis.source,
      llm_model: planSource === "llm" || synthesis.source === "llm"
        ? llmLabel()
        : undefined,
      total_cost_credits: Math.round(totalCost * 1e4) / 1e4,
      hires: settled.map((s) => ({
        task_id: s.task.id,
        agent_id: s.hire.agentId,
        agent_name: s.hire.agentName,
        capability: s.hire.capability,
        price: s.hire.price,
        status: s.response.status,
      })),
      subtask_results: results,
    };

    await updateRun(p.runId, {
      status: "completed",
      spentCredits: result.total_cost_credits,
      result,
      finishedAt: new Date(),
    });
    await emitter.emit({ type: "run.completed", result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await updateRun(p.runId, {
      status: "failed",
      finishedAt: new Date(),
    });
    await emitter.emit({ type: "run.failed", error: message });
  }
}
