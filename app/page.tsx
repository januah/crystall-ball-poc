'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Lock, Mail, Zap, BarChart3, Globe } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Abstract background shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute top-3/4 right-1/4 w-72 h-72 rounded-full bg-secondary/10 blur-2xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute top-1/3 right-1/3 w-48 h-48 rotate-45 bg-gradient-to-r from-primary/10 to-secondary/10 blur-xl" />
        <div className="absolute bottom-1/4 left-1/3 w-56 h-56 rotate-12 bg-gradient-to-br from-violet-500/5 to-teal-500/5 blur-xl" />
      </div>

      <div className="w-full max-w-6xl px-6 flex flex-col lg:flex-row items-center justify-between relative z-10">
        {/* Left side - Branding */}
        <div className="w-full lg:w-1/2 text-center lg:text-left mb-12 lg:mb-0 lg:pr-12">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-6 mx-auto lg:mx-0">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">Crystal Ball</h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto lg:mx-0">
            Your Window Into Tomorrow's Opportunities
          </p>

          <div className="mt-12 grid grid-cols-3 gap-6 max-w-md mx-auto lg:mx-0">
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground text-center">AI-Powered Insights</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center mb-2">
                <BarChart3 className="h-6 w-6 text-secondary" />
              </div>
              <span className="text-xs text-muted-foreground text-center">Market Intelligence</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-2">
                <Globe className="h-6 w-6 text-accent" />
              </div>
              <span className="text-xs text-muted-foreground text-center">Global Coverage</span>
            </div>
          </div>
        </div>

        {/* Right side - Login Card */}
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 space-y-5 shadow-xl">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Welcome Back</h2>
              <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
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
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
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
                className="w-full mt-4"
                size="lg"
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">AMAST Sdn Bhd · Internal Use Only</p>
        </div>
      </div>
    </div>
  );
}
