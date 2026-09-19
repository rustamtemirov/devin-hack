import { z } from "zod";
import { PermissionSchema } from "./permissions";

export const TaskRequestSchema = z.object({
  protocol: z.literal("amp/0.1"),
  task_id: z.string(),
  run_id: z.string(),
  parent_task_id: z.string().optional(),
  capability: z.string(),
  requester: z.object({ agent_id: z.string() }),
  inputs: z.record(z.string(), z.unknown()),
  budget: z.object({
    max_credits: z.number().nonnegative(),
    currency: z.literal("CREDIT"),
  }),
  deadline_ms: z.number(),
  permissions: z.array(PermissionSchema),
});
export type TaskRequest = z.infer<typeof TaskRequestSchema>;

export const TaskStatusSchema = z.enum([
  "pending",
  "searching",
  "hired",
  "running",
  "completed",
  "failed",
  "denied",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskResponseSchema = z.object({
  protocol: z.literal("amp/0.1"),
  task_id: z.string(),
  status: z.enum(["completed", "failed", "denied"]),
  result: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  cost: z.number(),
  execution_time_ms: z.number(),
  metadata: z.object({
    agent_id: z.string(),
    confidence: z.number().optional(),
  }),
});
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
