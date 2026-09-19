import type { AgentProfile } from "@/protocol";
import type { Candidate, RunState } from "@/lib/run-state";

const SEGMENT_COLORS: Record<string, string> = {
  rating: "#818cf8",
  success: "#34d399",
  price: "#fbbf24",
  latency: "#22d3ee",
  fit: "#f472b6",
};

function CandidateCard({
  c,
  agent,
}: {
  c: Candidate;
  agent?: AgentProfile;
}) {
  const segs = Object.entries(c.breakdown).filter(
    ([k]) => k !== "eligible"
  );
  return (
    <div
      className={`rounded border p-2 animate-[fadeIn_.3s] ${
        c.hired
          ? "border-emerald-600 ring-1 ring-emerald-600"
          : "border-zinc-800"
      } ${c.eligible ? "" : "opacity-40"}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium truncate">
          {agent?.name ?? c.agent_id}
          <span className="text-zinc-500 font-mono text-xs ml-1">
            {c.agent_id}
          </span>
        </div>
        {c.hired && (
          <span className="rounded bg-emerald-900 text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold">
            HIRED
          </span>
        )}
      </div>
      <div className="text-xs text-zinc-500 font-mono mt-0.5">
        {c.price.toFixed(2)}cr · ★{agent?.reputation.rating.toFixed(1) ?? "?"} ·{" "}
        {agent ? Math.round(agent.reputation.success_rate * 100) : "?"}%
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-2 flex-1 rounded bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-indigo-500"
            style={{ width: `${Math.min(100, c.score * 100)}%` }}
          />
        </div>
        <span className="font-mono text-xs text-zinc-300">
          {c.score.toFixed(4)}
        </span>
      </div>
      <div
        className="mt-1 flex h-1.5 rounded overflow-hidden"
        title={segs
          .map(([k, v]) => `${k}: ${v}`)
          .join("  ")}
      >
        {segs.map(([k, v]) => (
          <div
            key={k}
            style={{
              width: `${Math.min(100, v * 100)}%`,
              backgroundColor: SEGMENT_COLORS[k] ?? "#71717a",
            }}
          />
        ))}
      </div>
      {!c.eligible && (
        <div className="mt-1 text-[10px] text-red-400 font-mono">
          over budget / not delegable
        </div>
      )}
    </div>
  );
}

export function Candidates({
  state,
  agents,
}: {
  state: RunState;
  agents: Record<string, AgentProfile>;
}) {
  if (!state.subtasks.length) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-900/40 p-6 text-center">
        <p className="text-zinc-500 text-sm">
          Enter an objective and press Run
        </p>
        <p className="text-zinc-600 text-xs mt-2 font-mono">
          Discovery · Delegation · Permissions · Payment · Reputation
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {state.subtasks.map((sub, i) => {
        const cands = state.candidates[sub.capability] ?? [];
        const budget = (sub.budget_share * (state.budget ?? 0)).toFixed(2);
        return (
          <div
            key={i}
            className="rounded border border-zinc-800 bg-zinc-900/40 p-3"
          >
            <div className="text-xs text-zinc-400 font-mono mb-2">
              {sub.capability} ·{" "}
              {state.searched[sub.capability] ?? cands.length} candidates ·
              budget {budget}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {cands.map((c) => (
                <CandidateCard key={c.agent_id} c={c} agent={agents[c.agent_id]} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
