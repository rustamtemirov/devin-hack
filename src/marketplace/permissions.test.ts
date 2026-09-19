import { describe, it, expect } from "vitest";
import {
  checkPermission,
  filterInputs,
  envelopeFor,
  permissionForInput,
} from "./permissions";
import type { Permission } from "@/protocol";

describe("checkPermission", () => {
  it("allows when permission is in the envelope", () => {
    const r = checkPermission({
      permission: "share_destination",
      envelope: ["share_destination", "share_travel_dates"],
    });
    expect(r.decision).toBe("allowed");
    expect(r.reason).toContain("share_destination");
  });

  it("denies with reason mentioning the permission and the envelope", () => {
    const r = checkPermission({
      permission: "access_identity_documents",
      envelope: ["share_destination", "share_travel_dates"],
    });
    expect(r.decision).toBe("denied");
    expect(r.reason).toContain("access_identity_documents");
    expect(r.reason).toContain("share_destination");
  });
});

describe("filterInputs", () => {
  it("drops gated keys not granted, keeps granted and unmapped keys", () => {
    const { inputs, redacted } = filterInputs(
      {
        destination: "Tokyo",
        passport_number: "X123",
        budget: 1200,
        notes: "hi",
      },
      ["share_destination"]
    );
    expect(inputs).toEqual({ destination: "Tokyo", notes: "hi" });
    expect(redacted.sort()).toEqual(["budget", "passport_number"]);
  });

  it("passes through everything when all mapped permissions granted", () => {
    const { inputs, redacted } = filterInputs(
      { budget: 100, notes: "x" },
      ["share_budget"]
    );
    expect(inputs).toEqual({ budget: 100, notes: "x" });
    expect(redacted).toEqual([]);
  });
});

describe("envelopeFor", () => {
  it("returns the intersection as envelope and uncovered requirements as missing", () => {
    const r = envelopeFor({
      requesterGrants: [
        "share_destination",
        "share_travel_dates",
        "spend_credits",
      ],
      workerRequired: ["share_destination", "share_travel_dates"],
    });
    expect(r.envelope.sort()).toEqual([
      "share_destination",
      "share_travel_dates",
    ]);
    expect(r.missing).toEqual([]);
  });

  it("reports missing requirements the requester cannot grant", () => {
    const r = envelopeFor({
      requesterGrants: ["share_destination"] as Permission[],
      workerRequired: ["share_destination", "search_external"],
    });
    expect(r.envelope).toEqual(["share_destination"]);
    expect(r.missing).toEqual(["search_external"]);
  });
});

describe("permissionForInput", () => {
  it("maps known keys and returns null for unmapped", () => {
    expect(permissionForInput("passport_number")).toBe(
      "access_identity_documents"
    );
    expect(permissionForInput("notes")).toBeNull();
  });
});
