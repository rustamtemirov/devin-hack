"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "./ui";

interface RunResult {
  itinerary_markdown?: string;
  plan_source?: string;
  synthesis_source?: string;
  total_cost_credits?: number;
  hires?: { agent_id: string; status: string }[];
  subtask_results?: {
    capability: string;
    status: string;
    result: unknown;
  }[];
}

export function Itinerary({ result }: { result: unknown }) {
  const reduce = useReducedMotion();
  const r = result as RunResult | undefined;
  if (!r?.itinerary_markdown) return null;

  const destMatch = r.itinerary_markdown.match(/^#\s+(.+?)(?:\s+—|$)/m);
  const destination = destMatch?.[1] ?? "Itinerary";
  const hired = r.hires?.filter((h) => h.status === "completed").length ?? 0;

  const flight = r.subtask_results?.find(
    (x) => x.capability === "flight_search" && x.status === "completed"
  )?.result as { options?: { price_eur: number }[] } | undefined;
  const hotel = r.subtask_results?.find(
    (x) => x.capability === "hotel_search" && x.status === "completed"
  )?.result as { options?: { total_eur: number }[] } | undefined;

  return (
    <motion.div
      data-testid="itinerary"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.5 }}
      className="card-surface p-6 mt-5"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-2xl font-bold">{destination}</h2>
        <div className="flex gap-1.5 flex-wrap">
          <Badge tone="indigo">{hired} agents</Badge>
          <Badge tone="emerald">
            {r.total_cost_credits?.toFixed(2)} credits
          </Badge>
          <Badge tone="zinc">plan: {r.plan_source ?? "?"}</Badge>
          <Badge tone="zinc">synthesis: {r.synthesis_source ?? "?"}</Badge>
        </div>
      </div>
      {(flight?.options?.[0] || hotel?.options?.[0]) && (
        <div className="text-xs text-zinc-500 font-mono tabular-nums mb-3">
          {flight?.options?.[0] && `flight €${flight.options[0].price_eur}`}
          {flight?.options?.[0] && hotel?.options?.[0] && " · "}
          {hotel?.options?.[0] && `stay €${hotel.options[0].total_eur}`}
        </div>
      )}
      <Markdown

        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mb-3">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mt-5 mb-2 text-indigo-300 border-b border-indigo-500/30 pb-1">
              {children}
            </h2>
          ),
          p: ({ children }) => (
            <p className="text-sm text-zinc-300 mb-2">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 text-sm text-zinc-300 mb-2">
              {children}
            </ul>
          ),
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          strong: ({ children }) => (
            <strong className="text-zinc-100 font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="text-zinc-400">{children}</em>,
          table: ({ children }) => (
            <table className="border-collapse text-xs my-3 w-full">
              {children}
            </table>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-800/60">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="[&>tr:nth-child(even)]:bg-zinc-900/50">
              {children}
            </tbody>
          ),
          th: ({ children }) => (
            <th className="border border-[var(--hairline)] px-2.5 py-1.5 text-left font-medium text-zinc-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[var(--hairline)] px-2.5 py-1.5 text-zinc-300 font-mono tabular-nums">
              {children}
            </td>
          ),
          hr: () => <hr className="border-[var(--hairline)] my-4" />,
        }}
      >
        {r.itinerary_markdown.replace(/^#[^\n]*\n?/, "")}
      </Markdown>
    </motion.div>
  );
}
