import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agents, reputation, tasks, wallets } from "@/db/schema";
import type { AgentProfile, Permission } from "@/protocol";

type AgentRow = typeof agents.$inferSelect;
type ReputationRow = typeof reputation.$inferSelect;

export function toProfile(agent: AgentRow, rep: ReputationRow): AgentProfile {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    version: "0.1",
    capabilities: agent.capabilities,
    pricing: {
      model: "per_task",
      amount: agent.price,
      currency: "CREDIT",
    },
    reputation: {
      rating: rep.rating,
      success_rate: rep.successRate,
      completed_tasks: rep.completedTasks,
    },
    requirements: agent.requirements,
    permissions_required: agent.requiredPermissions as Permission[],
    latency_ms_p50: agent.latencyMsP50,
  };
}

const baseQuery = () =>
  db
    .select({ agent: agents, reputation: reputation })
    .from(agents)
    .innerJoin(reputation, eq(reputation.agentId, agents.id));

export async function listAgents(opts?: {
  includeOrchestrator?: boolean;
}): Promise<AgentProfile[]> {
  const rows = await baseQuery().orderBy(asc(agents.id));
  return rows
    .filter((r) => opts?.includeOrchestrator || !r.agent.isOrchestrator)
    .map((r) => toProfile(r.agent, r.reputation));
}

export type AgentProfileWithBalance = AgentProfile & { balance: number };

export async function listAgentsWithBalances(opts?: {
  includeOrchestrator?: boolean;
}): Promise<AgentProfileWithBalance[]> {
  const profiles = await listAgents(opts);
  const walletRows = await db.select().from(wallets);
  const balances = new Map(walletRows.map((w) => [w.agentId, w.balance]));
  return profiles.map((p) => ({ ...p, balance: balances.get(p.id) ?? 0 }));
}

export async function recentTasksForAgent(agentId: string, limit = 10) {
  const rows = await db
    .select({
      id: tasks.id,
      runId: tasks.runId,
      capability: tasks.capability,
      status: tasks.status,
      cost: tasks.cost,
      finishedAt: tasks.finishedAt,
    })
    .from(tasks)
    .where(eq(tasks.workerId, agentId))
    .orderBy(desc(tasks.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    run_id: r.runId,
    capability: r.capability,
    status: r.status,
    cost: r.cost,
    finished_at: r.finishedAt,
  }));
}

export interface AgentSearch {
  capability: string;
  maxPrice?: number;
  minRating?: number;
}

export async function searchAgents(
  search: AgentSearch
): Promise<AgentProfile[]> {
  const conditions = [
    eq(agents.isOrchestrator, false),
    sql`${agents.capabilities} @> ${JSON.stringify([search.capability])}::jsonb`,
  ];
  if (search.maxPrice !== undefined)
    conditions.push(lte(agents.price, search.maxPrice));
  if (search.minRating !== undefined)
    conditions.push(gte(reputation.rating, search.minRating));

  const rows = await baseQuery()
    .where(and(...conditions))
    .orderBy(desc(reputation.rating), asc(agents.price));
  return rows.map((r) => toProfile(r.agent, r.reputation));
}

export async function getAgent(id: string) {
  const rows = await baseQuery().where(eq(agents.id, id)).limit(1);
  if (rows.length === 0) return null;
  const { agent, reputation: rep } = rows[0];
  const walletRows = await db
    .select()
    .from(wallets)
    .where(eq(wallets.agentId, id))
    .limit(1);
  return {
    agent,
    reputation: rep,
    wallet: walletRows[0] ?? null,
    profile: toProfile(agent, rep),
  };
}
