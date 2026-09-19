import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reputation } from "@/db/schema";
import type { RunEmitter } from "./events";

export type ReputationRow = typeof reputation.$inferSelect;

export type Outcome = { success: boolean; latencyMs: number };

export interface ReputationState {
  rating: number;
  successRate: number;
  completedTasks: number;
  failedTasks: number;
  avgLatencyMs: number;
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const r2 = (x: number) => Math.round(x * 1e2) / 1e2;
const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

export function applyOutcome(
  rep: ReputationState,
  o: Outcome
): ReputationState {
  const completedTasks = rep.completedTasks + (o.success ? 1 : 0);
  const failedTasks = rep.failedTasks + (o.success ? 0 : 1);
  const total = completedTasks + failedTasks;
  return {
    completedTasks,
    failedTasks,
    successRate: r4(completedTasks / total),
    rating: r2(
      clamp(
        rep.rating +
          (o.success ? (rep.rating > 4.95 ? 0.005 : 0.01) : -0.15),
        0,
        5
      )
    ),
    avgLatencyMs: Math.round(rep.avgLatencyMs * 0.8 + o.latencyMs * 0.2),
  };
}

export async function recordOutcome(
  agentId: string,
  o: Outcome,
  emitter: RunEmitter
): Promise<ReputationRow> {
  const rows = await db
    .select()
    .from(reputation)
    .where(eq(reputation.agentId, agentId))
    .limit(1);
  if (!rows[0]) throw new Error(`no reputation row for ${agentId}`);
  const next = applyOutcome(rows[0], o);
  const [updated] = await db
    .update(reputation)
    .set(next)
    .where(eq(reputation.agentId, agentId))
    .returning();
  await emitter.emit({
    type: "reputation.updated",
    agent_id: agentId,
    rating: updated.rating,
    success_rate: updated.successRate,
    completed_tasks: updated.completedTasks,
  });
  return updated;
}
