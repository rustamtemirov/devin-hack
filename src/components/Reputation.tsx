"use client";

import type { AgentProfile } from "@/protocol";
import { useDrawer } from "@/lib/drawer";
import { Card } from "./ui";
import type { ReputationView } from "@/lib/run-state";

export function Reputation({
  reputation,
  agents,
}: {
  reputation: Record<string, ReputationView>;
  agents: Record<string, AgentProfile>;
}) {
  const rows = Object.values(reputation);
  const drawer = useDrawer();
  return (
    <Card title="Reputation">
      {rows.length === 0 ? (
        <p className="text-zinc-600 text-xs">No updates yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map((r) => {
            const seed = agents[r.agent_id]?.reputation.rating;
            const up = seed !== undefined && r.rating > seed;
            const down = seed !== undefined && r.rating < seed;
            return (
              <div key={r.agent_id} className="text-xs flex justify-between">
                <button
                  onClick={() => drawer.open(r.agent_id)}
                  className="text-zinc-300 hover:text-indigo-300"
                >
                  {agents[r.agent_id]?.name ?? r.agent_id}
                </button>
                <span className="font-mono tabular-nums text-zinc-400">
                  {seed !== undefined && (up || down)
                    ? `${seed.toFixed(2)} → ${r.rating.toFixed(2)}`
                    : r.rating.toFixed(2)}
                  {up && <span className="text-emerald-400"> ↑</span>}
                  {down && <span className="text-red-400"> ↓</span>}
                  {" · "}
                  {r.completed_tasks} tasks
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
