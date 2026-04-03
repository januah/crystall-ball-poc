import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getOpportunitiesByDate } from '@/lib/supabase/opportunities';
import { supabaseAdmin } from '@/lib/supabase/client';
import { formatInTimeZone } from 'date-fns-tz';
import { adaptOpportunity, dbCurationToUI } from '@/lib/adapters';
import type { OpportunityWithCuration } from '@/lib/supabase/types';

const MYT = 'Asia/Kuala_Lumpur';

// GET /api/opportunities?date=YYYY-MM-DD&category=...&status=...&amast_aligned=true&no_sea_competitor=true
export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    const { searchParams } = req.nextUrl;

    const todayMYT = formatInTimeZone(new Date(), MYT, 'yyyy-MM-dd');
    const date = searchParams.get('date') ?? todayMYT;
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const amastAligned = searchParams.get('amast_aligned');
    const noSeaCompetitor = searchParams.get('no_sea_competitor');

    const rows: OpportunityWithCuration[] = await getOpportunitiesByDate(
      date,
      user.id,
      user.role
    );

    // Fetch alignment data for all opportunity IDs in one query
    const oppIds = rows.map((r: any) => r.id).filter(Boolean);
    let alignmentMap: Record<string, string[]> = {};

    if (oppIds.length > 0) {
      const { data: alignments } = await supabaseAdmin
        .from('opportunity_amast_alignments')
        .select('opportunity_id, amast_domain:domain_id ( name )')
        .in('opportunity_id', oppIds);

      for (const a of alignments ?? []) {
        const id = (a as any).opportunity_id;
        const name = (a as any).amast_domain?.name;
        if (id && name) {
          alignmentMap[id] = alignmentMap[id] ?? [];
          alignmentMap[id].push(name);
        }
      }
    }

    // Adapt to UI type and apply server-side filters
    let opportunities = rows.map((row: any) =>
      adaptOpportunity({
        ...row,
        amast_alignments: (alignmentMap[row.id] ?? []).map((name) => ({
          id: '',
          opportunity_id: row.id,
          domain_id: '',
          alignment_notes: null,
          created_at: '',
          amast_domain: { id: '', name, description: null, is_active: true, created_at: '' },
        })),
        trend_history: [],
        curation: row.curation,
      })
    );

    if (category && category !== 'All') {
      opportunities = opportunities.filter((o) => o.category === category);
    }
    if (status && status !== 'All') {
      opportunities = opportunities.filter(
        (o) => dbCurationToUI(o.curationStatus) === status
      );
    }
    if (amastAligned === 'true') {
      opportunities = opportunities.filter((o) => o.amastAligned);
    }
    if (noSeaCompetitor === 'true') {
      opportunities = opportunities.filter(
        (o) => o.seaStatus === 'No SEA Competitor'
      );
    }

    return NextResponse.json({ success: true, data: opportunities });
  } catch (err) {
    console.error('[GET /api/opportunities]', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
