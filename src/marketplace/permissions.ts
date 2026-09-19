import type { Permission } from "@/protocol";

export const INPUT_PERMISSION_MAP: Record<string, Permission> = {
  origin: "share_destination",
  destination: "share_destination",
  travel_dates: "share_travel_dates",
  dates: "share_travel_dates",
  budget: "share_budget",
  budget_eur: "share_budget",
  traveler_name: "share_traveler_name",
  passport_number: "access_identity_documents",
  id_document: "access_identity_documents",
  card_number: "access_payment_methods",
  payment_method: "access_payment_methods",
  password: "access_credentials",
  api_key: "access_credentials",
};

export function permissionForInput(key: string): Permission | null {
  return INPUT_PERMISSION_MAP[key] ?? null;
}

export function checkPermission(p: {
  permission: Permission;
  envelope: Permission[];
}): { decision: "allowed" | "denied"; reason: string } {
  if (p.envelope.includes(p.permission)) {
    return {
      decision: "allowed",
      reason: `${p.permission} is in the task envelope`,
    };
  }
  return {
    decision: "denied",
    reason: `${p.permission} is not in the task envelope [${p.envelope.join(", ")}]`,
  };
}

export function filterInputs(
  inputs: Record<string, unknown>,
  grants: Permission[]
): { inputs: Record<string, unknown>; redacted: string[] } {
  const out: Record<string, unknown> = {};
  const redacted: string[] = [];
  for (const [key, value] of Object.entries(inputs)) {
    const perm = permissionForInput(key);
    if (perm === null || grants.includes(perm)) {
      out[key] = value;
    } else {
      redacted.push(key);
    }
  }
  return { inputs: out, redacted };
}

export function envelopeFor(p: {
  requesterGrants: Permission[];
  workerRequired: Permission[];
}): { envelope: Permission[]; missing: Permission[] } {
  const envelope = p.requesterGrants.filter((g) =>
    p.workerRequired.includes(g)
  );
  const missing = p.workerRequired.filter(
    (r) => !p.requesterGrants.includes(r)
  );
  return { envelope, missing };
}
