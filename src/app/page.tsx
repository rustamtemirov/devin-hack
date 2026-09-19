"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { HeroPipeline } from "@/components/HeroPipeline";
import { Counters } from "@/components/Counters";
import { AgentGraph } from "@/components/AgentGraph";
import { Candidates } from "@/components/Candidates";
import { MessageLog } from "@/components/MessageLog";
import { Ledger } from "@/components/Ledger";
import { PermissionLog } from "@/components/PermissionLog";
import { Reputation } from "@/components/Reputation";
import { Itinerary } from "@/components/Itinerary";
import { Toasts } from "@/components/Toast";
import { Card } from "@/components/ui";
import { useRun } from "@/lib/use-run";

const DEFAULT_OBJECTIVE = "Plan a 4-day trip to Tokyo under €1,200.";

export default function DemoPage() {
  const { state, start, reset, replaying, agents, wallets, previousScores } =
    useRun();
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE);
  const [budget, setBudget] = useState("2");

  const canRun =
    state.stage === "idle" ||
    state.stage === "completed" ||
    state.stage === "failed";
  const hiredCount = Object.values(state.candidates)
    .flat()
    .filter((c) => c.hired).length;
  const eventCount =
    state.messages.length +
    state.transfers.length +
    state.permissions.length +
    Object.keys(state.tasks).length;

  const topWallets = Object.entries(wallets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="min-h-screen p-4">
      <Nav />
      <Toasts permissions={state.permissions} agents={agents} />

      {/* Objective bar — single 40px row */}
      <div className="flex gap-2 items-center h-10 mb-3">
        <input
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="flex-1 min-w-40 h-9 bg-[var(--card)] border border-[var(--hairline)] rounded-lg px-3 text-sm"
          placeholder="Describe the trip…"
        />
        <input
          type="number"
          step="0.5"
          min="0"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="w-16 h-9 bg-[var(--card)] border border-[var(--hairline)] rounded-lg px-2 text-sm font-mono tabular-nums"
        />
        <span className="text-xs text-zinc-500">cr</span>
        <button
          onClick={() => start(objective, Number(budget))}
          disabled={!canRun}
          className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 px-5 text-sm font-medium"
          data-testid="run-button"
        >
          {canRun ? "Run" : "Running…"}
        </button>
        <button
          onClick={reset}
          className="h-9 rounded-lg border border-[var(--hairline)] hover:border-zinc-500 px-4 text-sm"
        >
          Reset
        </button>
        {state.planSource && (
          <span
            className={`rounded-md px-2 py-1 text-xs font-mono ${
              state.planSource === "llm"
                ? "bg-indigo-500/15 text-indigo-300"
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

      {/* Hero pipeline + counters */}
      <div className="flex gap-3 mb-3 items-stretch">
        <HeroPipeline state={state} />
        <Counters
          balance={wallets.orchestrator}
          spent={state.spent}
          hired={hiredCount}
          events={eventCount}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3">
        <div className="flex flex-col gap-3 min-w-0">
          <AgentGraph
            state={state}
            agents={agents}
            balance={wallets.orchestrator}
          />
          <Candidates
            state={state}
            agents={agents}
            onRunDemo={() => start(DEFAULT_OBJECTIVE, Number(budget))}
            previousScores={previousScores}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Ledger
            orchestratorBalance={wallets.orchestrator}
            transfers={state.transfers}
            spent={state.spent}
          />
          <PermissionLog permissions={state.permissions} agents={agents} />
          <MessageLog
            messages={state.messages}
            agents={agents}
            runStartTs={state.startedTs}
          />
          <Reputation reputation={state.reputation} agents={agents} />
          {state.stage === "idle" && topWallets.length > 0 && (
            <Card title="Wallets">
              <div className="flex flex-col gap-1">
                {topWallets.map(([id, bal]) => (
                  <div key={id} className="text-xs flex justify-between">
                    <span className="text-zinc-300 font-mono">{id}</span>
                    <span className="font-mono tabular-nums text-zinc-400">
                      {bal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <Itinerary result={state.result} />
    </div>
  );
}
