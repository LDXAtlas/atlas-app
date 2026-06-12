import { TIER_STORAGE_LIMITS } from "./file-utils";

// Huddles uses a separate storage pool from the regular file library so
// recordings don't crowd out documents. Higher tiers get dramatically
// more headroom since 60 minutes of meeting audio runs ~50 MB.
//   workspace  10 GB
//   suite      50 GB
//   ultimate  200 GB
export const HUDDLE_STORAGE_LIMITS = {
  workspace: 10_737_418_240,
  suite: 53_687_091_200,
  ultimate: 214_748_364_800,
} as const;

export interface TierAllocations {
  seat_limit: number;
  ai_credits_limit: number;
  storage_limit_bytes: number;
  huddle_storage_limit_bytes: number;
}

// Downgrades that take an org over the new tier's storage limit DON'T delete
// existing files — they just block new uploads until the org clears space or
// upgrades again. The webhook only updates the *limit*; usage is unaffected.
// ai_credits_used is preserved on tier changes; the monthly reset is
// handled separately via organizations.ai_credits_reset_at.
export function getAllocationsForTier(tier: string): TierAllocations {
  switch (tier) {
    case "workspace":
      return {
        seat_limit: 5,
        ai_credits_limit: 500,
        storage_limit_bytes: TIER_STORAGE_LIMITS.workspace,
        huddle_storage_limit_bytes: HUDDLE_STORAGE_LIMITS.workspace,
      };
    case "suite":
      return {
        seat_limit: 8,
        ai_credits_limit: 5000,
        storage_limit_bytes: TIER_STORAGE_LIMITS.suite,
        huddle_storage_limit_bytes: HUDDLE_STORAGE_LIMITS.suite,
      };
    case "ultimate":
      return {
        seat_limit: 15,
        ai_credits_limit: 20000,
        storage_limit_bytes: TIER_STORAGE_LIMITS.ultimate,
        huddle_storage_limit_bytes: HUDDLE_STORAGE_LIMITS.ultimate,
      };
    default:
      return {
        seat_limit: 5,
        ai_credits_limit: 500,
        storage_limit_bytes: TIER_STORAGE_LIMITS.workspace,
        huddle_storage_limit_bytes: HUDDLE_STORAGE_LIMITS.workspace,
      };
  }
}
