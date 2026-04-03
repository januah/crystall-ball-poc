import type { UniqueOpportunity } from './deduplication';

export interface VelocityAnalysis {
  velocity_score: number;
  velocity_explanation: string;
  is_spike_last_2_weeks: boolean;
  spike_explanation: string;
  trend_type: 'hype' | 'traction';
  trend_explanation: string;
}

export interface SEAAnalysis {
  sea_competitor_exists: boolean;
  sea_competitor_notes: string;
  malaysia_specific_notes: string;
  opportunity_gap: string;
  sea_competition_score: number;
}

export interface AMASAlignment {
  is_aligned: boolean;
  aligned_domains: string[];
  alignment_notes: string;
  replication_potential: string;
  amast_alignment_score: number;
}

export interface FullAnalysis {
  category: 'Emerging Tech' | 'Emerging SaaS';
  ai_summary: string;
  sea_adoption_analysis: string;
  business_model_estimate: string;
  hype_traction_explanation: string;
  market_size_estimate: string;
  market_size_score: number;
}

export interface ScoredOpportunity extends UniqueOpportunity {
  velocity: VelocityAnalysis;
  sea: SEAAnalysis;
  amast: AMASAlignment;
  analysis: FullAnalysis;
  score_velocity: number;
  score_traction: number;
  score_sea_competition: number;
  score_amast_alignment: number;
  score_market_size: number;
  score_total: number;
  slug: string;
  rank_position: number;
  is_new: boolean;
  existing_id?: string;
  existing_slug?: string;
}

export function calculateScores(opp: {
  velocity: VelocityAnalysis;
  sea: SEAAnalysis;
  amast: AMASAlignment;
  analysis: FullAnalysis;
}): {
  score_velocity: number;
  score_traction: number;
  score_sea_competition: number;
  score_amast_alignment: number;
  score_market_size: number;
  score_total: number;
} {
  const score_velocity = Math.min(100, Math.max(0, opp.velocity.velocity_score));
  const score_traction =
    opp.velocity.trend_type === 'traction'
      ? score_velocity
      : Math.round(score_velocity * 0.5);
  const score_sea_competition = Math.min(
    100,
    Math.max(0, opp.sea.sea_competition_score)
  );
  const score_amast_alignment = Math.min(
    100,
    Math.max(0, opp.amast.amast_alignment_score)
  );
  const score_market_size = Math.min(
    100,
    Math.max(0, opp.analysis.market_size_score)
  );

  const score_total =
    score_velocity * 0.2 +
    score_traction * 0.2 +
    score_sea_competition * 0.3 +
    score_amast_alignment * 0.15 +
    score_market_size * 0.15;

  return {
    score_velocity,
    score_traction,
    score_sea_competition,
    score_amast_alignment,
    score_market_size,
    score_total: Math.round(score_total * 10) / 10,
  };
}

export function generateSlug(title: string, existingSlugs: Set<string>): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  if (!existingSlugs.has(base)) return base;

  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!existingSlugs.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export function rankAndFilter(
  opportunities: ScoredOpportunity[]
): ScoredOpportunity[] {
  return opportunities
    .sort((a, b) => b.score_total - a.score_total)
    .slice(0, 10)
    .map((opp, i) => ({ ...opp, rank_position: i + 1 }));
}
