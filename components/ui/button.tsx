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
            'bg-violet-600 text-white hover:bg-violet-500 active:bg-violet-700': variant === 'default',
            'border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900': variant === 'outline',
            'text-slate-500 hover:text-slate-900 hover:bg-slate-100': variant === 'ghost',
            'bg-red-600/20 text-red-300 border border-red-600/30 hover:bg-red-600/30': variant === 'danger',
            'bg-emerald-600/20 text-emerald-300 border border-emerald-600/30 hover:bg-emerald-600/30': variant === 'success',
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
