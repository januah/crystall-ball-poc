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
            <span className="text-[10px] text-muted-foreground">{d.score}</span>
            <div
              className={`w-full rounded-t-sm transition-all ${
                d.isRecent ? 'bg-primary' : 'bg-border'
              }`}
              style={{ height: `${(d.score / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {data.map((d) => (
          <div key={d.month} className="flex-1 text-center text-[10px] text-muted-foreground">{d.month}</div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-border" /> Historical
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary" /> Recent (2 weeks)
        </span>
      </div>
    </div>
  );
}
