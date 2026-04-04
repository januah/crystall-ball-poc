'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { VelocityChart } from '@/components/opportunity/VelocityChart';
import { ScoreBreakdownReal } from '@/components/opportunity/ScoreBreakdownReal';
import { TrendHistory } from '@/components/opportunity/TrendHistory';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Toast, useToast } from '@/components/ui/toast';
import { CurationStatus } from '@/types';
import {
  ArrowLeft, Share2, Calendar, ChevronDown, ChevronUp,
  TrendingUp, Flame, Globe, Cpu, DollarSign, FileText, StickyNote, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<CurationStatus, { active: string; dot: string }> = {
  Interested:  { active: 'bg-emerald-500 text-white shadow-sm shadow-emerald-200', dot: 'bg-emerald-400' },
  Rejected:    { active: 'bg-red-500 text-white shadow-sm shadow-red-200',         dot: 'bg-red-400' },
  'Follow Up': { active: 'bg-amber-500 text-white shadow-sm shadow-amber-200',     dot: 'bg-amber-400' },
  Unreviewed:  { active: 'bg-slate-200 text-slate-600',                            dot: 'bg-slate-400' },
};
const STATUSES: CurationStatus[] = ['Unreviewed', 'Interested', 'Follow Up', 'Rejected'];

function scoreAccent(score: number) {
  if (score >= 80) return { stroke: '#22c55e', text: 'text-emerald-600' };
  if (score >= 60) return { stroke: '#f59e0b', text: 'text-amber-600' };
  return { stroke: '#ef4444', text: 'text-red-500' };
}

function Section({ icon: Icon, title, children, badge }: {
  icon: React.ElementType; title: string; children: React.ReactNode; badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-3.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 border border-violet-100">
          <Icon className="h-3.5 w-3.5 text-violet-600" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function StatusBadge({ type, label }: { type: 'success' | 'danger' | 'warning'; label: string }) {
  const styles = {
    success: 'bg-teal-50 border-teal-200 text-teal-700',
    danger:  'bg-red-50 border-red-200 text-red-600',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  const dots = { success: 'bg-teal-500', danger: 'bg-red-400', warning: 'bg-amber-500' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', styles[type])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dots[type])} />
      {label}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex-1 ml-[220px] animate-pulse px-8 py-6 space-y-4">
      <div className="h-8 bg-slate-200 rounded w-2/3" />
      <div className="h-4 bg-slate-100 rounded w-full" />
      <div className="h-4 bg-slate-100 rounded w-5/6" />
    </div>
  );
}

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast, showToast, hideToast } = useToast();
  const slug = params.slug as string;

  const { data: opp, isLoading, isError } = useQuery({
    queryKey: ['opportunity', slug],
    queryFn: async () => {
      const res = await fetch(`/api/opportunities/${slug}`);
      if (res.status === 401) { window.location.href = '/'; return null; }
      if (!res.ok) return null;
      const { data } = await res.json();
      return data;
    },
  });

  const [status, setStatus] = useState<CurationStatus | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [showNoteHistory, setShowNoteHistory] = useState(false);

  const currentStatus: CurationStatus = status ?? opp?.curationStatus ?? 'Unreviewed';
  const currentNotes: string = notes ?? opp?.notes ?? '';

  const curationMutation = useMutation({
    mutationFn: async (newStatus: CurationStatus) => {
      const res = await fetch('/api/curation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunitySlug: slug, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to save curation');
    },
    onSuccess: () => showToast('Status updated.'),
    onError: () => showToast('Failed to save status.'),
  });

  const handleStatusChange = (s: CurationStatus) => {
    setStatus(s);
    curationMutation.mutate(s);
  };

  const notesMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunitySlug: slug, noteText: text }),
      });
      if (!res.ok) throw new Error('Failed to save note');
    },
    onSuccess: () => {
      showToast('Note saved.');
      queryClient.invalidateQueries({ queryKey: ['opportunity', slug] });
    },
    onError: () => showToast('Failed to save note.'),
  });

  const { data: noteHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ['note-history', opp?.id],
    queryFn: async () => {
      if (!opp?.id) return [];
      const res = await fetch(`/api/notes/${opp.id}`);
      if (!res.ok) return [];
      const { data } = await res.json();
      return data ?? [];
    },
    enabled: showNoteHistory && !!opp?.id,
  });

  const handleShare = () => {
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? window.location.origin;
    navigator.clipboard.writeText(`${portalUrl}/share/${slug}`).catch(() => {});
    showToast('Public link copied to clipboard!');
  };

  if (isLoading) return <div className="flex min-h-screen"><Sidebar /><DetailSkeleton /></div>;
  if (isError || !opp) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Opportunity not found.
      </div>
    );
  }

  const { stroke, text: scoreText } = scoreAccent(opp.score);
  const circ = 2 * Math.PI * 42;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {toast && <Toast message={toast} onClose={hideToast} />}
      <Sidebar />
      <main className="flex-1 ml-[220px]">

        {/* Sticky header */}
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="text-slate-500 hover:text-slate-800 gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">#{opp.rank}</span>
                <span className="text-slate-300">·</span>
                <span className="rounded-md bg-violet-50 border border-violet-200 px-2 py-0.5 text-violet-700 font-medium">{opp.category}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                      currentStatus === s
                        ? STATUS_CONFIG[s].active
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {currentStatus === s && (
                      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_CONFIG[s].dot, 'opacity-80')} />
                    )}
                    {s}
                  </button>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={handleShare} className="gap-1.5 text-slate-600">
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="flex gap-6">

            {/* Left column */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Title block */}
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900 leading-tight">{opp.title}</h1>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{opp.summary}</p>
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium',
                    opp.hypeType === 'Traction'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-orange-50 border-orange-200 text-orange-700'
                  )}>
                    {opp.hypeType === 'Traction' ? <TrendingUp className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                    {opp.hypeType}
                  </span>
                  {opp.seaStatus === 'No SEA Competitor'
                    ? <StatusBadge type="success" label="No SEA Competitor" />
                    : <StatusBadge type="danger" label="Competitor Exists" />}
                  {opp.amastAligned && opp.amastPillars.map((p: string) => (
                    <span key={p} className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      AMAST · {p}
                    </span>
                  ))}
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="h-3 w-3" /> Discovered {opp.dateDiscovered}
                  </span>
                </div>
              </div>

              <Section icon={FileText} title="AI Summary">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{opp.fullSummary}</p>
              </Section>

              <Section
                icon={opp.hypeType === 'Traction' ? TrendingUp : Flame}
                title="Hype vs Traction Analysis"
                badge={
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    opp.hypeType === 'Traction'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-orange-50 border-orange-200 text-orange-700'
                  )}>
                    {opp.hypeType === 'Traction' ? <TrendingUp className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                    {opp.hypeType}
                  </span>
                }
              >
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{opp.hypeExplanation}</p>
              </Section>

              <Section icon={Cpu} title="Score Velocity">
                {opp.velocityData?.length > 0
                  ? <VelocityChart data={opp.velocityData} />
                  : <p className="text-sm text-slate-500">No velocity data yet.</p>}
              </Section>

              <Section
                icon={Globe}
                title="SEA Competition Analysis"
                badge={opp.seaStatus === 'No SEA Competitor'
                  ? <StatusBadge type="success" label="No SEA Competitor" />
                  : <StatusBadge type="danger" label="Competitor Exists" />}
              >
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{opp.seaAnalysis}</p>
              </Section>

              <Section icon={DollarSign} title="Business Model Estimate">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{opp.businessModel}</p>
              </Section>

              <Section icon={History} title="Historical Appearances">
                {opp.trendHistory?.length > 0
                  ? <TrendHistory history={opp.trendHistory} />
                  : <p className="text-sm text-slate-500">No trend history yet.</p>}
              </Section>

              {/* Notes */}
              <Section icon={StickyNote} title="Private Notes">
                <div className="space-y-3">
                  <Textarea
                    rows={4}
                    value={currentNotes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your private notes here... (visible to logged-in users only)"
                    className="text-sm text-slate-700 placeholder:text-slate-400"
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      onClick={() => notesMutation.mutate(currentNotes)}
                      disabled={notesMutation.isPending}
                    >
                      {notesMutation.isPending ? 'Saving...' : 'Save Notes'}
                    </Button>
                    <button
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                      onClick={() => { setShowNoteHistory(!showNoteHistory); refetchHistory(); }}
                    >
                      {showNoteHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showNoteHistory ? 'Hide' : 'View'} note history
                    </button>
                  </div>
                  {showNoteHistory && noteHistory.length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      {noteHistory.map((n: any) => (
                        <div key={n.id} className="text-xs border-b border-slate-100 pb-2 last:border-0">
                          <span className="text-slate-400">{new Date(n.created_at).toLocaleString('en-MY')} (v{n.version})</span>
                          <p className="mt-1 text-slate-600">{n.note_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            </div>

            {/* Right column */}
            <div className="w-72 shrink-0 space-y-4">

              {/* Score card */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 text-center">
                <div className="relative inline-flex items-center justify-center mb-2">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={stroke} strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${circ}`}
                      strokeDashoffset={`${circ * (1 - opp.score / 100)}`}
                      className="transition-all duration-700" />
                  </svg>
                  <div className="absolute text-center">
                    <div className={cn('text-3xl font-bold tabular-nums', scoreText)}>{opp.score}</div>
                    <div className="text-xs text-slate-400 font-medium">/100</div>
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Crystal Ball Score</p>
              </div>

              {/* Score breakdown */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-800">Score Breakdown</h3>
                </div>
                <div className="px-4 py-4">
                  <ScoreBreakdownReal
                    scoreVelocity={(opp.scoreBreakdown?.innovation ?? 0) * 5}
                    scoreTraction={(opp.scoreBreakdown?.timing ?? 0) * 5}
                    scoreSeaCompetition={(opp.scoreBreakdown?.seaFit ?? 0) * 5}
                    scoreAmastAlignment={(opp.scoreBreakdown?.amastFit ?? 0) * 10}
                    scoreMarketSize={(opp.scoreBreakdown?.marketSize ?? 0) * 5}
                    scoreTotal={opp.score}
                  />
                </div>
              </div>

              {/* AMAST alignment */}
              {opp.amastAligned && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 shadow-sm overflow-hidden">
                  <div className="border-b border-indigo-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-indigo-800">AMAST Alignment</h3>
                  </div>
                  <div className="px-4 py-4 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {opp.amastPillars.map((p: string) => (
                        <span key={p} className="rounded-md bg-white border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                          {p}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-indigo-700 leading-relaxed whitespace-pre-line">{opp.amastDetails}</p>
                  </div>
                </div>
              )}

              {/* Quick info */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-800">Quick Info</h3>
                </div>
                <div className="px-4 py-3 divide-y divide-slate-100">
                  {[
                    { label: 'Category',       value: opp.category },
                    { label: 'Classification', value: opp.hypeType },
                    { label: 'SEA Status',     value: opp.seaStatus },
                    { label: 'Rank',           value: `#${opp.rank}` },
                    { label: 'Discovered',     value: opp.dateDiscovered },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-2 text-xs">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-slate-800 font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
