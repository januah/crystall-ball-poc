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
          'bg-primary/10 text-primary border border-primary/20': variant === 'default',
          'bg-emerald-600/10 text-emerald-700 border border-emerald-600/20': variant === 'success',
          'bg-destructive/10 text-destructive border border-destructive/20': variant === 'danger',
          'bg-accent/20 text-amber-700 border border-accent/30': variant === 'warning',
          'bg-secondary/10 text-secondary border border-secondary/20': variant === 'info',
          'bg-transparent text-muted-foreground border border-border': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}
