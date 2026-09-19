"use client";

import { useEffect, useRef } from "react";
import { motion, useSpring, useTransform, useReducedMotion } from "framer-motion";

function RollingNumber({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 120, damping: 20 });
  const display = useTransform(spring, (v) => v.toFixed(2));
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  if (reduce) return <>{value.toFixed(2)}</>;
  return <motion.span>{display}</motion.span>;
}

function Mini({
  label,
  value,
  flash,
}: {
  label: string;
  value: React.ReactNode;
  flash?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={`font-mono tabular-nums text-sm ${flash ? "text-emerald-300" : "text-zinc-100"}`}
      >
        {value}
      </div>
    </div>
  );
}

export function Counters({
  balance,
  spent,
  hired,
  events,
}: {
  balance?: number;
  spent: number;
  hired: number;
  events: number;
}) {
  const reduce = useReducedMotion();
  const prev = useRef2(balance);
  const flash = !reduce && prev !== undefined && balance !== undefined && prev !== balance;
  return (
    <div
      className="card-surface px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1.5 shrink-0 w-[220px]"
      data-testid="counters"
    >
      <Mini
        label="Orch balance"
        value={balance !== undefined ? <RollingNumber value={balance} /> : "—"}
        flash={flash}
      />
      <Mini label="Spent" value={spent.toFixed(2)} />
      <Mini label="Hired" value={hired} />
      <Mini label="Events" value={events} />
    </div>
  );
}

// track previous value without re-render loop
function useRef2(v: number | undefined) {
  const r = useRef(v);
  const prev = r.current;
  r.current = v;
  return prev;
}
