// =============================================================
// Crystal Ball — Curation Helpers
// =============================================================
import { supabaseAdmin } from './client';
import type { CurationStatus, OpportunityCurationRow } from './types';

// ------------------------------------------------------------------
// upsertCurationStatus
// Creates or updates the user's curation status for an opportunity.
// Auth is enforced at the API route layer; supabaseAdmin bypasses RLS
// to avoid session-var issues with pgBouncer connection pooling.
// ------------------------------------------------------------------
export async function upsertCurationStatus(
  opportunityId: string,
  userId: string,
  userRole: string,
  status: CurationStatus
): Promise<OpportunityCurationRow> {
  const { data, error } = await supabaseAdmin
    .from('opportunity_curation')
    .upsert(
      { opportunity_id: opportunityId, user_id: userId, status },
      { onConflict: 'opportunity_id,user_id' }
    )
    .select()
    .single();

  if (error) throw new Error(`upsertCurationStatus: ${error.message}`);
  return data as OpportunityCurationRow;
}

// ------------------------------------------------------------------
// getUserCurationForDate
// Returns all curation rows for a user across opportunities that have
// a trend_history record for the given date.
// ------------------------------------------------------------------
export async function getUserCurationForDate(
  userId: string,
  userRole: string,
  date: string  // 'YYYY-MM-DD'
): Promise<OpportunityCurationRow[]> {
  const { data: historyRows, error: histErr } = await supabaseAdmin
    .from('opportunity_trend_history')
    .select('opportunity_id')
    .eq('run_date', date);

  if (histErr) throw new Error(`getUserCurationForDate (history): ${histErr.message}`);

  const ids = (historyRows ?? []).map((r: any) => r.opportunity_id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('opportunity_curation')
    .select('*')
    .eq('user_id', userId)
    .in('opportunity_id', ids);

  if (error) throw new Error(`getUserCurationForDate: ${error.message}`);
  return (data ?? []) as OpportunityCurationRow[];
}
