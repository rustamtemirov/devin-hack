import type { AgentProfile } from "@/protocol";
import type { PermissionView } from "@/lib/run-state";

export function PermissionLog({
  permissions,
  agents,
}: {
  permissions: PermissionView[];
  agents: Record<string, AgentProfile>;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        Permissions
      </h2>
      {permissions.length === 0 ? (
        <p className="text-zinc-600 text-xs">No permission requests yet</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {permissions.map((p, i) => (
            <div
              key={i}
              className={`rounded p-2 text-xs ${
                p.decision === "denied"
                  ? "animate-[flashRed_1s] border border-red-800"
                  : "border border-zinc-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-zinc-200">
                  {agents[p.agent_id]?.name ?? p.agent_id}
                </span>
                <span className="font-mono text-amber-300">
                  {p.permission}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    p.decision === "denied"
                      ? "bg-red-900 text-red-300"
                      : "bg-green-900 text-green-300"
                  }`}
                >
                  {p.decision.toUpperCase()}
                </span>
              </div>
              <div className="text-zinc-500 mt-0.5">{p.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
