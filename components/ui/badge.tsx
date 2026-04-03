import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'bg-violet-600/20 text-violet-300 border border-violet-600/30': variant === 'default',
          'bg-emerald-600/20 text-emerald-300 border border-emerald-600/30': variant === 'success',
          'bg-red-600/20 text-red-300 border border-red-600/30': variant === 'danger',
          'bg-amber-600/20 text-amber-300 border border-amber-600/30': variant === 'warning',
          'bg-blue-600/20 text-blue-300 border border-blue-600/30': variant === 'info',
          'bg-transparent text-slate-500 border border-slate-300': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}
