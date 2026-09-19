"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { AgentProfile } from "@/protocol";
import { Badge } from "./ui";
import { CAP_COLOR, capMonogram } from "./cap";

interface AgentDetail {
  profile: AgentProfile;
  wallet: { balance: number };
  reputation: {
    rating: number;
    success_rate: number;
    completed_tasks: number;
    failed_tasks: number;
    avg_latency_ms: number;
  };
  recent_tasks: {
    id: string;
    run_id: string;
    capability: string;
    status: string;
    cost: number;
    finished_at: string | null;
  }[];
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function AgentDrawer({
  agentId,
  onClose,
}: {
  agentId: string | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    setDetail(null);
    setError(null);
    setShowJson(false);
    const ctrl = new AbortController();
    fetch(`/api/agents/${agentId}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setDetail)
      .catch((e) => {
        if (e.name !== "AbortError") setError(String(e.message ?? e));
      });
    return () => ctrl.abort();
  }, [agentId]);

  useEffect(() => {
    if (!agentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [agentId, onClose]);

  const cap = detail?.profile.capabilities[0];
  const color = CAP_COLOR[cap ?? ""] ?? "#818cf8";

  return (
    <AnimatePresence>
      {agentId && (
        <>
          <motion.div
            key="overlay"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={onClose}
          />
          <motion.aside
            key="drawer"
            data-testid="agent-drawer"
            initial={reduce ? false : { x: 420 }}
            animate={{ x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: 420 }}
            transition={
              reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 32 }
            }
            className="fixed top-0 right-0 bottom-0 z-[61] w-[420px] max-w-full bg-[var(--card)] border-l border-[var(--hairline)] overflow-y-auto p-5 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-lg text-xs font-bold"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {capMonogram(cap ?? "")}
                </span>
                <div>
                  <div className="font-semibold">
                    {detail?.profile.name ?? agentId}
                  </div>
                  <div className="text-xs text-zinc-500 font-mono">{agentId}</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-200 text-lg leading-none px-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {error && <p className="text-xs text-red-400">Failed to load: {error}</p>}
            {!detail && !error && (
              <p className="text-xs text-zinc-500">Loading…</p>
            )}
            {detail && (
              <>
                <div className="flex gap-1.5 flex-wrap">
                  {detail.profile.capabilities.map((c) => (
                    <Badge key={c} tone="indigo">{c}</Badge>
                  ))}
                  <Badge tone="emerald">
                    {detail.profile.pricing.amount.toFixed(2)} cr
                  </Badge>
                </div>
                <Section title="Wallet">
                  <div className="font-mono tabular-nums text-lg">
                    {detail.wallet.balance.toFixed(2)}{" "}
                    <span className="text-xs text-zinc-500">credits</span>
                  </div>
                </Section>
                <Section title="Reputation">
                  <div className="text-xs font-mono tabular-nums text-zinc-300 flex flex-col gap-0.5">
                    <span>★ {detail.reputation.rating.toFixed(2)}</span>
                    <span>
                      success {(detail.reputation.success_rate * 100).toFixed(1)}% ·{" "}
                      {detail.reputation.completed_tasks} done ·{" "}
                      {detail.reputation.failed_tasks} failed
                    </span>
                    <span>avg latency {detail.reputation.avg_latency_ms}ms</span>
                  </div>
                </Section>
                <Section title="Permissions required">
                  {detail.profile.permissions_required.length === 0 ? (
                    <span className="text-xs text-zinc-600">none</span>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {detail.profile.permissions_required.map((p) => (
                        <Badge key={p} tone="amber">{p}</Badge>
                      ))}
                    </div>
                  )}
                </Section>
                <Section title="Requirements">
                  {detail.profile.requirements.length === 0 ? (
                    <span className="text-xs text-zinc-600">none</span>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {detail.profile.requirements.map((r) => (
                        <Badge key={r} tone="zinc">{r}</Badge>
                      ))}
                    </div>
                  )}
                </Section>
                <Section title="Recent tasks">
                  {detail.recent_tasks.length === 0 ? (
                    <span className="text-xs text-zinc-600">none yet</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {detail.recent_tasks.map((t) => (
                        <div
                          key={t.id}
                          className="text-xs font-mono tabular-nums flex justify-between gap-2"
                        >
                          <span className="text-zinc-300 truncate">
                            {t.capability}
                            <span className="text-zinc-600">
                              {" "}
                              · {t.run_id.replace(/^run_/, "").slice(0, 6)} ·{" "}
                              {relTime(t.finished_at)}
                            </span>
                          </span>
                          <span
                            className={
                              t.status === "completed"
                                ? "text-emerald-400"
                                : t.status === "failed"
                                  ? "text-red-400"
                                  : "text-amber-300"
                            }
                          >
                            {t.status} · {t.cost.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
                <div>
                  <button
                    onClick={() => setShowJson((v) => !v)}
                    className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
                  >
                    Profile JSON (amp/0.1) {showJson ? "▾" : "▸"}
                  </button>
                  {showJson && (
                    <pre className="mt-1.5 text-[10px] font-mono text-zinc-400 bg-zinc-900/60 rounded-lg p-3 overflow-auto max-h-64">
                      {JSON.stringify(detail.profile, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
