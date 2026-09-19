import { NextRequest, NextResponse } from "next/server";
import { getRunDetail } from "@/marketplace/runs";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const detail = await getRunDetail(id);
  if (!detail) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: `run ${id} not found` } },
      { status: 404 }
    );
  }
  return NextResponse.json(detail);
}
