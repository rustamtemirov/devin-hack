import { describe, it, expect } from "vitest";
import { scoreCandidates } from "./score";
import { SEED_AGENTS, type SeedAgent } from "@/db/seed-data";
import type { AgentProfile, Permission } from "@/protocol";

function toProfile(a: SeedAgent): AgentProfile {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    version: "0.1",
    capabilities: a.capabilities,
    pricing: { model: "per_task", amount: a.price, currency: "CREDIT" },
    reputation: {
      rating: a.rating,
      success_rate: a.successRate,
      completed_tasks: a.completedTasks,
    },
    requirements: a.requirements,
    permissions_required: a.permissionsRequired,
    latency_ms_p50: a.latencyMsP50,
  };
}

const ORCHESTRATOR_GRANTS: Permission[] = [
  "search_external",
  "hire_agents",
  "spend_credits",
  "share_destination",
  "share_travel_dates",
  "share_budget",
];

const INPUT_KEYS = ["origin", "destination", "travel_dates", "budget"];

function byCapability(cap: string): AgentProfile[] {
  return SEED_AGENTS.filter(
    (a) => !a.isOrchestrator && a.capabilities.includes(cap)
  ).map(toProfile);
}

describe("scoreCandidates", () => {
  it("flight_search budget 0.8 → flight-01 > flight-02 > flight-03", () => {
    const scored = scoreCandidates({
      candidates: byCapability("flight_search"),
      budgetCredits: 0.8,
      requesterGrants: ORCHESTRATOR_GRANTS,
      inputKeys: INPUT_KEYS,
    });
    expect(scored.map((s) => s.agent_id)).toEqual([
      "flight-01",
      "flight-02",
      "flight-03",
    ]);
    expect(scored[0].score).toBeCloseTo(0.8805, 3);
    expect(scored[1].score).toBeCloseTo(0.867, 3);
  });

  it("hotel_search budget 0.7 → hotel-04 first, hotel-01 second, hotel-02 eligible", () => {
    const scored = scoreCandidates({
      candidates: byCapability("hotel_search"),
      budgetCredits: 0.7,
      requesterGrants: ORCHESTRATOR_GRANTS,
      inputKeys: INPUT_KEYS,
    });
    expect(scored[0].agent_id).toBe("hotel-04");
    expect(scored[1].agent_id).toBe("hotel-01");
    expect(
      scored.find((s) => s.agent_id === "hotel-02")?.eligible
    ).toBe(true);
  });

  it("flight_search budget 0.3 → flight-02 ineligible, sorted last", () => {
    const scored = scoreCandidates({
      candidates: byCapability("flight_search"),
      budgetCredits: 0.3,
      requesterGrants: ORCHESTRATOR_GRANTS,
      inputKeys: INPUT_KEYS,
    });
    const f2 = scored.find((s) => s.agent_id === "flight-02")!;
    expect(f2.eligible).toBe(false);
    expect(f2.reason).toContain("exceeds subtask budget");
    expect(scored[scored.length - 1].agent_id).toBe("flight-02");
  });

  it("candidate requiring access_credentials is ineligible", () => {
    const rogue = toProfile({
      ...SEED_AGENTS[0],
      id: "rogue-01",
      isOrchestrator: false,
      capabilities: ["flight_search"],
      permissionsRequired: ["access_credentials"],
      price: 0.1,
    });
    const scored = scoreCandidates({
      candidates: [rogue],
      budgetCredits: 1,
      requesterGrants: ORCHESTRATOR_GRANTS,
      inputKeys: INPUT_KEYS,
    });
    expect(scored[0].eligible).toBe(false);
    expect(scored[0].reason).toContain("access_credentials");
  });
});
