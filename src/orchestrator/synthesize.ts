import { generateText } from "ai";
import { getModel, llmEnabled, withTimeout } from "@/llm/client";
import type { Plan } from "./plan";

export interface SubtaskResult {
  capability: string;
  agent_id: string;
  agent_name: string;
  cost: number;
  status: string;
  result: unknown;
}

export interface Synthesis {
  markdown: string;
  source: "llm" | "template";
  error?: string;
}

const SYSTEM = `Write a concise, well-structured trip itinerary in Markdown (GFM) from these structured agent results.
Format rules:
- The output MUST start with "# <Destination> — <N>-day itinerary" as the first line.
- Then sections, in this order: "## Flights", "## Stay", "## Day by day", "## Budget".
- Use GFM tables for the flight options, stay options, and the budget breakdown in EUR.
- Day by day: one "**Day N**" line per day with bullet items below it.
- Don't invent data not present in the results; note any failed subtask briefly in its section.
- Cap the output at ~600 words.`;

interface FlightOption {
  airline: string;
  from: string;
  to: string;
  depart: string;
  return: string;
  stops: number;
  duration_h: number;
  price_eur: number;
}
interface HotelOption {
  name: string;
  area: string;
  stars: number;
  price_per_night_eur: number;
  total_eur: number;
  rating: number;
}
interface ActivityDay {
  day: number;
  items: { time: string; title: string; area: string; cost_eur: number }[];
}
interface FxResult {
  from: string;
  to: string;
  rate: number;
  amount: number;
  converted: number;
}

function mdTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  return [head, sep, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

function fallbackSynthesis(
  objective: string,
  plan: Plan,
  results: SubtaskResult[]
): string {
  const lines: string[] = [];
  const days = plan.travel_dates.includes("..")
    ? Math.max(
        1,
        Math.round(
          (Date.parse(plan.travel_dates.split("..")[1]) -
            Date.parse(plan.travel_dates.split("..")[0])) /
            86400000
        )
      )
    : 4;
  lines.push(`# ${plan.destination} — ${days}-day itinerary`);
  lines.push("");
  lines.push(`_${plan.summary}_`);
  lines.push("");

  const flight = results.find((r) => r.capability === "flight_search");
  if (flight?.status === "completed" && flight.result) {
    const r = flight.result as { options?: FlightOption[]; recommended?: number };
    const options = r.options ?? [];
    const rec = r.recommended ?? 0;
    lines.push("## Flights");
    lines.push("");
    lines.push(
      mdTable(
        ["Airline", "Route", "Stops", "Duration", "Price", ""],
        options.map((o, i) => [
          o.airline,
          `${o.from}→${o.to}`,
          String(o.stops),
          `${o.duration_h}h`,
          `€${o.price_eur}`,
          i === rec ? "✓ recommended" : "",
        ])
      )
    );
    lines.push("");
  } else {
    lines.push("## Flights");
    lines.push("");
    lines.push(
      `_${flight ? `Flight search failed (${flight.agent_name}).` : "No flight subtask."}_`
    );
    lines.push("");
  }

  const hotel = results.find((r) => r.capability === "hotel_search");
  if (hotel?.status === "completed" && hotel.result) {
    const r = hotel.result as { options?: HotelOption[]; recommended?: number };
    const options = r.options ?? [];
    const rec = r.recommended ?? 0;
    lines.push("## Stay");
    lines.push("");
    lines.push(
      mdTable(
        ["Hotel", "Area", "Stars", "Per night", "Total", "Rating", ""],
        options.map((o, i) => [
          o.name,
          o.area,
          "★".repeat(o.stars),
          `€${o.price_per_night_eur}`,
          `€${o.total_eur}`,
          String(o.rating),
          i === rec ? "✓ recommended" : "",
        ])
      )
    );
    lines.push("");
  } else {
    lines.push("## Stay");
    lines.push("");
    lines.push(
      `_${hotel ? `Hotel search failed (${hotel.agent_name}).` : "No hotel subtask."}_`
    );
    lines.push("");
  }

  const activity = results.find((r) => r.capability === "activity_search");
  if (activity?.status === "completed" && activity.result) {
    const r = activity.result as { days?: ActivityDay[] };
    lines.push("## Day by day");
    lines.push("");
    for (const d of r.days ?? []) {
      lines.push(`**Day ${d.day}**`);
      if (d.items.length === 0) {
        lines.push("- _Free time / travel day._");
      }
      for (const item of d.items) {
        lines.push(
          `- ${item.time} — ${item.title} (${item.area}) ~€${item.cost_eur}`
        );
      }
      lines.push("");
    }
  } else {
    lines.push("## Day by day");
    lines.push("");
    lines.push(
      `_${activity ? `Activity search failed (${activity.agent_name}).` : "No activity subtask."}_`
    );
    lines.push("");
  }

  lines.push("## Budget");
  lines.push("");
  const flightCost =
    flight?.status === "completed" && flight.result
      ? ((flight.result as { options?: FlightOption[]; recommended?: number })
          .options?.[0]?.price_eur ?? 0)
      : 0;
  const hotelCost =
    hotel?.status === "completed" && hotel.result
      ? ((hotel.result as { options?: HotelOption[]; recommended?: number })
          .options?.[0]?.total_eur ?? 0)
      : 0;
  const activityCost =
    activity?.status === "completed" && activity.result
      ? ((activity.result as { days?: ActivityDay[] }).days ?? []).reduce(
          (s, d) => s + d.items.reduce((x, i) => x + i.cost_eur, 0),
          0
        )
      : 0;
  const total = flightCost + hotelCost + activityCost;
  const rows = [
    ["Flights (recommended)", `€${flightCost}`],
    ["Stay (recommended)", `€${hotelCost}`],
    ["Activities (est.)", `€${activityCost}`],
    ["**Total**", `**€${total}**`],
  ];
  if (plan.budget_eur !== null) {
    rows.push([
      "Budget",
      `€${plan.budget_eur} (${total <= plan.budget_eur ? "under" : "over"} by €${Math.abs(plan.budget_eur - total)})`,
    ]);
  }
  const fx = results.find((r) => r.capability === "currency_conversion");
  if (fx?.status === "completed" && fx.result) {
    const f = fx.result as FxResult;
    rows.push([
      "Local currency",
      `${f.amount} ${f.from} ≈ ${f.converted} ${f.to} @ ${f.rate}`,
    ]);
  }
  lines.push(mdTable(["Item", "Cost"], rows));
  lines.push("");

  const hired = results.filter((r) => r.status === "completed");
  const credits = results.reduce((s, r) => s + r.cost, 0);
  lines.push("---");
  lines.push(
    `Assembled by TravelOrchestrator via Bazaar amp/0.1 · ${hired.length} agents hired · ${credits.toFixed(2)} credits`
  );
  return lines.join("\n");
}

export async function synthesize(p: {
  objective: string;
  plan: Plan;
  results: SubtaskResult[];
}): Promise<Synthesis> {
  if (llmEnabled() && process.env.LLM_SYNTHESIS === "1") {
    try {
      const { text } = await withTimeout(
        generateText({
          model: getModel(),
          maxRetries: 0,
          system: SYSTEM,
          prompt: `Objective: ${p.objective}\n\nPlan: ${JSON.stringify(p.plan, null, 2)}\n\nResults:\n${JSON.stringify(p.results, null, 2)}`,
        }),
        20000,
        "synthesize"
      );
      return { markdown: text, source: "llm" };
    } catch (e) {
      const reason = (
        e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e)
      ).slice(0, 120);
      return {
        markdown: fallbackSynthesis(p.objective, p.plan, p.results),
        source: "template",
        error: reason,
      };
    }
  }
  return {
    markdown: fallbackSynthesis(p.objective, p.plan, p.results),
    source: "template",
  };
}
