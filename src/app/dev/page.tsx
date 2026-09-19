"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PERMISSIONS, type AgentProfile } from "@/protocol";

type Wallet = { agent_id: string; name: string; balance: number };
type Txn = {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  taskId: string | null;
  type: string;
  createdAt: string;
};
type RunDetail = {
  run: { id: string; status: string };
  tasks: {
    id: string;
    capability: string;
    workerId: string | null;
    status: string;
    cost: number;
  }[];
  transactions: Txn[];
  permission_events?: {
    agentId: string;
    permission: string;
    decision: string;
    reason: string;
  }[];
  events: { type: string; ts: number; [k: string]: unknown }[];
};

const CAPABILITIES = ["flight_search", "hotel_search", "activity_search"];

const DEFAULT_INPUTS = JSON.stringify(
  {
    destination: "Tokyo",
    travel_dates: "2026-10-01..2026-10-05",
    passport_number: "X123",
    notes: "window seat",
  },
  null,
  2
);

const truncate = (s: string | null | undefined, n = 14) =>
  s ? (s.length > n ? s.slice(0, n) + "…" : s) : "—";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-semibold text-zinc-300 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function JsonPre({ value }: { value: unknown }) {
  if (value === undefined) return null;
  return (
    <pre className="mt-3 max-h-64 overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-400">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function DevConsole() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [changedWallets, setChangedWallets] = useState<Set<string>>(new Set());
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);

  const [transferFrom, setTransferFrom] = useState("orchestrator");
  const [transferTo, setTransferTo] = useState("flight-01");
  const [transferAmount, setTransferAmount] = useState("0.2");
  const [transferResp, setTransferResp] = useState<unknown>();
  const [transferErr, setTransferErr] = useState<string | null>(null);

  const [permission, setPermission] = useState<string>(
    "access_identity_documents"
  );
  const [envelope, setEnvelope] = useState<string[]>([
    "share_destination",
    "share_travel_dates",
  ]);
  const [inputsJson, setInputsJson] = useState(DEFAULT_INPUTS);
  const [permResp, setPermResp] = useState<unknown>();

  const [capability, setCapability] = useState("flight_search");
  const [workerId, setWorkerId] = useState("flight-01");
  const [cost, setCost] = useState("0.2");
  const [simResp, setSimResp] = useState<unknown>();

  const [dCapability, setDCapability] = useState("flight_search");
  const [dWorkerId, setDWorkerId] = useState("flight-01");
  const [dInputs, setDInputs] = useState(
    JSON.stringify(
      {
        origin: "Berlin",
        destination: "Tokyo",
        travel_dates: "2026-10-01..2026-10-05",
        budget: 1200,
        passport_number: "X1234567",
      },
      null,
      2
    )
  );
  const [dBudget, setDBudget] = useState("0.5");
  const [dResp, setDResp] = useState<unknown>();

  const prevBalances = useRef<Map<string, number>>(new Map());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshState = useCallback(async () => {
    const [wRes, tRes] = await Promise.all([
      fetch("/api/ledger/wallets"),
      fetch("/api/ledger/transactions?limit=10"),
    ]);
    const wData = await wRes.json();
    const tData = await tRes.json();
    const next: Wallet[] = wData.wallets ?? [];
    const changed = new Set<string>();
    for (const w of next) {
      const prev = prevBalances.current.get(w.agent_id);
      if (prev !== undefined && prev !== w.balance) changed.add(w.agent_id);
    }
    prevBalances.current = new Map(next.map((w) => [w.agent_id, w.balance]));
    setWallets(next);
    if (changed.size) {
      setChangedWallets(changed);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setChangedWallets(new Set()), 1000);
    }
    setTransactions(tData.transactions ?? []);
  }, []);

  const refreshRun = useCallback(async (id: string) => {
    const res = await fetch(`/api/runs/${id}`);
    if (res.ok) setRunDetail(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/agents?include_orchestrator=1")
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []));
    refreshState();
  }, [refreshState]);

  const post = useCallback(
    async (url: string, body: unknown) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
    []
  );

  const doReset = async () => {
    await post("/api/admin/reset", {});
    setRunId(null);
    setRunDetail(null);
    await refreshState();
  };

  const doTransfer = async () => {
    const { ok, data } = await post("/api/dev/transfer", {
      from: transferFrom,
      to: transferTo,
      amount: Number(transferAmount),
    });
    setTransferResp(data);
    setTransferErr(
      ok ? null : ((data as { error?: { code?: string } })?.error?.code ?? "ERROR")
    );
    await refreshState();
  };

  const doPermissionCheck = async () => {
    let inputs: Record<string, unknown> = {};
    try {
      inputs = JSON.parse(inputsJson);
    } catch {
      setPermResp({ error: "inputs textarea is not valid JSON" });
      return;
    }
    const { data } = await post("/api/dev/permission-check", {
      permission,
      envelope,
      inputs,
    });
    setPermResp(data);
  };

  const doSimulate = async () => {
    const { data } = await post("/api/dev/simulate-task", {
      capability,
      worker_id: workerId,
      cost: Number(cost),
    });
    setSimResp(data);
    const id = (data as { run?: { id?: string } })?.run?.id;
    if (id) {
      setRunId(id);
      await refreshRun(id);
    }
    await refreshState();
  };

  const doDispatch = async () => {
    let inputs: Record<string, unknown> = {};
    try {
      inputs = JSON.parse(dInputs);
    } catch {
      setDResp({ error: "inputs textarea is not valid JSON" });
      return;
    }
    const { data } = await post("/api/dev/dispatch", {
      worker_id: dWorkerId,
      capability: dCapability,
      inputs,
      budget: Number(dBudget),
    });
    setDResp(data);
    const id = (data as { run_id?: string })?.run_id;
    if (id) {
      setRunId(id);
      await refreshRun(id);
    }
    await refreshState();
  };

  const workersForCapability = agents.filter((a) =>
    a.capabilities.includes(capability)
  );
  const dWorkers = agents.filter((a) => a.capabilities.includes(dCapability));

  useEffect(() => {
    const first = workersForCapability[0];
    if (first && !workersForCapability.some((a) => a.id === workerId)) {
      setWorkerId(first.id);
      setCost(String(first.pricing.amount));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capability, agents]);

  useEffect(() => {
    const first = dWorkers[0];
    if (first && !dWorkers.some((a) => a.id === dWorkerId)) {
      setDWorkerId(first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dCapability, agents]);

  const permCheck = (
    permResp as { check?: { decision?: string; reason?: string } } | undefined
  )?.check;
  const permFiltered = (
    permResp as
      | { filtered?: { inputs?: unknown; redacted?: string[] } }
      | undefined
  )?.filtered;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dev Console</h1>
          <p className="text-zinc-500 font-mono text-sm mt-1">
            Bazaar — amp/0.1
          </p>
        </div>
        <Link href="/" className="text-indigo-400 text-sm hover:underline">
          Marketplace →
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <Panel title="Reset">
            <button
              onClick={doReset}
              className="rounded bg-red-900 hover:bg-red-800 px-3 py-1.5 text-sm"
            >
              Reset marketplace (reseed)
            </button>
          </Panel>

          <Panel title="Transfer">
            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={transferFrom}
                onChange={(e) => setTransferFrom(e.target.value)}
                className="bg-zinc-800 rounded px-2 py-1 text-sm"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id}
                  </option>
                ))}
              </select>
              <span className="text-zinc-500">→</span>
              <select
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="bg-zinc-800 rounded px-2 py-1 text-sm"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="bg-zinc-800 rounded px-2 py-1 text-sm w-24"
              />
              <button
                onClick={doTransfer}
                className="rounded bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-sm"
              >
                Transfer
              </button>
            </div>
            {transferErr && (
              <div className="mt-2 text-red-400 font-mono text-sm font-bold">
                {transferErr}
              </div>
            )}
            <JsonPre value={transferResp} />
          </Panel>

          <Panel title="Permission check">
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  permission
                </label>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                  className="bg-zinc-800 rounded px-2 py-1 text-sm"
                >
                  {PERMISSIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  envelope
                </label>
                <div className="grid grid-cols-2 gap-x-3">
                  {PERMISSIONS.map((p) => (
                    <label
                      key={p}
                      className="flex items-center gap-1 text-xs text-zinc-400"
                    >
                      <input
                        type="checkbox"
                        checked={envelope.includes(p)}
                        onChange={(e) =>
                          setEnvelope(
                            e.target.checked
                              ? [...envelope, p]
                              : envelope.filter((x) => x !== p)
                          )
                        }
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <label className="block text-xs text-zinc-500 mt-3 mb-1">
              inputs (JSON)
            </label>
            <textarea
              value={inputsJson}
              onChange={(e) => setInputsJson(e.target.value)}
              rows={5}
              className="w-full bg-zinc-800 rounded px-2 py-1 text-xs font-mono"
            />
            <button
              onClick={doPermissionCheck}
              className="mt-2 rounded bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-sm"
            >
              Check
            </button>
            {permCheck && (
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                    permCheck.decision === "allowed"
                      ? "bg-green-900 text-green-300"
                      : "bg-red-900 text-red-300"
                  }`}
                >
                  {permCheck.decision?.toUpperCase()}
                </span>
                <span className="text-xs text-zinc-400">{permCheck.reason}</span>
              </div>
            )}
            {permFiltered?.redacted && permFiltered.redacted.length > 0 && (
              <div className="mt-1 text-xs text-amber-400">
                redacted: {permFiltered.redacted.join(", ")}
              </div>
            )}
            <JsonPre value={permResp} />
          </Panel>

          <Panel title="Simulate task">
            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={capability}
                onChange={(e) => setCapability(e.target.value)}
                className="bg-zinc-800 rounded px-2 py-1 text-sm"
              >
                {CAPABILITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={workerId}
                onChange={(e) => {
                  setWorkerId(e.target.value);
                  const a = workersForCapability.find(
                    (x) => x.id === e.target.value
                  );
                  if (a) setCost(String(a.pricing.amount));
                }}
                className="bg-zinc-800 rounded px-2 py-1 text-sm"
              >
                {workersForCapability.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} ({a.name})
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="bg-zinc-800 rounded px-2 py-1 text-sm w-24"
              />
              <button
                onClick={doSimulate}
                className="rounded bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-sm"
              >
                Simulate
              </button>
            </div>
            <JsonPre value={simResp} />
          </Panel>

          <Panel title="Dispatch">
            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={dCapability}
                onChange={(e) => setDCapability(e.target.value)}
                className="bg-zinc-800 rounded px-2 py-1 text-sm"
              >
                {CAPABILITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={dWorkerId}
                onChange={(e) => setDWorkerId(e.target.value)}
                className="bg-zinc-800 rounded px-2 py-1 text-sm"
              >
                {dWorkers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} ({a.name})
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={dBudget}
                onChange={(e) => setDBudget(e.target.value)}
                className="bg-zinc-800 rounded px-2 py-1 text-sm w-24"
                title="budget credits"
              />
              <button
                onClick={doDispatch}
                className="rounded bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-sm"
              >
                Dispatch
              </button>
            </div>
            <label className="block text-xs text-zinc-500 mt-3 mb-1">
              inputs (JSON)
            </label>
            <textarea
              value={dInputs}
              onChange={(e) => setDInputs(e.target.value)}
              rows={6}
              className="w-full bg-zinc-800 rounded px-2 py-1 text-xs font-mono"
            />
            {(
              dResp as { response?: { status?: string; error?: { code?: string } } } | undefined
            )?.response && (
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                    (dResp as { response: { status: string } }).response.status === "completed"
                      ? "bg-green-900 text-green-300"
                      : "bg-red-900 text-red-300"
                  }`}
                >
                  {(dResp as { response: { status: string } }).response.status.toUpperCase()}
                </span>
                {(
                  dResp as { response: { error?: { code?: string; message?: string } } }
                ).response.error && (
                  <span className="text-xs text-red-400 font-mono">
                    {
                      (dResp as { response: { error: { code: string; message: string } } })
                        .response.error.code
                    }
                    :{" "}
                    {
                      (dResp as { response: { error: { code: string; message: string } } })
                        .response.error.message
                    }
                  </span>
                )}
              </div>
            )}
            <JsonPre value={dResp} />
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Wallets">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="py-1 font-medium">Agent</th>
                  <th className="py-1 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr
                    key={w.agent_id}
                    className={`border-b border-zinc-900 transition-colors duration-1000 ${
                      changedWallets.has(w.agent_id)
                        ? "bg-yellow-500/20"
                        : ""
                    }`}
                  >
                    <td className="py-1">
                      <span className="font-mono text-xs">{w.agent_id}</span>{" "}
                      <span className="text-zinc-500 text-xs">{w.name}</span>
                    </td>
                    <td className="py-1 text-right font-mono">
                      {w.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Transactions">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="py-1 font-medium">Time</th>
                  <th className="py-1 font-medium">From → To</th>
                  <th className="py-1 font-medium text-right">Amount</th>
                  <th className="py-1 font-medium">Type</th>
                  <th className="py-1 font-medium">Task</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-900">
                    <td className="py-1 font-mono text-zinc-500">
                      {new Date(t.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-1 font-mono">
                      {t.fromAgentId} → {t.toAgentId}
                    </td>
                    <td className="py-1 text-right font-mono">
                      {t.amount.toFixed(4)}
                    </td>
                    <td className="py-1">{t.type}</td>
                    <td className="py-1 font-mono text-zinc-500">
                      {truncate(t.taskId)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Last run">
            {!runId || !runDetail ? (
              <p className="text-zinc-600 text-sm">
                Run a simulation to see details.
              </p>
            ) : (
              <div>
                <div className="text-xs font-mono text-zinc-500 mb-2">
                  {runId} —{" "}
                  <span className="text-zinc-300">{runDetail.run.status}</span>
                </div>
                <table className="w-full text-xs mb-3">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="py-1 font-medium">Task</th>
                      <th className="py-1 font-medium">Capability</th>
                      <th className="py-1 font-medium">Worker</th>
                      <th className="py-1 font-medium">Status</th>
                      <th className="py-1 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runDetail.tasks.map((t) => (
                      <tr key={t.id} className="border-b border-zinc-900">
                        <td className="py-1 font-mono">{truncate(t.id)}</td>
                        <td className="py-1">{t.capability}</td>
                        <td className="py-1 font-mono">
                          {t.workerId ?? "—"}
                        </td>
                        <td className="py-1">{t.status}</td>
                        <td className="py-1 text-right font-mono">
                          {t.cost.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {runDetail.permission_events &&
                  runDetail.permission_events.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-zinc-500 mb-1">
                        Permission events
                      </div>
                      {runDetail.permission_events.map((pe, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs py-0.5"
                        >
                          <span className="font-mono text-zinc-400">
                            {pe.agentId}
                          </span>
                          <span className="font-mono">{pe.permission}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold ${
                              pe.decision === "allowed"
                                ? "bg-green-900 text-green-300"
                                : "bg-red-900 text-red-300"
                            }`}
                          >
                            {pe.decision.toUpperCase()}
                          </span>
                          <span className="text-zinc-500">{pe.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                {runDetail.events.some((e) => e.type === "agent.message") && (
                  <div className="mb-3">
                    <div className="text-xs text-zinc-500 mb-1">Messages</div>
                    {runDetail.events
                      .filter((e) => e.type === "agent.message")
                      .map((e, i) => (
                        <div key={i} className="text-xs py-0.5">
                          <span className="font-mono text-indigo-400">
                            {String(e.from)} → {String(e.to)}
                          </span>
                          <span className="text-zinc-400">
                            {" "}
                            {String(e.content)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {runDetail.events.map((e, i) => (
                    <div
                      key={i}
                      className="rounded bg-zinc-950 px-2 py-1 font-mono text-xs"
                    >
                      <span className="text-indigo-400">{e.type}</span>{" "}
                      <span className="text-zinc-500">
                        {JSON.stringify(
                          Object.fromEntries(
                            Object.entries(e).filter(
                              ([k]) => !["type", "run_id", "ts"].includes(k)
                            )
                          )
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
