import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRun, getRunDetail } from "@/marketplace/runs";
import { dispatch } from "@/marketplace/dispatch";
import { RunEmitter } from "@/marketplace/events";
import { assertDevRoutes } from "@/lib/dev-guard";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  run_id: z.string().optional(),
  requester_id: z.string().default("orchestrator"),
  worker_id: z.string(),
  capability: z.string(),
  inputs: z.record(z.string(), z.unknown()).default({}),
  budget: z.number().positive(),
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
  const { run_id, requester_id, worker_id, capability, inputs, budget } =
    parsed.data;

  const run =
    run_id !== undefined
      ? { id: run_id }
      : await createRun({ objective: "dev dispatch", budgetCredits: budget });

  const emitter = new RunEmitter(run.id);
  const { task, response } = await dispatch({
    runId: run.id,
    requesterId: requester_id,
    workerId: worker_id,
    capability,
    inputs,
    budgetMaxCredits: budget,
    emitter,
  });

  const detail = await getRunDetail(run.id);
  return NextResponse.json({ run_id: run.id, task, response, detail });
}
