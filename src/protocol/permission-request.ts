import { z } from "zod";
import { PermissionSchema } from "./permissions";

export const PermissionRequestSchema = z.object({
  task_id: z.string(),
  agent_id: z.string(),
  permission: PermissionSchema,
  justification: z.string(),
});
export type PermissionRequest = z.infer<typeof PermissionRequestSchema>;

export const PermissionDecisionSchema = z.object({
  task_id: z.string(),
  permission: PermissionSchema,
  decision: z.enum(["allowed", "denied", "escalated"]),
  reason: z.string(),
});
export type PermissionDecision = z.infer<typeof PermissionDecisionSchema>;
