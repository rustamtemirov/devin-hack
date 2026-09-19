"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RunResult {
  itinerary_markdown?: string;
  plan_source?: string;
  synthesis_source?: string;
  total_cost_credits?: number;
  hires?: { agent_id: string; status: string }[];
}

export function Itinerary({ result }: { result: unknown }) {
  const r = result as RunResult | undefined;
  if (!r?.itinerary_markdown) return null;
  const hired = r.hires?.filter((h) => h.status === "completed").length ?? 0;
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-5 mt-4 animate-[fadeIn_.4s]">
      <div className="text-xs text-zinc-500 font-mono mb-3">
        Final itinerary · {hired} agents hired ·{" "}
        {r.total_cost_credits?.toFixed(2)} credits · plan:{" "}
        {r.plan_source ?? "?"} · synthesis: {r.synthesis_source ?? "?"}
      </div>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mb-3">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mt-4 mb-2 text-indigo-300">
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
          em: ({ children }) => (
            <em className="text-zinc-400">{children}</em>
          ),
          table: ({ children }) => (
            <table className="border-collapse text-xs my-2 w-full">
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th className="border border-zinc-700 bg-zinc-800 px-2 py-1 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-zinc-800 px-2 py-1 text-zinc-300">
              {children}
            </td>
          ),
          hr: () => <hr className="border-zinc-800 my-3" />,
        }}
      >
        {r.itinerary_markdown}
      </Markdown>
    </div>
  );
}
