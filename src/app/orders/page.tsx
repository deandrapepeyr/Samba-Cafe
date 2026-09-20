'use client';

import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Clock, 
  CheckCircle2, 
  ChefHat, 
  Bell, 
  Search, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Receipt, 
  RotateCcw,
  Utensils,
  PackageCheck,
  Printer,
  FileEdit,
  Banknote,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type OrderItem = {
  name: string;
  price: number;
  qty: number;
  notes?: string;
};

type Order = {
  id: string;
  date: string;
  rawDate: string;
  createdAt: Date;
  method: string;
  total: number;
  cashier_name: string;
  customer_name: string | null;
  status: string; // 'preparing' | 'ready' | 'completed' | 'Paid'
  completedAt?: Date;
  items: OrderItem[];
};

export default function OrdersPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'kanban' | 'list'>('kanban');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editedItems, setEditedItems] = useState<OrderItem[]>([]);
  const [now, setNow] = useState(new Date());

  const prevOrderCountRef = useRef<number>(0);
  const localUpdatesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!isLoading && !role) {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  // Update timer every 15s for dynamic elapsed time calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const playNotificationSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log('Audio playback error', e);
    }
  };

  const fetchOrders = async (isInitial = false) => {
    if (isInitial) setIsLoadingData(true);
    
    // Get transactions from today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: true });

    if (txData && txData.length > 0) {
      const txIds = txData.map(t => t.id);
      
      const { data: itemsData } = await supabase
        .from('transaction_items')
        .select('*')
        .in('transaction_id', txIds);

      const formattedOrders: Order[] = txData.map(tx => {
        const items = itemsData ? itemsData.filter(i => i.transaction_id === tx.id) : [];
        const dateObj = new Date(tx.created_at);
        
        let normStatus = (tx.status || 'preparing');
        let completedAt = undefined;
        
        if (normStatus.startsWith('completed|')) {
          const parts = normStatus.split('|');
          normStatus = 'completed';
          if (parts[1]) completedAt = new Date(parts[1]);
        }
        
        normStatus = normStatus.toLowerCase();
        if (normStatus === 'paid') normStatus = 'preparing';

        return {
          id: tx.id,
          date: dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          rawDate: tx.created_at,
          createdAt: dateObj,
          method: tx.method,
          total: tx.total,
          cashier_name: tx.cashier_name,
          customer_name: tx.customer_name,
          status: normStatus,
          completedAt,
          items: items.map(item => ({
            name: item.product_name,
            price: item.price,
            qty: item.quantity,
            notes: item.notes
          }))
        };
      });

      // Sound notification if new pending order came in
      const activePreparingCount = formattedOrders.filter(o => o.status === 'preparing').length;
      if (!isInitial && activePreparingCount > prevOrderCountRef.current) {
        playNotificationSound();
      }
      prevOrderCountRef.current = activePreparingCount;

      // Guard: don't overwrite recently locally-updated orders (fixes race condition)
      setOrders(prev => {
        const now = Date.now();
        return formattedOrders.map(order => {
          const localUpdateTime = localUpdatesRef.current[order.id];
          if (localUpdateTime && now - localUpdateTime < 10000) {
            const existingOrder = prev.find(o => o.id === order.id);
            if (existingOrder) return existingOrder;
          }
          if (localUpdateTime && now - localUpdateTime >= 10000) {
            delete localUpdatesRef.current[order.id];
          }
          return order;
        });
      });
    } else {
      setOrders([]);
    }
    
    setIsLoadingData(false);
  };

  useEffect(() => {
    if (role) {
      fetchOrders(true);

      // Realtime listener for transactions
      const channelId = `orders_page_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions' },
          () => {
            fetchOrders(false);
          }
        )
        .subscribe();

      // Fallback polling every 5s
      const pollInterval = setInterval(() => {
        fetchOrders(false);
      }, 30000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    }
  }, [role]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    localUpdatesRef.current[orderId] = Date.now();
    
    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === orderId ? { 
      ...o, 
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date() : undefined 
    } : o));

    let dbStatus = newStatus;
    if (newStatus === 'completed') {
      dbStatus = `completed|${new Date().toISOString()}`;
    }

    const { error } = await supabase
      .from('transactions')
      .update({ status: dbStatus })
      .eq('id', orderId);

    if (error) {
      alert("Gagal mengupdate status: " + error.message);
      fetchOrders(false);
    } else {
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    }
    setUpdatingId(null);
  };

  const startEditOrder = () => {
    if (selectedOrder) {
      setEditedItems([...selectedOrder.items]);
      setIsEditingOrder(true);
    }
  };

  const handleDeleteOrder = () => {
    if (!selectedOrder) return;
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteOrder = async () => {
    if (!selectedOrder) return;
    setUpdatingId(selectedOrder.id);
    await supabase.from('transactions').delete().eq('id', selectedOrder.id);
    fetchOrders(false);
    setSelectedOrder(null);
    setUpdatingId(null);
    setIsDeleteDialogOpen(false);
  };

  const saveEditedOrder = async () => {
    if (!selectedOrder) return;
    setUpdatingId(selectedOrder.id);
    const finalItems = editedItems.filter(i => i.qty > 0);
    if (finalItems.length === 0) {
      alert('Pesanan harus punya minimal 1 item.');
      setUpdatingId(null);
      return;
    }
    const newTotal = finalItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
    await supabase.from('transactions').update({ total: newTotal }).eq('id', selectedOrder.id);
    await supabase.from('transaction_items').delete().eq('transaction_id', selectedOrder.id);
    await supabase.from('transaction_items').insert(
      finalItems.map(item => ({
        transaction_id: selectedOrder.id,
        product_name: item.name,
        price: item.price,
        quantity: item.qty,
        notes: item.notes || null
      }))
    );
    setSelectedOrder(prev => prev ? { ...prev, items: finalItems, total: newTotal } : null);
    setIsEditingOrder(false);
    setUpdatingId(null);
    localUpdatesRef.current[selectedOrder.id] = Date.now();
    fetchOrders(false);
  };

  const getElapsedTimeText = (order: Order) => {
    let diffMs;
    if (order.status === 'completed') {
      if (order.completedAt) {
        diffMs = order.completedAt.getTime() - order.createdAt.getTime();
      } else {
        return "Selesai"; // For old legacy orders without timestamp
      }
    } else {
      diffMs = now.getTime() - order.createdAt.getTime();
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (order.status === 'completed') {
      if (diffHours > 0) {
        return `${diffHours}j ${diffMins % 60}m`;
      }
      return `${diffMins} mnt`;
    }

    if (diffHours > 0) {
      return `${diffHours}j ${diffMins % 60}m lalu`;
    }
    return `${diffMins} mnt lalu`;
  };

  const getTimerBadgeStyle = (order: Order) => {
    if (order.status === 'completed') {
      return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
    
    const diffMins = Math.floor((now.getTime() - order.createdAt.getTime()) / 60000);
    
    if (diffMins > 30) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (diffMins > 15) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  };

  if (!role) return null;

  // Filtered lists
  const preparingOrders = orders.filter(o => o.status === 'preparing' && (o.id.includes(searchQuery) || o.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))));
  const readyOrders = orders.filter(o => o.status === 'ready' && (o.id.includes(searchQuery) || o.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))));
  const completedOrders = orders.filter(o => o.status === 'completed' && (o.id.includes(searchQuery) || o.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))));

  const filteredAllOrders = orders.filter(o => {
    const matchesSearch = o.id.includes(searchQuery) || o.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const renderOrderCard = (order: Order) => {

    return (
      <div 
        key={order.id} 
        className={`group relative rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${
          order.status === 'preparing' ? 'bg-zinc-900/60 backdrop-blur-md border border-white/10 hover:border-amber-500/50 hover:shadow-amber-500/10' :
          order.status === 'ready' ? 'bg-emerald-950/20 backdrop-blur-md border border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-emerald-500/10' :
          'bg-zinc-900/30 backdrop-blur-md border border-white/5 opacity-70 hover:opacity-100'
        }`}
      >
        {/* Glow accent */}
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${
          order.status === 'preparing' ? 'bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0 opacity-50' :
          order.status === 'ready' ? 'bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-emerald-500/0 opacity-50' : 'hidden'
        }`} />

        <div className="p-3.5 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono font-bold text-sm text-zinc-100">{order.id.startsWith('order_') ? order.id : `order_${order.id}`}</span>
                <span className={`shrink-0 whitespace-nowrap text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                  order.method === 'QRIS' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                  order.method === 'Bayar Nanti' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse' :
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {order.method}
                </span>
              </div>
              {order.customer_name && (
                <p className="text-[11px] font-medium text-zinc-300 truncate">
                  Pelanggan: <span className="text-primary font-bold">{order.customer_name}</span>
                </p>
              )}
            </div>
            <span className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md border ${getTimerBadgeStyle(order)}`}>
              <Clock size={10} className="shrink-0" />
              {getElapsedTimeText(order)}
            </span>
          </div>

          {/* Items Summary */}
          <div className="space-y-1 bg-black/20 p-2 rounded-lg border border-white/5">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-start text-[11px] leading-tight">
                <span className="text-primary font-bold mr-1.5 shrink-0">{item.qty}x</span>
                <span className="text-zinc-300 truncate">{item.name}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-white/5" />

          {/* Total + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="shrink-0">
              <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Total</p>
              <p className="text-sm font-bold text-primary leading-none mt-1">Rp {order.total.toLocaleString('id-ID')}</p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setSelectedOrder(order)}
                className="h-7 px-2.5 text-[10px] font-medium text-zinc-400 bg-zinc-900/50 hover:bg-zinc-800 hover:text-zinc-100 rounded-lg border border-white/10 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <Receipt size={12} />
                Detail
              </button>

              {order.status === 'preparing' && (
                <button
                  disabled={updatingId === order.id}
                  onClick={() => updateOrderStatus(order.id, 'ready')}
                  className="h-7 px-2.5 text-[10px] font-bold text-black bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                  {updatingId === order.id ? <RefreshCw size={12} className="animate-spin" /> : (
                    <>
                      <ChefHat size={12} />
                      Selesai Masak
                    </>
                  )}
                </button>
              )}

              {order.status === 'ready' && (
                <button
                  disabled={updatingId === order.id}
                  onClick={() => updateOrderStatus(order.id, 'completed')}
                  className="h-7 px-2.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                  {updatingId === order.id ? <RefreshCw size={12} className="animate-spin" /> : (
                    <>
                      <CheckCircle2 size={12} />
                      Pesanan Selesai
                    </>
                  )}
                </button>
              )}

              {order.status === 'completed' && (
                <button
                  disabled={updatingId === order.id}
                  onClick={() => updateOrderStatus(order.id, 'preparing')}
                  className="h-7 px-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 bg-transparent hover:bg-zinc-900 rounded-lg transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                  <RotateCcw size={10} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout title="Order List & Status Pesanan">
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full flex flex-col space-y-5">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Pesanan</h1>
            <p className="text-xs text-[#666] mt-0.5">Pantau dan kelola status pesanan hari ini</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`h-8 px-3 text-[11px] font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                soundEnabled 
                  ? 'border-primary/30 text-primary bg-primary/5 hover:bg-primary/10' 
                  : 'border-[#333] text-[#666] bg-transparent hover:text-[#999]'
              }`}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {soundEnabled ? 'Suara On' : 'Suara Off'}
            </button>

            <button
              onClick={() => fetchOrders(false)}
              className="h-8 px-3 text-[11px] font-medium text-[#888] bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-lg transition-all flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={isLoadingData ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Status Counters */}
        <div className="grid grid-cols-2 gap-4 shrink-0">
          <button 
            className={`group text-left p-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${
              statusFilter === 'preparing' 
                ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20 shadow-lg shadow-amber-500/5' 
                : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60 hover:border-white/10'
            } border backdrop-blur-md`}
            onClick={() => setStatusFilter(statusFilter === 'preparing' ? 'all' : 'preparing')}
          >
            {statusFilter === 'preparing' && <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent" />}
            <p className="relative text-xs font-bold text-zinc-400 uppercase tracking-widest group-hover:text-amber-500/70 transition-colors">Pesanan Aktif</p>
            <div className="relative flex items-center justify-between mt-2">
              <span className={`text-3xl font-black tracking-tighter ${statusFilter === 'preparing' ? 'text-amber-500' : 'text-zinc-100 group-hover:text-amber-500 transition-colors'}`}>{preparingOrders.length + readyOrders.length}</span>
              <Utensils size={24} className={statusFilter === 'preparing' ? 'text-amber-500' : 'text-zinc-600 group-hover:text-amber-500/50 transition-colors'} strokeWidth={1.5} />
            </div>
          </button>

          <button 
            className={`group text-left p-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${
              statusFilter === 'completed' 
                ? 'bg-zinc-800 border-zinc-600 ring-1 ring-zinc-500 shadow-lg' 
                : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60 hover:border-white/10'
            } border backdrop-blur-md`}
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          >
            {statusFilter === 'completed' && <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />}
            <p className="relative text-xs font-bold text-zinc-400 uppercase tracking-widest group-hover:text-zinc-300 transition-colors">Selesai</p>
            <div className="relative flex items-center justify-between mt-2">
              <span className={`text-3xl font-black tracking-tighter ${statusFilter === 'completed' ? 'text-zinc-300' : 'text-zinc-100 group-hover:text-zinc-300 transition-colors'}`}>{completedOrders.length}</span>
              <PackageCheck size={24} className={statusFilter === 'completed' ? 'text-zinc-400' : 'text-zinc-600 group-hover:text-zinc-400 transition-colors'} strokeWidth={1.5} />
            </div>
          </button>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0">
          <div className="relative flex-1 max-w-xl group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" size={18} />
            <input
              placeholder="Cari Order ID atau item..."
              className="w-full h-12 pl-12 pr-4 bg-zinc-900/50 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner hover:bg-zinc-900/80"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 bg-zinc-900/50 border border-white/5 rounded-xl p-1 shadow-inner h-12">
            <button 
              onClick={() => setActiveTab('kanban')}
              className={`px-6 h-full text-[13px] font-semibold rounded-lg transition-all duration-300 ${
                activeTab === 'kanban' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Board Mode
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`px-6 h-full text-[13px] font-semibold rounded-lg transition-all duration-300 ${
                activeTab === 'list' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              List Mode
            </button>
          </div>
        </div>

        {/* Antrian Masak Section */}
        {orders.filter(o => o.status === 'preparing').length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 shrink-0 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-primary">
              <ChefHat size={16} />
              <h3 className="font-bold text-sm">Antrian Masak (Sedang Disiapkan)</h3>
              <span className="text-xs text-primary/70 ml-2">— Klik pesanan untuk Edit (Belum Lunas) atau Selesai (Lunas)</span>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
              {orders.filter(o => o.status === 'preparing').map(order => (
                <button
                  key={`cook-${order.id}`}
                  onClick={() => {
                    if (order.method === 'Bayar Nanti') {
                      router.push(`/pos?edit=${order.id}`);
                    } else {
                      updateOrderStatus(order.id, 'completed');
                    }
                  }}
                  className={`snap-start shrink-0 bg-zinc-950 border ${order.method === 'Bayar Nanti' ? 'border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10' : 'border-primary/30 hover:border-primary hover:bg-primary/10'} cursor-pointer hover:-translate-y-0.5 rounded-xl p-3 flex flex-col min-w-[200px] max-w-[250px] text-left transition-all`}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-xs font-mono text-zinc-400">{order.id.startsWith('order_') ? order.id : `order_${order.id}`}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${order.method === 'Bayar Nanti' ? 'bg-amber-500/20 text-amber-500' : 'bg-primary/20 text-primary'}`}>
                      {order.method === 'Bayar Nanti' ? 'Belum Lunas' : 'Lunas'}
                    </span>
                  </div>
                  <span className="font-bold text-zinc-100 truncate w-full mb-1">
                    {order.customer_name || 'Tanpa Nama'}
                  </span>
                  <div className="text-xs text-zinc-400 mt-1 space-y-1">
                    {order.items.map((i, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="font-bold text-zinc-300">{i.qty}x</span>
                        <span className="line-clamp-1">{i.name}</span>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Content View */}
        {isLoadingData ? (
          <div className="py-20 text-center space-y-4">
            <RefreshCw size={28} className="animate-spin text-primary mx-auto" />
            <p className="text-sm text-zinc-500 font-medium">Sinkronisasi data pesanan...</p>
          </div>
        ) : activeTab === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            
            {/* Column 1: Pesanan Aktif (Preparing + Ready) */}
            <div className="flex flex-col bg-zinc-950/50 rounded-3xl p-5 lg:p-6 border border-white/5 shadow-2xl min-h-[500px]">
              <div className="flex items-center justify-between px-2 pb-5 mb-5 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-3 h-3">
                    <span className="absolute w-full h-full rounded-full bg-amber-500 animate-ping opacity-75" />
                    <span className="relative w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <h2 className="font-bold text-base text-zinc-200 tracking-wide">Pesanan Aktif</h2>
                </div>
                <span className="text-sm font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full">{preparingOrders.length + readyOrders.length}</span>
              </div>

              <div className="space-y-4 pb-4">
                {preparingOrders.length === 0 && readyOrders.length === 0 ? (
                  <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center text-zinc-500 text-sm font-medium">
                    Belum ada pesanan aktif
                  </div>
                ) : (
                  <>
                    {preparingOrders.map(renderOrderCard)}
                    {readyOrders.map(renderOrderCard)}
                  </>
                )}
              </div>
            </div>

            {/* Column 2: Selesai */}
            <div className="flex flex-col bg-zinc-950/50 rounded-3xl p-5 lg:p-6 border border-white/5 shadow-2xl min-h-[500px]">
              <div className="flex items-center justify-between px-2 pb-5 mb-5 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                  <h2 className="font-bold text-base text-zinc-400 tracking-wide">Selesai</h2>
                </div>
                <span className="text-xs font-bold text-zinc-400 bg-zinc-800 border border-zinc-700 px-3 py-1 rounded-full">{completedOrders.length}</span>
              </div>

              <div className="space-y-4 pb-4">
                {completedOrders.length === 0 ? (
                  <div className="border border-dashed border-white/10 rounded-2xl p-10 text-center text-zinc-500 text-sm font-medium">
                    Belum ada pesanan selesai
                  </div>
                ) : (
                  completedOrders.slice(0, 15).map(renderOrderCard)
                )}
              </div>
            </div>

          </div>
        ) : (
          /* List Mode View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-4">
            {filteredAllOrders.length === 0 ? (
              <div className="col-span-full border border-dashed border-white/10 rounded-2xl p-16 text-center text-zinc-500 text-sm font-medium">
                Tidak ada pesanan yang sesuai filter
              </div>
            ) : (
              filteredAllOrders.map(renderOrderCard)
            )}
          </div>
        )}

      </div>

      {/* Order Detail & Receipt Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => { setSelectedOrder(null); setIsEditingOrder(false); }}>
        {selectedOrder && (
          <DialogContent className="sm:max-w-[380px] p-0 bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 print:border-none print:shadow-none print:bg-white print:rounded-none print:max-w-none print:w-full">
            <div className="relative">
              {/* Top accent — hidden on print */}
              <div className={`h-[2px] w-full bg-gradient-to-r print:hidden ${
                selectedOrder.status === 'preparing' ? 'from-transparent via-amber-500 to-transparent' :
                selectedOrder.status === 'ready' ? 'from-transparent via-emerald-500 to-transparent' :
                'from-transparent via-[#444] to-transparent'
              }`} />
              
              <div className="px-6 pt-6 pb-5 print:px-0 print:pt-0 print:pb-0">
                {/* Header — hidden on print */}
                <div className="flex items-center justify-between mb-1 print:hidden">
                  <DialogHeader className="space-y-0 p-0">
                    <DialogTitle className="font-mono text-lg font-bold text-white">
                      {selectedOrder.id.startsWith('order_') ? selectedOrder.id : `order_${selectedOrder.id}`}
                    </DialogTitle>
                  </DialogHeader>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                    selectedOrder.status === 'preparing' ? 'bg-amber-500/10 text-amber-500' :
                    selectedOrder.status === 'ready' ? 'bg-emerald-500/10 text-emerald-500' :
                    'bg-[#222] text-[#888]'
                  }`}>
                    {selectedOrder.status === 'preparing' ? 'Antrean' : selectedOrder.status === 'ready' ? 'Siap' : 'Selesai'}
                  </span>
                </div>
                <DialogDescription className="text-[11px] text-[#555] mt-0.5 print:hidden">
                  {selectedOrder.cashier_name} · {selectedOrder.date} · {selectedOrder.method}
                  {selectedOrder.customer_name && ` · Pelanggan: ${selectedOrder.customer_name}`}
                </DialogDescription>

                {/* Receipt — this is what gets printed */}
                <div id="print-receipt" className="mt-5 bg-[#0a0a0a] rounded-xl border border-[#222] overflow-hidden print:mt-0 print:bg-white print:border-none print:rounded-none">
                  <div className="px-4 py-3 border-b border-dashed border-[#222] text-center print:border-black print:py-4">
                    <p className="font-bold text-sm text-white tracking-wide print:text-black print:text-lg">SAMBA CAFE</p>
                    <p className="text-[10px] text-[#555] mt-0.5 print:text-black print:text-xs print:mt-1">Order Slip {selectedOrder.id.startsWith('order_') ? selectedOrder.id : `order_${selectedOrder.id}`}</p>
                    {selectedOrder.customer_name && (
                      <p className="text-[12px] font-bold text-white mt-1 print:text-black print:text-sm">
                        Pelanggan: {selectedOrder.customer_name}
                      </p>
                    )}
                    <p className="hidden print:block text-xs text-gray-600 mt-1">
                      {selectedOrder.date} · Kasir: {selectedOrder.cashier_name} · {selectedOrder.method}
                    </p>
                  </div>

                  <div className="px-4 py-3 space-y-2 print:py-4 print:space-y-3">
                    {(isEditingOrder ? editedItems : selectedOrder.items).map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between items-center text-[12px] print:text-sm gap-2">
                          {isEditingOrder ? (
                            <>
                              <span className={`flex-1 truncate ${item.qty === 0 ? 'text-zinc-600 line-through' : 'text-[#ccc]'}`}>{item.name}</span>
                              <div className="flex items-center gap-2 shrink-0 bg-zinc-900 rounded-lg p-1 border border-white/5">
                                <button 
                                  onClick={() => setEditedItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: Math.max(0, it.qty - 1) } : it))} 
                                  className="w-7 h-7 rounded-md bg-black text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center text-sm font-bold shadow-sm"
                                >
                                  −
                                </button>
                                <span className={`w-5 text-center font-bold text-xs ${item.qty === 0 ? 'text-zinc-600' : 'text-white'}`}>{item.qty}</span>
                                <button 
                                  onClick={() => setEditedItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: it.qty + 1 } : it))} 
                                  className="w-7 h-7 rounded-md bg-black text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center text-sm font-bold shadow-sm"
                                >
                                  +
                                </button>
                              </div>
                              <span className={`w-[60px] text-right font-mono text-[11px] ${item.qty === 0 ? 'text-zinc-600' : 'text-[#666]'}`}>
                                Rp {(item.price * item.qty).toLocaleString('id-ID')}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-[#ccc] print:text-black">{item.qty}× {item.name}</span>
                              <span className="text-[#666] font-mono print:text-black">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                            </>
                          )}
                        </div>
                        {item.notes && !isEditingOrder && (
                          <p className="text-[11px] text-amber-500/80 italic pl-4 mt-0.5 print:text-gray-600 print:text-xs print:not-italic print:pl-5">
                            Catatan: {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-3 border-t border-dashed border-[#222] flex justify-between items-center print:border-black print:py-4">
                    <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wider print:text-black print:text-sm">Total</span>
                    <span className="font-bold text-primary print:text-black print:text-base">Rp {(isEditingOrder ? editedItems.filter(i => i.qty > 0).reduce((s, i) => s + i.price * i.qty, 0) : selectedOrder.total).toLocaleString('id-ID')}</span>
                  </div>

                  {/* Print-only footer */}
                  <div className="hidden print:block px-4 py-3 border-t border-dashed border-black text-center">
                    <p className="text-xs text-gray-500">Terima kasih atas kunjungan Anda!</p>
                    <p className="text-[10px] text-gray-400 mt-1">Dicetak: {new Date().toLocaleString('id-ID')}</p>
                  </div>
                </div>

                {/* Actions — hidden on print */}
                <div className="flex flex-col gap-3 mt-6 print:hidden">
                  {isEditingOrder ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditingOrder(false)}
                        className="flex-1 h-11 text-[12px] font-medium text-[#888] bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        Batal
                      </button>
                      <button
                        onClick={saveEditedOrder}
                        disabled={updatingId === selectedOrder.id}
                        className="flex-1 h-11 text-[12px] font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                      >
                        {updatingId === selectedOrder.id ? 'Menyimpan...' : '✓ Simpan Perubahan'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Secondary Actions (Row) */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.print()}
                          className="flex-1 flex items-center justify-center gap-2 h-10 text-[11px] font-semibold text-zinc-300 bg-zinc-900 border border-white/10 hover:bg-zinc-800 rounded-xl transition-all"
                        >
                          <Printer size={14} /> Cetak Struk
                        </button>

                        {selectedOrder.status === 'preparing' && (
                          <>
                            <button
                              onClick={startEditOrder}
                              className="flex-1 flex items-center justify-center gap-2 h-10 text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 rounded-xl transition-all"
                            >
                              <FileEdit size={14} /> Edit
                            </button>
                            <button
                              onClick={handleDeleteOrder}
                              disabled={updatingId === selectedOrder.id}
                              className="flex-1 flex items-center justify-center gap-2 h-10 text-[11px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl transition-all"
                            >
                              <Trash2 size={14} /> Hapus
                            </button>
                          </>
                        )}
                      </div>

                      {/* Primary Actions */}
                      <div className="flex flex-col gap-2 mt-2">
                        {selectedOrder.method === 'Bayar Nanti' && (
                          <button
                            onClick={async () => {
                              setUpdatingId(selectedOrder.id);
                              await supabase.from('transactions').update({ method: 'Cash (Lunas)' }).eq('id', selectedOrder.id);
                              localUpdatesRef.current[selectedOrder.id] = Date.now();
                              fetchOrders(false);
                              setUpdatingId(null);
                              setSelectedOrder({...selectedOrder, method: 'Cash (Lunas)'});
                            }}
                            className="w-full h-12 text-[13px] font-bold text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                          >
                            <Banknote size={16} /> Tandai Lunas
                          </button>
                        )}

                        {selectedOrder.status === 'preparing' && (
                          <button
                            onClick={() => updateOrderStatus(selectedOrder.id, 'ready')}
                            className="w-full h-12 text-[13px] font-bold text-white bg-primary hover:bg-primary/90 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                          >
                            <ChefHat size={16} /> Selesai Masak
                          </button>
                        )}

                        {selectedOrder.status === 'ready' && (
                          <button
                            onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                            className="w-full h-12 text-[13px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                          >
                            <CheckCircle2 size={16} /> Pesanan Selesai
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-md rounded-2xl z-[200]">
          <DialogHeader>
            <DialogTitle className="text-xl text-red-500 flex items-center gap-2">
              <Trash2 size={24} /> Hapus Pesanan
            </DialogTitle>
            <DialogDescription className="text-zinc-400 mt-2">
              Apakah Anda yakin ingin menghapus pesanan <span className="text-zinc-100 font-bold">{selectedOrder?.id?.startsWith('order_') ? selectedOrder.id : `order_${selectedOrder?.id}`}</span> secara permanen?
              <br/><br/>
              <span className="text-amber-500 font-medium">Perhatian:</span> Stok bahan yang sudah terpotong tidak akan dikembalikan otomatis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 mt-2 border-t border-white/5 gap-2 sm:gap-0">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl text-zinc-300" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
            <Button 
              className="bg-red-500 text-white hover:bg-red-600 rounded-xl shadow-lg shadow-red-500/20"
              onClick={confirmDeleteOrder}
              disabled={updatingId === selectedOrder?.id}
            >
              {updatingId === selectedOrder?.id ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
