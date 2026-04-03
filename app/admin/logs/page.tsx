'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Toast, useToast } from '@/components/ui/toast';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Play, ChevronDown, ChevronUp } from 'lucide-react';

type LogStatus = 'success' | 'partial' | 'failed';

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
  duration_seconds: number | null;
}

const STATUS_CONFIG: Record<LogStatus, { label: string; variant: 'success' | 'warning' | 'danger'; icon: React.FC<any> }> = {
  success: { label: 'Success', variant: 'success', icon: CheckCircle2 },
  partial: { label: 'Partial', variant: 'warning', icon: AlertTriangle },
  failed:  { label: 'Failed',  variant: 'danger',  icon: XCircle },
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

export default function CronLogsPage() {
  const queryClient = useQueryClient();
  const { toast, showToast, hideToast } = useToast();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery<CronLog[]>({
    queryKey: ['cron-logs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/logs');
      if (!res.ok) return [];
      const { data } = await res.json();
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/cron/trigger', { method: 'POST' });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error ?? 'Failed to trigger pipeline');
      }
    },
    onSuccess: () => {
      showToast('Pipeline triggered — check logs in a few minutes.');
      queryClient.invalidateQueries({ queryKey: ['cron-logs'] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  // Summary stats from latest 30 logs
  const successCount = logs.filter((l) => l.status === 'success').length;
  const failedCount  = logs.filter((l) => l.status === 'failed').length;
  const partialCount = logs.filter((l) => l.status === 'partial').length;
  const totalSaved = logs.reduce((s, l) => s + (l.opportunities_saved ?? 0), 0);

  return (
    <div className="flex min-h-screen">
      {toast && <Toast message={toast} onClose={hideToast} />}
      <Sidebar />
      <main className="flex-1 ml-[240px]">
        {/* Header */}
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/80 backdrop-blur-md px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Cron Job Logs</h1>
              <p className="text-xs text-slate-400 mt-0.5">Daily pipeline runs · auto-refreshes every 30s</p>
            </div>
            <Button
              size="sm"
              onClick={() => triggerMutation.mutate()}
              disabled={triggerMutation.isPending}
            >
              <Play className="h-4 w-4" />
              {triggerMutation.isPending ? 'Triggering…' : 'Run Now'}
            </Button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Runs',         value: logs.length,   icon: Activity,      color: 'text-violet-400'  },
              { label: 'Successful',          value: successCount,  icon: CheckCircle2,  color: 'text-emerald-400' },
              { label: 'Partial / Failed',    value: `${partialCount} / ${failedCount}`, icon: AlertTriangle, color: 'text-amber-400' },
              { label: 'Opportunities Saved', value: totalSaved,    icon: Activity,      color: 'text-blue-400'   },
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

          {/* Logs Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading logs…</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No logs yet. The pipeline hasn't run.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200">
                    <TableHead>Date</TableHead>
                    <TableHead>Started At</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Found</TableHead>
                    <TableHead className="text-right">Saved</TableHead>
                    <TableHead className="text-right">WA Alerts</TableHead>
                    <TableHead className="text-right">Retries</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const cfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.failed;
                    const Icon = cfg.icon;
                    const isExpanded = expandedRow === log.id;
                    return (
                      <>
                        <TableRow key={log.id} className={isExpanded ? 'bg-slate-50' : undefined}>
                          <TableCell className="font-medium text-slate-800">{log.run_date}</TableCell>
                          <TableCell className="text-slate-500 text-xs">{fmtTime(log.started_at)}</TableCell>
                          <TableCell className="text-slate-500 text-xs">{fmtDuration(log.duration_seconds)}</TableCell>
                          <TableCell>
                            <Badge variant={cfg.variant} className="flex items-center gap-1 w-fit">
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-slate-600">{log.opportunities_found ?? 0}</TableCell>
                          <TableCell className="text-right text-slate-600">{log.opportunities_saved ?? 0}</TableCell>
                          <TableCell className="text-right text-slate-600">{log.whatsapp_alerts_sent ?? 0}</TableCell>
                          <TableCell className="text-right text-slate-600">{log.retry_count ?? 0}</TableCell>
                          <TableCell className="text-right">
                            {log.error_message && (
                              <button
                                onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 ml-auto"
                              >
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                {isExpanded ? 'Hide' : 'Error'}
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && log.error_message && (
                          <TableRow key={`${log.id}-error`}>
                            <TableCell colSpan={9} className="bg-red-50 border-b border-red-100 px-6 py-3">
                              <p className="text-xs font-medium text-red-600 mb-1">Error Details</p>
                              <pre className="text-xs text-red-500 whitespace-pre-wrap font-mono leading-relaxed">
                                {log.error_message}
                              </pre>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
