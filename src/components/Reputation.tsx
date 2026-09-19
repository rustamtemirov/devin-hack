import type { AgentProfile } from "@/protocol";
import type { ReputationView } from "@/lib/run-state";

export function Reputation({
  reputation,
  agents,
}: {
  reputation: Record<string, ReputationView>;
  agents: Record<string, AgentProfile>;
}) {
  const rows = Object.values(reputation);
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        Reputation
      </h2>
      {rows.length === 0 ? (
        <p className="text-zinc-600 text-xs">No updates yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map((r) => {
            const seed = agents[r.agent_id]?.reputation.rating;
            const delta =
              seed !== undefined && r.rating !== seed
                ? `${seed.toFixed(2)} → ${r.rating.toFixed(2)}`
                : r.rating.toFixed(2);
            return (
              <div key={r.agent_id} className="text-xs flex justify-between">
                <span className="text-zinc-300">
                  {agents[r.agent_id]?.name ?? r.agent_id}
                </span>
                <span className="font-mono text-zinc-400">
                  {delta}
                  {seed !== undefined && r.rating > seed && (
                    <span className="text-emerald-400"> ↑</span>
                  )}
                  {" · "}
                  {r.completed_tasks} tasks
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
