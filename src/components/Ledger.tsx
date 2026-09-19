import { useEffect, useRef, useState } from "react";
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
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        Ledger
      </h2>
      <div
        className={`text-2xl font-mono mb-1 ${flash ? "animate-[flashGreen_.9s] text-emerald-300" : "text-zinc-100"}`}
      >
        {orchestratorBalance !== undefined
          ? orchestratorBalance.toFixed(2)
          : "—"}
        <span className="text-xs text-zinc-500 ml-1">credits</span>
      </div>
      <div className="text-xs text-zinc-500 mb-2">
        spent this run: {spent.toFixed(2)}
      </div>
      <div className="flex flex-col gap-0.5 max-h-40 overflow-auto">
        {transfers.map((t, i) => (
          <div key={i} className="text-xs font-mono text-zinc-400">
            <span className="text-emerald-400">{t.to}</span> ←{" "}
            {t.amount.toFixed(4)}{" "}
            <span className="text-zinc-600">({trunc(t.task_id)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
