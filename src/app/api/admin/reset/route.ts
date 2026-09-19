import { NextResponse } from "next/server";
import { seed } from "@/db/seed-lib";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await seed();
  return NextResponse.json({ ok: true, agents: result.agents });
}
