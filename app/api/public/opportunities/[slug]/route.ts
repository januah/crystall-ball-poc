import { NextRequest, NextResponse } from 'next/server';
import { getPublicOpportunityBySlug } from '@/lib/supabase/opportunities';

// No auth required — used by /share/[slug]
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const opp = await getPublicOpportunityBySlug(params.slug);
    if (!opp) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: opp });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
