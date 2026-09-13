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
  Printer
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
  const [now, setNow] = useState(new Date());

  const prevOrderCountRef = useRef<number>(0);

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
        
        // Map status: if status is 'Paid', consider it 'preparing' by default
        let normStatus = (tx.status || 'preparing').toLowerCase();
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

      setOrders(formattedOrders);
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
      }, 5000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    }
  }, [role]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    
    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

    const { error } = await supabase
      .from('transactions')
      .update({ status: newStatus })
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

  const getElapsedTimeText = (createdAt: Date) => {
    const diffMs = now.getTime() - createdAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} mnt lalu`;
    const hours = Math.floor(diffMins / 60);
    return `${hours} jam ${diffMins % 60} mnt lalu`;
  };

  const getTimerBadgeStyle = (createdAt: Date) => {
    const diffMins = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
    if (diffMins < 5) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (diffMins < 12) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse';
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

  const renderOrderCard = (order: Order) => (
    <div 
      key={order.id} 
      className={`relative rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md ${
        order.status === 'preparing' ? 'bg-[#1a1a1a] border border-[#2a2a2a]' :
        order.status === 'ready' ? 'bg-[#0f1a14] border border-emerald-500/20' :
        'bg-[#161616] border border-[#222] opacity-80'
      }`}
    >
      {/* Thin accent top line */}
      <div className={`h-[2px] w-full ${
        order.status === 'preparing' ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500' :
        order.status === 'ready' ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500' : 'bg-[#333]'
      }`} />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-mono font-bold text-[15px] text-white">#{order.id}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getTimerBadgeStyle(order.createdAt)}`}>
              <Clock size={10} />
              {getElapsedTimeText(order.createdAt)}
            </span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
            order.method === 'QRIS' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
          }`}>
            {order.method}
          </span>
        </div>

        {/* Cashier & Customer info */}
        <div className="flex flex-col gap-0.5">
          {order.customer_name && (
            <p className="text-[13px] font-semibold text-white">
              Pelanggan: <span className="text-primary">{order.customer_name}</span>
            </p>
          )}
          <p className="text-[11px] text-[#666]">
            {order.cashier_name} · {order.date}
          </p>
        </div>

        {/* Items */}
        <div className="space-y-1.5">
          {order.items.map((item, idx) => (
            <div key={idx}>
              <div className="flex justify-between items-baseline text-[13px]">
                <span className="text-[#ccc]">
                  <span className="text-primary font-semibold mr-1">{item.qty}×</span>
                  {item.name}
                </span>
                <span className="text-[11px] text-[#555] font-mono ml-2 shrink-0">
                  {(item.price * item.qty).toLocaleString('id-ID')}
                </span>
              </div>
              {item.notes && (
                <div className="mt-1 pl-4 flex items-center gap-1.5">
                  <span className="text-xs text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md font-medium">
                    📝 {item.notes}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-[#222]" />

        {/* Total + Actions */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#555] uppercase tracking-wider">Total</p>
            <p className="text-sm font-bold text-primary">Rp {order.total.toLocaleString('id-ID')}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedOrder(order)}
              className="h-8 px-3 text-[11px] font-medium text-[#888] bg-[#222] hover:bg-[#2a2a2a] hover:text-white rounded-lg border border-[#333] transition-all flex items-center gap-1.5"
            >
              <Receipt size={12} />
              Detail
            </button>

            {order.status === 'preparing' && (
              <button
                disabled={updatingId === order.id}
                onClick={() => updateOrderStatus(order.id, 'ready')}
                className="h-8 px-3 text-[11px] font-semibold text-black bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-all flex items-center gap-1.5"
              >
                {updatingId === order.id ? <RefreshCw size={12} className="animate-spin" /> : (
                  <>
                    <Bell size={12} />
                    Siap
                  </>
                )}
              </button>
            )}

            {order.status === 'ready' && (
              <button
                disabled={updatingId === order.id}
                onClick={() => updateOrderStatus(order.id, 'completed')}
                className="h-8 px-3 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-all flex items-center gap-1.5"
              >
                {updatingId === order.id ? <RefreshCw size={12} className="animate-spin" /> : (
                  <>
                    <CheckCircle2 size={12} />
                    Serahkan
                  </>
                )}
              </button>
            )}

            {order.status === 'completed' && (
              <button
                disabled={updatingId === order.id}
                onClick={() => updateOrderStatus(order.id, 'ready')}
                className="h-8 px-3 text-[11px] font-medium text-[#666] hover:text-white bg-transparent hover:bg-[#222] rounded-lg transition-all flex items-center gap-1.5"
              >
                <RotateCcw size={11} />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <MainLayout title="Order List & Status Pesanan">
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
        <div className="grid grid-cols-3 gap-3">
          <button 
            className={`text-left p-4 rounded-xl transition-all ${
              statusFilter === 'preparing' 
                ? 'bg-amber-500/10 border border-amber-500/30 ring-1 ring-amber-500/20' 
                : 'bg-[#141414] border border-[#222] hover:border-[#333]'
            }`}
            onClick={() => setStatusFilter(statusFilter === 'preparing' ? 'all' : 'preparing')}
          >
            <p className="text-[10px] font-medium text-[#666] uppercase tracking-wider">Antrean</p>
            <div className="flex items-end justify-between mt-1">
              <span className="text-2xl font-black text-amber-500">{preparingOrders.length}</span>
              <Utensils size={16} className="text-amber-500/40" />
            </div>
          </button>

          <button 
            className={`text-left p-4 rounded-xl transition-all ${
              statusFilter === 'ready' 
                ? 'bg-emerald-500/10 border border-emerald-500/30 ring-1 ring-emerald-500/20' 
                : 'bg-[#141414] border border-[#222] hover:border-[#333]'
            }`}
            onClick={() => setStatusFilter(statusFilter === 'ready' ? 'all' : 'ready')}
          >
            <p className="text-[10px] font-medium text-[#666] uppercase tracking-wider">Siap</p>
            <div className="flex items-end justify-between mt-1">
              <span className="text-2xl font-black text-emerald-500">{readyOrders.length}</span>
              <Bell size={16} className="text-emerald-500/40" />
            </div>
          </button>

          <button 
            className={`text-left p-4 rounded-xl transition-all ${
              statusFilter === 'completed' 
                ? 'bg-[#222] border border-[#444] ring-1 ring-[#333]' 
                : 'bg-[#141414] border border-[#222] hover:border-[#333]'
            }`}
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          >
            <p className="text-[10px] font-medium text-[#666] uppercase tracking-wider">Selesai</p>
            <div className="flex items-end justify-between mt-1">
              <span className="text-2xl font-black text-[#999]">{completedOrders.length}</span>
              <PackageCheck size={16} className="text-[#444]" />
            </div>
          </button>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" size={15} />
            <input
              placeholder="Cari order atau item..."
              className="w-full h-9 pl-9 pr-4 bg-[#141414] border border-[#222] rounded-lg text-sm text-white placeholder:text-[#444] outline-none focus:border-[#444] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 bg-[#141414] border border-[#222] rounded-lg p-0.5">
            <button 
              onClick={() => setActiveTab('kanban')}
              className={`px-3 h-8 text-[11px] font-medium rounded-md transition-all ${
                activeTab === 'kanban' ? 'bg-[#222] text-white' : 'text-[#666] hover:text-[#999]'
              }`}
            >
              Board
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`px-3 h-8 text-[11px] font-medium rounded-md transition-all ${
                activeTab === 'list' ? 'bg-[#222] text-white' : 'text-[#666] hover:text-[#999]'
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Main Content View */}
        {isLoadingData ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw size={24} className="animate-spin text-[#555] mx-auto" />
            <p className="text-xs text-[#555]">Memuat pesanan...</p>
          </div>
        ) : activeTab === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Column 1: Sedang Dibuat */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-amber-500/20">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="font-semibold text-xs text-[#999] uppercase tracking-wider">Antrean</h2>
                </div>
                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">{preparingOrders.length}</span>
              </div>

              <div className="space-y-3">
                {preparingOrders.length === 0 ? (
                  <div className="border border-dashed border-[#222] rounded-xl p-8 text-center text-[#444] text-xs">
                    Tidak ada antrean
                  </div>
                ) : (
                  preparingOrders.map(renderOrderCard)
                )}
              </div>
            </div>

            {/* Column 2: Siap Disajikan */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h2 className="font-semibold text-xs text-[#999] uppercase tracking-wider">Siap</h2>
                </div>
                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">{readyOrders.length}</span>
              </div>

              <div className="space-y-3">
                {readyOrders.length === 0 ? (
                  <div className="border border-dashed border-[#222] rounded-xl p-8 text-center text-[#444] text-xs">
                    Belum ada pesanan siap
                  </div>
                ) : (
                  readyOrders.map(renderOrderCard)
                )}
              </div>
            </div>

            {/* Column 3: Selesai */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-[#222]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#555]" />
                  <h2 className="font-semibold text-xs text-[#999] uppercase tracking-wider">Selesai</h2>
                </div>
                <span className="text-[10px] font-bold text-[#666] bg-[#1a1a1a] px-2 py-0.5 rounded-full">{completedOrders.length}</span>
              </div>

              <div className="space-y-3">
                {completedOrders.length === 0 ? (
                  <div className="border border-dashed border-[#222] rounded-xl p-8 text-center text-[#444] text-xs">
                    Belum ada pesanan selesai
                  </div>
                ) : (
                  completedOrders.slice(0, 10).map(renderOrderCard)
                )}
              </div>
            </div>

          </div>
        ) : (
          /* List Mode View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredAllOrders.length === 0 ? (
              <div className="col-span-full border border-dashed border-[#222] rounded-xl p-12 text-center text-[#444] text-sm">
                Tidak ada pesanan yang sesuai filter
              </div>
            ) : (
              filteredAllOrders.map(renderOrderCard)
            )}
          </div>
        )}

      </div>

      {/* Order Detail & Receipt Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
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
                      #{selectedOrder.id}
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
                    <p className="text-[10px] text-[#555] mt-0.5 print:text-black print:text-xs print:mt-1">Order Slip #{selectedOrder.id}</p>
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
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-[12px] print:text-sm">
                          <span className="text-[#ccc] print:text-black">{item.qty}× {item.name}</span>
                          <span className="text-[#666] font-mono print:text-black">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                        </div>
                        {item.notes && (
                          <p className="text-[11px] text-amber-500/80 italic pl-4 mt-0.5 print:text-gray-600 print:text-xs print:not-italic print:pl-5">
                            Catatan: {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-3 border-t border-dashed border-[#222] flex justify-between items-center print:border-black print:py-4">
                    <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wider print:text-black print:text-sm">Total</span>
                    <span className="font-bold text-primary print:text-black print:text-base">Rp {selectedOrder.total.toLocaleString('id-ID')}</span>
                  </div>

                  {/* Print-only footer */}
                  <div className="hidden print:block px-4 py-3 border-t border-dashed border-black text-center">
                    <p className="text-xs text-gray-500">Terima kasih atas kunjungan Anda!</p>
                    <p className="text-[10px] text-gray-400 mt-1">Dicetak: {new Date().toLocaleString('id-ID')}</p>
                  </div>
                </div>

                {/* Actions — hidden on print */}
                <div className="flex gap-2 mt-5 print:hidden">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 h-9 text-[11px] font-medium text-[#888] bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <Printer size={13} />
                    Cetak
                  </button>

                  {selectedOrder.status === 'preparing' && (
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.id, 'ready')}
                      className="flex-1 h-9 text-[11px] font-semibold text-black bg-amber-500 hover:bg-amber-400 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <Bell size={13} />
                      Tandai Siap
                    </button>
                  )}

                  {selectedOrder.status === 'ready' && (
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                      className="flex-1 h-9 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={13} />
                      Serahkan
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </MainLayout>
  );
}
