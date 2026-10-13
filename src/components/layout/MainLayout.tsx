'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, X, Home, Clock, LayoutDashboard, ChefHat, WifiOff } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { BroadcastMarquee } from '@/components/ui/BroadcastMarquee';

interface MainLayoutProps {
  children: React.ReactNode;
  onLogoutClick?: () => void;
  onLoginClick?: () => void;
  title: string;
  headerAction?: React.ReactNode;
}

export function MainLayout({ children, onLogoutClick, onLoginClick, title, headerAction }: MainLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const pathname = usePathname();
  const { role, isLoading } = useAuth();

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    // Background Sync Logic
    const syncOfflineQueue = async () => {
      const offlineQueue = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
      if (offlineQueue.length === 0) return;

      console.log(`Attempting to sync ${offlineQueue.length} offline transactions...`);
      let successCount = 0;
      const newQueue = [];
      
      try {
        for (const item of offlineQueue) {
          const { transaction, itemsToInsert } = item;
          
          // Retry pushing to supabase
          const { error: txError } = await supabase.from('transactions').insert([transaction]);
          
          if (txError) {
             // If transaction already exists (23505) or foreign key fails, we can't do much. Skip it.
             if (txError.code === '23505' || txError.code === '23503') {
                console.warn("Skipping bad/duplicate offline transaction:", transaction.id);
                continue;
             }
             throw txError;
          }
          
          const { error: itemsError } = await supabase.from('transaction_items').insert(itemsToInsert);
          if (itemsError) {
             if (itemsError.code === '23503' || itemsError.code === '23505') {
                 console.warn("Skipping bad items for transaction:", transaction.id);
                 continue;
             }
             throw itemsError;
          }
          successCount++;
        }
        
        // If all succeeded (or skipped), clear the queue
        localStorage.removeItem('offline_transactions');
        if (successCount > 0) {
           alert(`✅ Sinkronisasi Berhasil: ${successCount} data transaksi offline telah dikirim ke server.`);
           window.dispatchEvent(new CustomEvent('refresh-dashboard'));
        }
      } catch (error) {
        console.error("Sync failed for some items, keeping them in queue:", error);
      }
    };

    // Listen for online event
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Also try syncing right away if already online on mount
    // Delay slightly to allow auth session to initialize
    if (navigator.onLine) {
      setTimeout(() => {
        syncOfflineQueue();
      }, 3000);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isManager = mounted && !isLoading && role === 'manager';

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden text-foreground relative">
      {/* Global Aesthetic Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-[#38a169]/5 rounded-full blur-[120px]"></div>
        
        {/* Subtle Grid Texture */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_20%,#000_40%,transparent_100%)]"></div>
      </div>

      {/* Global Connection Status */}
      {!isOnline && mounted && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] bg-amber-500 text-amber-950 px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 animate-bounce">
          <WifiOff size={16} /> Mode Offline
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:block relative z-10 border-r border-white/5 bg-zinc-950/60 backdrop-blur-xl">
        <Sidebar onLogoutClick={onLogoutClick} onLoginClick={onLoginClick} />
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
            <Sidebar onLogoutClick={onLogoutClick} onLoginClick={onLoginClick} />
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

        <BroadcastMarquee />

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0 flex flex-col">
          {children}
        </div>

        {/* Mobile Bottom Navigation (Hidden on Desktop) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around h-16 z-40 pb-safe">
          <Link href="/pos" className={`flex flex-col items-center justify-center w-full h-full ${pathname === '/pos' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Home size={22} className={pathname === '/pos' ? 'fill-primary/20' : ''} />
            <span className="text-[10px] mt-1 font-medium">POS</span>
          </Link>

          <Link href="/orders" className={`flex flex-col items-center justify-center w-full h-full ${pathname === '/orders' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <ChefHat size={22} className={pathname === '/orders' ? 'fill-primary/20' : ''} />
            <span className="text-[10px] mt-1 font-medium">Pesanan</span>
          </Link>
          
          <Link href="/history" className={`flex flex-col items-center justify-center w-full h-full ${pathname === '/history' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <Clock size={22} className={pathname === '/history' ? 'fill-primary/20' : ''} />
            <span className="text-[10px] mt-1 font-medium font-medium">History</span>
          </Link>

          {isManager && (
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
