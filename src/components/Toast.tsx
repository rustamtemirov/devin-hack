"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { AgentProfile } from "@/protocol";
import type { PermissionView } from "@/lib/run-state";

interface ToastItem {
  key: string;
  agent: string;
  permission: string;
  justification?: string;
}

export function Toasts({
  permissions,
  agents,
}: {
  permissions: PermissionView[];
  agents: Record<string, AgentProfile>;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    for (const p of permissions) {
      if (p.decision !== "denied") continue;
      const key = `${p.task_id}:${p.permission}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      const just = p.reason.split("Agent justification: ")[1];
      const item: ToastItem = {
        key,
        agent: agents[p.agent_id]?.name ?? p.agent_id,
        permission: p.permission,
        justification: just,
      };
      setToasts((t) => [item, ...t].slice(0, 2));
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.key !== key));
      }, 4000);
    }
  }, [permissions, agents]);

  const reduce = useReducedMotion();
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 px-4 w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.key}
            data-testid="toast"
            initial={reduce ? false : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 24, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
            className="w-full max-w-[760px] rounded-lg border border-red-500/40 bg-[var(--card)] shadow-lg flex overflow-hidden pointer-events-auto"
          >
            <div className="w-1 bg-red-500 shrink-0" />
            <div className="p-3 flex gap-3 items-start">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="text-red-400 shrink-0 mt-0.5"
              >
                <path
                  d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 12l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <div>
                <div className="text-sm text-zinc-100">
                  <span className="font-medium">{t.agent}</span> requested{" "}
                  <code className="font-mono text-red-300">{t.permission}</code>{" "}
                  — blocked by marketplace
                </div>
                {t.justification && (
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {t.justification}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
