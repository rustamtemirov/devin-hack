import { NextRequest, NextResponse } from "next/server";
import { listAgents } from "@/marketplace/registry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const includeOrchestrator =
    req.nextUrl.searchParams.get("include_orchestrator") === "1";
  const agents = await listAgents({ includeOrchestrator });
  return NextResponse.json({ agents });
}
