import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { callAnalystAI } from '@/lib/analyst/ai';
import type { AnalystInput } from '@/lib/analyst/types';

export const maxDuration = 120;

// POST /api/analyst
export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (user.role !== 'admin' && user.role !== 'analyst') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json() as AnalystInput;

    if (!body.opportunity_title?.trim()) {
      return NextResponse.json({ success: false, error: 'opportunity_title is required' }, { status: 400 });
    }
    if (!body.opportunity_description?.trim()) {
      return NextResponse.json({ success: false, error: 'opportunity_description is required' }, { status: 400 });
    }
    if (!Array.isArray(body.amast_verticals) || body.amast_verticals.length === 0) {
      return NextResponse.json({ success: false, error: 'amast_verticals must be a non-empty array' }, { status: 400 });
    }

    const report = await callAnalystAI(body);

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
