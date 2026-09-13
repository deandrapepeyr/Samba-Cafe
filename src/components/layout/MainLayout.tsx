'use client';

import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, X, Home, Clock, LayoutDashboard, ChefHat, Bot, Send, Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const pathname = usePathname();
  const { role, isLoading } = useAuth();

  useEffect(() => {
    setMounted(true);

    // Background Sync Logic
    const syncOfflineQueue = async () => {
      const offlineQueue = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
      if (offlineQueue.length === 0) return;

      console.log(`Attempting to sync ${offlineQueue.length} offline transactions...`);
      
      try {
        for (const item of offlineQueue) {
          const { transaction, itemsToInsert } = item;
          
          // Retry pushing to supabase
          const { error: txError } = await supabase.from('transactions').insert([transaction]);
          if (txError) throw txError;
          
          const { error: itemsError } = await supabase.from('transaction_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }
        
        // If all succeeded, clear the queue
        localStorage.removeItem('offline_transactions');
        alert("✅ Sinkronisasi Berhasil: Data transaksi offline telah dikirim ke server.");
      } catch (error) {
        console.error("Sync failed, will keep in queue:", error);
      }
    };

    // Listen for online event
    window.addEventListener('online', syncOfflineQueue);
    
    // Also try syncing right away if already online on mount
    if (navigator.onLine) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', syncOfflineQueue);
    };
  }, []);

  const isManager = mounted && !isLoading && role === 'manager';

  // AI Manager Assistant State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiChat, setAiChat] = useState<{role: string, content: string}[]>([{
    role: 'assistant',
    content: 'Halo Bos! Ada yang bisa saya bantu terkait laporan kafe kita?'
  }]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChat, isAiOpen]);

  const handleAiSubmit = async (text: string) => {
    if (!text.trim() || isAiLoading) return;

    setAiInput('');
    const newChat = [...aiChat, { role: 'user', content: text }];
    setAiChat(newChat);
    setIsAiLoading(true);

    try {
      const response = await fetch('/api/ai-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, chatHistory: aiChat.slice(-5) }) // keep context small
      });
      const data = await response.json();
      setAiChat([...newChat, { role: 'assistant', content: data.reply || 'Maaf, sistem AI sedang gangguan.' }]);
    } catch (error) {
      setAiChat([...newChat, { role: 'assistant', content: 'Gagal terhubung ke AI.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
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

      {/* AI Manager Assistant FAB & Dialog */}
      {isManager && (
        <>
          <button
            onClick={() => setIsAiOpen(true)}
            className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-indigo-700 transition-all hover:scale-105 z-40 group"
          >
            <Sparkles size={24} className="group-hover:animate-pulse" />
          </button>

          <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
            <DialogContent className="bg-card border-border sm:max-w-md h-[80vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-4 border-b border-border bg-indigo-600/10 shrink-0">
                <DialogTitle className="flex items-center gap-2 text-indigo-500 text-lg">
                  <Bot size={24} /> Manager Assistant
                </DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-4 pb-4">
                  {aiChat.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-muted border border-border text-foreground rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isAiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted border border-border text-foreground rounded-2xl rounded-tl-sm px-4 py-2 text-sm flex gap-1">
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce delay-100">.</span>
                        <span className="animate-bounce delay-200">.</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border bg-card shrink-0">
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                  {["Penjualan hari ini", "Laporan minggu ini", "Bulan ini gimana?"].map(q => (
                    <button 
                      key={q} 
                      className="whitespace-nowrap rounded-full border border-indigo-500/30 bg-indigo-500/5 text-indigo-500 px-3 py-1.5 text-xs hover:bg-indigo-500 hover:text-white transition-colors"
                      onClick={() => handleAiSubmit(q)}
                      disabled={isAiLoading}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleAiSubmit(aiInput); }} 
                  className="flex gap-2"
                >
                  <Input
                    placeholder='Tanya laporan...'
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    disabled={isAiLoading}
                    className="bg-background border-border rounded-full"
                    autoFocus
                  />
                  <Button type="submit" disabled={isAiLoading || !aiInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full w-10 h-10 p-0 shrink-0 flex items-center justify-center">
                    <Send size={16} className="-ml-0.5" />
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
