"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { AgentProfile, MarketplaceEvent } from "@/protocol";
import { parseSseStream } from "./sse-client";
import {
  applyEvent,
  initialRunState,
  type RunState,
} from "./run-state";

type WalletMap = Record<string, number>;
type Action = { kind: "event"; event: MarketplaceEvent } | { kind: "reset" };

function reducer(state: RunState, action: Action): RunState {
  if (action.kind === "reset") return { ...initialRunState };
  return applyEvent(state, action.event);
}

export function useRun() {
  const [state, dispatch] = useReducer(reducer, { ...initialRunState });
  const [replaying, setReplaying] = useState(false);
  const [agents, setAgents] = useState<Record<string, AgentProfile>>({});
  const [wallets, setWallets] = useState<WalletMap>({});
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const fetchWallets = useCallback(async () => {
    const res = await fetch("/api/ledger/wallets");
    const data = await res.json();
    const map: WalletMap = {};
    for (const w of data.wallets ?? []) map[w.agent_id] = w.balance;
    setWallets(map);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetch("/api/agents?include_orchestrator=1")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, AgentProfile> = {};
        for (const a of d.agents ?? []) map[a.id] = a;
        setAgents(map);
      });
    fetchWallets();

    const runId = new URLSearchParams(window.location.search).get("run");
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    if (runId) {
      setReplaying(true);
      const load = async () => {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) {
          setReplaying(false);
          return;
        }
        const detail = await res.json();
        if (!mountedRef.current) return;
        dispatch({ kind: "reset" });
        for (const e of detail.events ?? []) {
          dispatch({ kind: "event", event: e as MarketplaceEvent });
        }
        const status = detail.run?.status;
        if (status === "running" || status === "pending") {
          if (!pollTimer) pollTimer = setInterval(load, 1500);
        } else {
          setReplaying(false);
          if (pollTimer) clearInterval(pollTimer);
        }
      };
      load();
    }
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [fetchWallets]);

  const applyTransfer = useCallback((from: string, to: string, amt: number) => {
    setWallets((w) => ({
      ...w,
      [from]: Math.round(((w[from] ?? 0) - amt) * 1e4) / 1e4,
      [to]: Math.round(((w[to] ?? 0) + amt) * 1e4) / 1e4,
    }));
  }, []);

  const start = useCallback(
    async (objective: string, budget: number) => {
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      dispatch({ kind: "reset" });

      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objective, budget }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) return;
      const runId = res.headers.get("x-run-id");
      if (runId) history.replaceState(null, "", `?run=${runId}`);
      await parseSseStream(res.body, (type, data) => {
        if (type === "run.created") return;
        const e = data as MarketplaceEvent;
        if (mountedRef.current) dispatch({ kind: "event", event: e });
        if (e.type === "ledger.transfer") {
          applyTransfer(e.from, e.to, e.amount);
        }
      });
      await fetchWallets();
    },
    [applyTransfer, fetchWallets]
  );

  const reset = useCallback(async () => {
    abortRef.current?.abort();
    await fetch("/api/admin/reset", { method: "POST" });
    history.replaceState(null, "", window.location.pathname);
    dispatch({ kind: "reset" });
    await fetchWallets();
  }, [fetchWallets]);

  return { state, start, reset, replaying, agents, wallets };
}
