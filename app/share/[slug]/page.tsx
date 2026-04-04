import { notFound } from 'next/navigation';
import { getPublicOpportunityBySlug } from '@/lib/supabase/opportunities';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreBreakdownReal } from '@/components/opportunity/ScoreBreakdownReal';
import { Sparkles, Calendar } from 'lucide-react';
import type { Metadata } from 'next';

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const opp = await getPublicOpportunityBySlug(params.slug);
  if (!opp) return { title: 'Not Found — Crystal Ball' };
  return {
    title: `${opp.title} — Crystal Ball`,
    description: opp.ai_summary?.slice(0, 160) ?? '',
    openGraph: {
      title: opp.title,
      description: opp.ai_summary?.slice(0, 160) ?? '',
      type: 'article',
    },
  };
}

export default async function SharePage({ params }: Props) {
  const opp = await getPublicOpportunityBySlug(params.slug);
  if (!opp) notFound();

  const alignments = (opp as any).amast_alignments ?? [];
  const trendType = opp.trend_type === 'traction' ? 'Traction' : 'Hype';
  const category = (opp as any).category?.name ?? 'Emerging SaaS';
  const score = Math.round(opp.score_total ?? 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Public header */}
      <div className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 border border-violet-600/30">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <span className="text-sm font-bold text-foreground">Crystal Ball</span>
        </div>
        <span className="text-xs text-muted-foreground bg-card border border-border px-3 py-1 rounded-full">
          Public View · Read Only
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Title + badges */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl font-bold text-violet-400">#{opp.rank_position}</span>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{opp.title}</h1>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Discovered {opp.first_discovered_at?.slice(0, 10)}
              </div>
            </div>
          </div>
          <p className="text-muted-foreground">{opp.ai_summary?.split('\n')[0]}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant={category === 'Emerging Tech' ? 'info' : 'default'}>{category}</Badge>
            <Badge variant={trendType === 'Traction' ? 'success' : 'warning'}>
              {trendType === 'Traction' ? '📈 Traction' : '🔥 Hype'}
            </Badge>
            {opp.sea_competitor_exists
              ? <Badge variant="danger">🔴 Competitor Exists</Badge>
              : <Badge variant="success">🟢 No SEA Competitor</Badge>}
            {alignments.map((a: any) => (
              <Badge key={a.domain?.id} variant="outline" className="text-violet-400 border-violet-700/40">
                AMAST · {a.domain?.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Left: main content */}
          <div className="col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">AI Summary</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{opp.ai_summary}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">SEA Adoption Analysis</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">{opp.sea_adoption_analysis}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Business Model Estimate</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">{opp.business_model_estimate}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Market Size Estimate</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">{opp.market_size_estimate}</CardContent>
            </Card>
          </div>

          {/* Right: score */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="relative inline-flex items-center justify-center mb-3">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#7c3aed" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - score / 100)}`} />
                  </svg>
                  <div className="absolute">
                    <div className="text-2xl font-bold text-violet-400">{score}</div>
                    <div className="text-xs text-muted-foreground">/100</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Crystal Ball Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Score Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ScoreBreakdownReal
                  scoreVelocity={opp.score_velocity ?? 0}
                  scoreTraction={opp.score_traction ?? 0}
                  scoreSeaCompetition={opp.score_sea_competition ?? 0}
                  scoreAmastAlignment={opp.score_amast_alignment ?? 0}
                  scoreMarketSize={opp.score_market_size ?? 0}
                  scoreTotal={score}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <footer className="border-t border-border mt-12 py-6 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          Powered by <span className="font-semibold text-foreground">Crystal Ball</span> · AMAST Sdn Bhd · {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
