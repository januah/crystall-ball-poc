import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95': variant === 'default',
            'border border-border text-foreground hover:bg-accent hover:text-accent-foreground': variant === 'outline',
            'text-muted-foreground hover:text-foreground hover:bg-accent': variant === 'ghost',
            'bg-destructive text-white border border-destructive hover:bg-destructive/90': variant === 'danger',
            'bg-success/20 text-success-foreground border border-success/30 hover:bg-success/30': variant === 'success',
            'px-3 py-1.5 text-sm gap-1.5': size === 'sm',
            'px-4 py-2 text-sm gap-2': size === 'md',
            'px-6 py-3 text-base gap-2': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
