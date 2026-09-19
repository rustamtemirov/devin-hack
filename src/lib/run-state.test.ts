import { describe, it, expect } from "vitest";
import {
  applyEvent,
  reduceEvents,
  initialRunState,
  type Stage,
} from "./run-state";
import type { MarketplaceEvent } from "@/protocol";

const base = { run_id: "run_1", ts: 1 };
let t = 0;
const ts = () => ++t;

function seq(): MarketplaceEvent[] {
  return [
    { ...base, ts: ts(), type: "run.started", objective: "Trip", budget: 2 },
    {
      ...base,
      ts: ts(),
      type: "agent.message",
      task_id: "plan",
      from: "orchestrator",
      to: "user",
      content: "No ANTHROPIC_API_KEY; using fallback plan",
    },
    {
      ...base,
      ts: ts(),
      type: "run.decomposed",
      subtasks: [
        { capability: "flight_search", inputs: {}, budget_share: 0.4 },
      ],
    },
    { ...base, ts: ts(), type: "market.searched", capability: "flight_search", candidates: 3 },
    {
      ...base,
      ts: ts(),
      type: "market.evaluated",
      capability: "flight_search",
      scores: [
        {
          agent_id: "flight-01",
          score: 0.88,
          breakdown: {
            rating: 0.336,
            success: 0.24,
            price: 0.2,
            latency: 0.05,
            fit: 0.1,
            eligible: 1,
          },
        },
        {
          agent_id: "flight-02",
          score: 0.8,
          breakdown: {
            rating: 0.34,
            success: 0.24,
            price: 0.1,
            latency: 0.05,
            fit: 0.1,
            eligible: 1,
          },
        },
      ],
    },
    {
      ...base,
      ts: ts(),
      type: "agent.hired",
      task_id: "task_1",
      agent_id: "flight-01",
      capability: "flight_search",
      price: 0.2,
    },
    { ...base, ts: ts(), type: "task.status", task_id: "task_1", status: "running" },
    {
      ...base,
      ts: ts(),
      type: "permission.checked",
      task_id: "task_1",
      agent_id: "flight-01",
      permission: "share_destination",
      decision: "allowed",
      reason: "in envelope",
    },
    {
      ...base,
      ts: ts(),
      type: "ledger.transfer",
      from: "orchestrator",
      to: "flight-01",
      amount: 0.2,
      task_id: "task_1",
    },
    {
      ...base,
      ts: ts(),
      type: "reputation.updated",
      agent_id: "flight-01",
      rating: 4.82,
      success_rate: 0.9684,
      completed_tasks: 184,
    },
    {
      ...base,
      ts: ts(),
      type: "ledger.transfer",
      from: "orchestrator",
      to: "hotel-04",
      amount: 0.15,
      task_id: "task_2",
    },
    {
      ...base,
      ts: ts(),
      type: "run.completed",
      result: { plan_source: "fallback", total_cost_credits: 0.35 },
    },
  ];
}

describe("applyEvent / reduceEvents", () => {
  it("walks stages in order and ends completed with summed spend", () => {
    const stages: Stage[] = [];
    let s = initialRunState;
    for (const e of seq()) {
      s = applyEvent(s, e);
      stages.push(s.stage);
    }
    expect(stages[0]).toBe("started");
    expect(stages[1]).toBe("decomposing");
    expect(stages).toContain("searching");
    expect(stages).toContain("evaluating");
    expect(stages).toContain("hiring");
    expect(stages).toContain("executing");
    expect(stages).toContain("settling");
    expect(s.stage).toBe("completed");
    expect(s.spent).toBeCloseTo(0.35);
    expect(s.planSource).toBe("fallback");
    expect(s.startedTs).toBe(1);
  });

  it("stage never regresses on late market.searched after agent.hired", () => {
    let s = reduceEvents(seq().slice(0, 6)); // through agent.hired → hiring
    expect(s.stage).toBe("hiring");
    s = applyEvent(s, {
      ...base,
      ts: ts(),
      type: "market.searched",
      capability: "hotel_search",
      candidates: 5,
    });
    expect(s.stage).toBe("hiring");
  });

  it("records permission.checked and marks hired candidate", () => {
    const s = reduceEvents(seq());
    const denied = applyEvent(s, {
      ...base,
      ts: ts(),
      type: "permission.checked",
      task_id: "task_9",
      agent_id: "hotel-04",
      permission: "access_identity_documents",
      decision: "denied",
      reason: "not in envelope",
    });
    const perm = denied.permissions.find(
      (p) => p.permission === "access_identity_documents"
    );
    expect(perm?.decision).toBe("denied");
    expect(
      s.candidates.flight_search.find((c) => c.agent_id === "flight-01")?.hired
    ).toBe(true);
    expect(
      s.candidates.flight_search.find((c) => c.agent_id === "flight-02")?.hired
    ).toBe(false);
  });
});
