import { NextResponse } from "next/server";

export function assertDevRoutes(): NextResponse | null {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEV_ROUTES === "1"
  ) {
    return null;
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
