'use client';

import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, X, Home, Clock, LayoutDashboard, ChefHat, Bot, Send, Sparkles, Upload, Image as ImageIcon, WifiOff } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  // AI Manager Assistant State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiChat, setAiChat] = useState<{role: string, content: string}[]>([{
    role: 'assistant',
    content: 'Halo Bos! Ada yang bisa saya bantu terkait laporan kafe kita?'
  }]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Add Menu Feature State
  const [showAddMenuForm, setShowAddMenuForm] = useState(false);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [newMenu, setNewMenu] = useState({ name: '', price: '', category_id: '' });
  const [newMenuImage, setNewMenuImage] = useState<File | null>(null);
  const [isSubmittingMenu, setIsSubmittingMenu] = useState(false);

  useEffect(() => {
    if (isManager) {
      supabase.from('categories').select('*').then(({ data }) => {
        if (data) setCategories(data);
      });
    }
  }, [isManager]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChat, isAiOpen]);

  const handleAiSubmit = async (text: string) => {
    if (!text.trim() || isAiLoading) return;

    setAiInput('');
    const newChat = [...aiChat, { role: 'user', content: text }];
    
    if (text.toLowerCase().includes('tambah menu')) {
      setAiChat([...newChat, { role: 'assistant', content: 'Silakan isi form berikut untuk menambahkan menu baru:' }]);
      setShowAddMenuForm(true);
      return;
    }

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

  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenu.name || !newMenu.price || !newMenu.category_id) {
      alert("Mohon lengkapi nama, harga, dan kategori!");
      return;
    }

    setIsSubmittingMenu(true);
    try {
      let finalImageUrl: string | null = null;
      
      if (newMenuImage) {
        const formData = new FormData();
        formData.append('file', newMenuImage);

        const uploadRes = await fetch('/api/upload-image', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Gagal upload foto');
        finalImageUrl = uploadData.imageUrl;
      }

      const { error } = await supabase.from('products').insert([{
        id: crypto.randomUUID(),
        name: newMenu.name,
        price: parseInt(newMenu.price),
        category_id: newMenu.category_id,
        image_url: finalImageUrl,
        is_available: true
      }]);

      if (error) throw error;

      setShowAddMenuForm(false);
      setNewMenu({ name: '', price: '', category_id: '' });
      setNewMenuImage(null);
      setAiChat(prev => [...prev, { role: 'assistant', content: `Menu "${newMenu.name}" berhasil ditambahkan dan siap dijual!` }]);
      
      // Trigger a refresh event for the POS and other pages to update their lists
      window.dispatchEvent(new CustomEvent('refresh-products'));
    } catch (err: any) {
      alert("Gagal menambah menu: " + err.message);
    } finally {
      setIsSubmittingMenu(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground relative">
      {/* Global Connection Status */}
      {!isOnline && mounted && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] bg-amber-500 text-amber-950 px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 animate-bounce">
          <WifiOff size={16} /> Mode Offline
        </div>
      )}

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
            <DialogContent className="bg-zinc-950/80 backdrop-blur-2xl border-white/10 sm:max-w-md h-[80vh] flex flex-col p-0 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] rounded-2xl">
              <DialogHeader className="p-5 border-b border-white/5 bg-transparent shrink-0">
                <DialogTitle className="flex items-center gap-3 text-white text-lg font-medium tracking-tight">
                  <div className="p-2 bg-indigo-500/20 rounded-xl">
                    <Bot size={20} className="text-indigo-400" />
                  </div>
                  Manager Assistant
                </DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="flex-1 p-5">
                <div className="flex flex-col gap-5 pb-4">
                  {aiChat.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-500 text-white rounded-tr-sm' : 'bg-white/5 border border-white/5 text-zinc-200 rounded-tl-sm backdrop-blur-sm'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isAiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 border border-white/5 text-zinc-400 rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex gap-1 items-center backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-100"></span>
                        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-200"></span>
                      </div>
                    </div>
                  )}
                  {showAddMenuForm && (
                    <div className="bg-white/[0.03] border border-white/10 backdrop-blur-md rounded-2xl p-5 mt-2 shadow-inner">
                      <h4 className="font-medium text-white mb-4 text-sm flex items-center gap-2">
                        <ChefHat size={16} className="text-indigo-400" /> Form Tambah Menu
                      </h4>
                      <form onSubmit={handleMenuSubmit} className="flex flex-col gap-4">
                        <div>
                          <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Nama Menu</label>
                          <Input required placeholder="Mis: Nasi Goreng Spesial" className="h-9 text-sm bg-black/20 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-indigo-500/50 rounded-lg" value={newMenu.name} onChange={e => setNewMenu({...newMenu, name: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Harga (Rp)</label>
                          <Input required type="text" placeholder="Mis: 25.000" className="h-9 text-sm bg-black/20 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-indigo-500/50 rounded-lg" value={newMenu.price ? parseInt(newMenu.price).toLocaleString('id-ID') : ''} onChange={e => { const num = e.target.value.replace(/\D/g, ''); setNewMenu({...newMenu, price: num}); }} />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Kategori</label>
                          <select required className="w-full h-9 text-sm rounded-lg border border-white/10 bg-black/20 text-white px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 appearance-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23a1a1aa\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }} value={newMenu.category_id} onChange={e => setNewMenu({...newMenu, category_id: e.target.value})}>
                            <option value="" className="bg-zinc-900 text-zinc-400">Pilih Kategori...</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id} className="bg-zinc-900 text-white">{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 font-medium mb-1.5 flex items-center justify-between block">
                            <span>Foto Menu</span>
                            <span className="text-zinc-500 font-normal opacity-70">(Opsional)</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 border border-dashed border-white/20 bg-black/20 hover:bg-white/5 transition-colors rounded-lg py-2.5 text-zinc-400 hover:text-zinc-300 text-xs font-medium">
                              <Upload size={14} /> {newMenuImage ? 'Ganti Foto' : 'Pilih Foto'}
                              <input type="file" accept="image/*" className="hidden" onChange={e => setNewMenuImage(e.target.files?.[0] || null)} />
                            </label>
                            {newMenuImage && <div className="text-xs text-emerald-400 font-medium flex items-center bg-emerald-400/10 px-3 py-2 rounded-lg border border-emerald-400/20"><ImageIcon size={14} className="mr-1.5"/>Terpilih</div>}
                          </div>
                        </div>
                        <div className="flex gap-3 mt-2">
                          <Button type="button" variant="ghost" className="flex-1 h-9 text-xs border border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white rounded-lg" onClick={() => setShowAddMenuForm(false)}>Batal</Button>
                          <Button type="submit" disabled={isSubmittingMenu} className="flex-1 h-9 text-xs bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all rounded-lg border-0">
                            {isSubmittingMenu ? 'Menyimpan...' : 'Simpan Menu'}
                          </Button>
                        </div>
                      </form>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-white/5 bg-transparent shrink-0">
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                  {["Penjualan hari ini", "Laporan minggu ini", "Bulan ini gimana?"].map(q => (
                    <button 
                      key={q} 
                      className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 text-zinc-300 px-3.5 py-1.5 text-xs hover:bg-white/10 hover:text-white transition-all font-medium"
                      onClick={() => handleAiSubmit(q)}
                      disabled={isAiLoading}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleAiSubmit(aiInput); }} 
                  className="flex gap-2 relative"
                >
                  <Input
                    placeholder='Tanya sesuatu atau "tambah menu"...'
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    disabled={isAiLoading}
                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-500 rounded-full h-11 pl-4 pr-12 focus-visible:ring-1 focus-visible:ring-indigo-500/50 shadow-inner"
                    autoFocus
                  />
                  <Button type="submit" disabled={isAiLoading || !aiInput.trim()} className="absolute right-1 top-1 bottom-1 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full w-9 h-9 p-0 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-md">
                    <Send size={14} className="-ml-0.5" />
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
