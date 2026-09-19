"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Card } from "./ui";
import type { TransferView } from "@/lib/run-state";

const trunc = (s: string, n = 12) => (s.length > n ? s.slice(0, n) + "…" : s);

export function Ledger({
  orchestratorBalance,
  transfers,
  spent,
}: {
  orchestratorBalance?: number;
  transfers: TransferView[];
  spent: number;
}) {
  const [flash, setFlash] = useState(false);
  const prev = useRef<number | undefined>(orchestratorBalance);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (prev.current !== undefined && prev.current !== orchestratorBalance) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
    prev.current = orchestratorBalance;
  }, [orchestratorBalance]);
  useEffect(() => {
    prev.current = orchestratorBalance;
  });

  return (
    <Card title="Ledger">
      <div
        className={`text-2xl font-mono tabular-nums mb-1 ${flash ? "animate-[flashGreen_.9s] text-emerald-300" : "text-zinc-100"}`}
      >
        {orchestratorBalance !== undefined
          ? orchestratorBalance.toFixed(2)
          : "—"}
        <span className="text-xs text-zinc-500 ml-1">credits</span>
      </div>
      <div className="text-xs text-zinc-500 mb-2">
        spent this run:{" "}
        <span className="font-mono tabular-nums">{spent.toFixed(2)}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <AnimatePresence initial={false}>
          {transfers.slice(-4).map((t, i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
              className="text-xs font-mono tabular-nums text-zinc-400"
            >
              <span className="text-emerald-400">{t.to}</span> ←{" "}
              {t.amount.toFixed(2)}{" "}
              <span className="text-zinc-600">({trunc(t.task_id, 6)})</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}
