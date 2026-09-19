import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { MarketplaceEventSchema, type MarketplaceEvent } from "@/protocol";

export type EventSink = (e: MarketplaceEvent) => void;

type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

export type EventInput = DistributiveOmit<MarketplaceEvent, "run_id" | "ts">;

export class RunEmitter {
  constructor(
    public runId: string,
    private sink?: EventSink
  ) {}

  async emit(input: EventInput): Promise<MarketplaceEvent> {
    const event = MarketplaceEventSchema.parse({
      run_id: this.runId,
      ts: Date.now(),
      ...input,
    });
    await db.insert(events).values({
      id: `evt_${crypto.randomUUID()}`,
      runId: this.runId,
      type: event.type,
      payload: event,
    });
    this.sink?.(event);
    return event;
  }
}

export async function listEvents(
  runId: string
): Promise<MarketplaceEvent[]> {
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.runId, runId))
    .orderBy(asc(events.createdAt));
  return rows.map((r) => MarketplaceEventSchema.parse(r.payload));
}
