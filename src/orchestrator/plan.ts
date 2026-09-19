import { z } from "zod";

export const SUBTASK_CAPABILITIES = [
  "flight_search",
  "hotel_search",
  "activity_search",
  "currency_conversion",
  "web_research",
  "translation",
] as const;

export const PlanSchema = z.object({
  summary: z.string(),
  destination: z.string(),
  origin: z.string().default("Berlin"),
  travel_dates: z.string(),
  budget_eur: z.number().nullable(),
  subtasks: z
    .array(
      z.object({
        capability: z.enum(SUBTASK_CAPABILITIES),
        inputs: z.object({
          origin: z.string().optional(),
          destination: z.string().optional(),
          travel_dates: z.string().optional(),
          budget: z.number().optional(),
          amount: z.number().optional(),
          from_currency: z.string().optional(),
          to_currency: z.string().optional(),
          query: z.string().optional(),
          text: z.string().optional(),
          target_language: z.string().optional(),
        }),
        budget_share: z.number().min(0).max(1),
        rationale: z.string(),
      })
    )
    .min(1)
    .max(6),
});

export type Plan = z.infer<typeof PlanSchema>;

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fallbackPlan(objective: string): Plan {
  const destMatch = objective.match(
    /\b(?:to|in|around|visit(?:ing)?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/
  );
  const destination = destMatch?.[1] ?? "Tokyo";
  const daysMatch = objective.match(/(\d+)-day/);
  const days = daysMatch ? Number(daysMatch[1]) : 4;
  const budgetMatch = objective.match(/[€$]\s?(\d[\d,]*)/);
  const budgetEur = budgetMatch
    ? Number(budgetMatch[1].replace(/,/g, ""))
    : 1200;
  const travelDates = `2026-10-01..${addDays("2026-10-01", days)}`;
  const toCurrency = destination === "Tokyo" ? "JPY" : "USD";

  return {
    summary: `Plan a ${days}-day trip to ${destination} under €${budgetEur}.`,
    destination,
    origin: "Berlin",
    travel_dates: travelDates,
    budget_eur: budgetEur,
    subtasks: [
      {
        capability: "flight_search",
        inputs: { origin: "Berlin", destination, travel_dates: travelDates },
        budget_share: 0.4,
        rationale: "Flights are the largest cost driver; book first.",
      },
      {
        capability: "hotel_search",
        inputs: {
          destination,
          travel_dates: travelDates,
          budget: budgetEur,
        },
        budget_share: 0.35,
        rationale: "Accommodation for the full stay.",
      },
      {
        capability: "activity_search",
        inputs: { destination, travel_dates: travelDates },
        budget_share: 0.15,
        rationale: "Fill the itinerary with activities.",
      },
      {
        capability: "currency_conversion",
        inputs: {
          amount: budgetEur,
          from_currency: "EUR",
          to_currency: toCurrency,
        },
        budget_share: 0.1,
        rationale: "Convert the budget to local currency.",
      },
    ],
  };
}
