export interface TierAllocations {
  seat_limit: number;
  ai_credits_limit: number;
}

export function getAllocationsForTier(tier: string): TierAllocations {
  switch (tier) {
    case "workspace":
      return { seat_limit: 5, ai_credits_limit: 500 };
    case "suite":
      return { seat_limit: 8, ai_credits_limit: 5000 };
    case "ultimate":
      return { seat_limit: 15, ai_credits_limit: 20000 };
    default:
      return { seat_limit: 5, ai_credits_limit: 500 };
  }
}
