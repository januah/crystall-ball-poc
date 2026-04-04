import { TrendEntry } from '@/types';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendHistoryProps {
  history: TrendEntry[];
}

export function TrendHistory({ history }: TrendHistoryProps) {
  return (
    <div className="space-y-2">
      {history.map((entry, i) => {
        const prev = history[i - 1];
        const rankDelta = prev ? prev.rank - entry.rank : 0;
        return (
          <div key={entry.date} className="flex items-center gap-4 py-2.5 border-b border-slate-200 last:border-0">
            <span className="text-xs text-slate-500 w-24 shrink-0">{entry.date}</span>
            <span className="text-sm text-slate-700 w-8 shrink-0">#{entry.rank}</span>
            {rankDelta > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            ) : rankDelta < 0 ? (
              <TrendingDown className="h-3.5 w-3.5 text-red-400 shrink-0" />
            ) : (
              <Minus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            )}
            <div className="flex-1" />
            <Badge variant={entry.hypeType === 'Traction' ? 'success' : 'warning'} className="text-[10px]">
              {entry.hypeType}
            </Badge>
            <span className="text-sm font-bold text-slate-700 w-16 text-right">{entry.score}/100</span>
          </div>
        );
      })}
    </div>
  );
}
