import type { AgentProfile, Permission } from "@/protocol";

export const WEIGHTS = {
  rating: 0.35,
  success: 0.25,
  price: 0.2,
  latency: 0.1,
  fit: 0.1,
} as const;

export type ScoredCandidate = {
  agent_id: string;
  name: string;
  price: number;
  score: number;
  eligible: boolean;
  reason?: string;
  breakdown: {
    rating: number;
    success: number;
    price: number;
    latency: number;
    fit: number;
  };
};

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

export function scoreCandidates(p: {
  candidates: AgentProfile[];
  budgetCredits: number;
  requesterGrants: Permission[];
  inputKeys: string[];
}): ScoredCandidate[] {
  const maxLatency = Math.max(
    ...p.candidates.map((c) => c.latency_ms_p50),
    0
  );

  const scored = p.candidates.map((c): ScoredCandidate => {
    let eligible = true;
    let reason: string | undefined;
    const missingPerms = c.permissions_required.filter(
      (perm) => !p.requesterGrants.includes(perm)
    );
    if (c.pricing.amount > p.budgetCredits) {
      eligible = false;
      reason = `price ${c.pricing.amount} exceeds subtask budget ${p.budgetCredits}`;
    } else if (missingPerms.length) {
      eligible = false;
      reason = `requires ${missingPerms.join(", ")} which requester cannot delegate`;
    }

    const rating = WEIGHTS.rating * (c.reputation.rating / 5);
    const success = WEIGHTS.success * c.reputation.success_rate;
    const price =
      p.budgetCredits > 0
        ? WEIGHTS.price *
          Math.min(1, Math.max(0, 1 - c.pricing.amount / p.budgetCredits))
        : 0;
    const latency =
      p.candidates.length <= 1 || maxLatency === 0
        ? WEIGHTS.latency
        : WEIGHTS.latency * (1 - c.latency_ms_p50 / maxLatency);
    const fit =
      c.requirements.length === 0
        ? WEIGHTS.fit
        : WEIGHTS.fit *
          (c.requirements.filter((k) => p.inputKeys.includes(k)).length /
            c.requirements.length);

    const breakdown = {
      rating: r4(rating),
      success: r4(success),
      price: r4(price),
      latency: r4(latency),
      fit: r4(fit),
    };
    return {
      agent_id: c.id,
      name: c.name,
      price: c.pricing.amount,
      score: r4(rating + success + price + latency + fit),
      eligible,
      reason,
      breakdown,
    };
  });

  scored.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.score - a.score;
  });
  return scored;
}
