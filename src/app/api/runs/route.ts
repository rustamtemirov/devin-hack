import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRun, listRuns } from "@/marketplace/runs";
import { runOrchestration } from "@/orchestrator/run";
import type { MarketplaceEvent } from "@/protocol";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  objective: z.string().min(5),
  budget: z.number().positive().max(10).default(2),
});

export async function GET(req: NextRequest) {
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw !== null ? Number(limitRaw) : 20;
  const runs = await listRuns(Number.isNaN(limit) ? 20 : limit);
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: parsed.error.message } },
      { status: 400 }
    );
  }
  const { objective, budget } = parsed.data;

  const run = await createRun({ objective, budgetCredits: budget });
  const encoder = new TextEncoder();
  const encode = (s: string) => encoder.encode(s);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encode(`event: run.created\ndata: ${JSON.stringify({ run_id: run.id })}\n\n`)
      );
      runOrchestration({
        runId: run.id,
        objective,
        budgetCredits: budget,
        sink: (e: MarketplaceEvent) => {
          try {
            controller.enqueue(
              encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
            );
          } catch {
            // client disconnected
          }
        },
      })
        .catch(() => undefined)
        .finally(() => {
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-run-id": run.id,
    },
  });
}
