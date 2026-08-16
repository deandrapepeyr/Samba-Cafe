'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, Settings, UserCircle, LogOut, Coffee, Package, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

export function Sidebar({ onLogoutClick }: { onLogoutClick?: () => void } = {}) {
  const pathname = usePathname();
  const { role, logout } = useAuth();

  return (
    <div className="w-20 lg:w-64 h-screen bg-background border-r border-border flex flex-col justify-between py-6">
      <div className="flex flex-col items-center lg:items-stretch px-0 lg:px-4 space-y-8">
        <div className="flex items-center justify-center lg:justify-start gap-3 px-2">
          <div className="bg-primary p-2 rounded-xl text-primary-foreground">
            <Coffee size={24} />
          </div>
          <span className="hidden lg:block text-primary font-bold text-xl tracking-tight">Samba Cafe</span>
        </div>

        <nav className="flex flex-col gap-2">
          <Link href="/pos" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/pos' })}>
            <Home size={20} />
            <span className="hidden lg:block font-medium">POS</span>
          </Link>
          {role === 'manager' && (
            <Link href="/dashboard" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/dashboard' })}>
              <LayoutDashboard size={20} />
              <span className="hidden lg:block font-medium">Dashboard</span>
            </Link>
          )}
          <Link href="/history" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/history' })}>
            <Coffee size={20} />
            <span className="hidden lg:block font-medium">History</span>
          </Link>
          {role === 'manager' && (
            <>
              <Link href="/reports" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/reports' })}>
                <FileText size={20} />
                <span className="hidden lg:block font-medium">Reports</span>
              </Link>
              <Link href="/stock" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/stock' })}>
                <Package size={20} />
                <span className="hidden lg:block font-medium">Stock</span>
              </Link>
              <Link href="/settings" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/settings' })}>
                <Settings size={20} />
                <span className="hidden lg:block font-medium">Settings</span>
              </Link>
            </>
          )}
        </nav>
      </div>

      <div className="flex flex-col gap-2 px-2 lg:px-4">
        <Link href="/profile" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/profile' })}>
          <UserCircle size={20} />
          <span className="hidden lg:block font-medium">Profile</span>
        </Link>
        <button onClick={onLogoutClick || logout} className="flex items-center gap-3 px-3 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-all">
          <LogOut size={20} />
          <span className="hidden lg:block font-medium">Log Out</span>
        </button>
      </div>
    </div>
  );
}
