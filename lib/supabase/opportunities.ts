// =============================================================
// Crystal Ball — Opportunity Helpers
// All functions run server-side only.
// =============================================================
import { supabaseAdmin, getAuthedClient } from './client';
import type {
  OpportunityInsert,
  OpportunityWithCuration,
  OpportunityDetail,
  OpportunityPublic,
  TrendHistoryInsert,
  OpportunitySourceInsert,
  OpportunityAlignmentInsert,
} from './types';

// ------------------------------------------------------------------
// getOpportunitiesByDate
// Returns all opportunities that have a trend_history record for
// the given run_date, enriched with the requesting user's curation.
// ------------------------------------------------------------------
export async function getOpportunitiesByDate(
  date: string,   // 'YYYY-MM-DD'
  userId: string,
  userRole: string
): Promise<OpportunityWithCuration[]> {
  const client = await getAuthedClient(userId, userRole);

  const { data, error } = await client
    .from('opportunity_trend_history')
    .select(
      `
      run_date,
      rank_position,
      score_total,
      opportunity:opportunity_id (
        id, title, slug, trend_type, sea_competitor_exists,
        ai_summary, market_size_estimate, score_total, rank_position,
        first_discovered_at, last_updated_at, created_at,
        category:category_id ( id, name, description, is_active, created_at )
      )
      `
    )
    .eq('run_date', date)
    .order('rank_position', { ascending: true });

  if (error) throw new Error(`getOpportunitiesByDate: ${error.message}`);

  const opportunityIds = (data ?? [])
    .map((row: any) => row.opportunity?.id)
    .filter(Boolean) as string[];

  // Fetch this user's curation for all these opportunities in one query
  let curationMap: Record<string, any> = {};
  if (opportunityIds.length > 0) {
    const { data: curations, error: cErr } = await client
      .from('opportunity_curation')
      .select('*')
      .eq('user_id', userId)
      .in('opportunity_id', opportunityIds);

    if (cErr) throw new Error(`getOpportunitiesByDate (curation): ${cErr.message}`);
    for (const c of curations ?? []) {
      curationMap[c.opportunity_id] = c;
    }
  }

  return (data ?? []).map((row: any) => ({
    ...row.opportunity,
    category: row.opportunity?.category ?? null,
    curation: curationMap[row.opportunity?.id] ?? null,
  })) as OpportunityWithCuration[];
}

// ------------------------------------------------------------------
// getOpportunityBySlug
// Full detail view for an authenticated user.
// ------------------------------------------------------------------
export async function getOpportunityBySlug(
  slug: string,
  userId: string,
  userRole: string
): Promise<OpportunityDetail | null> {
  const client = await getAuthedClient(userId, userRole);

  const { data: opp, error: oppErr } = await client
    .from('opportunities')
    .select(
      `
      *,
      category:category_id (*),
      amast_alignments:opportunity_amast_alignments (
        *, amast_domain:domain_id (*)
      ),
      sources:opportunity_sources (
        *, data_source:source_id (*)
      ),
      trend_history:opportunity_trend_history ( * )
      `
    )
    .eq('slug', slug)
    .maybeSingle();

  if (oppErr) throw new Error(`getOpportunityBySlug: ${oppErr.message}`);
  if (!opp) return null;

  const [curationRes, noteRes] = await Promise.all([
    client
      .from('opportunity_curation')
      .select('*')
      .eq('opportunity_id', opp.id)
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('opportunity_notes')
      .select('*')
      .eq('opportunity_id', opp.id)
      .eq('user_id', userId)
      .eq('is_latest', true)
      .maybeSingle(),
  ]);

  if (curationRes.error) throw new Error(`getOpportunityBySlug (curation): ${curationRes.error.message}`);
  if (noteRes.error) throw new Error(`getOpportunityBySlug (note): ${noteRes.error.message}`);

  // Sort trend_history descending (PostgREST doesn't support ORDER BY in nested selects)
  const sortedHistory = [...(opp.trend_history ?? [])].sort(
    (a: any, b: any) => b.run_date.localeCompare(a.run_date)
  );

  return {
    ...opp,
    trend_history: sortedHistory,
    curation: curationRes.data ?? null,
    latest_note: noteRes.data ?? null,
  } as OpportunityDetail;
}

// ------------------------------------------------------------------
// getPublicOpportunityBySlug
// No auth required — strips curation and notes.
// Uses admin client so RLS does not block unauthenticated access.
// Apply your own public-route logic before calling this.
// ------------------------------------------------------------------
export async function getPublicOpportunityBySlug(
  slug: string
): Promise<OpportunityPublic | null> {
  const { data: opp, error } = await supabaseAdmin
    .from('opportunities')
    .select(
      `
      id, title, slug, trend_type, sea_competitor_exists,
      ai_summary, sea_adoption_analysis, business_model_estimate,
      market_size_estimate,
      score_velocity, score_traction, score_sea_competition,
      score_amast_alignment, score_market_size, score_total,
      rank_position, first_discovered_at, last_updated_at,
      category:category_id ( id, name ),
      amast_alignments:opportunity_amast_alignments (
        alignment_notes,
        domain:domain_id ( id, name )
      )
      `
    )
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`getPublicOpportunityBySlug: ${error.message}`);
  return (opp as unknown as OpportunityPublic) ?? null;
}

// ------------------------------------------------------------------
// upsertOpportunity
// Insert or update an opportunity, then append a trend history row.
// Scores are computed server-side by the DB trigger — do not include
// score_total in the payload.
// ------------------------------------------------------------------
export type UpsertOpportunityInput = OpportunityInsert & {
  sources?: Array<Omit<OpportunitySourceInsert, 'opportunity_id'>>;
  alignments?: Array<Omit<OpportunityAlignmentInsert, 'opportunity_id'>>;
};

export async function upsertOpportunity(
  data: UpsertOpportunityInput
): Promise<string> {  // returns opportunity id
  const { sources, alignments, ...oppPayload } = data;

  // Upsert the core opportunity row (match on slug)
  const { data: upserted, error: upsertErr } = await supabaseAdmin
    .from('opportunities')
    .upsert(oppPayload, { onConflict: 'slug' })
    .select('id')
    .single();

  if (upsertErr) throw new Error(`upsertOpportunity: ${upsertErr.message}`);
  const opportunityId = upserted.id as string;

  // Append today's trend history snapshot
  const historyPayload: TrendHistoryInsert = {
    opportunity_id:        opportunityId,
    run_date:              new Date().toISOString().slice(0, 10),
    rank_position:         oppPayload.rank_position ?? null,
    score_velocity:        oppPayload.score_velocity ?? null,
    score_traction:        oppPayload.score_traction ?? null,
    score_sea_competition: oppPayload.score_sea_competition ?? null,
    score_amast_alignment: oppPayload.score_amast_alignment ?? null,
    score_market_size:     oppPayload.score_market_size ?? null,
    trend_type:            oppPayload.trend_type ?? null,
    sea_competitor_exists: oppPayload.sea_competitor_exists,
  };

  const { error: histErr } = await supabaseAdmin
    .from('opportunity_trend_history')
    .upsert(historyPayload, { onConflict: 'opportunity_id,run_date' });

  if (histErr) throw new Error(`upsertOpportunity (history): ${histErr.message}`);

  // Upsert sources if provided
  if (sources && sources.length > 0) {
    const sourceRows: OpportunitySourceInsert[] = sources.map((s) => ({
      ...s,
      opportunity_id: opportunityId,
    }));
    const { error: srcErr } = await supabaseAdmin
      .from('opportunity_sources')
      .upsert(sourceRows, { onConflict: 'opportunity_id,source_id' });
    if (srcErr) throw new Error(`upsertOpportunity (sources): ${srcErr.message}`);
  }

  // Upsert alignments if provided
  if (alignments && alignments.length > 0) {
    const alignmentRows: OpportunityAlignmentInsert[] = alignments.map((a) => ({
      ...a,
      opportunity_id: opportunityId,
    }));
    const { error: alignErr } = await supabaseAdmin
      .from('opportunity_amast_alignments')
      .upsert(alignmentRows, { onConflict: 'opportunity_id,domain_id' });
    if (alignErr) throw new Error(`upsertOpportunity (alignments): ${alignErr.message}`);
  }

  return opportunityId;
}
