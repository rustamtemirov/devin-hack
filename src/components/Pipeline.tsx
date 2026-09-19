import type { RunState, Stage } from "@/lib/run-state";

const NODES: { key: string; label: string }[] = [
  { key: "user", label: "USER" },
  { key: "orchestrator", label: "ORCHESTRATOR" },
  { key: "decomposing", label: "Decomposing" },
  { key: "searching", label: "Marketplace search" },
  { key: "evaluating", label: "Evaluating" },
  { key: "hiring", label: "Hiring" },
  { key: "executing", label: "Executing" },
  { key: "results", label: "Results" },
  { key: "settling", label: "Payments settled" },
  { key: "itinerary", label: "Itinerary" },
];

const STAGE_NODE_INDEX: Record<Stage, number> = {
  idle: -1,
  started: 1,
  decomposing: 2,
  searching: 3,
  evaluating: 4,
  hiring: 5,
  executing: 6,
  settling: 7,
  completed: 9,
  failed: -1,
};

function detailFor(key: string, state: RunState): string | null {
  switch (key) {
    case "decomposing":
      return state.subtasks.length
        ? `${state.subtasks.length} subtasks`
        : null;
    case "searching": {
      const entries = Object.entries(state.searched);
      if (!entries.length) return null;
      return entries
        .map(([cap, n]) => `${n} ${cap.replace("_search", "").replace("_conversion", "")}`)
        .join(" · ");
    }
    case "hiring": {
      const hired = Object.values(state.tasks).filter((t) => t.agent_id);
      if (!hired.length) return null;
      return hired
        .map((t) => `${t.agent_id} ${t.price?.toFixed(2)}`)
        .join(" · ");
    }
    case "executing": {
      const tasks = Object.values(state.tasks);
      if (!tasks.length) return null;
      const done = tasks.filter(
        (t) => t.status === "completed" || t.status === "failed"
      ).length;
      return `${done}/${tasks.length} done`;
    }
    case "settling":
      return state.transfers.length
        ? `${state.spent.toFixed(2)} credits settled`
        : null;
    case "itinerary":
      return state.result ? "ready" : null;
    default:
      return null;
  }
}

export function Pipeline({ state }: { state: RunState }) {
  const activeIdx = STAGE_NODE_INDEX[state.stage];
  const failed = state.stage === "failed";
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
        Pipeline
      </h2>
      <ol>
        {NODES.map((node, i) => {
          const done =
            state.stage === "completed" ? true : i < activeIdx;
          const active = !failed && i === activeIdx;
          const detail = detailFor(node.key, state);
          return (
            <li key={node.key} className="relative pl-6 pb-4 last:pb-0">
              {i < NODES.length - 1 && (
                <span
                  className={`absolute left-[5px] top-3 bottom-0 w-px ${
                    done ? "bg-emerald-700" : "bg-zinc-800"
                  }`}
                />
              )}
              <span
                className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${
                  active
                    ? "bg-amber-400 animate-pulse"
                    : done
                      ? "bg-emerald-500"
                      : "bg-zinc-700"
                }`}
              />
              <div
                className={`text-sm ${done || active ? "text-zinc-200" : "text-zinc-600"}`}
              >
                {node.label}
              </div>
              {detail && (
                <div className="text-xs text-zinc-500 font-mono truncate">
                  {detail}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {failed && (
        <div className="mt-2 text-xs text-red-400 font-mono">
          FAILED: {state.error}
        </div>
      )}
    </div>
  );
}
