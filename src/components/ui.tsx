import type { ReactNode } from "react";

export function Card({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-surface p-4 ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {title}
            </h2>
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  zinc: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
} as const;

export function Badge({
  tone = "zinc",
  children,
  className = "",
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="card-surface px-4 py-3 min-w-32">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </div>
      <div className="font-mono tabular-nums text-xl text-zinc-100">{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function Dot({
  state,
}: {
  state: "pending" | "active" | "done" | "failed";
}) {
  const cls =
    state === "active"
      ? "bg-amber-400 animate-pulse"
      : state === "done"
        ? "bg-emerald-500"
        : state === "failed"
          ? "bg-red-500"
          : "bg-zinc-700";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />;
}

export function Empty({
  glyph,
  title,
  hint,
  children,
}: {
  glyph?: ReactNode;
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card-surface p-8 text-center">
      {glyph && <div className="text-3xl mb-3 text-zinc-600">{glyph}</div>}
      <div className="text-zinc-300 font-medium">{title}</div>
      {hint && (
        <div className="text-zinc-500 text-xs mt-2 font-mono">{hint}</div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
