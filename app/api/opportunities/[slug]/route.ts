import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getOpportunityBySlug } from '@/lib/supabase/opportunities';
import { adaptOpportunity } from '@/lib/adapters';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const user = getSessionUser(req);
    const detail = await getOpportunityBySlug(params.slug, user.id, user.role);

    if (!detail) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const opportunity = adaptOpportunity({
      ...detail,
      amast_alignments: detail.amast_alignments as any,
      trend_history: detail.trend_history,
      curation: detail.curation,
      latest_note: detail.latest_note,
    });

    return NextResponse.json({ success: true, data: opportunity });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
