import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { runs, tasks, transactions, permissionEvents, events } from "@/db/schema";
import type { MarketplaceEvent } from "@/protocol";

export type Run = typeof runs.$inferSelect;

export async function createRun(p: {
  objective: string;
  budgetCredits: number;
  orchestratorId?: string;
  id?: string;
}): Promise<Run> {
  const [run] = await db
    .insert(runs)
    .values({
      id: p.id ?? `run_${crypto.randomUUID()}`,
      objective: p.objective,
      status: "pending",
      orchestratorId: p.orchestratorId ?? "orchestrator",
      budgetCredits: p.budgetCredits,
      spentCredits: 0,
    })
    .returning();
  return run;
}

export async function updateRun(
  id: string,
  patch: Partial<{
    status: string;
    spentCredits: number;
    result: unknown;
    finishedAt: Date;
  }>
): Promise<Run | null> {
  const [run] = await db
    .update(runs)
    .set(patch)
    .where(eq(runs.id, id))
    .returning();
  return run ?? null;
}

export async function listRuns(limit = 20): Promise<Run[]> {
  return db
    .select()
    .from(runs)
    .orderBy(desc(runs.createdAt))
    .limit(limit);
}

export async function getRunDetail(id: string): Promise<null | {
  run: Run;
  tasks: (typeof tasks.$inferSelect)[];
  transactions: (typeof transactions.$inferSelect)[];
  permission_events: (typeof permissionEvents.$inferSelect)[];
  events: MarketplaceEvent[];
}> {
  const runRows = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  const run = runRows[0];
  if (!run) return null;

  const runTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.runId, id))
    .orderBy(asc(tasks.createdAt));

  const taskIds = runTasks.map((t) => t.id);
  const runTransactions = taskIds.length
    ? await db
        .select()
        .from(transactions)
        .where(inArray(transactions.taskId, taskIds))
        .orderBy(asc(transactions.createdAt))
    : [];

  const runPermEvents = await db
    .select()
    .from(permissionEvents)
    .where(eq(permissionEvents.runId, id))
    .orderBy(asc(permissionEvents.createdAt));

  const runEvents = await db
    .select()
    .from(events)
    .where(eq(events.runId, id))
    .orderBy(asc(events.createdAt));

  return {
    run,
    tasks: runTasks,
    transactions: runTransactions,
    permission_events: runPermEvents,
    events: runEvents.map((r) => r.payload as MarketplaceEvent),
  };
}
