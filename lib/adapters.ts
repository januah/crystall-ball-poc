// Converts Supabase DB row shapes → UI Opportunity type used by existing components.
// Key convention: `id` is set to `slug` so existing link patterns (/opportunity/${id})
// resolve to slug-based routes without touching any UI components.
import { format, subWeeks, isAfter } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type {
  OpportunityRow,
  CategoryRow,
  TrendHistoryRow,
  OpportunityAlignmentWithDomain,
  OpportunityCurationRow,
  OpportunityNoteRow,
} from '@/lib/supabase/types';
import type { Opportunity, CurationStatus, AMASTPillar, TrendEntry } from '@/types';

const MYT = 'Asia/Kuala_Lumpur';
const TWO_WEEKS_AGO = subWeeks(new Date(), 2);

// ── Curation status mapping ──────────────────────────────────────
export function dbCurationToUI(status: string | null | undefined): CurationStatus {
  const map: Record<string, CurationStatus> = {
    interested: 'Interested',
    rejected: 'Rejected',
    follow_up: 'Follow Up',
    unreviewed: 'Unreviewed',
  };
  return map[status ?? ''] ?? 'Unreviewed';
}

export function uiCurationToDb(status: CurationStatus): string {
  const map: Record<CurationStatus, string> = {
    Interested: 'interested',
    Rejected: 'rejected',
    'Follow Up': 'follow_up',
    Unreviewed: 'unreviewed',
  };
  return map[status];
}

// ── Trend history → velocity chart data ─────────────────────────
export function adaptTrendHistoryToVelocityData(
  history: Pick<TrendHistoryRow, 'run_date' | 'score_total'>[]
) {
  const sorted = [...history].sort(
    (a, b) => new Date(a.run_date).getTime() - new Date(b.run_date).getTime()
  );
  return sorted.map((h) => ({
    month: format(new Date(h.run_date), 'MMM d'),
    score: Math.round(h.score_total ?? 0),
    isRecent: isAfter(new Date(h.run_date), TWO_WEEKS_AGO),
  }));
}

// ── Trend history → TrendEntry[] for TrendHistory component ─────
export function adaptTrendHistoryToTrendEntries(
  history: Pick<TrendHistoryRow, 'run_date' | 'rank_position' | 'score_total' | 'trend_type'>[]
): TrendEntry[] {
  return [...history]
    .sort((a, b) => new Date(a.run_date).getTime() - new Date(b.run_date).getTime())
    .map((h) => ({
      date: h.run_date,
      rank: h.rank_position ?? 0,
      score: Math.round(h.score_total ?? 0),
      hypeType: h.trend_type === 'traction' ? 'Traction' : 'Hype',
    }));
}

// ── Break wall-of-text into paragraphs (every 2 sentences) ───────
function paragraphify(text: string | null | undefined): string {
  if (!text) return '';
  if (text.includes('\n')) return text; // already has breaks
  const sentences = text.match(/[^.!?]+[.!?]+["']?/g) ?? [text];
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(' ').trim());
  }
  return chunks.join('\n\n');
}

// ── Alignment notes: parse JSON → readable text ──────────────────
function parseAlignmentNotes(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const p = JSON.parse(raw);
    if (typeof p === 'object' && !Array.isArray(p)) {
      return Object.entries(p)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    }
    return raw;
  } catch {
    return raw;
  }
}

// ── Business model: parse JSON → readable text ───────────────────
function parseBusinessModel(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const p = JSON.parse(raw);
    const lines: string[] = [];
    if (Array.isArray(p.revenue_streams) && p.revenue_streams.length) {
      lines.push(`Revenue streams: ${p.revenue_streams.join(', ')}.`);
    }
    if (p.pricing_tiers && typeof p.pricing_tiers === 'object') {
      const tiers = Object.entries(p.pricing_tiers)
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
        .join(' · ');
      lines.push(`Pricing — ${tiers}.`);
    }
    if (p.estimated_annual_revenue) {
      lines.push(`Estimated annual revenue: ${p.estimated_annual_revenue}.`);
    }
    return lines.length ? lines.join('\n') : raw;
  } catch {
    return raw;
  }
}

// ── Full DB opportunity → UI Opportunity ─────────────────────────
export function adaptOpportunity(
  row: OpportunityRow & {
    category?: CategoryRow | null;
    amast_alignments?: OpportunityAlignmentWithDomain[];
    trend_history?: TrendHistoryRow[];
    curation?: OpportunityCurationRow | null;
    latest_note?: OpportunityNoteRow | null;
  }
): Opportunity {
  const alignments = row.amast_alignments ?? [];
  const history = row.trend_history ?? [];
  const amastPillars = alignments
    .map((a) => a.amast_domain?.name)
    .filter(Boolean) as AMASTPillar[];

  // Approximate score breakdown mapping DB 5-score format → UI 6-factor format
  const sv = row.score_velocity ?? 0;
  const st = row.score_traction ?? 0;
  const ss = row.score_sea_competition ?? 0;
  const sa = row.score_amast_alignment ?? 0;
  const sm = row.score_market_size ?? 0;
  const total = row.score_total ?? 0;

  return {
    // Use slug as id so existing /opportunity/${id} links resolve via slug routes
    id: row.slug,
    rank: row.rank_position ?? 0,
    title: row.title,
    summary: row.ai_summary?.split('\n')[0]?.slice(0, 200) ?? '',
    fullSummary: paragraphify(row.ai_summary),
    category: (row.category?.name ?? 'Emerging SaaS') as Opportunity['category'],
    hypeType: row.trend_type === 'traction' ? 'Traction' : 'Hype',
    hypeExplanation: paragraphify(row.hype_traction_explanation),
    seaStatus:
      row.sea_competitor_exists ? 'Competitor Exists' : 'No SEA Competitor',
    seaAnalysis: paragraphify(row.sea_adoption_analysis ?? row.sea_competitor_notes),
    amastAligned: alignments.length > 0,
    amastPillars,
    amastDetails: parseAlignmentNotes(alignments[0]?.alignment_notes),
    score: Math.round(total),
    scoreBreakdown: {
      marketSize: Math.round(sm * 0.2),
      innovation: Math.round(sv * 0.2),
      seaFit:     Math.round(ss * 0.2),
      timing:     Math.round(st * 0.2),
      competition: Math.round(ss * 0.15),
      amastFit:   Math.round(sa * 0.1),
      total:      Math.round(total),
    },
    dateDiscovered: formatInTimeZone(
      new Date(row.first_discovered_at),
      MYT,
      'yyyy-MM-dd'
    ),
    curationStatus: dbCurationToUI(row.curation?.status),
    businessModel: parseBusinessModel(row.business_model_estimate),
    velocityData: adaptTrendHistoryToVelocityData(history),
    trendHistory: adaptTrendHistoryToTrendEntries(history),
    notes: row.latest_note?.note_text ?? '',
  };
}
