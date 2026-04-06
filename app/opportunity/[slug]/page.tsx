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
import type { AnalystReport } from '@/lib/analyst/types';
import {
  ArrowLeft, Share2, Calendar, ChevronDown, ChevronUp,
  TrendingUp, Flame, Globe, Cpu, DollarSign, FileText, StickyNote,
  History, Sparkles, Loader2, Users, Zap, BookOpen, AlertTriangle,
  CheckCircle2, ShieldAlert, Shield, ShieldCheck, Copy, Check,
  ArrowRight, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Curation config ────────────────────────────────────────────────
const STATUS_CONFIG: Record<CurationStatus, { active: string; dot: string }> = {
  Interested:  { active: 'bg-emerald-500 text-white shadow-sm shadow-emerald-200', dot: 'bg-emerald-400' },
  Rejected:    { active: 'bg-red-500 text-white shadow-sm shadow-red-200',         dot: 'bg-red-400'     },
  'Follow Up': { active: 'bg-amber-500 text-white shadow-sm shadow-amber-200',     dot: 'bg-amber-400'   },
  Unreviewed:  { active: 'bg-slate-200 text-slate-600',                            dot: 'bg-slate-400'   },
};
const STATUSES: CurationStatus[] = ['Unreviewed', 'Interested', 'Follow Up', 'Rejected'];

// ─── Analyst display helpers ─────────────────────────────────────────
const HOOK_BADGE: Record<string, string> = {
  acquisition: 'bg-blue-100 text-blue-700 border-blue-200',
  retention:   'bg-violet-100 text-violet-700 border-violet-200',
  viral:       'bg-pink-100 text-pink-700 border-pink-200',
  plg:         'bg-emerald-100 text-emerald-700 border-emerald-200',
};
const RISK_CFG: Record<string, { badge: string; icon: React.FC<any> }> = {
  High:   { badge: 'bg-destructive/10 text-destructive border-destructive/20',  icon: ShieldAlert  },
  Medium: { badge: 'bg-amber-100 text-amber-700 border-amber-200',              icon: Shield       },
  Low:    { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',        icon: ShieldCheck  },
};
const LAYER_COLORS = [
  'border-l-violet-500',
  'border-l-blue-500',
  'border-l-orange-500',
  'border-l-teal-500',
  'border-l-slate-400',
];

function scoreAccent(score: number) {
  if (score >= 80) return { stroke: '#22c55e', text: 'text-emerald-600' };
  if (score >= 60) return { stroke: '#f59e0b', text: 'text-amber-600' };
  return { stroke: '#ef4444', text: 'text-red-500' };
}

// ─── Shared components ───────────────────────────────────────────────
function Section({ icon: Icon, title, children, badge, newBadge }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
  newBadge?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-50 border border-violet-100 dark:bg-violet-900/30 dark:border-violet-700">
          <Icon className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {newBadge && (
          <span className="ml-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            New
          </span>
        )}
        {badge && <div className="ml-auto">{badge}</div>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function StatusBadge({ type, label }: { type: 'success' | 'danger' | 'warning'; label: string }) {
  const styles = { success: 'bg-teal-50 border-teal-200 text-teal-700', danger: 'bg-red-50 border-red-200 text-red-600', warning: 'bg-amber-50 border-amber-200 text-amber-700' };
  const dots   = { success: 'bg-teal-500', danger: 'bg-red-400', warning: 'bg-amber-500' };
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

// ─── Analyst section components ──────────────────────────────────────

function OpportunityDepthSection({ report }: { report: AnalystReport }) {
  const d = report.opportunity_depth;
  return (
    <Section icon={Zap} title="Opportunity Depth" newBadge>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Problem Intensity',  value: d.problem_intensity  },
          { label: 'Buyer Urgency',      value: d.buyer_urgency      },
          { label: 'Moat Potential',     value: d.moat_potential     },
          { label: 'Adjacent Expansion', value: d.adjacent_expansion },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-muted/40 border border-border px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-1.5">{label}</p>
            <p className="text-sm text-foreground leading-relaxed">{value}</p>
          </div>
        ))}
      </div>
      {report.sea_competition.global_analogues?.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
          Comparable global plays: {report.sea_competition.global_analogues.join(', ')}.
        </p>
      )}
    </Section>
  );
}

function MarketSizeSection({ report }: { report: AnalystReport }) {
  const m = report.market_size_revenue;
  const sorted = [...(m.revenue_streams ?? [])].sort((a, b) => a.priority - b.priority);
  return (
    <Section icon={DollarSign} title="Market Size & Revenue Potential" newBadge>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'SEA Market TAM',  value: m.sea_market_usd,        sub: 'addressable base'   },
          { label: 'Tooling TAM est.',value: m.safety_tooling_tam_pct, sub: 'of AI spend'        },
          { label: 'Year-3 ARR Target',value: m.year3_arr_range,      sub: 'realistic SaaS range'},
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-lg bg-muted/40 border border-border px-4 py-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {sorted.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs border border-border bg-muted rounded-full px-3 py-1 font-medium">
            <ArrowRight className="h-3 w-3 text-primary shrink-0" />{s.name}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{m.recommended_entry}</p>
    </Section>
  );
}

function CustomerSegmentationSection({ report }: { report: AnalystReport }) {
  const TIER_COLORS = ['text-violet-700 bg-violet-50 border-violet-200', 'text-amber-700 bg-amber-50 border-amber-200', 'text-teal-700 bg-teal-50 border-teal-200'];
  return (
    <Section icon={Users} title="Customer Segmentation" newBadge>
      <div className="grid grid-cols-3 gap-3">
        {report.customer_segmentation.map((tier, i) => (
          <div key={tier.tier} className="rounded-lg border border-border bg-muted/20 px-4 py-4 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <span className={cn('text-[10px] font-bold rounded px-1.5 py-0.5 border', TIER_COLORS[i])}>Tier {tier.tier}</span>
              <span className="text-sm font-bold text-foreground">{tier.label}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{tier.profile}</p>
            <div className="pt-1 space-y-1 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ACV</span>
                <span className="font-semibold text-foreground">{tier.acv_usd}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Sales cycle</span>
                <span className="font-semibold text-foreground">{tier.sales_cycle}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SystemImplementationSection({ report }: { report: AnalystReport }) {
  const s = report.system_implementation;
  return (
    <Section icon={Cpu} title="System Implementation Overview" newBadge>
      <p className="text-xs text-muted-foreground mb-4">
        A competitive system requires {s.layers.length} interlocking technical layers, each surfacing distinct product value.
      </p>
      <div className="space-y-2 mb-5">
        {s.layers.map((layer, i) => (
          <div key={layer.number} className={cn('rounded-lg border-l-4 border border-border bg-muted/10 px-4 py-3', LAYER_COLORS[i] ?? 'border-l-slate-400')}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Layer {layer.number} — {layer.name}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {layer.components.map((c) => (
                <span key={c} className="text-[11px] bg-background border border-border rounded-full px-2.5 py-0.5">{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
          <p className="font-semibold text-foreground mb-1">Recommended Stack</p>
          <p className="leading-relaxed">{s.recommended_stack}</p>
        </div>
        <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
          <p className="font-semibold text-foreground mb-1">SEA Deployment Notes</p>
          <p className="leading-relaxed">{s.sea_deployment_notes}</p>
        </div>
      </div>
    </Section>
  );
}

function ProductHooksSection({ report }: { report: AnalystReport }) {
  return (
    <Section icon={Zap} title="Key Product Hooks" newBadge>
      <p className="text-xs text-muted-foreground mb-4">
        These are the features most likely to drive acquisition, retention, and word-of-mouth in the SEA market.
      </p>
      <div className="space-y-2">
        {report.product_hooks.map((hook, i) => {
          const DOTS = ['bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-blue-500', 'bg-amber-500'];
          return (
            <div key={hook.name} className="rounded-lg border border-border bg-muted/10 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', DOTS[i] ?? 'bg-muted')} />
                  <p className="text-sm font-semibold text-foreground">{hook.name}</p>
                </div>
                <span className={cn('shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border', HOOK_BADGE[hook.hook_type] ?? '')}>
                  {hook.hook_type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 ml-4 leading-relaxed">{hook.description}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ReplicationPlaybookSection({ report }: { report: AnalystReport }) {
  return (
    <Section icon={BookOpen} title="Replication Playbook (for business builders)" newBadge>
      <div className="space-y-0">
        {report.replication_playbook.map((step, idx) => (
          <div key={step.step} className="relative flex gap-4">
            {idx < report.replication_playbook.length - 1 && (
              <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border" />
            )}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm shadow-violet-900/20">
              {step.step}
            </div>
            <div className="pb-6 pt-1.5">
              <p className="text-sm font-semibold text-foreground mb-1">{step.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function RiskRegisterSection({ report }: { report: AnalystReport }) {
  return (
    <Section icon={AlertTriangle} title="Risk Register" newBadge>
      <div className="space-y-3">
        {report.risk_register.map((risk) => {
          const cfg = RISK_CFG[risk.severity] ?? RISK_CFG.Medium;
          const RiskIcon = cfg.icon;
          return (
            <div key={risk.name} className="flex gap-3 rounded-lg border border-border bg-muted/10 px-4 py-3">
              <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border mt-0.5', cfg.badge)}>
                <RiskIcon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-foreground">{risk.name}</p>
                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border', cfg.badge)}>
                    {risk.severity}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{risk.description}</p>
                <div className="mt-1.5 flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                  <p className="text-xs text-emerald-700 leading-relaxed">{risk.mitigation}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function buildClaudePrompt(opp: any, report: AnalystReport): string {
  const layers = report.system_implementation.layers
    .map((l) => `Layer ${l.number} — ${l.name}:\n  ${l.components.join(', ')}`)
    .join('\n\n');

  const segments = report.customer_segmentation
    .map((t) => `- Tier ${t.tier} (${t.label}): ${t.profile} ACV ${t.acv_usd}, ${t.sales_cycle} sales cycle`)
    .join('\n');

  const hooks = report.product_hooks
    .map((h) => `- ${h.name} [${h.hook_type}]: ${h.description}`)
    .join('\n');

  return `You are an expert software architect and full-stack developer. Build a complete production-ready SaaS application based on the following market intelligence brief.

## Opportunity
**Title:** ${opp.title}
**Classification:** ${report.hype_vs_traction.classification} | ${report.meta.category}
**SEA Region:** Southeast Asia

## Problem & Context
${report.ai_summary.overview}

**Gap in Market:** ${report.ai_summary.gap_statement}

## Target Customers
${segments}

## System Architecture (5 Layers)
${layers}

**Recommended Stack:** ${report.system_implementation.recommended_stack}

**SEA Deployment Requirements:** ${report.system_implementation.sea_deployment_notes}

## Core Product Features to Build
${hooks}

## Revenue Model
Streams: ${report.business_model_estimate.streams.join(', ')}
${report.business_model_estimate.notes}

## Constraints & Requirements
- Multi-tenant architecture with row-level security
- RBAC with roles: superadmin, admin, analyst, viewer
- JWT authentication (no server-side sessions)
- SEA-optimised: support BM/EN languages, MYR/SGD/IDR currencies, local regulatory compliance APIs
- All API responses use envelope: { success, data, message } or { success: false, error, message }
- Prefix-based IDs (not UUIDs) for master records
- Pagination on all list views (page size 20)
- No alert()/confirm() — custom modal components only

## What to Build
Create a complete, deployable SaaS system for ${opp.title} with:

1. **Backend** (Node.js/Express or FastAPI)
   - RESTful API following layered architecture: routes → controllers → services → models
   - Supabase PostgreSQL with RLS policies per tenant
   - All endpoints authenticated and role-checked

2. **Frontend** (React/Next.js)
   - Dashboard with opportunity/data overview
   - Role-aware UI — show/hide by role
   - All sections from the system layers above

3. **Database Schema**
   - Design tables for all entities implied by the 5-layer architecture
   - Include RLS policies, indexes, and triggers
   - Seeding script with realistic dummy data

Start by asking clarifying questions if needed, then present an implementation plan before writing any code.`;
}

function ClaudePromptSection({ opp, report }: { opp: any; report: AnalystReport }) {
  const [copied, setCopied] = useState(false);
  const prompt = buildClaudePrompt(opp, report);

  function copy() {
    navigator.clipboard.writeText(prompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Section icon={Sparkles} title="Claude Code Build Prompt" newBadge>
      <p className="text-xs text-muted-foreground mb-3">
        Complete prompt to build this system in Claude Code. Copy and paste into a new Claude Code session.
      </p>
      <div className="relative">
        <pre className="rounded-lg bg-muted border border-border text-xs text-foreground p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-mono">
          {prompt}
        </pre>
        <button
          onClick={copy}
          className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md bg-background border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shadow-sm"
        >
          {copied ? <><Check className="h-3 w-3 text-emerald-600" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
        </button>
      </div>
    </Section>
  );
}

// ─── Deep Analysis panel (generate or show cached) ──────────────────
function DeepAnalysisPanel({
  opp,
  slug,
}: {
  opp: any;
  slug: string;
}) {
  const { toast, showToast, hideToast } = useToast();

  const { data: cached, isLoading: fetchingCache, refetch } = useQuery<{ report: AnalystReport } | null>({
    queryKey: ['analyst-report', slug],
    queryFn: async () => {
      const res = await fetch(`/api/opportunities/${slug}/analyst-report`);
      if (!res.ok) return null;
      const { data } = await res.json();
      return data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/opportunities/${slug}/analyst-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       opp.title,
          description: `${opp.fullSummary}\n\n${opp.seaAnalysis ?? ''}\n\n${opp.businessModel ?? ''}`.trim(),
          verticals:   opp.amastPillars?.length > 0 ? opp.amastPillars : ['AI', 'SaaS'],
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Analysis failed');
      return json.data as AnalystReport;
    },
    onSuccess: () => {
      showToast('Deep analysis complete.');
      refetch();
    },
    onError: (err: Error) => showToast(err.message),
  });

  const report: AnalystReport | null = cached?.report ?? null;

  if (fetchingCache) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-6 text-center animate-pulse text-sm text-muted-foreground">
          Loading analysis…
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <>
        {toast && <Toast message={toast} onClose={hideToast} />}
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-3">
          <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-violet-50 border border-violet-100">
            <Sparkles className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No deep analysis yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Generate a full market intelligence report including market sizing, customer segments, system architecture, and a Claude Code build prompt.
            </p>
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2"
          >
            {generateMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing… (~60s)</>
              : <><Sparkles className="h-4 w-4" /> Generate Deep Analysis</>
            }
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {toast && <Toast message={toast} onClose={hideToast} />}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-violet-500" />
            Deep analysis available
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {generateMutation.isPending
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Refreshing…</>
              : 'Refresh analysis'
            }
          </button>
        </div>

        <OpportunityDepthSection     report={report} />
        <MarketSizeSection           report={report} />
        <CustomerSegmentationSection report={report} />
        <SystemImplementationSection report={report} />
        <ProductHooksSection         report={report} />
        <ReplicationPlaybookSection  report={report} />
        <RiskRegisterSection         report={report} />
        <ClaudePromptSection         opp={opp} report={report} />
      </div>
    </>
  );
}

// ─── Main page ───────────────────────────────────────────────────────
export default function OpportunityDetailPage() {
  const params       = useParams();
  const queryClient  = useQueryClient();
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

  const [status,          setStatus]          = useState<CurationStatus | null>(null);
  const [notes,           setNotes]           = useState<string | null>(null);
  const [showNoteHistory, setShowNoteHistory] = useState(false);

  const currentStatus: CurationStatus = status ?? opp?.curationStatus ?? 'Unreviewed';
  const currentNotes: string          = notes  ?? opp?.notes          ?? '';

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
    onError:   () => showToast('Failed to save status.'),
  });

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
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Opportunity not found.
      </div>
    );
  }

  const { stroke, text: scoreText } = scoreAccent(opp.score);
  const circ = 2 * Math.PI * 42;

  return (
    <div className="flex min-h-screen bg-background">
      {toast && <Toast message={toast} onClose={hideToast} />}
      <Sidebar />
      <main className="flex-1 ml-[220px]">

        {/* Sticky header */}
        <div className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={async () => {
                await queryClient.invalidateQueries({ queryKey: ['opportunities'] });
                await queryClient.invalidateQueries({ queryKey: ['opportunity-dates'] });
                window.location.assign('/dashboard');
              }} className="text-muted-foreground hover:text-foreground gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">#{opp.rank}</span>
                <span className="text-border">·</span>
                <span className="rounded-md bg-violet-50 border border-violet-200 px-2 py-0.5 text-violet-700 font-medium dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-300">
                  {opp.category}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatus(s); curationMutation.mutate(s); }}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                      currentStatus === s
                        ? STATUS_CONFIG[s].active
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {currentStatus === s && (
                      <span className={cn('h-1.5 w-1.5 rounded-full opacity-80', STATUS_CONFIG[s].dot)} />
                    )}
                    {s}
                  </button>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={handleShare} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="flex gap-6">

            {/* ── Left column ── */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* Title block */}
              <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-sm">
                <h1 className="text-2xl font-bold text-foreground leading-tight">{opp.title}</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{opp.summary}</p>
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

              {/* AI Summary */}
              <Section icon={FileText} title="AI Summary">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{opp.fullSummary}</p>
              </Section>

              {/* Hype vs Traction */}
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
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{opp.hypeExplanation}</p>
              </Section>

              {/* SEA Competition */}
              <Section
                icon={Globe}
                title="SEA Competition Analysis"
                badge={opp.seaStatus === 'No SEA Competitor'
                  ? <StatusBadge type="success" label="No SEA Competitor" />
                  : <StatusBadge type="danger" label="Competitor Exists" />}
              >
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{opp.seaAnalysis}</p>
              </Section>

              {/* ── Deep Analysis (analyst-powered sections) ── */}
              <DeepAnalysisPanel opp={opp} slug={slug} />

              {/* Private Notes */}
              <Section icon={StickyNote} title="Private Notes">
                <div className="space-y-3">
                  <Textarea
                    rows={4}
                    value={currentNotes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your private notes here… (visible to logged-in users only)"
                    className="dark:text-foreground dark:bg-background dark:border-border"
                  />
                  <div className="flex items-center gap-3">
                    <Button size="sm" onClick={() => notesMutation.mutate(currentNotes)} disabled={notesMutation.isPending}>
                      {notesMutation.isPending ? 'Saving...' : 'Save Notes'}
                    </Button>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      onClick={() => { setShowNoteHistory(!showNoteHistory); refetchHistory(); }}
                    >
                      {showNoteHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showNoteHistory ? 'Hide' : 'View'} note history
                    </button>
                  </div>
                  {showNoteHistory && noteHistory.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-3">
                      {noteHistory.map((n: any) => (
                        <div key={n.id} className="text-xs border-b border-border pb-2 last:border-0">
                          <span className="text-muted-foreground">{new Date(n.created_at).toLocaleString('en-MY')} (v{n.version})</span>
                          <p className="mt-1 text-foreground">{n.note_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            </div>

            {/* ── Right column ── */}
            <div className="w-72 shrink-0 space-y-4">

              {/* Score ring */}
              <div className="rounded-xl border border-border bg-card shadow-sm p-5 text-center">
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Crystal Ball Score</p>
              </div>

              {/* Score breakdown */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Score Breakdown</h3>
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

              {/* Score velocity chart */}
              {opp.velocityData?.length > 0 && (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Score Velocity</h3>
                  </div>
                  <div className="px-4 py-4">
                    <VelocityChart data={opp.velocityData} />
                  </div>
                </div>
              )}

              {/* AMAST alignment */}
              {opp.amastAligned && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 shadow-sm overflow-hidden dark:bg-indigo-900/20 dark:border-indigo-700/50">
                  <div className="border-b border-indigo-100 px-4 py-3 dark:border-indigo-700/50">
                    <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">AMAST Alignment</h3>
                  </div>
                  <div className="px-4 py-4 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {opp.amastPillars.map((p: string) => (
                        <span key={p} className="rounded-md bg-card border border-border px-2.5 py-0.5 text-xs font-medium text-foreground">{p}</span>
                      ))}
                    </div>
                    <p className="text-xs text-indigo-700 leading-relaxed whitespace-pre-line dark:text-indigo-300">{opp.amastDetails}</p>
                  </div>
                </div>
              )}

              {/* Historical appearances */}
              {opp.trendHistory?.length > 0 && (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="border-b border-border px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Historical Appearances</h3>
                  </div>
                  <div className="px-4 py-4">
                    <TrendHistory history={opp.trendHistory} />
                  </div>
                </div>
              )}

              {/* Quick info */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Quick Info</h3>
                </div>
                <div className="px-4 py-3 divide-y divide-border">
                  {[
                    { label: 'Category',       value: opp.category     },
                    { label: 'Classification', value: opp.hypeType     },
                    { label: 'SEA Status',     value: opp.seaStatus    },
                    { label: 'Rank',           value: `#${opp.rank}`   },
                    { label: 'Discovered',     value: opp.dateDiscovered },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-2 text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-foreground font-medium">{value}</span>
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
