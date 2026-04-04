// Real score breakdown using DB schema scores + weights.
// Used on opportunity detail and share pages instead of the POC ScoreBreakdown.
interface ScoreBreakdownRealProps {
  scoreVelocity: number;
  scoreTraction: number;
  scoreSeaCompetition: number;
  scoreAmastAlignment: number;
  scoreMarketSize: number;
  scoreTotal: number;
}

const FACTORS = [
  { key: 'scoreVelocity',      label: 'Velocity',          weight: 0.20 },
  { key: 'scoreTraction',      label: 'Traction',           weight: 0.20 },
  { key: 'scoreSeaCompetition',label: 'SEA Competition',    weight: 0.30 },
  { key: 'scoreAmastAlignment',label: 'AMAST Alignment',    weight: 0.15 },
  { key: 'scoreMarketSize',    label: 'Market Size',        weight: 0.15 },
] as const;

export function ScoreBreakdownReal(props: ScoreBreakdownRealProps) {
  return (
    <div className="space-y-3">
      {FACTORS.map((f) => {
        const raw = props[f.key as keyof ScoreBreakdownRealProps] as number;
        const contribution = Math.round(raw * f.weight * 10) / 10;
        return (
          <div key={f.key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">
                {f.label}
                <span className="text-slate-500 ml-1">× {Math.round(f.weight * 100)}%</span>
              </span>
              <span className="text-slate-700 font-medium">
                {raw}<span className="text-slate-500">/100</span>
                <span className="text-slate-500 ml-1">= {contribution}</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${raw}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
        <span className="text-sm font-semibold text-slate-700">Total Score</span>
        <span className="text-lg font-bold text-violet-400">
          {Math.round(props.scoreTotal)}
          <span className="text-slate-500 text-sm">/100</span>
        </span>
      </div>
    </div>
  );
}
