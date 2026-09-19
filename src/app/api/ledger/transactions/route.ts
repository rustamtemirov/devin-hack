import { NextRequest, NextResponse } from "next/server";
import { listTransactions } from "@/marketplace/ledger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const limitRaw = params.get("limit");
  const limit = limitRaw !== null ? Number(limitRaw) : 50;
  const transactions = await listTransactions({
    limit: Number.isNaN(limit) ? 50 : limit,
    agentId: params.get("agent_id") ?? undefined,
    taskId: params.get("task_id") ?? undefined,
  });
  return NextResponse.json({ transactions });
}
