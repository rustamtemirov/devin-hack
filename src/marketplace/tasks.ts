import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tasks } from "@/db/schema";
import type { TaskStatus } from "@/protocol";

export type Task = typeof tasks.$inferSelect;

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["searching", "hired", "failed", "denied"],
  searching: ["hired", "failed"],
  hired: ["running", "failed", "denied"],
  running: ["completed", "failed", "denied"],
  completed: [],
  failed: [],
  denied: [],
};

export class TaskStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskStateError";
  }
}

export async function createTask(p: {
  runId: string;
  capability: string;
  requesterId: string;
  parentTaskId?: string | null;
  id?: string;
}): Promise<Task> {
  const [task] = await db
    .insert(tasks)
    .values({
      id: p.id ?? `task_${crypto.randomUUID()}`,
      runId: p.runId,
      parentTaskId: p.parentTaskId ?? null,
      capability: p.capability,
      requesterId: p.requesterId,
      workerId: null,
      status: "pending",
    })
    .returning();
  return task;
}

export async function transitionTask(
  id: string,
  status: TaskStatus,
  patch?: Partial<{
    workerId: string;
    request: unknown;
    response: unknown;
    cost: number;
  }>
): Promise<Task> {
  const existing = await getTask(id);
  if (!existing) {
    throw new TaskStateError(`task ${id} not found`);
  }
  const allowed = TASK_TRANSITIONS[existing.status as TaskStatus];
  if (!allowed.includes(status)) {
    throw new TaskStateError(
      `invalid transition ${existing.status} -> ${status} for task ${id}`
    );
  }
  const now = new Date();
  const [task] = await db
    .update(tasks)
    .set({
      status,
      ...(patch?.workerId !== undefined ? { workerId: patch.workerId } : {}),
      ...(patch?.request !== undefined ? { request: patch.request } : {}),
      ...(patch?.response !== undefined ? { response: patch.response } : {}),
      ...(patch?.cost !== undefined ? { cost: patch.cost } : {}),
      ...(status === "running" ? { startedAt: now } : {}),
      ...(status === "completed" || status === "failed" || status === "denied"
        ? { finishedAt: now }
        : {}),
    })
    .where(eq(tasks.id, id))
    .returning();
  return task;
}

export async function getTask(id: string): Promise<Task | null> {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listTasksForRun(runId: string): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.runId, runId))
    .orderBy(asc(tasks.createdAt));
}
