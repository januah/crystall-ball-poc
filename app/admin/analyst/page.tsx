'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Toast, useToast } from '@/components/ui/toast';
import type { AnalystReport } from '@/lib/analyst/types';
import {
  Loader2, Sparkles, Plus, X, ChevronDown, ChevronUp,
  TrendingUp, Target, Globe, Layers, Users, Zap,
  BarChart2, AlertTriangle, BookOpen, ArrowRight, CheckCircle2,
  ShieldAlert, Shield, ShieldCheck, DollarSign, Cpu,
  Save, Clock, Trash2, History,
} from 'lucide-react';

// ---------- constants ----------

const AMAST_VERTICALS_DEFAULT = ['AI', 'Logistics', 'IoT', 'Analytics', 'SaaS', 'Fintech', 'PropTech', 'HealthTech', 'EdTech', 'AgriTech'];

const HOOK_BADGE: Record<string, string> = {
  acquisition: 'bg-blue-100 text-blue-700 border-blue-200',
  retention:   'bg-violet-100 text-violet-700 border-violet-200',
  viral:       'bg-pink-100 text-pink-700 border-pink-200',
  plg:         'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const CLASSIFICATION_BADGE: Record<string, string> = {
  hype:     'bg-orange-100 text-orange-700 border-orange-200',
  traction: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  emerging: 'bg-blue-100 text-blue-700 border-blue-200',
};

const RISK_COLOR: Record<string, { bar: string; badge: string; icon: React.FC<any> }> = {
  High:   { bar: 'bg-destructive',  badge: 'bg-destructive/10 text-destructive border-destructive/20',  icon: ShieldAlert  },
  Medium: { bar: 'bg-amber-500',    badge: 'bg-amber-100 text-amber-700 border-amber-200',               icon: Shield       },
  Low:    { bar: 'bg-emerald-500',  badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',         icon: ShieldCheck  },
};

const SCORE_LABELS: Record<string, string> = {
  velocity:        'Velocity',
  traction:        'Traction',
  sea_competition: 'SEA Competition',
  amast_alignment: 'AMAST Alignment',
  market_size:     'Market Size',
};

// ---------- sub-components ----------

function SectionHeader({ icon: Icon, title }: { icon: React.FC<any>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</h2>
    </div>
  );
}

function ScoreBar({ label, raw, weighted, weight }: { label: string; raw: number; weighted: number; weight: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{raw}<span className="text-muted-foreground font-normal"> / 100</span></span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${raw}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>weight {(weight * 100).toFixed(0)}%</span>
        <span>+{weighted} pts</span>
      </div>
    </div>
  );
}

function ExpandableCard({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ---------- report renderer ----------

function AnalystReportView({ report, title }: { report: AnalystReport; title: string }) {
  const scoreEntries = Object.entries(report.score).filter(([k]) => k !== 'total') as [
    string, { raw: number; weight: number; weighted: number }
  ][];

  const sortedStreams = [...(report.market_size_revenue.revenue_streams ?? [])].sort(
    (a, b) => a.priority - b.priority
  );

  return (
    <div className="space-y-6">
      {/* Title + meta bar */}
      <div className="rounded-xl border border-border bg-card px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">{report.meta.category}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{report.meta.sea_status}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{report.meta.discovered_date}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border capitalize ${CLASSIFICATION_BADGE[report.hype_vs_traction.classification] ?? ''}`}>
              {report.hype_vs_traction.classification}
            </span>
            <div className="flex flex-col items-center rounded-xl bg-primary/10 border border-primary/20 px-4 py-2">
              <span className="text-2xl font-bold text-primary">{report.score.total}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overview + Hype/Traction */}
      <div className="grid grid-cols-2 gap-4">
        <ExpandableCard title="Overview">
          <SectionHeader icon={Sparkles} title="AI Summary" />
          <p className="text-sm text-foreground leading-relaxed">{report.ai_summary.overview}</p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3 italic">{report.ai_summary.gap_statement}</p>
        </ExpandableCard>

        <ExpandableCard title="Hype vs Traction">
          <SectionHeader icon={TrendingUp} title="Classification" />
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border capitalize mb-3 ${CLASSIFICATION_BADGE[report.hype_vs_traction.classification] ?? ''}`}>
            {report.hype_vs_traction.classification}
          </span>
          <p className="text-sm text-muted-foreground leading-relaxed">{report.hype_vs_traction.rationale}</p>
        </ExpandableCard>
      </div>

      {/* Scores */}
      <ExpandableCard title="Scoring Breakdown">
        <SectionHeader icon={BarChart2} title="Weighted Scores" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {scoreEntries.map(([key, val]) => (
            <ScoreBar
              key={key}
              label={SCORE_LABELS[key] ?? key}
              raw={val.raw}
              weighted={val.weighted}
              weight={val.weight}
            />
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Total Score</span>
          <span className="text-2xl font-bold text-primary">{report.score.total} <span className="text-sm font-normal text-muted-foreground">/ 100</span></span>
        </div>
      </ExpandableCard>

      {/* SEA Competition + AMAST Alignment */}
      <div className="grid grid-cols-2 gap-4">
        <ExpandableCard title="SEA Competition">
          <SectionHeader icon={Globe} title="Competitive Landscape" />
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-muted border border-border mb-3">
            {report.sea_competition.status}
          </span>
          <p className="text-sm text-muted-foreground leading-relaxed">{report.sea_competition.analysis}</p>
          {report.sea_competition.global_analogues.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-foreground mb-2">Global Analogues</p>
              <div className="flex flex-wrap gap-1.5">
                {report.sea_competition.global_analogues.map((a) => (
                  <span key={a} className="text-xs bg-muted border border-border rounded-full px-2.5 py-0.5">{a}</span>
                ))}
              </div>
            </div>
          )}
        </ExpandableCard>

        <ExpandableCard title="AMAST Alignment">
          <SectionHeader icon={Target} title="Vertical Fit" />
          <div className="flex flex-wrap gap-1.5 mb-4">
            {report.amast_alignment.verticals.map((v) => (
              <span key={v} className="text-xs font-semibold bg-primary/10 border border-primary/20 text-primary rounded-full px-2.5 py-0.5">{v}</span>
            ))}
          </div>
          <div className="space-y-3">
            {Object.entries(report.amast_alignment.alignment_notes).map(([vertical, note]) => (
              <div key={vertical}>
                <p className="text-xs font-semibold text-foreground mb-0.5">{vertical}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
        </ExpandableCard>
      </div>

      {/* Opportunity Depth */}
      <ExpandableCard title="Opportunity Depth">
        <SectionHeader icon={Zap} title="Market Dynamics" />
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Problem Intensity',   value: report.opportunity_depth.problem_intensity },
            { label: 'Buyer Urgency',        value: report.opportunity_depth.buyer_urgency },
            { label: 'Moat Potential',       value: report.opportunity_depth.moat_potential },
            { label: 'Adjacent Expansion',   value: report.opportunity_depth.adjacent_expansion },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/40 border border-border px-4 py-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm text-foreground leading-relaxed">{value}</p>
            </div>
          ))}
        </div>
      </ExpandableCard>

      {/* Market Size & Revenue */}
      <ExpandableCard title="Market Size & Revenue">
        <SectionHeader icon={DollarSign} title="Revenue Model" />
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'SEA Market TAM',    value: report.market_size_revenue.sea_market_usd },
            { label: 'Tooling TAM %',     value: report.market_size_revenue.safety_tooling_tam_pct },
            { label: 'Yr 3 ARR Range',    value: report.market_size_revenue.year3_arr_range },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className="text-lg font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <p className="text-xs font-semibold text-foreground mb-3">Revenue Streams</p>
        <div className="space-y-2 mb-4">
          {sortedStreams.map((s) => (
            <div key={s.name} className="flex items-start gap-3 rounded-lg bg-muted/30 border border-border px-4 py-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary">{s.priority}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.rationale}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Recommended Entry</p>
          <p className="text-sm text-foreground">{report.market_size_revenue.recommended_entry}</p>
        </div>
      </ExpandableCard>

      {/* Customer Segmentation */}
      <ExpandableCard title="Customer Segmentation">
        <SectionHeader icon={Users} title="3-Tier Model" />
        <div className="grid grid-cols-3 gap-4">
          {report.customer_segmentation.map((tier) => (
            <div key={tier.tier} className="rounded-lg border border-border bg-muted/20 px-4 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{tier.tier}</span>
                <span className="text-sm font-bold text-foreground">{tier.label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{tier.profile}</p>
              <div className="pt-2 space-y-1">
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
      </ExpandableCard>

      {/* System Implementation */}
      <ExpandableCard title="System Implementation">
        <SectionHeader icon={Cpu} title="Architecture Layers" />
        <div className="space-y-2 mb-5">
          {report.system_implementation.layers.map((layer) => (
            <div key={layer.number} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-xs font-bold text-foreground">{layer.number}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-1.5">{layer.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {layer.components.map((c) => (
                    <span key={c} className="text-[11px] bg-background border border-border rounded-full px-2 py-0.5">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Recommended Stack</p>
            <p className="text-sm text-foreground leading-relaxed">{report.system_implementation.recommended_stack}</p>
          </div>
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">SEA Deployment Notes</p>
            <p className="text-sm text-foreground leading-relaxed">{report.system_implementation.sea_deployment_notes}</p>
          </div>
        </div>
      </ExpandableCard>

      {/* Product Hooks */}
      <ExpandableCard title="Product Hooks">
        <SectionHeader icon={Zap} title="Growth Mechanics" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {report.product_hooks.map((hook) => (
            <div key={hook.name} className="rounded-lg border border-border bg-muted/20 px-4 py-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground leading-snug">{hook.name}</p>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${HOOK_BADGE[hook.hook_type] ?? ''}`}>
                  {hook.hook_type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{hook.description}</p>
              <p className="text-[11px] text-muted-foreground/70 italic">{hook.rationale}</p>
            </div>
          ))}
        </div>
      </ExpandableCard>

      {/* Replication Playbook */}
      <ExpandableCard title="Replication Playbook">
        <SectionHeader icon={BookOpen} title="5-Step Execution" />
        <div className="space-y-0">
          {report.replication_playbook.map((step, idx) => (
            <div key={step.step} className="relative flex gap-4">
              {/* connector line */}
              {idx < report.replication_playbook.length - 1 && (
                <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border" />
              )}
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm shadow-violet-900/30">
                  {step.step}
                </div>
              </div>
              <div className="pb-6 pt-1.5">
                <p className="text-sm font-semibold text-foreground mb-1">{step.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </ExpandableCard>

      {/* Risk Register */}
      <ExpandableCard title="Risk Register">
        <SectionHeader icon={AlertTriangle} title="4 Key Risks" />
        <div className="space-y-3">
          {report.risk_register.map((risk) => {
            const cfg = RISK_COLOR[risk.severity] ?? RISK_COLOR.Medium;
            const RiskIcon = cfg.icon;
            return (
              <div key={risk.name} className="flex gap-4 rounded-lg border border-border bg-muted/10 px-4 py-4">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.badge} border`}>
                  <RiskIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground">{risk.name}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${cfg.badge}`}>
                      {risk.severity}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{risk.description}</p>
                  <div className="mt-2 flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                    <p className="text-xs text-emerald-700 leading-relaxed">{risk.mitigation}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ExpandableCard>

      {/* Business Model */}
      <ExpandableCard title="Business Model Estimate">
        <SectionHeader icon={Layers} title="Revenue Architecture" />
        <div className="flex flex-wrap gap-2 mb-4">
          {report.business_model_estimate.streams.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs bg-muted border border-border rounded-full px-3 py-1 font-medium">
              <ArrowRight className="h-3 w-3 text-primary" />{s}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{report.business_model_estimate.notes}</p>
      </ExpandableCard>
    </div>
  );
}

// ---------- main page ----------

export default function AnalystPage() {
  const { toast, showToast, hideToast } = useToast();
  const queryClient = useQueryClient();

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [region,      setRegion]      = useState('Southeast Asia');
  const [verticals,   setVerticals]   = useState<string[]>(['AI', 'Analytics']);
  const [customTag,   setCustomTag]   = useState('');
  const [report,      setReport]      = useState<AnalystReport | null>(null);
  const [modelUsed,   setModelUsed]   = useState<string | null>(null);
  const [savedId,     setSavedId]     = useState<string | null>(null);

  // ── Saved reports list ──
  const { data: savedReports = [] } = useQuery<{ id: string; title: string; model_used: string | null; created_at: string }[]>({
    queryKey: ['analyst-saved'],
    queryFn: async () => {
      const res = await fetch('/api/analyst/saved');
      if (!res.ok) return [];
      const { data } = await res.json();
      return data ?? [];
    },
  });

  // ── Generate ──
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_title:       title.trim(),
          opportunity_description: description.trim(),
          amast_verticals:         verticals,
          sea_region:              region.trim() || 'Southeast Asia',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Analysis failed');
      return { report: json.data as AnalystReport, model_used: json.model_used as string | null };
    },
    onSuccess: ({ report, model_used }) => {
      setReport(report);
      setModelUsed(model_used ?? null);
      setSavedId(null);
      showToast(`Analysis complete${model_used ? ` · ${model_used}` : ''}.`);
    },
    onError: (err: Error) => showToast(err.message),
  });

  // ── Save ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/analyst/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          input: { opportunity_title: title.trim(), opportunity_description: description.trim(), amast_verticals: verticals, sea_region: region },
          report,
          model_used: modelUsed,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      return json.data.id as string;
    },
    onSuccess: (id) => {
      setSavedId(id);
      showToast('Report saved.');
      queryClient.invalidateQueries({ queryKey: ['analyst-saved'] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  // ── Delete saved ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/analyst/saved/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => {
      showToast('Report deleted.');
      queryClient.invalidateQueries({ queryKey: ['analyst-saved'] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  // ── Load saved ──
  async function loadSaved(id: string) {
    const res = await fetch(`/api/analyst/saved/${id}`);
    const json = await res.json();
    if (!json.success) { showToast('Failed to load report.'); return; }
    const { title: t, report: r, model_used: m, input } = json.data;
    setTitle(t);
    setDescription(input?.opportunity_description ?? '');
    setVerticals(input?.amast_verticals ?? ['AI']);
    setRegion(input?.sea_region ?? 'Southeast Asia');
    setReport(r);
    setModelUsed(m ?? null);
    setSavedId(id);
  }

  function toggleVertical(v: string) {
    setVerticals((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  function addCustomTag() {
    const tag = customTag.trim();
    if (!tag || verticals.includes(tag)) { setCustomTag(''); return; }
    setVerticals((prev) => [...prev, tag]);
    setCustomTag('');
  }

  const canSubmit = title.trim() && description.trim() && verticals.length > 0 && !mutation.isPending;

  return (
    <div className="flex min-h-screen bg-background">
      {toast && <Toast message={toast} onClose={hideToast} />}
      <Sidebar />
      <main className="flex-1 ml-[220px]">
        {/* Header */}
        <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">Market Intelligence Analyst</h1>
              <p className="text-xs text-muted-foreground mt-0.5">AI-powered opportunity analysis for AMAST Sdn Bhd</p>
            </div>
            {report && (
              <div className="flex items-center gap-2">
                {savedId ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Save className="h-3.5 w-3.5" />
                    }
                    Save
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setReport(null); setSavedId(null); setModelUsed(null); }}>
                  New Analysis
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 py-6">
          {!report ? (
            /* ── Input Form ── */
            <div className="max-w-2xl mx-auto space-y-5">
              <Card>
                <CardContent className="p-6 space-y-5">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Opportunity Title <span className="text-destructive">*</span></label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. AI-Powered Fleet Safety Monitoring for SEA Logistics"
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Opportunity Description <span className="text-destructive">*</span></label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={6}
                      placeholder="Describe the business/SaaS opportunity, the problem it solves, target market, and any known traction or competitors..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>

                  {/* SEA Region */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">SEA Region</label>
                    <input
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="Southeast Asia"
                      className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  {/* Verticals */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">AMAST Verticals <span className="text-destructive">*</span></label>
                    <div className="flex flex-wrap gap-2">
                      {AMAST_VERTICALS_DEFAULT.map((v) => (
                        <button
                          key={v}
                          onClick={() => toggleVertical(v)}
                          className={`text-xs rounded-full px-3 py-1 border font-medium transition-colors ${
                            verticals.includes(v)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    {/* Custom vertical input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        value={customTag}
                        onChange={(e) => setCustomTag(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
                        placeholder="Add custom vertical…"
                        className="flex-1 h-8 rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <Button size="sm" variant="outline" onClick={addCustomTag} className="h-8">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Selected custom verticals not in default list */}
                    {verticals.filter((v) => !AMAST_VERTICALS_DEFAULT.includes(v)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {verticals
                          .filter((v) => !AMAST_VERTICALS_DEFAULT.includes(v))
                          .map((v) => (
                            <span key={v} className="inline-flex items-center gap-1 text-xs bg-primary/10 border border-primary/20 text-primary rounded-full px-2.5 py-0.5 font-medium">
                              {v}
                              <button onClick={() => toggleVertical(v)} className="ml-0.5 hover:text-destructive transition-colors">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Submit */}
                  <Button
                    onClick={() => mutation.mutate()}
                    disabled={!canSubmit}
                    className="w-full"
                  >
                    {mutation.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</>
                      : <><Sparkles className="h-4 w-4" /> Generate Analysis</>
                    }
                  </Button>

                  {mutation.isPending && (
                    <p className="text-center text-xs text-muted-foreground animate-pulse">
                      Running deep market intelligence analysis — this may take up to 60 seconds…
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Saved Reports */}
              {savedReports.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold text-foreground">Saved Reports</h2>
                      <span className="ml-auto text-xs text-muted-foreground">{savedReports.length} saved</span>
                    </div>
                    <div className="space-y-2">
                      {savedReports.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 hover:bg-muted/40 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                              {s.model_used && (
                                <>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-xs text-muted-foreground truncate">{s.model_used}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => loadSaved(s.id)}>
                              Load
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                              onClick={() => deleteMutation.mutate(s.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            /* ── Report View ── */
            <AnalystReportView report={report} title={title} />
          )}
        </div>
      </main>
    </div>
  );
}
