import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { permissionEvents } from "@/db/schema";
import type { Permission } from "@/protocol";

export type PermissionEventRow = typeof permissionEvents.$inferSelect;

export async function recordPermissionEvent(p: {
  runId: string;
  taskId?: string | null;
  agentId: string;
  permission: Permission;
  decision: "allowed" | "denied" | "escalated";
  reason: string;
}): Promise<PermissionEventRow> {
  const [row] = await db
    .insert(permissionEvents)
    .values({
      id: `perm_${crypto.randomUUID()}`,
      runId: p.runId,
      taskId: p.taskId ?? null,
      agentId: p.agentId,
      permission: p.permission,
      decision: p.decision,
      reason: p.reason,
    })
    .returning();
  return row;
}

export async function listPermissionEvents(
  runId: string
): Promise<PermissionEventRow[]> {
  return db
    .select()
    .from(permissionEvents)
    .where(eq(permissionEvents.runId, runId))
    .orderBy(asc(permissionEvents.createdAt));
}
