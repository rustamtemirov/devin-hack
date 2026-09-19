import { NextRequest, NextResponse } from "next/server";
import { getAgent, recentTasksForAgent } from "@/marketplace/registry";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const found = await getAgent(id);
  if (!found) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }
  return NextResponse.json({
    profile: found.profile,
    wallet: { balance: found.wallet?.balance ?? 0 },
    reputation: {
      rating: found.reputation.rating,
      success_rate: found.reputation.successRate,
      completed_tasks: found.reputation.completedTasks,
      failed_tasks: found.reputation.failedTasks,
      avg_latency_ms: found.reputation.avgLatencyMs,
    },
    recent_tasks: await recentTasksForAgent(id),
  });
}
