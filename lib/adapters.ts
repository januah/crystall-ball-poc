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
  history: Pick<TrendHistoryRow, 'run_date' | 'score_total' | 'score_velocity' | 'score_traction' | 'score_sea_competition' | 'score_amast_alignment' | 'score_market_size'>[]
) {
  const sorted = [...history].sort(
    (a, b) => new Date(a.run_date).getTime() - new Date(b.run_date).getTime()
  );
  return sorted.map((h) => {
    const fallback =
      (h.score_velocity ?? 0) +
      (h.score_traction ?? 0) +
      (h.score_sea_competition ?? 0) +
      (h.score_amast_alignment ?? 0) +
      (h.score_market_size ?? 0);
    return {
      month: format(new Date(h.run_date), 'MMM d'),
      score: Math.round(h.score_total ?? fallback),
      isRecent: isAfter(new Date(h.run_date), TWO_WEEKS_AGO),
    };
  });
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

  // Clean up common formatting issues before processing
  let cleanedRaw = raw.trim();

  // Check if the string starts and ends with quotes (double encoded JSON string)
  if (cleanedRaw.startsWith('"') && cleanedRaw.endsWith('"')) {
    try {
      // This might be a JSON-encoded string - decode it first
      cleanedRaw = JSON.parse(cleanedRaw);
    } catch {
      // If parsing fails, keep the original cleaned value
      cleanedRaw = cleanedRaw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  }

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(cleanedRaw);

    // If it's a simple string after parsing, return it directly
    if (typeof parsed === 'string') {
      return parsed.replace(/\n/g, '\n').replace(/\t/g, '  '); // Normalize line breaks and tabs
    }

    // If it's an array, join the elements
    if (Array.isArray(parsed)) {
      return parsed.map(item => {
        if (typeof item === 'string') {
          return item.replace(/\n/g, '\n').replace(/\t/g, '  ');
        } else if (typeof item === 'object') {
          // For objects in array, convert to key-value pairs
          return Object.entries(item).map(([k, v]) => `${k}: ${formatValue(v)}`).join('\n');
        }
        return String(item).replace(/\n/g, '\n').replace(/\t/g, '  ');
      }).join('\n\n');
    }

    // If it's an object, format as key-value pairs
    if (typeof parsed === 'object' && parsed !== null) {
      // Handle common business model fields specifically
      const parts = [];

      // Check for specific known fields
      if (parsed.revenue_streams) {
        parts.push(`Revenue Streams: ${formatValue(parsed.revenue_streams)}`);
      }
      if (parsed.pricing_models || parsed.pricing_tiers) {
        const pricing = parsed.pricing_models || parsed.pricing_tiers;
        parts.push(`Pricing: ${formatValue(pricing)}`);
      }
      if (parsed.estimated_revenue || parsed.estimated_annual_revenue) {
        const rev = parsed.estimated_revenue || parsed.estimated_annual_revenue;
        parts.push(`Estimated Revenue: ${formatValue(rev)}`);
      }
      if (parsed.business_model_canvas) {
        parts.push(`Business Model Canvas: ${formatValue(parsed.business_model_canvas)}`);
      }

      // If we handled specific fields, return those
      if (parts.length > 0) {
        return parts.join('\n\n');
      }

      // Otherwise, convert all properties to readable format
      return Object.entries(parsed)
        .map(([key, value]) => {
          return `${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${formatValue(value)}`;
        })
        .join('\n\n');
    }

    // For other primitive types, return as string
    return String(parsed).replace(/\n/g, '\n').replace(/\t/g, '  ');
  } catch (e) {
    // If not valid JSON, return the cleaned raw string
    return cleanedRaw.replace(/\n/g, '\n').replace(/\t/g, '  ');
  }
}

// Helper function to properly format values
function formatValue(value: any): string {
  if (typeof value === 'string') {
    return value;
  } else if (Array.isArray(value)) {
    return value.join(', ');
  } else if (typeof value === 'object' && value !== null) {
    // For objects, format as "key: value" pairs
    return Object.entries(value)
      .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${v}`)
      .join(', ');
  } else {
    return String(value);
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
