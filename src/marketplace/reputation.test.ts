import { describe, it, expect } from "vitest";
import { applyOutcome, type ReputationState } from "./reputation";

const base: ReputationState = {
  rating: 4.8,
  successRate: 0.97,
  completedTasks: 183,
  failedTasks: 6,
  avgLatencyMs: 1200,
};

describe("applyOutcome", () => {
  it("success bumps rating and completed count", () => {
    const r = applyOutcome(base, { success: true, latencyMs: 1000 });
    expect(r.completedTasks).toBe(184);
    expect(r.failedTasks).toBe(6);
    expect(r.rating).toBe(4.82);
    expect(r.avgLatencyMs).toBe(1160);
  });

  it("failure drops rating by 0.2 and increments failed", () => {
    const r = applyOutcome(base, { success: false, latencyMs: 2000 });
    expect(r.failedTasks).toBe(7);
    expect(r.rating).toBe(4.6);
  });

  it("clamps rating at 5 and 0", () => {
    const top = applyOutcome(
      { ...base, rating: 4.99 },
      { success: true, latencyMs: 100 }
    );
    expect(top.rating).toBe(5);
    const bottom = applyOutcome(
      { ...base, rating: 0.1 },
      { success: false, latencyMs: 100 }
    );
    expect(bottom.rating).toBe(0);
  });

  it("computes success_rate as completed/(completed+failed)", () => {
    const r = applyOutcome(
      { rating: 4, successRate: 0, completedTasks: 2, failedTasks: 1, avgLatencyMs: 0 },
      { success: true, latencyMs: 100 }
    );
    expect(r.successRate).toBe(0.75);
  });
});
