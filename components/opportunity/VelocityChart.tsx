interface VelocityChartProps {
  data: { month: string; score: number; isRecent: boolean }[];
}

export function VelocityChart({ data }: VelocityChartProps) {
  const max = Math.max(...data.map(d => d.score));
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 h-32">
        {data.map((d) => (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-slate-400">{d.score}</span>
            <div
              className={`w-full rounded-t-sm transition-all ${
                d.isRecent ? 'bg-violet-500' : 'bg-slate-200'
              }`}
              style={{ height: `${(d.score / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {data.map((d) => (
          <div key={d.month} className="flex-1 text-center text-[10px] text-slate-400">{d.month}</div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-200" /> Historical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-violet-500" /> Recent (2 weeks)
        </span>
      </div>
    </div>
  );
}
