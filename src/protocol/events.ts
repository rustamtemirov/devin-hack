import { z } from "zod";
import { PermissionSchema } from "./permissions";
import { TaskStatusSchema } from "./task";

const EventBase = z.object({
  run_id: z.string(),
  ts: z.number(),
});

export const MarketplaceEventSchema = z.discriminatedUnion("type", [
  EventBase.extend({
    type: z.literal("run.started"),
    objective: z.string(),
    budget: z.number(),
  }),
  EventBase.extend({
    type: z.literal("run.decomposed"),
    subtasks: z.array(
      z.object({
        capability: z.string(),
        inputs: z.record(z.string(), z.unknown()),
        budget_share: z.number(),
      })
    ),
  }),
  EventBase.extend({
    type: z.literal("market.searched"),
    capability: z.string(),
    candidates: z.number(),
  }),
  EventBase.extend({
    type: z.literal("market.evaluated"),
    capability: z.string(),
    scores: z.array(
      z.object({
        agent_id: z.string(),
        score: z.number(),
        breakdown: z.record(z.string(), z.number()),
      })
    ),
  }),
  EventBase.extend({
    type: z.literal("agent.hired"),
    task_id: z.string(),
    agent_id: z.string(),
    capability: z.string(),
    price: z.number(),
  }),
  EventBase.extend({
    type: z.literal("agent.message"),
    task_id: z.string(),
    from: z.string(),
    to: z.string(),
    content: z.string(),
  }),
  EventBase.extend({
    type: z.literal("task.status"),
    task_id: z.string(),
    status: TaskStatusSchema,
  }),
  EventBase.extend({
    type: z.literal("permission.checked"),
    task_id: z.string(),
    agent_id: z.string(),
    permission: PermissionSchema,
    decision: z.enum(["allowed", "denied", "escalated"]),
    reason: z.string(),
  }),
  EventBase.extend({
    type: z.literal("ledger.transfer"),
    from: z.string(),
    to: z.string(),
    amount: z.number(),
    task_id: z.string(),
  }),
  EventBase.extend({
    type: z.literal("reputation.updated"),
    agent_id: z.string(),
    rating: z.number(),
    success_rate: z.number(),
    completed_tasks: z.number(),
  }),
  EventBase.extend({
    type: z.literal("run.completed"),
    result: z.unknown(),
  }),
  EventBase.extend({
    type: z.literal("run.failed"),
    error: z.string(),
  }),
]);

export type MarketplaceEvent = z.infer<typeof MarketplaceEventSchema>;
export type MarketplaceEventType = MarketplaceEvent["type"];
