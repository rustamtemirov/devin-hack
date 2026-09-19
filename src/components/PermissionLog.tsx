"use client";

import type { AgentProfile } from "@/protocol";
import { Badge, Card } from "./ui";
import type { PermissionView } from "@/lib/run-state";

export function PermissionLog({
  permissions,
  agents,
}: {
  permissions: PermissionView[];
  agents: Record<string, AgentProfile>;
}) {
  return (
    <Card title="Permissions">
      {permissions.length === 0 ? (
        <p className="text-zinc-600 text-xs">No permission requests yet</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {permissions.map((p, i) => (
            <div
              key={i}
              className={`rounded-lg p-2 text-xs ${
                p.decision === "denied"
                  ? "animate-[flashRed_1s] border border-red-800"
                  : "border border-[var(--hairline)]"
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-zinc-200">
                  {agents[p.agent_id]?.name ?? p.agent_id}
                </span>
                <span className="font-mono text-amber-300">{p.permission}</span>
                <Badge tone={p.decision === "denied" ? "red" : "emerald"}>
                  {p.decision.toUpperCase()}
                </Badge>
              </div>
              <div className="text-zinc-500 mt-0.5">{p.reason}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
