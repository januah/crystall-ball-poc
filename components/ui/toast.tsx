'use client';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-600/30 bg-card px-5 py-3.5 shadow-2xl animate-in slide-in-from-bottom-4">
      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
      <span className="text-sm text-foreground">{message}</span>
      <button onClick={onClose} className="ml-2 text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => setToast(msg);
  const hideToast = () => setToast(null);
  return { toast, showToast, hideToast };
}
