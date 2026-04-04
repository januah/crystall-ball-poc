'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ScrollText, LogOut, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { DarkModeToggle } from '@/components/ui/DarkModeToggle';

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
    <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40 bg-sidebar border-r border-border">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-lg shadow-violet-900/40">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-none">
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight">Crystal Ball</span>
            <p className="text-[10px] text-sidebar-foreground/70 uppercase tracking-widest mt-0.5">Intelligence</p>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div className="px-5 pt-5 pb-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Menu</p>
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
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-violet-900/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar/50'
                )}
              >
                <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground')} />
                {item.label}
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-foreground/60" />
                )}
              </Link>
            );
          })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar/60 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">
              {user?.full_name ?? user?.email ?? 'Loading...'}
            </p>
            <p className="text-[10px] text-sidebar-foreground/70 capitalize">{user?.role ?? ''}</p>
          </div>
          <div className="flex items-center gap-1">
            <DarkModeToggle />
            <button
              onClick={logout}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors ml-1"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
