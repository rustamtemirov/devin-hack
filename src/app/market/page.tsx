"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { Badge } from "@/components/ui";
import { CAP_COLOR, capMonogram } from "@/components/cap";
import { useDrawer } from "@/lib/drawer";
import { SEED_AGENTS } from "@/db/seed-data";
import type { AgentProfile } from "@/protocol";

type AgentWithBalance = AgentProfile & { balance: number };

const SEED_RATING = new Map(SEED_AGENTS.map((a) => [a.id, a.rating]));

function AgentCard({ a }: { a: AgentWithBalance }) {
  const drawer = useDrawer();
  const cap = a.capabilities[0];
  const color = CAP_COLOR[cap] ?? "#818cf8";
  const seed = SEED_RATING.get(a.id);
  const delta = seed !== undefined ? a.reputation.rating - seed : 0;
  return (
    <button
      onClick={() => drawer.open(a.id)}
      className="card-surface p-4 text-left hover:border-zinc-600 transition-colors"
    >
      <div className="flex items-center gap-3 mb-2">
        <span
          className="grid h-9 w-9 place-items-center rounded-lg text-[11px] font-bold shrink-0"
          style={{ backgroundColor: `${color}22`, color }}
        >
          {capMonogram(cap)}
        </span>
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{a.name}</div>
          <div className="text-[11px] text-zinc-500 font-mono truncate">
            {a.id}
          </div>
        </div>
        <div className="ml-auto text-right shrink-0">
          <div className="font-mono tabular-nums text-sm">
            {a.balance.toFixed(2)}
          </div>
          <div className="text-[9px] text-zinc-600 uppercase">balance</div>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap mb-2">
        {a.capabilities.map((c) => (
          <Badge key={c} tone="indigo">
            {c}
          </Badge>
        ))}
      </div>
      <div className="text-[11px] font-mono tabular-nums text-zinc-400 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>{a.pricing.amount.toFixed(2)} cr</span>
        <span>★{a.reputation.rating.toFixed(2)}</span>
        <span>{Math.round(a.reputation.success_rate * 100)}%</span>
        <span>{a.reputation.completed_tasks} tasks</span>
        <span>{a.latency_ms_p50}ms</span>
        {seed !== undefined && (
          <span
            className={
              delta > 0.004
                ? "text-emerald-400"
                : delta < -0.004
                  ? "text-red-400"
                  : "text-zinc-600"
            }
          >
            {delta > 0.004
              ? `↑ +${delta.toFixed(2)}`
              : delta < -0.004
                ? `↓ ${delta.toFixed(2)}`
                : "—"}
          </span>
        )}
      </div>
      {a.permissions_required.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {a.permissions_required.map((p) => (
            <Badge key={p} tone="amber">
              {p}
            </Badge>
          ))}
        </div>
      )}
    </button>
  );
}

export default function MarketPage() {
  const [agents, setAgents] = useState<AgentWithBalance[]>([]);
  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []));
  }, []);

  const capCount = new Set(agents.flatMap((a) => a.capabilities)).size;
  const circulation = agents.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="min-h-screen p-4">
      <Nav />
      <div className="flex items-baseline gap-3 mb-4 mt-1">
        <h1 className="text-xl font-bold">Marketplace</h1>
        <span className="text-xs text-zinc-500 font-mono">
          {agents.length} agents · {capCount} capabilities ·{" "}
          {circulation.toFixed(2)} credits in circulation
        </span>
      </div>
      {(() => {
        const ORDER = [
          "flight_search",
          "hotel_search",
          "activity_search",
          "currency_conversion",
          "translation",
          "web_research",
        ];
        const groups = new Map<string, AgentWithBalance[]>();
        for (const a of agents) {
          const g = a.capabilities[0] ?? "other";
          groups.set(g, [...(groups.get(g) ?? []), a]);
        }
        const keys = [
          ...ORDER.filter((k) => groups.has(k)),
          ...[...groups.keys()].filter((k) => !ORDER.includes(k)),
        ];
        return keys.map((cap) => {
          const list = groups
            .get(cap)!
            .sort((x, y) => y.reputation.rating - x.reputation.rating);
          return (
            <div key={cap} className="mb-5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2 font-mono">
                {cap} · {list.length}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                {list.map((a) => (
                  <AgentCard key={a.id} a={a} />
                ))}
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}
