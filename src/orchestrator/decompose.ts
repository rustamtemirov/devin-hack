import { generateObject } from "ai";
import { getModel, llmEnabled, withTimeout } from "@/llm/client";
import { fallbackPlan, PlanSchema, type Plan } from "./plan";
import type { RunEmitter } from "@/marketplace/events";

const SYSTEM = `You are a travel orchestrator decomposing a user objective into marketplace subtasks.
Available capabilities and the exact input keys each requires:
- flight_search: origin, destination, travel_dates
- hotel_search: destination, travel_dates, budget
- activity_search: destination, travel_dates
- currency_conversion: amount, from_currency, to_currency
- web_research: query
- translation: text, target_language
Rules:
- budget_share values must sum to <= 1.
- Never include identity documents, payment details, or credentials in inputs.
- travel_dates format: YYYY-MM-DD..YYYY-MM-DD. If the objective has no explicit dates, pick sensible ones within the next 2 months.
- Keep subtasks to at most 6.`;

function normalize(plan: Plan): Plan {
  const sum = plan.subtasks.reduce((s, t) => s + t.budget_share, 0);
  if (sum > 1) {
    return {
      ...plan,
      subtasks: plan.subtasks.map((t) => ({
        ...t,
        budget_share: t.budget_share / sum,
      })),
    };
  }
  return plan;
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
      content: "No ANTHROPIC_API_KEY; using fallback plan",
    });
    return { plan: fallbackPlan(objective), source: "fallback" };
  }
  try {
    const { object } = await withTimeout(
      generateObject({
        model: getModel(),
        schema: PlanSchema,
        system: SYSTEM,
        prompt: objective,
      }),
      15000,
      "decompose"
    );
    return { plan: normalize(object), source: "llm" };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await emitter.emit({
      type: "agent.message",
      task_id: "plan",
      from: "orchestrator",
      to: "user",
      content: `LLM decomposition unavailable (${reason}); using fallback plan`,
    });
    return { plan: fallbackPlan(objective), source: "fallback" };
  }
}
