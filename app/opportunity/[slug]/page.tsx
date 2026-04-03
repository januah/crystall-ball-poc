'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { VelocityChart } from '@/components/opportunity/VelocityChart';
import { ScoreBreakdownReal } from '@/components/opportunity/ScoreBreakdownReal';
import { TrendHistory } from '@/components/opportunity/TrendHistory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Toast, useToast } from '@/components/ui/toast';
import { CurationStatus } from '@/types';
import { ArrowLeft, Share2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<CurationStatus, string> = {
  Interested: 'bg-emerald-600 text-white',
  Rejected: 'bg-red-600 text-white',
  'Follow Up': 'bg-amber-600 text-white',
  Unreviewed: 'bg-slate-100 text-slate-500',
};
const STATUSES: CurationStatus[] = ['Unreviewed', 'Interested', 'Follow Up', 'Rejected'];

function DetailSkeleton() {
  return (
    <div className="flex-1 ml-[240px] animate-pulse px-8 py-6 space-y-4">
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

  // Curation mutation
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

  // Notes mutation
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

  // Note history
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

  return (
    <div className="flex min-h-screen">
      {toast && <Toast message={toast} onClose={hideToast} />}
      <Sidebar />
      <main className="flex-1 ml-[240px]">
        {/* Header */}
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/80 backdrop-blur-md px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="h-4 w-px bg-slate-200" />
              <div>
                <span className="text-xs text-slate-400">#{opp.rank}</span>
                <span className="text-xs text-slate-500 mx-2">·</span>
                <span className="text-xs text-slate-400">{opp.category}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-all',
                    currentStatus === s ? STATUS_COLORS[s] : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                  )}
                >
                  {s}
                </button>
              ))}
              <Button size="sm" variant="outline" onClick={handleShare}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="flex gap-6">
            {/* Left column */}
            <div className="flex-1 min-w-0 space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{opp.title}</h1>
                <p className="mt-2 text-slate-600">{opp.summary}</p>
                <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                  <Calendar className="h-3 w-3" />
                  Discovered {opp.dateDiscovered}
                </div>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">AI Summary</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{opp.fullSummary}</CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    Hype vs Traction Analysis
                    <Badge variant={opp.hypeType === 'Traction' ? 'success' : 'warning'}>
                      {opp.hypeType === 'Traction' ? '📈 Traction' : '🔥 Hype'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-400 leading-relaxed">{opp.hypeExplanation}</CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Score Velocity</CardTitle></CardHeader>
                <CardContent>
                  {opp.velocityData?.length > 0 ? (
                    <VelocityChart data={opp.velocityData} />
                  ) : (
                    <p className="text-xs text-slate-400">No velocity data yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    SEA Competition Analysis
                    {opp.seaStatus === 'No SEA Competitor'
                      ? <Badge variant="success">🟢 No SEA Competitor</Badge>
                      : <Badge variant="danger">🔴 Competitor Exists</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-400 leading-relaxed">{opp.seaAnalysis}</CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Business Model Estimate</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-400 leading-relaxed">{opp.businessModel}</CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Historical Appearances</CardTitle></CardHeader>
                <CardContent>
                  {opp.trendHistory?.length > 0 ? (
                    <TrendHistory history={opp.trendHistory} />
                  ) : (
                    <p className="text-xs text-slate-400">No trend history yet.</p>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Private Notes</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    rows={4}
                    value={currentNotes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your private notes here... (visible to logged-in users only)"
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
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                      onClick={() => { setShowNoteHistory(!showNoteHistory); refetchHistory(); }}
                    >
                      {showNoteHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showNoteHistory ? 'Hide' : 'View'} note history
                    </button>
                  </div>
                  {showNoteHistory && noteHistory.length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      {noteHistory.map((n: any) => (
                        <div key={n.id} className="text-xs text-slate-500 border-b border-slate-100 pb-2">
                          <span className="text-slate-400">{new Date(n.created_at).toLocaleString('en-MY')} (v{n.version})</span>
                          <p className="mt-1">{n.note_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <div className="w-80 shrink-0 space-y-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="relative inline-flex items-center justify-center mb-3">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#7c3aed" strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - opp.score / 100)}`}
                        className="transition-all duration-700" />
                    </svg>
                    <div className="absolute text-center">
                      <div className="text-3xl font-bold text-violet-400">{opp.score}</div>
                      <div className="text-xs text-slate-400">/100</div>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-600">Crystal Ball Score</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Score Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <ScoreBreakdownReal
                    scoreVelocity={(opp.scoreBreakdown?.innovation ?? 0) * 5}
                    scoreTraction={(opp.scoreBreakdown?.timing ?? 0) * 5}
                    scoreSeaCompetition={(opp.scoreBreakdown?.seaFit ?? 0) * 5}
                    scoreAmastAlignment={(opp.scoreBreakdown?.amastFit ?? 0) * 10}
                    scoreMarketSize={(opp.scoreBreakdown?.marketSize ?? 0) * 5}
                    scoreTotal={opp.score}
                  />
                </CardContent>
              </Card>

              {opp.amastAligned && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">AMAST Alignment</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {opp.amastPillars.map((p: string) => (
                        <Badge key={p} variant="default">{p}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{opp.amastDetails}</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-sm">Quick Info</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Category', value: opp.category },
                    { label: 'Classification', value: opp.hypeType },
                    { label: 'SEA Status', value: opp.seaStatus },
                    { label: 'Rank', value: `#${opp.rank}` },
                    { label: 'Discovered', value: opp.dateDiscovered },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-slate-700 font-medium">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
