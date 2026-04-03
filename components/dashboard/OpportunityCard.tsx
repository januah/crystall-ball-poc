'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Opportunity, CurationStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Share2, Calendar, ChevronRight } from 'lucide-react';
import { Toast, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { uiCurationToDb } from '@/lib/adapters';

const STATUS_COLORS: Record<CurationStatus, string> = {
  Interested: 'text-emerald-400 border-emerald-600/30 bg-emerald-600/10 hover:bg-emerald-600/20',
  Rejected: 'text-red-400 border-red-600/30 bg-red-600/10 hover:bg-red-600/20',
  'Follow Up': 'text-amber-400 border-amber-600/30 bg-amber-600/10 hover:bg-amber-600/20',
  Unreviewed: 'text-slate-500 border-slate-300 bg-slate-100/50 hover:bg-slate-200/50',
};

const STATUS_CYCLE: CurationStatus[] = ['Unreviewed', 'Interested', 'Follow Up', 'Rejected'];

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity: opp }: OpportunityCardProps) {
  const [status, setStatus] = useState<CurationStatus>(opp.curationStatus);
  const [savingStatus, setSavingStatus] = useState(false);
  const { toast, showToast, hideToast } = useToast();

  const cycleStatus = async (e: React.MouseEvent) => {
    e.preventDefault();
    const idx = STATUS_CYCLE.indexOf(status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const prev = status;
    setStatus(next); // optimistic update
    setSavingStatus(true);
    try {
      const res = await fetch('/api/curation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // opp.id is the slug (see lib/adapters.ts)
        body: JSON.stringify({ opportunitySlug: opp.id, status: next }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      setStatus(prev); // revert on error
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
        <Card className="p-5 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer group">
          <div className="flex gap-4">
            {/* Rank */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-bold text-violet-400">
              #{opp.rank}
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-slate-800 transition-colors truncate">{opp.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{opp.summary}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-bold text-violet-400">{opp.score}</div>
                  <div className="text-[10px] text-slate-400">/100</div>
                </div>
              </div>

              {/* Badges */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge variant={opp.category === 'Emerging Tech' ? 'info' : 'default'}>
                  {opp.category}
                </Badge>
                <Badge variant={opp.hypeType === 'Traction' ? 'success' : 'warning'}>
                  {opp.hypeType === 'Traction' ? '📈 Traction' : '🔥 Hype'}
                </Badge>
                {opp.seaStatus === 'No SEA Competitor' ? (
                  <Badge variant="success">🟢 No SEA Competitor</Badge>
                ) : (
                  <Badge variant="danger">🔴 Competitor Exists</Badge>
                )}
                {opp.amastAligned && opp.amastPillars.map((p) => (
                  <Badge key={p} variant="outline" className="text-violet-400 border-violet-700/40">
                    AMAST · {p}
                  </Badge>
                ))}
                <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
                  <Calendar className="h-3 w-3" />
                  {opp.dateDiscovered}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={cycleStatus}
                  disabled={savingStatus}
                  className={cn(
                    'text-xs font-medium px-3 py-1 rounded-full border transition-all',
                    STATUS_COLORS[status],
                    savingStatus && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {status}
                </button>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={handleShare} className="h-7 px-2">
                    <Share2 className="h-3 w-3" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </>
  );
}
