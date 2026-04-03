import { Sparkles } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AppHeader({ title, subtitle, actions }: AppHeaderProps) {
  return (
    <div className="sticky top-0 z-30 border-b border-[#1e1e2e] bg-[#0a0a0f]/80 backdrop-blur-md px-8 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">{title}</h1>
          {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
