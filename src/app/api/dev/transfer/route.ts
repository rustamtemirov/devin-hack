import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transfer, getBalance, LedgerError } from "@/marketplace/ledger";
import { assertDevRoutes } from "@/lib/dev-guard";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  from: z.string(),
  to: z.string(),
  amount: z.number(),
  task_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const guard = assertDevRoutes();
  if (guard) return guard;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.message } },
      { status: 400 }
    );
  }
  const { from, to, amount, task_id } = parsed.data;
  try {
    const transaction = await transfer({ from, to, amount, taskId: task_id });
    const balances = {
      [from]: await getBalance(from),
      [to]: await getBalance(to),
    };
    return NextResponse.json({ transaction, balances });
  } catch (e) {
    if (e instanceof LedgerError) {
      return NextResponse.json(
        { error: { code: e.code, message: e.message } },
        { status: 400 }
      );
    }
    throw e;
  }
}
