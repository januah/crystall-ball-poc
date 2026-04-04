'use client';
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { OpportunityCard } from '@/components/dashboard/OpportunityCard';
import { Category, CurationStatus } from '@/types';
import { Zap, Target, Globe, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatInTimeZone } from 'date-fns-tz';

const PAGE_SIZE = 10;

const MYT = 'Asia/Kuala_Lumpur';
const todayMYT = () => formatInTimeZone(new Date(), MYT, 'yyyy-MM-dd');

// Sentinel — replaced once availableDates loads
const PENDING = '__pending__';

type BadgeFilter = 'All' | 'AMAST Aligned' | 'No SEA Competitor';

async function fetchDates(): Promise<string[]> {
  const res = await fetch('/api/opportunities/dates');
  if (!res.ok) throw new Error('Failed to load dates');
  const { data } = await res.json();
  return data ?? [];
}

async function fetchOpportunities(params: URLSearchParams) {
  const res = await fetch(`/api/opportunities?${params.toString()}`);
  if (res.status === 401) { window.location.href = '/'; return []; }
  if (!res.ok) throw new Error('Failed to load opportunities');
  const { data } = await res.json();
  return data ?? [];
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-pulse space-y-3">
      <div className="flex gap-4">
        <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted/60 rounded w-full" />
          <div className="flex gap-2 mt-2">
            <div className="h-5 w-20 bg-muted/60 rounded-full" />
            <div className="h-5 w-20 bg-muted/60 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(PENDING);
  const [selectedCategory, setSelectedCategory] = useState<'All' | Category>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | CurationStatus>('All');
  const [selectedBadge, setSelectedBadge] = useState<BadgeFilter>('All');
  const [page, setPage] = useState(1);

  const { data: availableDates = [] } = useQuery({
    queryKey: ['opportunity-dates'],
    queryFn: fetchDates,
  });

  // Auto-select most recent date once dates load; fall back to today MYT
  useEffect(() => {
    if (selectedDate === PENDING && availableDates.length > 0) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  const resolvedDate = selectedDate === PENDING ? (availableDates[0] ?? todayMYT()) : selectedDate;

  const params = useMemo(() => {
    setPage(1);
    const p = new URLSearchParams({ date: resolvedDate });
    if (selectedCategory !== 'All') p.set('category', selectedCategory);
    if (selectedStatus !== 'All') p.set('status', selectedStatus);
    if (selectedBadge === 'AMAST Aligned') p.set('amast_aligned', 'true');
    if (selectedBadge === 'No SEA Competitor') p.set('no_sea_competitor', 'true');
    return p;
  }, [resolvedDate, selectedCategory, selectedStatus, selectedBadge]);

  const {
    data: opportunities = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['opportunities', params.toString()],
    queryFn: () => fetchOpportunities(params),
    enabled: selectedDate !== PENDING,
  });

  const amastCount = opportunities.filter((o: any) => o.amastAligned).length;
  const noCompetitorCount = opportunities.filter((o: any) => o.seaStatus === 'No SEA Competitor').length;
  const avgScore =
    opportunities.length > 0
      ? Math.round(opportunities.reduce((s: number, o: any) => s + (o.score ?? 0), 0) / opportunities.length)
      : 0;

  const totalPages = Math.ceil(opportunities.length / PAGE_SIZE);
  const pagedOpportunities = opportunities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allDates = availableDates.length > 0 ? availableDates : [resolvedDate];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-[240px] min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">Opportunity Feed</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI-curated market intelligence · {resolvedDate}
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Opportunities', value: opportunities.length, icon: Zap, accent: 'bg-violet-500', bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700' },
              { label: 'AMAST Aligned', value: amastCount, icon: Target, accent: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
              { label: 'No SEA Competitor', value: noCompetitorCount, icon: Globe, accent: 'bg-teal-500', bg: 'bg-teal-50', border: 'border-teal-100', text: 'text-teal-700' },
              { label: 'Avg Score', value: opportunities.length > 0 ? `${avgScore}/100` : '—', icon: BarChart3, accent: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3 shadow-sm">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.bg} ${stat.border} border`}>
                  <stat.icon className={`h-4 w-4 ${stat.text}`} />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{stat.label}</p>
                  <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <FilterBar
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            selectedBadge={selectedBadge}
            onBadgeChange={setSelectedBadge}
            selectedDate={resolvedDate}
            onDateChange={setSelectedDate}
            availableDates={allDates}
          />

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-red-400 text-sm">
              Failed to load opportunities. Please try again.
            </div>
          ) : opportunities.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No opportunities found for this date. The cron job may not have run yet.
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, opportunities.length)} of {opportunities.length} opportunit{opportunities.length === 1 ? 'y' : 'ies'}
              </p>
              <div className="space-y-3">
                {pagedOpportunities.map((opp: any) => (
                  <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-8 w-8 rounded text-xs font-medium transition-colors ${
                          p === page
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
