'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Toast, useToast } from '@/components/ui/toast';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Play, Square, ChevronDown, ChevronUp, Loader2, Clock, CalendarClock, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';

type LogStatus = 'success' | 'partial' | 'failed' | 'running';

interface StepLog {
  ts: string;
  level: 'info' | 'warn' | 'error';
  step: string;
  message: string;
}

interface CronLog {
  id: string;
  run_date: string;
  started_at: string;
  completed_at: string | null;
  status: LogStatus;
  opportunities_found: number;
  opportunities_saved: number;
  whatsapp_alerts_sent: number;
  retry_count: number;
  error_message: string | null;
  step_failed: string | null;
  step_logs: StepLog[] | null;
  duration_seconds: number | null;
}

interface LogsResponse {
  data: CronLog[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

const STATUS_CONFIG: Record<LogStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'default'; icon: React.FC<any> }> = {
  success: { label: 'Success',    variant: 'success', icon: CheckCircle2 },
  partial: { label: 'Failed',     variant: 'danger',  icon: XCircle      },
  failed:  { label: 'Failed',     variant: 'danger',  icon: XCircle      },
  running: { label: 'Running...', variant: 'default', icon: Loader2      },
};

const LEVEL_STYLES: Record<StepLog['level'], string> = {
  info:  'text-foreground',
  warn:  'text-amber-600',
  error: 'text-destructive font-medium',
};

const LEVEL_BADGE: Record<StepLog['level'], string> = {
  info:  'bg-muted text-muted-foreground',
  warn:  'bg-accent/20 text-amber-700',
  error: 'bg-destructive/10 text-destructive',
};

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-MY');
}

function fmtLogTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', { hour12: false });
}

function hasDetails(log: CronLog): boolean {
  return log.status !== 'success';
}

interface CronConfig {
  is_paused: boolean;
  schedule: string;
  next_run: string | null;
}

export default function CronLogsPage() {
  const queryClient = useQueryClient();
  const { toast, showToast, hideToast } = useToast();
  const [expandedRow, setExpandedRow]   = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter,   setDateFilter]   = useState('');
  const [filtersOpen,  setFiltersOpen]  = useState(false);

  // While a manual trigger is pending, poll every 3s to show the log entry appearing
  const [triggerPending, setTriggerPending] = useState(false);

  const logsQueryKey = ['cron-logs', page, PAGE_SIZE, statusFilter, dateFilter];

  const { data: logsRes, isLoading } = useQuery<LogsResponse>({
    queryKey: logsQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page:     String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter) params.set('status', statusFilter);
      if (dateFilter)   params.set('date',   dateFilter);

      const res = await fetch(`/api/admin/logs?${params}`);
      if (!res.ok) return { data: [], total: 0, page, pageSize: PAGE_SIZE };
      return res.json();
    },
    refetchInterval: triggerPending ? 3_000 : 10_000,
  });

  const { data: cronConfig, refetch: refetchConfig } = useQuery<CronConfig>({
    queryKey: ['cron-config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/cron-config');
      if (!res.ok) return { is_paused: false, schedule: '0 23 * * *', next_run: null };
      const { data } = await res.json();
      return data;
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (isPaused: boolean) => {
      const res = await fetch('/api/admin/cron-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_paused: isPaused }),
      });
      if (!res.ok) throw new Error('Failed to update cron config');
    },
    onSuccess: (_, isPaused) => {
      showToast(isPaused ? 'Cron job stopped — will not run until resumed.' : 'Cron job resumed.');
      refetchConfig();
      queryClient.invalidateQueries({ queryKey: ['cron-config'] });
    },
    onError: () => showToast('Failed to update cron config. Ensure cron_config table exists in Supabase.'),
  });

  const isPaused = cronConfig?.is_paused ?? false;

  // Derive running status: only when cron is active (not paused)
  const rawLogs: CronLog[] = logsRes?.data ?? [];
  const logs = rawLogs.map((l) => {
    if (l.status === 'failed' && !l.completed_at && !isPaused) {
      return { ...l, status: 'running' as LogStatus };
    }
    return l;
  });

  const total     = logsRes?.total    ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const lastRun = logs[0]?.started_at ?? null;
  const nextRun = cronConfig?.next_run ?? null;

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/cron/trigger', { method: 'POST' });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error ?? 'Failed to trigger pipeline');
      }
    },
    onMutate: () => {
      // Immediately refresh logs so the new "running" entry appears
      setTriggerPending(true);
      setPage(1);
      setStatusFilter('');
      setDateFilter('');
      queryClient.invalidateQueries({ queryKey: ['cron-logs'] });
    },
    onSuccess: () => {
      showToast('Pipeline completed — log updated.');
      setTriggerPending(false);
      queryClient.invalidateQueries({ queryKey: ['cron-logs'] });
    },
    onError: (err: Error) => {
      showToast(err.message);
      setTriggerPending(false);
      queryClient.invalidateQueries({ queryKey: ['cron-logs'] });
    },
  });

  // Summary stats from current page
  const successCount = logs.filter((l) => l.status === 'success').length;
  const failedCount  = logs.filter((l) => l.status === 'failed').length;
  const partialCount = logs.filter((l) => l.status === 'partial').length;
  const totalSaved   = logs.reduce((s, l) => s + (l.opportunities_saved ?? 0), 0);

  const hasActiveFilters = statusFilter || dateFilter;

  function resetFilters() {
    setStatusFilter('');
    setDateFilter('');
    setPage(1);
  }

  return (
    <div className="flex min-h-screen bg-background">
      {toast && <Toast message={toast} onClose={hideToast} />}
      <Sidebar />
      <main className="flex-1 ml-[240px]">
        {/* Header */}
        <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">Cron Job Logs</h1>
                {isPaused && (
                  <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Stopped</span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last run: <span className="text-foreground font-medium">{fmtTime(lastRun)}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  Next run: <span className={`font-medium ${isPaused ? 'text-red-500' : 'text-foreground'}`}>
                    {isPaused ? 'Paused' : fmtTime(nextRun)}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">Schedule: <code className="text-xs bg-muted px-1 rounded">{cronConfig?.schedule ?? '0 23 * * *'}</code></span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPaused && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => triggerMutation.mutate()}
                  disabled={triggerMutation.isPending}
                >
                  {triggerMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Triggering…</>
                    : <><Play className="h-4 w-4" /> Run Now</>
                  }
                </Button>
              )}
              <Button
                size="sm"
                variant={isPaused ? 'default' : 'default'}
                onClick={() => pauseMutation.mutate(!isPaused)}
                disabled={pauseMutation.isPending}
                className={isPaused ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
              >
                {pauseMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  : isPaused
                    ? <><Play className="h-4 w-4" /> Resume</>
                    : <><Square className="h-4 w-4" /> Stop</>
                }
              </Button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Runs',         value: total,         icon: Activity,      color: 'text-primary'     },
              { label: 'Successful',          value: successCount,  icon: CheckCircle2,  color: 'text-emerald-600' },
              { label: 'Partial / Failed',    value: `${partialCount} / ${failedCount}`, icon: AlertTriangle, color: 'text-accent' },
              { label: 'Opportunities Saved', value: totalSaved,    icon: Activity,      color: 'text-secondary'   },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted border border-border ${stat.color}`}>
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFiltersOpen((v) => !v)}
              className={hasActiveFilters ? 'border-primary text-primary' : ''}
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Filters
              {hasActiveFilters && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />}
            </Button>

            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={resetFilters} className="text-muted-foreground">
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}

            {/* Active filter chips */}
            {statusFilter && (
              <span className="flex items-center gap-1 text-xs bg-muted border border-border rounded-full px-2.5 py-1">
                Status: <strong>{STATUS_CONFIG[statusFilter as LogStatus]?.label ?? statusFilter}</strong>
                <button onClick={() => { setStatusFilter(''); setPage(1); }} className="ml-1 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {dateFilter && (
              <span className="flex items-center gap-1 text-xs bg-muted border border-border rounded-full px-2.5 py-1">
                Date: <strong>{dateFilter}</strong>
                <button onClick={() => { setDateFilter(''); setPage(1); }} className="ml-1 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          {/* Filter panel */}
          {filtersOpen && (
            <div className="flex items-end gap-4 rounded-xl border border-border bg-card px-5 py-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="partial">Partial</option>
                  <option value="running">Running</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <Button size="sm" variant="ghost" onClick={() => setFiltersOpen(false)} className="text-muted-foreground mb-0.5">
                Done
              </Button>
            </div>
          )}

          {/* Logs Table */}
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading logs…</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {hasActiveFilters ? 'No logs match the selected filters.' : 'No logs yet. The pipeline hasn\'t run.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border">
                    <TableHead>Date</TableHead>
                    <TableHead>Started At</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Found</TableHead>
                    <TableHead className="text-right">Saved</TableHead>
                    <TableHead className="text-right">WA</TableHead>
                    <TableHead className="text-right">Retries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const cfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.failed;
                    const Icon = cfg.icon;
                    const isExpanded = expandedRow === log.id;
                    const showable = hasDetails(log);
                    return (
                      <React.Fragment key={log.id}>
                        <TableRow
                          className={`${isExpanded ? 'bg-muted/40' : ''} ${showable ? 'cursor-pointer hover:bg-muted/20' : ''}`}
                          onClick={() => showable && setExpandedRow(isExpanded ? null : log.id)}
                        >
                          <TableCell className="font-medium text-foreground">{log.run_date}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{fmtTime(log.started_at)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{fmtDuration(log.duration_seconds)}</TableCell>
                          <TableCell>
                            <Badge variant={cfg.variant} className="flex items-center gap-1 w-fit">
                              <Icon className={`h-3 w-3 ${log.status === 'running' ? 'animate-spin' : ''}`} />
                              {cfg.label}
                              {showable && (isExpanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-foreground">{log.opportunities_found ?? 0}</TableCell>
                          <TableCell className="text-right text-foreground">{log.opportunities_saved ?? 0}</TableCell>
                          <TableCell className="text-right text-foreground">{log.whatsapp_alerts_sent ?? 0}</TableCell>
                          <TableCell className="text-right text-foreground">{log.retry_count ?? 0}</TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow key={`${log.id}-detail`}>
                            <TableCell colSpan={8} className="bg-muted/20 border-b border-border p-0">
                              <div className="px-6 py-4 space-y-3">
                                {log.error_message && (
                                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
                                    <p className="text-xs font-semibold text-destructive mb-1">
                                      Error{log.step_failed ? ` — failed at ${log.step_failed}` : ''}
                                    </p>
                                    <p className="text-xs text-destructive/80 font-mono">{log.error_message}</p>
                                  </div>
                                )}

                                {!log.error_message && (!log.step_logs || log.step_logs.length === 0) && (
                                  <p className="text-xs text-muted-foreground italic">
                                    No error details captured for this run. Run the DB migration and trigger a new run to see step-by-step logs.
                                  </p>
                                )}

                                {log.step_logs && log.step_logs.length > 0 && (
                                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                                    <div className="px-4 py-2 border-b border-border bg-muted/40">
                                      <p className="text-xs font-semibold text-foreground">Pipeline Log</p>
                                    </div>
                                    <div className="divide-y divide-border/50 font-mono text-xs max-h-72 overflow-y-auto">
                                      {log.step_logs.map((entry, i) => (
                                        <div key={i} className="flex items-start gap-3 px-4 py-2">
                                          <span className="text-muted-foreground shrink-0 w-16">{fmtLogTime(entry.ts)}</span>
                                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${LEVEL_BADGE[entry.level]}`}>
                                            {entry.level}
                                          </span>
                                          <span className="text-muted-foreground shrink-0 w-20 truncate">{entry.step}</span>
                                          <span className={LEVEL_STYLES[entry.level]}>{entry.message}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} runs
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                      acc.push('…');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={p}
                        size="sm"
                        variant={p === page ? 'default' : 'outline'}
                        onClick={() => setPage(p as number)}
                        className="h-8 w-8 p-0"
                      >
                        {p}
                      </Button>
                    )
                  )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
