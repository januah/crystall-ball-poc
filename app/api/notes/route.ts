import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { addNote } from '@/lib/supabase/notes';
import { supabaseAdmin } from '@/lib/supabase/client';

// POST /api/notes  body: { opportunitySlug, noteText }
export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    const { opportunitySlug, noteText } = await req.json();

    if (!opportunitySlug || !noteText?.trim()) {
      return NextResponse.json(
        { success: false, error: 'opportunitySlug and noteText are required.' },
        { status: 400 }
      );
    }

    // Resolve slug → UUID
    const { data: opp, error: oppErr } = await supabaseAdmin
      .from('opportunities')
      .select('id')
      .eq('slug', opportunitySlug)
      .maybeSingle();

    if (oppErr || !opp) {
      return NextResponse.json({ success: false, error: 'Opportunity not found.' }, { status: 404 });
    }

    const note = await addNote(opp.id, user.id, user.role, noteText.trim());
    return NextResponse.json({ success: true, data: note });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
