"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Pipeline } from "@/components/Pipeline";
import { Candidates } from "@/components/Candidates";
import { MessageLog } from "@/components/MessageLog";
import { Ledger } from "@/components/Ledger";
import { PermissionLog } from "@/components/PermissionLog";
import { Reputation } from "@/components/Reputation";
import { Itinerary } from "@/components/Itinerary";
import { useRun } from "@/lib/use-run";

export default function DemoPage() {
  const { state, start, reset, replaying, agents, wallets } = useRun();
  const [objective, setObjective] = useState(
    "Plan a 4-day trip to Tokyo under €1,200."
  );
  const [budget, setBudget] = useState("2");

  const canRun =
    state.stage === "idle" ||
    state.stage === "completed" ||
    state.stage === "failed";
  const runStartTs = state.messages[0]?.ts;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <Nav />

      {/* Objective bar */}
      <div className="flex gap-2 items-center mb-5 flex-wrap">
        <input
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="flex-1 min-w-64 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm"
          placeholder="Describe the trip…"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.5"
            min="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-2 text-sm font-mono"
          />
          <span className="text-xs text-zinc-500">credits</span>
        </div>
        <button
          onClick={() => start(objective, Number(budget))}
          disabled={!canRun}
          className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 px-5 py-2 text-sm font-medium"
        >
          {canRun ? "Run" : "Running…"}
        </button>
        <button
          onClick={reset}
          className="rounded border border-zinc-700 hover:border-zinc-500 px-4 py-2 text-sm"
        >
          Reset
        </button>
        {state.planSource && (
          <span
            className={`rounded px-2 py-1 text-xs font-mono ${
              state.planSource === "llm"
                ? "bg-indigo-900 text-indigo-300"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {state.planSource === "llm" ? "LLM plan" : "fallback plan"}
          </span>
        )}
        {replaying && (
          <span className="text-xs text-amber-400 font-mono">replaying…</span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_360px] gap-4">
        {/* Left: pipeline */}
        <div>
          <Pipeline state={state} />
        </div>

        {/* Center: candidates + messages */}
        <div className="flex flex-col gap-4 min-w-0">
          <Candidates state={state} agents={agents} />
          <MessageLog
            messages={state.messages}
            agents={agents}
            runStartTs={runStartTs}
          />
        </div>

        {/* Right: ledger / permissions / reputation */}
        <div className="flex flex-col gap-4">
          <Ledger
            orchestratorBalance={wallets.orchestrator}
            transfers={state.transfers}
            spent={state.spent}
          />
          <PermissionLog permissions={state.permissions} agents={agents} />
          <Reputation reputation={state.reputation} agents={agents} />
        </div>
      </div>

      {/* Bottom: itinerary */}
      <Itinerary result={state.result} />
    </div>
  );
}
