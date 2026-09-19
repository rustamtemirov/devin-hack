import { NextRequest, NextResponse } from "next/server";
import { searchAgents } from "@/marketplace/registry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const capability = params.get("capability");
  if (!capability) {
    return NextResponse.json(
      { error: "capability query parameter is required" },
      { status: 400 }
    );
  }
  const maxPriceRaw = params.get("max_price");
  const minRatingRaw = params.get("min_rating");
  const maxPrice = maxPriceRaw !== null ? Number(maxPriceRaw) : undefined;
  const minRating = minRatingRaw !== null ? Number(minRatingRaw) : undefined;
  if (maxPrice !== undefined && Number.isNaN(maxPrice)) {
    return NextResponse.json({ error: "invalid max_price" }, { status: 400 });
  }
  if (minRating !== undefined && Number.isNaN(minRating)) {
    return NextResponse.json({ error: "invalid min_rating" }, { status: 400 });
  }
  const agents = await searchAgents({ capability, maxPrice, minRating });
  return NextResponse.json({ agents });
}
