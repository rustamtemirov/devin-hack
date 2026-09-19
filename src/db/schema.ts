import {
  pgTable,
  text,
  jsonb,
  doublePrecision,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  capabilities: jsonb("capabilities").$type<string[]>().notNull(),
  pricingModel: text("pricing_model").notNull(),
  price: doublePrecision("price").notNull(),
  currency: text("currency").notNull(),
  latencyMsP50: integer("latency_ms_p50").notNull(),
  requiredPermissions: jsonb("required_permissions")
    .$type<string[]>()
    .notNull(),
  grantedPermissions: jsonb("granted_permissions")
    .$type<string[]>()
    .notNull(),
  requirements: jsonb("requirements").$type<string[]>().notNull(),
  isOrchestrator: boolean("is_orchestrator").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const wallets = pgTable("wallets", {
  agentId: text("agent_id")
    .primaryKey()
    .references(() => agents.id),
  balance: doublePrecision("balance").notNull(),
});

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  fromAgentId: text("from_agent_id").notNull(),
  toAgentId: text("to_agent_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  taskId: text("task_id"),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  objective: text("objective").notNull(),
  status: text("status").notNull(),
  orchestratorId: text("orchestrator_id").notNull(),
  budgetCredits: doublePrecision("budget_credits").notNull(),
  spentCredits: doublePrecision("spent_credits").notNull().default(0),
  result: jsonb("result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  parentTaskId: text("parent_task_id"),
  capability: text("capability").notNull(),
  requesterId: text("requester_id").notNull(),
  workerId: text("worker_id"),
  status: text("status").notNull(),
  request: jsonb("request"),
  response: jsonb("response"),
  cost: doublePrecision("cost").notNull().default(0),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reputation = pgTable("reputation", {
  agentId: text("agent_id")
    .primaryKey()
    .references(() => agents.id),
  rating: doublePrecision("rating").notNull(),
  successRate: doublePrecision("success_rate").notNull(),
  completedTasks: integer("completed_tasks").notNull(),
  failedTasks: integer("failed_tasks").notNull(),
  avgLatencyMs: integer("avg_latency_ms").notNull(),
});

export const permissionEvents = pgTable("permission_events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  taskId: text("task_id"),
  agentId: text("agent_id").notNull(),
  permission: text("permission").notNull(),
  decision: text("decision").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
