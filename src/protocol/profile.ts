import { z } from "zod";
import { PermissionSchema } from "./permissions";

export const AgentProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.literal("0.1"),
  capabilities: z.array(z.string()),
  pricing: z.object({
    model: z.literal("per_task"),
    amount: z.number().nonnegative(),
    currency: z.literal("CREDIT"),
  }),
  reputation: z.object({
    rating: z.number().min(0).max(5),
    success_rate: z.number().min(0).max(1),
    completed_tasks: z.number().int(),
  }),
  requirements: z.array(z.string()),
  permissions_required: z.array(PermissionSchema),
  latency_ms_p50: z.number().int(),
});

export type AgentProfile = z.infer<typeof AgentProfileSchema>;
