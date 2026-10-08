import {
  OfferTierName,
  PLACEMENT_POLICY_CONFIG,
  resolveOfferTier,
} from '@/config/collegeConfig';

export interface StudentOfferSummary {
  _id?: string;
  role: string;
  companyName: string;
  type: string;
  ctcLpa?: number | null;
  tier?: OfferTierName | null;
  status: 'Pending' | 'Accepted' | 'Declined' | 'Revoked';
}

export interface PolicyCheckResult {
  compliant: boolean;
  violationReason?: string;
  highestTierHeld?: OfferTierName;
  activeOffersCount: number;
}

const TIER_HIERARCHY: Record<OfferTierName, number> = {
  Regular: 0,
  Dream: 1,
  'Super Dream': 2,
};

/**
 * Checks placement policy compliance when registering for a drive or recording an offer.
 * Rules:
 * 1. One Offer / Upgrade Only: Can only apply for strictly higher tiers.
 * 2. Maximum offers limit per student.
 * 3. Pending offers counted only if configured.
 */
export function evaluatePlacementPolicyCompliance(params: {
  existingOffers: StudentOfferSummary[];
  targetTier?: OfferTierName | null;
  targetCtcLpa?: number | null;
}): PolicyCheckResult {
  const { existingOffers, targetCtcLpa } = params;
  const config = PLACEMENT_POLICY_CONFIG.rules;

  // Resolve target tier from CTC if not explicitly provided
  const targetTier: OfferTierName =
    params.targetTier || resolveOfferTier(targetCtcLpa);

  // Filter qualifying offers
  const activeOffers = existingOffers.filter((o) => {
    if (o.status === 'Accepted') return true;
    if (config.pendingOffersCountAsActive && o.status === 'Pending') return true;
    return false;
  });

  if (activeOffers.length === 0) {
    return {
      compliant: true,
      activeOffersCount: 0,
    };
  }

  // 1. Max offers check
  if (activeOffers.length >= config.maxOffersPerStudent) {
    return {
      compliant: false,
      violationReason: `Student already holds ${activeOffers.length} active/accepted offer(s) (Maximum limit: ${config.maxOffersPerStudent}).`,
      activeOffersCount: activeOffers.length,
    };
  }

  // Find highest tier currently held
  let maxTierLevel = -1;
  let highestTierHeld: OfferTierName = 'Regular';
  let bestOfferDescription = '';

  for (const offer of activeOffers) {
    const tier = offer.tier || resolveOfferTier(offer.ctcLpa);
    const level = TIER_HIERARCHY[tier];
    if (level > maxTierLevel) {
      maxTierLevel = level;
      highestTierHeld = tier;
      bestOfferDescription = `${offer.companyName} (${offer.ctcLpa ? `${offer.ctcLpa} LPA` : 'Offer'}, ${tier})`;
    }
  }

  const targetLevel = TIER_HIERARCHY[targetTier];

  // 2. Super Dream student cannot reapply
  if (maxTierLevel >= TIER_HIERARCHY['Super Dream']) {
    return {
      compliant: false,
      highestTierHeld,
      activeOffersCount: activeOffers.length,
      violationReason: `Student already holds a Super Dream offer with ${bestOfferDescription}. Re-applying to further placement drives is not permitted.`,
    };
  }

  // 3. Tier Upgrade Only Check
  if (config.tierUpgradeOnly && targetLevel <= maxTierLevel) {
    return {
      compliant: false,
      highestTierHeld,
      activeOffersCount: activeOffers.length,
      violationReason: `Placement policy requires tier upgrades: Student already holds an offer in tier "${highestTierHeld}" (${bestOfferDescription}). Cannot apply for tier "${targetTier}".`,
    };
  }

  return {
    compliant: true,
    highestTierHeld,
    activeOffersCount: activeOffers.length,
  };
}
