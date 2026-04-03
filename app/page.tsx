'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Lock, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Invalid email or password.');
        return;
      }

      await refresh();
      router.push('/dashboard');
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-100/50 blur-3xl" />
      </div>

      <div className="w-full max-w-sm px-6 relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 border border-violet-600/30 mb-4">
            <Sparkles className="h-7 w-7 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Crystal Ball</h1>
          <p className="mt-1 text-sm text-slate-500">Market Intelligence Platform</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@amast.com.my"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <Button
            className="w-full mt-2"
            size="lg"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">AMAST Sdn Bhd · Internal Use Only</p>
      </div>
    </div>
  );
}
