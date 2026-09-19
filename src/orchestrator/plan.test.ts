import { describe, it, expect } from "vitest";
import { fallbackPlan } from "./plan";

describe("fallbackPlan parsing", () => {
  it("Tokyo: 'to <City>' + 4-day + €1,200", () => {
    const p = fallbackPlan("Plan a 4-day trip to Tokyo under €1,200.");
    expect(p.destination).toBe("Tokyo");
    expect(p.budget_eur).toBe(1200);
    expect(p.travel_dates).toBe("2026-10-01..2026-10-05");
    expect(p.subtasks.map((s) => s.capability)).toEqual([
      "flight_search",
      "hotel_search",
      "activity_search",
      "currency_conversion",
    ]);
  });

  it("Lisbon weekend: 'in <City>' + 3-day + €900", () => {
    const p = fallbackPlan(
      "Plan a 3-day food-focused weekend in Lisbon for two under €900"
    );
    expect(p.destination).toBe("Lisbon");
    expect(p.budget_eur).toBe(900);
    expect(p.travel_dates).toBe("2026-10-01..2026-10-04");
  });

  it("New York: two-word destination", () => {
    const p = fallbackPlan("Plan a 5-day trip to New York under €2,000");
    expect(p.destination).toBe("New York");
    expect(p.budget_eur).toBe(2000);
  });
});
