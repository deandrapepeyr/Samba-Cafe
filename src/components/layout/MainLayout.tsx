'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, X, Home, Clock, LayoutDashboard } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

interface MainLayoutProps {
  children: React.ReactNode;
  onLogoutClick?: () => void;
  title: string;
  headerAction?: React.ReactNode;
}

export function MainLayout({ children, onLogoutClick, title, headerAction }: MainLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { role } = useAuth();

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar onLogoutClick={onLogoutClick} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileSidebarOpen(false)} />
          <div className="relative z-50 flex flex-col bg-background w-fit h-full shadow-2xl animate-in slide-in-from-left-full duration-300">
            <button 
              className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground z-50"
              onClick={() => setIsMobileSidebarOpen(false)}
            >
              <X size={24} />
            </button>
            <Sidebar onLogoutClick={onLogoutClick} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="md:hidden flex items-center justify-between px-4 h-16 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)} 
              className="p-2 -ml-2 text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-bold truncate">{title}</h1>
          </div>
          {headerAction && <div>{headerAction}</div>}
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </div>

        {/* Mobile Bottom Navigation (Hidden on Desktop) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around h-16 z-40 pb-safe">
          <Link href="/pos" className={`flex flex-col items-center justify-center w-full h-full ${pathname === '/pos' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Home size={22} className={pathname === '/pos' ? 'fill-primary/20' : ''} />
            <span className="text-[10px] mt-1 font-medium">POS</span>
          </Link>
          
          <Link href="/history" className={`flex flex-col items-center justify-center w-full h-full ${pathname === '/history' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Clock size={22} className={pathname === '/history' ? 'fill-primary/20' : ''} />
            <span className="text-[10px] mt-1 font-medium">History</span>
          </Link>

          {role === 'manager' && (
            <Link href="/dashboard" className={`flex flex-col items-center justify-center w-full h-full ${pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <LayoutDashboard size={22} className={pathname === '/dashboard' ? 'fill-primary/20' : ''} />
              <span className="text-[10px] mt-1 font-medium">Dashboard</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
