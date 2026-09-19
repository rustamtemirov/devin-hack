import { NextResponse } from "next/server";
import { listWallets } from "@/marketplace/ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  const wallets = await listWallets();
  return NextResponse.json({ wallets });
}
