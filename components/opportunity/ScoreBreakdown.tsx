interface ScoreBreakdownProps {
  breakdown: {
    marketSize: number;
    innovation: number;
    seaFit: number;
    timing: number;
    competition: number;
    amastFit: number;
    total: number;
  };
}

const factors = [
  { key: 'marketSize', label: 'Market Size', max: 20 },
  { key: 'innovation', label: 'Innovation Level', max: 20 },
  { key: 'seaFit', label: 'SEA Market Fit', max: 20 },
  { key: 'timing', label: 'Timing', max: 20 },
  { key: 'competition', label: 'Competition', max: 15 },
  { key: 'amastFit', label: 'AMAST Alignment', max: 10 },
] as const;

export function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  return (
    <div className="space-y-3">
      {factors.map((f) => {
        const score = breakdown[f.key as keyof typeof breakdown] as number;
        const pct = (score / f.max) * 100;
        return (
          <div key={f.key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-foreground">{f.label}</span>
              <span className="text-foreground font-medium">
                {score}<span className="text-muted-foreground">/{f.max}</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="pt-2 border-t border-border flex justify-between items-center">
        <span className="text-sm font-semibold text-foreground">Total Score</span>
        <span className="text-lg font-bold text-violet-400">
          {breakdown.total}<span className="text-muted-foreground text-sm">/100</span>
        </span>
      </div>
    </div>
  );
}
