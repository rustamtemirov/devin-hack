import { useEffect, useRef } from "react";
import type { AgentProfile } from "@/protocol";
import type { Message } from "@/lib/run-state";

function nameOf(
  id: string,
  agents: Record<string, AgentProfile>
): string {
  if (id === "user") return "user";
  return agents[id]?.name ?? id;
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
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
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
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        Messages
      </h2>
      <div className="max-h-72 overflow-auto flex flex-col gap-1">
        {messages.length === 0 && (
          <p className="text-zinc-600 text-xs">No messages yet.</p>
        )}
        {messages.map((m, i) => {
          const isOrch = m.from === "orchestrator";
          const isUser = m.from === "user";
          const border = m.content.includes("Redacted")
            ? "border-l-2 border-amber-500 pl-2"
            : m.content.toLowerCase().includes("denied")
              ? "border-l-2 border-red-500 pl-2"
              : "";
          return (
            <div key={i} className={`text-xs ${border}`}>
              <span className="text-zinc-600 font-mono mr-1">
                {fmt(m.ts)}
              </span>
              <span
                className={
                  isOrch
                    ? "text-indigo-400"
                    : isUser
                      ? "text-white"
                      : "text-zinc-200"
                }
              >
                {nameOf(m.from, agents)} → {nameOf(m.to, agents)}
              </span>
              <span className="text-zinc-400"> {m.content}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
