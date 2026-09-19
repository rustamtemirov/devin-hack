"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { AgentProfile } from "@/protocol";
import { Badge, Empty } from "./ui";
import { CAP_COLOR, capMonogram } from "./cap";
import { useDrawer } from "@/lib/drawer";
import type { Candidate, RunState } from "@/lib/run-state";

const SEGMENT_COLORS: Record<string, string> = {
  rating: "#818cf8",
  success: "#34d399",
  price: "#fbbf24",
  latency: "#22d3ee",
  fit: "#f472b6",
};

function ScoreDelta({ delta }: { delta?: number }) {
  if (delta === undefined || Math.abs(delta) < 0.00005) return null;
  const up = delta > 0;
  return (
    <span
      className={`font-mono tabular-nums text-[10px] ${up ? "text-emerald-400" : "text-red-400"}`}
      title={`vs previous run: ${up ? "+" : "−"}${Math.abs(delta).toFixed(4)}`}
    >
      {up ? "+" : "−"}
      {Math.abs(delta).toFixed(4)}
    </span>
  );
}

function CandidateRow({
  c,
  agent,
  cap,
  index,
  prevScore,
}: {
  c: Candidate;
  agent?: AgentProfile;
  cap: string;
  index: number;
  prevScore?: number;
}) {
  const reduce = useReducedMotion();
  const drawer = useDrawer();
  const color = CAP_COLOR[cap] ?? "#818cf8";
  const segs = Object.entries(c.breakdown).filter(([k]) => k !== "eligible");
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.25, delay: index * 0.03 }}
      data-testid={c.hired ? "candidate-hired" : "candidate"}
      className={`relative flex items-center gap-2 h-8 rounded-md border px-2 ${
        c.hired
          ? "border-emerald-600 ring-1 ring-emerald-600"
          : "border-[var(--hairline)] bg-zinc-900/30"
      } ${c.eligible ? "" : "opacity-40"}`}
    >
      <button
        onClick={() => drawer.open(c.agent_id)}
        className="grid h-6 w-6 place-items-center rounded text-[9px] font-bold shrink-0"
        style={{ backgroundColor: `${color}22`, color }}
        title={c.agent_id}
      >
        {capMonogram(cap)}
      </button>
      <button
        onClick={() => drawer.open(c.agent_id)}
        className="text-xs font-medium truncate max-w-36 hover:text-indigo-300 text-left"
      >
        {agent?.name ?? c.agent_id}
      </button>
      {c.hired && (
        <motion.span
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={
            reduce
              ? { duration: 0 }
              : { type: "spring", stiffness: 300, damping: 15 }
          }
          className="shrink-0"
        >
          <Badge tone="emerald">HIRED</Badge>
        </motion.span>
      )}
      <span className="text-[10px] text-zinc-600 font-mono truncate hidden md:inline">
        {c.agent_id}
      </span>
      <span className="text-[11px] text-zinc-400 font-mono tabular-nums shrink-0">
        {(agent?.pricing.amount ?? 0).toFixed(2)}
      </span>
      <span className="text-[11px] text-zinc-500 font-mono tabular-nums shrink-0">
        ★{agent?.reputation.rating.toFixed(1) ?? "?"}
      </span>
      <span className="text-[11px] text-zinc-500 font-mono tabular-nums shrink-0 hidden sm:inline">
        {agent ? Math.round(agent.reputation.success_rate * 100) : "?"}%
      </span>
      <div
        className="h-2 flex-1 min-w-10 rounded bg-zinc-800 overflow-hidden"
        title={segs.map(([k, v]) => `${k}: ${v}`).join("  ")}
      >
        <motion.div
          className="h-full"
          style={{ backgroundColor: color }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${Math.min(100, c.score * 100)}%` }}
          transition={{ duration: reduce ? 0 : 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="font-mono tabular-nums text-[11px] text-zinc-300 shrink-0">
        {c.score.toFixed(4)}
      </span>
      <ScoreDelta
        delta={prevScore !== undefined ? c.score - prevScore : undefined}
      />
      {!c.eligible && <Badge tone="red">over budget</Badge>}
    </motion.div>
  );
}

function Section({
  cap,
  cands,
  searched,
  budget,
  agents,
  prevScores,
}: {
  cap: string;
  cands: Candidate[];
  searched?: number;
  budget: string;
  agents: Record<string, AgentProfile>;
  prevScores?: Record<string, number>;
}) {
  const hired = cands.find((c) => c.hired);
  const [expanded, setExpanded] = useState(false);
  const runnerUp = cands.find((c) => c.eligible && !c.hired);
  const collapsed = !!hired && !expanded;
  const visible = collapsed && hired ? [hired] : cands;

  return (
    <div className="card-surface px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <Badge tone="indigo">{cap}</Badge>
        <span className="text-[11px] text-zinc-500 font-mono">
          {searched ?? cands.length} candidates · budget {budget} cr
        </span>
        {hired && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300 font-mono"
          >
            {expanded ? "▾ collapse" : "▸ all candidates"}
          </button>
        )}
        {!hired && (
          <span className="ml-auto hidden lg:flex gap-1.5 text-[9px] text-zinc-600">
            {Object.entries(SEGMENT_COLORS).map(([k, col]) => (
              <span key={k} className="flex items-center gap-0.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: col }}
                />
                {k}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <AnimatePresence>
          {visible.map((c, idx) => (
            <CandidateRow
              key={c.agent_id}
              c={c}
              agent={agents[c.agent_id]}
              cap={cap}
              index={idx}
              prevScore={prevScores?.[c.agent_id]}
            />
          ))}
        </AnimatePresence>
      </div>
      {collapsed && runnerUp && (
        <div className="text-[10px] text-zinc-600 font-mono mt-1">
          vs {cands.length - 1} others — best runner-up{" "}
          {agents[runnerUp.agent_id]?.name ?? runnerUp.agent_id}{" "}
          {runnerUp.score.toFixed(3)}
        </div>
      )}
    </div>
  );
}

export function Candidates({
  state,
  agents,
  onRunDemo,
  previousScores,
}: {
  state: RunState;
  agents: Record<string, AgentProfile>;
  onRunDemo?: () => void;
  previousScores?: Record<string, Record<string, number>>;
}) {
  if (!state.subtasks.length) {
    return (
      <Empty
        glyph="◈"
        title="An economy for autonomous agents"
        hint="Discovery · Delegation · Permissions · Payment · Reputation"
      >
        {onRunDemo && (
          <button
            onClick={onRunDemo}
            className="rounded bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-sm font-medium"
          >
            Run the Tokyo demo
          </button>
        )}
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {state.subtasks.map((sub, i) => (
        <Section
          key={i}
          cap={sub.capability}
          cands={state.candidates[sub.capability] ?? []}
          searched={state.searched[sub.capability]}
          budget={(sub.budget_share * (state.budget ?? 0)).toFixed(2)}
          agents={agents}
          prevScores={previousScores?.[sub.capability]}
        />
      ))}
    </div>
  );
}
