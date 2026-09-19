import type { MarketplaceEvent, TaskStatus } from "@/protocol";

export type Stage =
  | "idle"
  | "started"
  | "decomposing"
  | "searching"
  | "evaluating"
  | "hiring"
  | "executing"
  | "settling"
  | "completed"
  | "failed";

const STAGE_ORDER: Stage[] = [
  "idle",
  "started",
  "decomposing",
  "searching",
  "evaluating",
  "hiring",
  "executing",
  "settling",
  "completed",
];

function advance(current: Stage, next: Stage): Stage {
  if (current === "completed" || current === "failed") return current;
  if (next === "failed" || next === "completed") return next;
  const ci = STAGE_ORDER.indexOf(current);
  const ni = STAGE_ORDER.indexOf(next);
  return ni > ci ? next : current;
}

export interface Candidate {
  agent_id: string;
  score: number;
  breakdown: Record<string, number>;
  eligible: boolean;
  hired: boolean;
}
export interface TaskView {
  task_id: string;
  capability: string;
  agent_id?: string;
  status: TaskStatus;
  price?: number;
}
export interface Message {
  ts: number;
  task_id: string;
  from: string;
  to: string;
  content: string;
}
export interface PermissionView {
  ts: number;
  task_id: string;
  agent_id: string;
  permission: string;
  decision: string;
  reason: string;
}
export interface TransferView {
  ts: number;
  from: string;
  to: string;
  amount: number;
  task_id: string;
}
export interface ReputationView {
  agent_id: string;
  rating: number;
  success_rate: number;
  completed_tasks: number;
}

export interface RunState {
  runId?: string;
  objective?: string;
  budget?: number;
  stage: Stage;
  subtasks: {
    capability: string;
    inputs: Record<string, unknown>;
    budget_share: number;
  }[];
  searched: Record<string, number>;
  candidates: Record<string, Candidate[]>;
  tasks: Record<string, TaskView>;
  messages: Message[];
  permissions: PermissionView[];
  transfers: TransferView[];
  reputation: Record<string, ReputationView>;
  spent: number;
  result?: unknown;
  error?: string;
  planSource?: "llm" | "fallback";
}

export const initialRunState: RunState = {
  stage: "idle",
  subtasks: [],
  searched: {},
  candidates: {},
  tasks: {},
  messages: [],
  permissions: [],
  transfers: [],
  reputation: {},
  spent: 0,
};

export function applyEvent(state: RunState, e: MarketplaceEvent): RunState {
  switch (e.type) {
    case "run.started":
      return {
        ...state,
        runId: e.run_id,
        objective: e.objective,
        budget: e.budget,
        stage: advance(state.stage, "started"),
      };
    case "run.decomposed":
      return {
        ...state,
        subtasks: e.subtasks,
        stage: advance(state.stage, "searching"),
      };
    case "market.searched":
      return {
        ...state,
        searched: { ...state.searched, [e.capability]: e.candidates },
        stage: advance(state.stage, "searching"),
      };
    case "market.evaluated": {
      const list: Candidate[] = e.scores.map((s) => ({
        agent_id: s.agent_id,
        score: s.score,
        breakdown: s.breakdown,
        eligible: s.breakdown.eligible !== 0,
        hired: false,
      }));
      return {
        ...state,
        candidates: { ...state.candidates, [e.capability]: list },
        stage: advance(state.stage, "evaluating"),
      };
    }
    case "agent.hired": {
      const candidates = { ...state.candidates };
      for (const cap of Object.keys(candidates)) {
        candidates[cap] = candidates[cap].map((c) =>
          c.agent_id === e.agent_id ? { ...c, hired: true } : c
        );
      }
      const cap = Object.keys(candidates).find((c) =>
        candidates[c].some((x) => x.agent_id === e.agent_id && x.hired)
      );
      return {
        ...state,
        candidates,
        tasks: {
          ...state.tasks,
          [e.task_id]: {
            task_id: e.task_id,
            capability: e.capability ?? cap ?? "",
            agent_id: e.agent_id,
            status: "hired",
            price: e.price,
          },
        },
        stage: advance(state.stage, "hiring"),
      };
    }
    case "agent.message": {
      const planSource =
        state.planSource ??
        (e.content.includes("fallback plan") ? "fallback" : undefined);
      const stage =
        e.task_id === "plan" && state.stage === "started"
          ? advance(state.stage, "decomposing")
          : state.stage;
      return {
        ...state,
        planSource,
        stage,
        messages: [
          ...state.messages,
          {
            ts: e.ts,
            task_id: e.task_id,
            from: e.from,
            to: e.to,
            content: e.content,
          },
        ],
      };
    }
    case "task.status": {
      const existing = state.tasks[e.task_id];
      const tasks = {
        ...state.tasks,
        [e.task_id]: {
          ...(existing ?? { task_id: e.task_id, capability: "" }),
          status: e.status,
        },
      };
      const stage =
        e.status === "running"
          ? advance(state.stage, "executing")
          : state.stage;
      return { ...state, tasks, stage };
    }
    case "permission.checked":
      return {
        ...state,
        permissions: [
          ...state.permissions,
          {
            ts: e.ts,
            task_id: e.task_id,
            agent_id: e.agent_id,
            permission: e.permission,
            decision: e.decision,
            reason: e.reason,
          },
        ],
      };
    case "ledger.transfer":
      return {
        ...state,
        stage: advance(state.stage, "settling"),
        spent:
          Math.round((state.spent + e.amount) * 1e4) / 1e4,
        transfers: [
          ...state.transfers,
          {
            ts: e.ts,
            from: e.from,
            to: e.to,
            amount: e.amount,
            task_id: e.task_id,
          },
        ],
      };
    case "reputation.updated":
      return {
        ...state,
        reputation: {
          ...state.reputation,
          [e.agent_id]: {
            agent_id: e.agent_id,
            rating: e.rating,
            success_rate: e.success_rate,
            completed_tasks: e.completed_tasks,
          },
        },
      };
    case "run.completed": {
      const result = e.result as { plan_source?: "llm" | "fallback" } | undefined;
      return {
        ...state,
        stage: "completed",
        result: e.result,
        planSource: state.planSource ?? result?.plan_source,
      };
    }
    case "run.failed":
      return { ...state, stage: "failed", error: e.error };
    default:
      return state;
  }
}

export function reduceEvents(events: MarketplaceEvent[]): RunState {
  return events.reduce(applyEvent, initialRunState);
}
