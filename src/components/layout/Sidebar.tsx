'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, Settings, UserCircle, LogOut, Coffee, Package, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

export function Sidebar({ onLogoutClick }: { onLogoutClick?: () => void } = {}) {
  const pathname = usePathname();
  const { role, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);

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
          <div className="bg-primary p-2 rounded-xl text-primary-foreground">
            <Coffee size={24} />
          </div>
          <span className={cn("text-primary font-bold text-xl tracking-tight", isExpanded ? "block" : "hidden")}>Samba Cafe</span>
        </div>

        <nav className="flex flex-col gap-2">
          <Link href="/pos" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/pos' })}>
            <Home size={20} className="shrink-0" />
            <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>POS</span>
          </Link>
          {role === 'manager' && (
            <Link href="/dashboard" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/dashboard' })}>
              <LayoutDashboard size={20} className="shrink-0" />
              <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Dashboard</span>
            </Link>
          )}
          <Link href="/history" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/history' })}>
            <Coffee size={20} className="shrink-0" />
            <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>History</span>
          </Link>
          {role === 'manager' && (
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
        <Link href="/profile" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/profile' })}>
          <UserCircle size={20} className="shrink-0" />
          <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Profile</span>
        </Link>
        <button onClick={onLogoutClick || logout} className="flex items-center gap-3 px-3 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-all">
          <LogOut size={20} className="shrink-0" />
          <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Log Out</span>
        </button>
      </div>
    </div>
  );
}
