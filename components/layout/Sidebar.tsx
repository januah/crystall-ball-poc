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
    <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40 bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 shadow-lg shadow-violet-900/40">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-none">
            <span className="text-sm font-bold text-white tracking-tight">Crystal Ball</span>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Intelligence</p>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div className="px-5 pt-5 pb-1">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Menu</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-900/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-white')} />
                {item.label}
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />
                )}
              </Link>
            );
          })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 rounded-lg bg-slate-800/60 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white text-xs font-bold shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {user?.full_name ?? user?.email ?? 'Loading...'}
            </p>
            <p className="text-[10px] text-slate-500 capitalize">{user?.role ?? ''}</p>
          </div>
          <button
            onClick={logout}
            className="text-slate-600 hover:text-slate-300 transition-colors ml-1"
            title="Logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
