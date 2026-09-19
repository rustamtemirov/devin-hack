import { NextRequest, NextResponse } from "next/server";
import { listAgentsWithBalances } from "@/marketplace/registry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const includeOrchestrator =
    req.nextUrl.searchParams.get("include_orchestrator") === "1";
  const agents = await listAgentsWithBalances({ includeOrchestrator });
  return NextResponse.json({ agents });
}
