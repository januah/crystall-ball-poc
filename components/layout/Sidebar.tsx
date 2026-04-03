'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ScrollText, LogOut, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '??';

  const isAdmin = user?.role === 'admin';

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { href: '/admin/logs', label: 'Cron Logs', icon: ScrollText, show: isAdmin },
    { href: '/admin/users', label: 'User Management', icon: Users, show: isAdmin },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-slate-100 border-r border-slate-200 flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 border border-violet-600/30">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 tracking-tight">Crystal Ball</span>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Intelligence</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-600/20'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-200">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600/30 text-violet-300 text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 truncate">
              {user?.full_name ?? user?.email ?? 'Loading...'}
            </p>
            <p className="text-[10px] text-slate-400 capitalize">{user?.role ?? ''}</p>
          </div>
          <button
            onClick={logout}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
