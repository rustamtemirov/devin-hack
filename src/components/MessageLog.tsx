"use client";

import { useEffect, useRef } from "react";
import type { AgentProfile } from "@/protocol";
import { useDrawer } from "@/lib/drawer";
import { Card } from "./ui";
import type { Message } from "@/lib/run-state";

function nameOf(id: string, agents: Record<string, AgentProfile>): string {
  if (id === "user") return "user";
  return agents[id]?.name ?? id;
}

function Avatar({ id }: { id: string }) {
  const mono =
    id === "user"
      ? "US"
      : id === "orchestrator"
        ? "OR"
        : id
            .split("-")
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("")
            .slice(0, 2) || "AG";
  const color =
    id === "orchestrator"
      ? "#818cf8"
      : id === "user"
        ? "#e4e4e7"
        : "#a1a1aa";
  return (
    <span
      className="grid h-5 w-5 place-items-center rounded text-[8px] font-bold shrink-0"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {mono}
    </span>
  );
}

export function MessageLog({
  messages,
  agents,
  runStartTs,
}: {
  messages: Message[];
  agents: Record<string, AgentProfile>;
  runStartTs?: number;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const drawer = useDrawer();
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const t0 = runStartTs ?? messages[0]?.ts ?? 0;
  const fmt = (ts: number) => {
    const ms = Math.max(0, ts - t0);
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const frac = Math.floor((ms % 1000) / 100);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${frac}`;
  };

  return (
    <Card title="Messages">
      <div ref={boxRef} className="h-[160px] overflow-auto flex flex-col gap-1.5">
        {messages.length === 0 && (
          <p className="text-zinc-600 text-xs">No messages yet.</p>
        )}
        {messages.map((m, i) => {
          const border = m.content.includes("Redacted")
            ? "border-l-2 border-amber-500 pl-2"
            : m.content.toLowerCase().includes("denied")
              ? "border-l-2 border-red-500 pl-2"
              : "";
          return (
            <div key={i} className={`text-xs flex gap-2 items-start ${border}`}>
              <span className="text-zinc-600 font-mono tabular-nums mt-0.5 shrink-0">
                {fmt(m.ts)}
              </span>
              <Avatar id={m.from} />
              <div className="min-w-0">
                <button
                  onClick={() => {
                    if (m.from !== "user") drawer.open(m.from);
                  }}
                  className={
                    m.from === "orchestrator"
                      ? "text-indigo-400 hover:text-indigo-300"
                      : m.from === "user"
                        ? "text-white"
                        : "text-zinc-200 hover:text-indigo-300"
                  }
                >
                  {nameOf(m.from, agents)} → {nameOf(m.to, agents)}
                </button>
                <span className="text-zinc-400"> {m.content}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
