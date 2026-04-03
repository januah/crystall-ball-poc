import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { upsertCurationStatus } from '@/lib/supabase/curation';
import { supabaseAdmin } from '@/lib/supabase/client';
import { uiCurationToDb } from '@/lib/adapters';
import type { CurationStatus } from '@/types';

// PATCH /api/curation  body: { opportunitySlug, status }
export async function PATCH(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    const { opportunitySlug, status } = await req.json();

    if (!opportunitySlug || !status) {
      return NextResponse.json(
        { success: false, error: 'opportunitySlug and status are required.' },
        { status: 400 }
      );
    }

    // Resolve slug → opportunity UUID
    const { data: opp, error: oppErr } = await supabaseAdmin
      .from('opportunities')
      .select('id')
      .eq('slug', opportunitySlug)
      .maybeSingle();

    if (oppErr || !opp) {
      return NextResponse.json({ success: false, error: 'Opportunity not found.' }, { status: 404 });
    }

    const dbStatus = uiCurationToDb(status as CurationStatus);
    const row = await upsertCurationStatus(opp.id, user.id, user.role, dbStatus as any);

    return NextResponse.json({ success: true, data: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
