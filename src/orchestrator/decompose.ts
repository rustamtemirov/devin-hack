import { generateObject } from "ai";
import { getModel, llmEnabled, llmLabel, llmProvider, withTimeout } from "@/llm/client";
import { fallbackPlan, PlanSchema, type Plan } from "./plan";
import type { RunEmitter } from "@/marketplace/events";

const SYSTEM = `You are a travel orchestrator decomposing a user objective into marketplace subtasks.
Today is ${new Date().toISOString().slice(0, 10)} — all dates must be in the future.
Available capabilities and the exact input keys each requires:
- flight_search: origin, destination, travel_dates
- hotel_search: destination, travel_dates, budget
- activity_search: destination, travel_dates
- currency_conversion: amount, from_currency, to_currency
- web_research: query
- translation: text, target_language
Rules:
- Every subtask MUST include all input keys its capability requires — copy destination/travel_dates/budget into each subtask's inputs; do not rely on the top-level fields.
- budget_share values must sum to <= 1, and every subtask must get a nonzero share.
- Never include identity documents, payment details, or credentials in inputs.
- travel_dates format: YYYY-MM-DD..YYYY-MM-DD. If the objective has no explicit dates, pick sensible ones within the next 2 months.
- Keep subtasks to at most 6.`;

function normalize(plan: Plan): Plan {
  const cleaned = {
    ...plan,
    subtasks: plan.subtasks.map((t) => {
      // backfill plan-level fields the model omitted, then strip undefined
      const merged: Record<string, unknown> = {
        origin: plan.origin,
        destination: plan.destination,
        travel_dates: plan.travel_dates,
        ...(t.capability === "hotel_search"
          ? { budget: plan.budget_eur ?? undefined }
          : {}),
        ...t.inputs,
      };
      const inputs = Object.fromEntries(
        Object.entries(merged).filter(([, v]) => v !== undefined)
      ) as Plan["subtasks"][number]["inputs"];
      return { ...t, inputs };
    }),
  };
  // floor tiny/zero shares so every subtask can afford a cheap agent
  let subtasks = cleaned.subtasks.map((t) => ({
    ...t,
    budget_share: Math.max(t.budget_share, 0.01),
  }));
  const sum = subtasks.reduce((s, t) => s + t.budget_share, 0);
  if (sum > 1) {
    subtasks = subtasks.map((t) => ({
      ...t,
      budget_share: t.budget_share / sum,
    }));
  }
  return { ...cleaned, subtasks };
}

export async function decompose(
  objective: string,
  emitter: RunEmitter
): Promise<{ plan: Plan; source: "llm" | "fallback" }> {
  if (!llmEnabled()) {
    await emitter.emit({
      type: "agent.message",
      task_id: "plan",
      from: "orchestrator",
      to: "user",
      content:
        "No LLM key (ANTHROPIC_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY); using fallback plan",
    });
    return { plan: fallbackPlan(objective), source: "fallback" };
  }
  try {
    const { object } = await withTimeout(
      generateObject({
        model: getModel(),
        maxRetries: 0,
        schema: PlanSchema,
        system: SYSTEM,
        prompt: objective,
      }),
      15000,
      "decompose"
    );
    const plan = normalize(object);
    await emitter.emit({
      type: "agent.message",
      task_id: "plan",
      from: "orchestrator",
      to: "user",
      content: `Plan by ${llmLabel()}: ${plan.subtasks.length} subtasks`,
    });
    return { plan, source: "llm" };
  } catch (e) {
    const raw = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
    const reason = raw.slice(0, 120);
    const quota = /quota|429/i.test(raw);
    await emitter.emit({
      type: "agent.message",
      task_id: "plan",
      from: "orchestrator",
      to: "user",
      content: quota
        ? `LLM quota exceeded (${llmProvider()}); using fallback plan`
        : `LLM decomposition unavailable (${reason}); using fallback plan`,
    });
    return { plan: fallbackPlan(objective), source: "fallback" };
  }
}
