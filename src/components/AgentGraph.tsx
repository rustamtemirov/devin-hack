"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { AgentProfile } from "@/protocol";
import { Card } from "./ui";
import { CAP_COLOR, capMonogram, shortCap } from "./cap";
import { useDrawer } from "@/lib/drawer";
import type { RunState } from "@/lib/run-state";

const CX = 400;
const CY = 160;
const W = 800;
const H = 260;

interface Pulse {
  key: number;
  agentId: string;
  out: boolean; // orchestrator → agent
}
interface Coin {
  key: number;
  agentId: string;
  amount: number;
}

export function AgentGraph({
  state,
  agents,
  balance,
}: {
  state: RunState;
  agents: Record<string, AgentProfile>;
  balance?: number;
}) {
  const reduce = useReducedMotion();
  const drawer = useDrawer();
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [coins, setCoins] = useState<Coin[]>([]);
  const seenMsgs = useRef(0);
  const seenTransfers = useRef(0);
  const keyRef = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // map capability → hired agent / task
  const hiredByCap: Record<string, { agentId: string; status: string; price?: number }> = {};
  for (const t of Object.values(state.tasks)) {
    if (t.agent_id && t.capability)
      hiredByCap[t.capability] = {
        agentId: t.agent_id,
        status: t.status,
        price: t.price,
      };
  }

  // node positions on an upward arc
  const n = state.subtasks.length;
  const nodes = state.subtasks.map((sub, i) => {
    const angle = n > 1 ? 200 + (i * 140) / (n - 1) : 270;
    const rad = (angle * Math.PI) / 180;
    return {
      cap: sub.capability,
      x: CX + 300 * Math.cos(rad),
      y: CY + 110 * Math.sin(rad),
      hired: hiredByCap[sub.capability],
    };
  });
  const posByAgent = new Map<string, { x: number; y: number }>();
  for (const nd of nodes) {
    if (nd.hired) posByAgent.set(nd.hired.agentId, { x: nd.x, y: nd.y });
  }

  const deniedAgents = new Set(
    state.permissions.filter((p) => p.decision === "denied").map((p) => p.agent_id)
  );

  // diff messages → edge pulses
  useEffect(() => {
    const fresh = state.messages.slice(seenMsgs.current);
    seenMsgs.current = state.messages.length;
    if (!fresh.length || reduce) return;
    const add: Pulse[] = [];
    for (const m of fresh) {
      const agentId = m.from === "orchestrator" ? m.to : m.from;
      if (!posByAgent.has(agentId)) continue;
      if (m.to === "user") continue;
      add.push({ key: ++keyRef.current, agentId, out: m.from === "orchestrator" });
    }
    if (!add.length) return;
    setPulses((p) => [...p, ...add]);
    const t = setTimeout(() => {
      setPulses((p) => p.filter((x) => !add.some((a) => a.key === x.key)));
      timers.current.delete(t);
    }, 750);
    timers.current.add(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages, reduce]);

  // diff transfers → coins
  useEffect(() => {
    const fresh = state.transfers.slice(seenTransfers.current);
    seenTransfers.current = state.transfers.length;
    if (!fresh.length) return;
    const add: Coin[] = [];
    for (const t of fresh) {
      if (!posByAgent.has(t.to)) continue;
      add.push({ key: ++keyRef.current, agentId: t.to, amount: t.amount });
    }
    if (!add.length) return;
    if (reduce) {
      setCoins([]);
      return;
    }
    setCoins((c) => [...c, ...add]);
    const t = setTimeout(() => {
      setCoins((c) => c.filter((x) => !add.some((a) => a.key === x.key)));
      timers.current.delete(t);
    }, 1000);
    timers.current.add(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.transfers, reduce]);

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    []
  );

  const statusColor = (s?: string) =>
    s === "completed"
      ? "#34d399"
      : s === "failed"
        ? "#f87171"
        : s === "running" || s === "hired"
          ? "#fbbf24"
          : "#52525b";

  return (
    <Card title="Agent graph" className="p-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 260 }}
        data-testid="agent-graph"
      >
        {/* edges */}
        {nodes.map((nd) => {
          const active = pulses.some((p) => p.agentId === nd.hired?.agentId);
          return (
            <line
              key={nd.cap}
              x1={CX}
              y1={CY}
              x2={nd.x}
              y2={nd.y}
              stroke={active ? "#818cf8" : "rgba(255,255,255,.12)"}
              strokeWidth={active ? 1.5 : 1}
            />
          );
        })}

        {/* travelling message dots */}
        {pulses.map((p) => {
          const pos = posByAgent.get(p.agentId);
          if (!pos) return null;
          const [x1, y1, x2, y2] = p.out
            ? [CX, CY, pos.x, pos.y]
            : [pos.x, pos.y, CX, CY];
          return (
            <motion.circle
              key={p.key}
              r={3}
              fill="#818cf8"
              initial={{ cx: x1, cy: y1, opacity: 0 }}
              animate={{ cx: x2, cy: y2, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
          );
        })}

        {/* coins */}
        {coins.map((c) => {
          const pos = posByAgent.get(c.agentId);
          if (!pos) return null;
          return (
            <g key={c.key}>
              <motion.circle
                r={5}
                fill="#34d399"
                initial={{ cx: CX, cy: CY, opacity: 0 }}
                animate={{ cx: pos.x, cy: pos.y, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
              />
              <motion.text
                x={pos.x + 24}
                y={pos.y - 22}
                fontSize={11}
                fill="#34d399"
                fontFamily="var(--font-jbmono), monospace"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.2 }}
              >
                +{c.amount.toFixed(2)}
              </motion.text>
            </g>
          );
        })}

        {/* orchestrator node */}
        <circle cx={CX} cy={CY} r={26} fill="#1e1b4b" stroke="#818cf8" strokeWidth={2} />
        <text
          x={CX}
          y={CY + 4}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill="#c7d2fe"
        >
          OR
        </text>
        <text x={CX} y={CY + 42} textAnchor="middle" fontSize={11} fill="#a5b4fc">
          TravelOrchestrator
        </text>
        {balance !== undefined && (
          <text
            x={CX}
            y={CY + 56}
            textAnchor="middle"
            fontSize={10}
            fill="#71717a"
            fontFamily="var(--font-jbmono), monospace"
          >
            {balance.toFixed(2)} cr
          </text>
        )}

        {/* subtask nodes */}
        {nodes.map((nd) => {
          const color = CAP_COLOR[nd.cap] ?? "#818cf8";
          const hired = nd.hired;
          const agent = hired ? agents[hired.agentId] : undefined;
          const denied = hired ? deniedAgents.has(hired.agentId) : false;
          const candCount = state.searched[nd.cap];
          return (
            <g
              key={nd.cap}
              onClick={() => hired && drawer.open(hired.agentId)}
              style={{ cursor: hired ? "pointer" : "default" }}
            >
              {denied && (
                <circle
                  cx={nd.x}
                  cy={nd.y}
                  r={24}
                  fill="none"
                  stroke="#f87171"
                  strokeWidth={2}
                  className="animate-[flashRed_1.5s]"
                />
              )}
              <circle
                cx={nd.x}
                cy={nd.y}
                r={20}
                fill={hired ? `${color}26` : "#18181b"}
                stroke={hired ? color : "#3f3f46"}
                strokeWidth={hired ? 2 : 1}
                strokeDasharray={hired ? undefined : "3 3"}
              />
              <text
                x={nd.x}
                y={nd.y + 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill={hired ? color : "#71717a"}
              >
                {capMonogram(nd.cap)}
              </text>
              {/* status dot */}
              <circle
                cx={nd.x + 15}
                cy={nd.y - 15}
                r={3.5}
                fill={statusColor(hired?.status)}
              />
              {denied && (
                <g transform={`translate(${nd.x - 26}, ${nd.y - 26})`}>
                  <path
                    d="M6 0l5 2v4c0 3.6-2.2 6.8-5 8-2.8-1.2-5-4.4-5-8V2l5-2z"
                    fill="#7f1d1d"
                    stroke="#f87171"
                    strokeWidth={1}
                  />
                </g>
              )}
              <text
                x={nd.x}
                y={nd.y + 34}
                textAnchor="middle"
                fontSize={10}
                fill={hired ? "#e4e4e7" : "#71717a"}
              >
                {hired ? (agent?.name ?? hired.agentId) : shortCap(nd.cap)}
              </text>
              <text
                x={nd.x}
                y={nd.y + 47}
                textAnchor="middle"
                fontSize={9}
                fill="#52525b"
                fontFamily="var(--font-jbmono), monospace"
              >
                {hired
                  ? `${hired.price?.toFixed(2) ?? ""} cr · ${hired.status}`
                  : candCount !== undefined
                    ? `${candCount} candidates`
                    : "searching…"}
              </text>
            </g>
          );
        })}
      </svg>
    </Card>
  );
}
