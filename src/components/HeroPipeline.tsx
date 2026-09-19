"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { RunState, Stage } from "@/lib/run-state";
import { shortCap } from "./cap";

interface NodeDef {
  key: string;
  label: string;
  glyph: string;
}

const NODES: NodeDef[] = [
  { key: "user", label: "USER", glyph: "US" },
  { key: "orchestrator", label: "ORCHESTRATOR", glyph: "OR" },
  { key: "market", label: "MARKET", glyph: "MK" },
  { key: "agents", label: "AGENTS", glyph: "AG" },
  { key: "settlement", label: "SETTLEMENT", glyph: "ST" },
  { key: "result", label: "RESULT", glyph: "RS" },
];

const STAGE_NODE_INDEX: Record<Stage, number> = {
  idle: -1,
  started: 1,
  decomposing: 1,
  searching: 2,
  evaluating: 2,
  hiring: 2,
  executing: 3,
  settling: 4,
  completed: 5,
  failed: -1,
};

function detailFor(key: string, state: RunState): string | null {
  switch (key) {
    case "user":
      return state.objective ? "objective set" : null;
    case "orchestrator":
      return state.subtasks.length
        ? `${state.subtasks.length} subtasks`
        : state.stage === "decomposing" || state.stage === "started"
          ? "planning…"
          : null;
    case "market": {
      const entries = Object.entries(state.searched);
      if (entries.length)
        return entries
          .map(([cap, n]) => `${n} ${shortCap(cap)}`)
          .join(" · ");
      const hired = Object.values(state.tasks).filter((t) => t.agent_id);
      return hired.length ? `${hired.length} hired` : null;
    }
    case "agents": {
      const tasks = Object.values(state.tasks);
      if (!tasks.length) return null;
      const hired = tasks.filter((t) => t.agent_id).length;
      const done = tasks.filter(
        (t) => t.status === "completed" || t.status === "failed"
      ).length;
      return `${hired} hired · ${done}/${tasks.length} done`;
    }
    case "settlement":
      return state.transfers.length
        ? `${state.spent.toFixed(2)} cr settled`
        : null;
    case "result":
      return state.result ? "ready" : null;
    default:
      return null;
  }
}

function NodeCard({
  node,
  state: st,
  detail,
}: {
  node: NodeDef;
  state: "pending" | "active" | "done";
  detail: string | null;
}) {
  const ring =
    st === "active"
      ? "ring-2 ring-amber-400/70 shadow-[0_0_18px_rgba(251,191,36,.25)]"
      : st === "done"
        ? "ring-2 ring-emerald-500/60"
        : "ring-1 ring-[var(--hairline)]";
  return (
    <div
      className={`card-surface flex-1 min-w-[150px] px-3 py-2 ${ring} ${st === "pending" ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold shrink-0 ${
            st === "done"
              ? "bg-emerald-500/15 text-emerald-300"
              : st === "active"
                ? "bg-amber-400/15 text-amber-300"
                : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {node.glyph}
        </span>
        <span className="text-[13px] font-semibold tracking-wide text-zinc-200 truncate">
          {node.label}
        </span>
      </div>
      <div className="mt-1 text-xs font-mono text-zinc-500 leading-tight line-clamp-2">
        {detail}
      </div>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-0.5 w-6 self-center bg-zinc-800 rounded shrink-0">
      {active && !reduce && (
        <motion.span
          className="absolute -top-[3px] h-2 w-2 rounded-full bg-amber-400"
          initial={{ x: -2, opacity: 1 }}
          animate={{ x: 22, opacity: [1, 1, 0] }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

export function HeroPipeline({ state }: { state: RunState }) {
  const activeIdx = STAGE_NODE_INDEX[state.stage];
  const failed = state.stage === "failed";
  return (
    <div className="overflow-x-auto pb-1 flex-1" data-testid="hero-pipeline">
      <div className="flex gap-0 items-stretch min-w-max w-full">
        {NODES.map((node, i) => {
          const nodeState =
            state.stage === "completed" || i < activeIdx
              ? "done"
              : i === activeIdx && !failed
                ? "active"
                : "pending";
          return (
            <div key={node.key} className="flex items-stretch flex-1 min-w-0">
              <NodeCard
                node={node}
                state={nodeState}
                detail={detailFor(node.key, state)}
              />
              {i < NODES.length - 1 && (
                <Connector active={i + 1 === activeIdx && !failed} />
              )}
            </div>
          );
        })}
      </div>
      {failed && (
        <div className="mt-2 text-xs text-red-400 font-mono">
          FAILED: {state.error}
        </div>
      )}
    </div>
  );
}
