'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Opportunity, CurationStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Share2, Calendar, ChevronRight, TrendingUp, Flame } from 'lucide-react';
import { Toast, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { uiCurationToDb } from '@/lib/adapters';

const STATUS_COLORS: Record<CurationStatus, string> = {
  Interested:  'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
  Rejected:    'text-red-500 border-red-200 bg-red-50 hover:bg-red-100',
  'Follow Up': 'text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100',
  Unreviewed:  'text-slate-400 border-slate-200 bg-slate-50 hover:bg-slate-100',
};

const STATUS_DOTS: Record<CurationStatus, string> = {
  Interested:  'bg-emerald-500',
  Rejected:    'bg-red-500',
  'Follow Up': 'bg-amber-500',
  Unreviewed:  'bg-slate-300',
};

const STATUS_CYCLE: CurationStatus[] = ['Unreviewed', 'Interested', 'Follow Up', 'Rejected'];

function scoreColor(score: number) {
  if (score >= 80) return { ring: '#22c55e', bg: 'bg-emerald-500', accent: 'border-l-emerald-500', text: 'text-emerald-600' };
  if (score >= 60) return { ring: '#f59e0b', bg: 'bg-amber-500', accent: 'border-l-amber-500', text: 'text-amber-600' };
  return { ring: '#ef4444', bg: 'bg-red-500', accent: 'border-l-red-500', text: 'text-red-500' };
}

function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const { ring, text } = scoreColor(score);

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" width="56" height="56">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke={ring} strokeWidth="3.5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="flex flex-col items-center leading-none">
        <span className={cn('text-sm font-bold tabular-nums', text)}>{score}</span>
        <span className="text-[9px] text-slate-400 font-medium">/100</span>
      </div>
    </div>
  );
}

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity: opp }: OpportunityCardProps) {
  const [status, setStatus] = useState<CurationStatus>(opp.curationStatus);
  const [savingStatus, setSavingStatus] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const { accent } = scoreColor(opp.score);

  const cycleStatus = async (e: React.MouseEvent) => {
    e.preventDefault();
    const idx = STATUS_CYCLE.indexOf(status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const prev = status;
    setStatus(next);
    setSavingStatus(true);
    try {
      const res = await fetch('/api/curation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunitySlug: opp.id, status: next }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setStatus(prev);
      showToast('Failed to save status. Please try again.');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? window.location.origin;
    navigator.clipboard.writeText(`${portalUrl}/share/${opp.id}`).catch(() => {});
    showToast('Link copied to clipboard!');
  };

  return (
    <>
      {toast && <Toast message={toast} onClose={hideToast} />}
      <Link href={`/opportunity/${opp.id}`}>
        <div className={cn(
          'group relative flex gap-5 rounded-xl border border-border bg-card p-5 pl-6',
          'border-l-4 transition-all duration-200 hover:shadow-md hover:-translate-y-px',
          accent
        )}>
          {/* Rank badge */}
          <div className="absolute -top-2.5 left-5 flex h-5 items-center rounded-full bg-slate-800 px-2 text-[10px] font-bold text-white tabular-nums">
            #{opp.rank}
          </div>

          {/* Score ring */}
          <div className="mt-1 shrink-0">
            <ScoreRing score={opp.score} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground leading-snug group-hover:text-violet-700 transition-colors pr-2">
                {opp.title}
              </h3>
              <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-slate-300 group-hover:text-violet-400 transition-colors" />
            </div>

            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{opp.summary}</p>

            {/* Badges */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 border border-violet-200 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                {opp.category}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium',
                opp.hypeType === 'Traction'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-orange-50 border-orange-200 text-orange-700'
              )}>
                {opp.hypeType === 'Traction'
                  ? <TrendingUp className="h-2.5 w-2.5" />
                  : <Flame className="h-2.5 w-2.5" />}
                {opp.hypeType}
              </span>
              {opp.seaStatus === 'No SEA Competitor' ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-medium text-teal-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                  No SEA Competitor
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  Competitor Exists
                </span>
              )}
              {opp.amastAligned && opp.amastPillars.map((p) => (
                <span key={p} className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                  AMAST · {p}
                </span>
              ))}
            </div>

            {/* Footer row */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={cycleStatus}
                  disabled={savingStatus}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    STATUS_COLORS[status],
                    savingStatus && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOTS[status])} />
                  {status}
                </button>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {opp.dateDiscovered}
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={handleShare} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600">
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Link>
    </>
  );
}
