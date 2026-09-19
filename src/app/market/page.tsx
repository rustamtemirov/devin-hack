import { listAgents } from "@/marketplace/registry";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

function Chip({ children, color }: { children: string; color?: string }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-mono mr-1 mb-1 ${
        color ?? "bg-zinc-800 text-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}

export default async function Home() {
  const agents = await listAgents();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <Nav />
      <h1 className="text-2xl font-bold mb-6">Marketplace</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-zinc-500 border-b border-zinc-800">
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Capabilities</th>
            <th className="py-2 pr-4 font-medium">Price</th>
            <th className="py-2 pr-4 font-medium">Rating</th>
            <th className="py-2 pr-4 font-medium">Success</th>
            <th className="py-2 pr-4 font-medium">Tasks</th>
            <th className="py-2 pr-4 font-medium">Latency</th>
            <th className="py-2 font-medium">Permissions required</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id} className="border-b border-zinc-900 align-top">
              <td className="py-3 pr-4">
                <div className="font-medium">{a.name}</div>
                <div className="text-zinc-600 font-mono text-xs">{a.id}</div>
              </td>
              <td className="py-3 pr-4">
                {a.capabilities.map((c) => (
                  <Chip key={c} color="bg-indigo-950 text-indigo-300">
                    {c}
                  </Chip>
                ))}
              </td>
              <td className="py-3 pr-4 font-mono">
                {a.pricing.amount.toFixed(2)}
              </td>
              <td className="py-3 pr-4 font-mono">
                {a.reputation.rating.toFixed(1)}
              </td>
              <td className="py-3 pr-4 font-mono">
                {(a.reputation.success_rate * 100).toFixed(0)}%
              </td>
              <td className="py-3 pr-4 font-mono">
                {a.reputation.completed_tasks}
              </td>
              <td className="py-3 pr-4 font-mono">{a.latency_ms_p50}ms</td>
              <td className="py-3">
                {a.permissions_required.length === 0 ? (
                  <span className="text-zinc-600 text-xs">none</span>
                ) : (
                  a.permissions_required.map((p) => (
                    <Chip key={p} color="bg-amber-950 text-amber-300">
                      {p}
                    </Chip>
                  ))
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
