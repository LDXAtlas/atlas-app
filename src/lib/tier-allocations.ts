import { TIER_STORAGE_LIMITS } from "./file-utils";

export interface TierAllocations {
  seat_limit: number;
  ai_credits_limit: number;
  storage_limit_bytes: number;
}

// Downgrades that take an org over the new tier's storage limit DON'T delete
// existing files — they just block new uploads until the org clears space or
// upgrades again. The webhook only updates the *limit*; usage is unaffected.
export function getAllocationsForTier(tier: string): TierAllocations {
  switch (tier) {
    case "workspace":
      return {
        seat_limit: 5,
        ai_credits_limit: 500,
        storage_limit_bytes: TIER_STORAGE_LIMITS.workspace,
      };
    case "suite":
      return {
        seat_limit: 8,
        ai_credits_limit: 5000,
        storage_limit_bytes: TIER_STORAGE_LIMITS.suite,
      };
    case "ultimate":
      return {
        seat_limit: 15,
        ai_credits_limit: 20000,
        storage_limit_bytes: TIER_STORAGE_LIMITS.ultimate,
      };
    default:
      return {
        seat_limit: 5,
        ai_credits_limit: 500,
        storage_limit_bytes: TIER_STORAGE_LIMITS.workspace,
      };
  }
}
