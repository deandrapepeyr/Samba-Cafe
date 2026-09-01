'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, Settings, UserCircle, LogOut, LogIn, Coffee, Package, FileText, ChevronLeft, ChevronRight, Loader2, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

export function Sidebar({ onLogoutClick, onLoginClick }: { onLogoutClick?: () => void; onLoginClick?: () => void } = {}) {
  const pathname = usePathname();
  const { role, userName, logout, isLoading } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && role) {
      fetchActiveCount();
      
      const channelId = `sidebar_orders_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase
        .channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
          fetchActiveCount();
        })
        .subscribe();

      const interval = setInterval(fetchActiveCount, 10000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, [mounted, role]);

  const fetchActiveCount = async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('transactions')
      .select('status')
      .gte('created_at', startOfDay.toISOString());

    if (data) {
      const active = data.filter(t => {
        const st = (t.status || 'preparing').toLowerCase();
        return st === 'preparing' || st === 'ready' || st === 'paid';
      }).length;
      setActiveOrdersCount(active);
    }
  };

  const isManager = mounted && !isLoading && role === 'manager';
  const isAuthLoaded = mounted && !isLoading;

  return (
    <div className={cn("h-screen bg-background border-r border-border flex flex-col justify-between py-6 transition-all duration-300 relative", isExpanded ? "w-64" : "w-20")}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-8 bg-card border border-border rounded-full p-1 text-muted-foreground hover:text-foreground z-10 hidden md:block"
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className={cn("flex flex-col px-0 space-y-8", isExpanded ? "items-stretch px-4" : "items-center")}>
        <div className={cn("flex items-center gap-3 px-2", isExpanded ? "justify-start" : "justify-center")}>
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
            <img src="/logo.png" alt="Samba Cafe" className="w-full h-full object-cover" />
          </div>
          <span className={cn("text-primary font-bold text-xl tracking-tight", isExpanded ? "block" : "hidden")}>Samba Cafe</span>
        </div>

        <nav className="flex flex-col gap-2">
          <Link href="/pos" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/pos' })}>
            <Home size={20} className="shrink-0" />
            <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>POS</span>
          </Link>

          <Link href="/orders" className={cn("flex items-center justify-between px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/orders' })}>
            <div className="flex items-center gap-3">
              <ChefHat size={20} className="shrink-0" />
              <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Pesanan</span>
            </div>
            {activeOrdersCount > 0 && (
              <span className={cn("px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white animate-pulse", isExpanded ? "block" : "hidden")}>
                {activeOrdersCount}
              </span>
            )}
          </Link>
          {isManager && (
            <Link href="/dashboard" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/dashboard' })}>
              <LayoutDashboard size={20} className="shrink-0" />
              <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Dashboard</span>
            </Link>
          )}
          <Link href="/history" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/history' })}>
            <Coffee size={20} className="shrink-0" />
            <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>History</span>
          </Link>
          {isManager && (
            <>
              <Link href="/reports" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/reports' })}>
                <FileText size={20} className="shrink-0" />
                <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Reports</span>
              </Link>
              <Link href="/stock" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/stock' })}>
                <Package size={20} className="shrink-0" />
                <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Stock</span>
              </Link>
              <Link href="/settings" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/settings' })}>
                <Settings size={20} className="shrink-0" />
                <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Settings</span>
              </Link>
            </>
          )}
        </nav>
      </div>

      <div className={cn("flex flex-col gap-2 px-2", isExpanded ? "px-4" : "")}>
        {!isAuthLoaded ? (
          <div className="px-3 py-3 text-muted-foreground flex items-center gap-3 text-sm">
            <Loader2 size={20} className="animate-spin text-primary shrink-0" />
            <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Memuat...</span>
          </div>
        ) : role ? (
          <>
            <Link href="/profile" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/profile' })}>
              <UserCircle size={20} className="shrink-0" />
              <span className={cn("font-medium truncate", isExpanded ? "block" : "hidden")}>{userName || 'Profile'}</span>
            </Link>
            <button onClick={onLogoutClick || logout} className="flex items-center gap-3 px-3 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-all">
              <LogOut size={20} className="shrink-0" />
              <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Log Out</span>
            </button>
          </>
        ) : (
          <button onClick={onLoginClick} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm">
            <LogIn size={20} className="shrink-0" />
            <span className={cn("font-semibold", isExpanded ? "block" : "hidden")}>Log In Kasir</span>
          </button>
        )}
      </div>
    </div>
  );
}
