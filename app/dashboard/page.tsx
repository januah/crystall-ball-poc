'use client';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { OpportunityCard } from '@/components/dashboard/OpportunityCard';
import { Category, CurationStatus } from '@/types';
import { Zap, Target, Globe, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatInTimeZone } from 'date-fns-tz';

const MYT = 'Asia/Kuala_Lumpur';
const todayMYT = () => formatInTimeZone(new Date(), MYT, 'yyyy-MM-dd');

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
    <div className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse space-y-3">
      <div className="flex gap-4">
        <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-full" />
          <div className="flex gap-2 mt-2">
            <div className="h-5 w-20 bg-slate-100 rounded-full" />
            <div className="h-5 w-20 bg-slate-100 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(todayMYT());
  const [selectedCategory, setSelectedCategory] = useState<'All' | Category>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | CurationStatus>('All');
  const [selectedBadge, setSelectedBadge] = useState<BadgeFilter>('All');

  const { data: availableDates = [] } = useQuery({
    queryKey: ['opportunity-dates'],
    queryFn: fetchDates,
  });

  const params = useMemo(() => {
    const p = new URLSearchParams({ date: selectedDate });
    if (selectedCategory !== 'All') p.set('category', selectedCategory);
    if (selectedStatus !== 'All') p.set('status', selectedStatus);
    if (selectedBadge === 'AMAST Aligned') p.set('amast_aligned', 'true');
    if (selectedBadge === 'No SEA Competitor') p.set('no_sea_competitor', 'true');
    return p;
  }, [selectedDate, selectedCategory, selectedStatus, selectedBadge]);

  const {
    data: opportunities = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['opportunities', params.toString()],
    queryFn: () => fetchOpportunities(params),
  });

  const amastCount = opportunities.filter((o: any) => o.amastAligned).length;
  const noCompetitorCount = opportunities.filter((o: any) => o.seaStatus === 'No SEA Competitor').length;
  const avgScore =
    opportunities.length > 0
      ? Math.round(opportunities.reduce((s: number, o: any) => s + (o.score ?? 0), 0) / opportunities.length)
      : 0;

  const allDates = availableDates.length > 0 ? availableDates : [selectedDate];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[240px] min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/80 backdrop-blur-md px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Opportunity Feed</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                AI-curated market intelligence · {selectedDate}
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Opportunities', value: opportunities.length, icon: Zap, color: 'text-violet-400' },
              { label: 'AMAST Aligned', value: amastCount, icon: Target, color: 'text-emerald-400' },
              { label: 'No SEA Competitor', value: noCompetitorCount, icon: Globe, color: 'text-blue-400' },
              { label: 'Avg Score', value: opportunities.length > 0 ? `${avgScore}/100` : '—', icon: BarChart3, color: 'text-amber-400' },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-slate-100 border border-slate-200 ${stat.color}`}>
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
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
            selectedDate={selectedDate}
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
            <div className="py-16 text-center text-slate-400 text-sm">
              No opportunities found for this date. The cron job may not have run yet.
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                Showing {opportunities.length} opportunit{opportunities.length === 1 ? 'y' : 'ies'}
              </p>
              <div className="space-y-3">
                {opportunities.map((opp: any) => (
                  <OpportunityCard key={opp.id} opportunity={opp} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
