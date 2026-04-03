// =============================================================
// Crystal Ball — Notes Helpers
// Notes are append-only and versioned per user per opportunity.
// =============================================================
import { getAuthedClient } from './client';
import type { OpportunityNoteRow } from './types';

// ------------------------------------------------------------------
// addNote
// Appends a new versioned note. Marks all previous notes for this
// user + opportunity as is_latest = false, then inserts the new one.
// Uses the anon client (RLS enforces user_id ownership).
// ------------------------------------------------------------------
export async function addNote(
  opportunityId: string,
  userId: string,
  userRole: string,
  noteText: string
): Promise<OpportunityNoteRow> {
  const client = await getAuthedClient(userId, userRole);

  // Determine next version number
  const { data: existing, error: versionErr } = await client
    .from('opportunity_notes')
    .select('version')
    .eq('opportunity_id', opportunityId)
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionErr) throw new Error(`addNote (version lookup): ${versionErr.message}`);

  const nextVersion = existing ? (existing.version as number) + 1 : 1;

  // Flip previous latest note to is_latest = false
  if (existing) {
    // We must do this via supabaseAdmin since UPDATE is not allowed by RLS for notes
    // (notes are intentionally append-only — no UPDATE policy exists)
    // Use a raw RPC or admin client here.
    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { error: flipErr } = await adminClient
      .from('opportunity_notes')
      .update({ is_latest: false })
      .eq('opportunity_id', opportunityId)
      .eq('user_id', userId)
      .eq('is_latest', true);

    if (flipErr) throw new Error(`addNote (flip is_latest): ${flipErr.message}`);
  }

  // Insert new note
  const { data: newNote, error: insertErr } = await client
    .from('opportunity_notes')
    .insert({
      opportunity_id: opportunityId,
      user_id: userId,
      note_text: noteText,
      version: nextVersion,
      is_latest: true,
    })
    .select()
    .single();

  if (insertErr) throw new Error(`addNote (insert): ${insertErr.message}`);
  return newNote as OpportunityNoteRow;
}

// ------------------------------------------------------------------
// getNoteHistory
// All versions of a user's notes for an opportunity, oldest first.
// ------------------------------------------------------------------
export async function getNoteHistory(
  opportunityId: string,
  userId: string,
  userRole: string
): Promise<OpportunityNoteRow[]> {
  const client = await getAuthedClient(userId, userRole);

  const { data, error } = await client
    .from('opportunity_notes')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .eq('user_id', userId)
    .order('version', { ascending: true });

  if (error) throw new Error(`getNoteHistory: ${error.message}`);
  return (data ?? []) as OpportunityNoteRow[];
}

// ------------------------------------------------------------------
// getLatestNote
// Returns only the is_latest = true note for a user + opportunity.
// ------------------------------------------------------------------
export async function getLatestNote(
  opportunityId: string,
  userId: string,
  userRole: string
): Promise<OpportunityNoteRow | null> {
  const client = await getAuthedClient(userId, userRole);

  const { data, error } = await client
    .from('opportunity_notes')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .eq('user_id', userId)
    .eq('is_latest', true)
    .maybeSingle();

  if (error) throw new Error(`getLatestNote: ${error.message}`);
  return (data as OpportunityNoteRow) ?? null;
}
