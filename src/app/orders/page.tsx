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
    <Card 
      key={order.id} 
      className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg border ${
        order.status === 'preparing' ? 'border-amber-500/30 bg-card' :
        order.status === 'ready' ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10' :
        'border-border/60 bg-muted/20 opacity-85'
      }`}
    >
      {/* Accent top border */}
      <div className={`h-1.5 w-full ${
        order.status === 'preparing' ? 'bg-amber-500' :
        order.status === 'ready' ? 'bg-emerald-500' : 'bg-muted-foreground/30'
      }`} />

      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-lg text-foreground">#{order.id}</span>
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold ${getTimerBadgeStyle(order.createdAt)}`}>
              <Clock size={11} className="mr-1" />
              {getElapsedTimeText(order.createdAt)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kasir: <span className="font-medium text-foreground">{order.cashier_name}</span> • {order.date}
          </p>
        </div>
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
          order.method === 'QRIS' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'
        }`}>
          {order.method}
        </span>
      </CardHeader>

      <CardContent className="p-4 pt-2 flex flex-col justify-between space-y-4">
        {/* Item List */}
        <div className="space-y-2 bg-background/60 p-3 rounded-xl border border-border/50">
          {order.items.map((item, idx) => (
            <div key={idx} className="text-sm">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-foreground">
                  <span className="text-primary font-bold mr-1.5">{item.qty}x</span>
                  {item.name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Rp {(item.price * item.qty).toLocaleString('id-ID')}
                </span>
              </div>
              {item.notes && (
                <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md inline-block font-medium">
                  📝 {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total & Action Buttons */}
        <div className="pt-1 flex flex-col space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Total Pesanan ({order.items.reduce((s, i) => s + i.qty, 0)} item):</span>
            <span className="font-bold text-sm text-primary">Rp {order.total.toLocaleString('id-ID')}</span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setSelectedOrder(order)}
            >
              <Receipt size={14} className="mr-1" />
              Detail
            </Button>

            {order.status === 'preparing' && (
              <Button
                size="sm"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-md transition-all"
                disabled={updatingId === order.id}
                onClick={() => updateOrderStatus(order.id, 'ready')}
              >
                {updatingId === order.id ? <RefreshCw size={14} className="animate-spin" /> : (
                  <>
                    <Bell size={14} className="mr-1 animate-bounce" />
                    Tandai Siap
                  </>
                )}
              </Button>
            )}

            {order.status === 'ready' && (
              <Button
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition-all"
                disabled={updatingId === order.id}
                onClick={() => updateOrderStatus(order.id, 'completed')}
              >
                {updatingId === order.id ? <RefreshCw size={14} className="animate-spin" /> : (
                  <>
                    <CheckCircle2 size={14} className="mr-1" />
                    Diserahkan
                  </>
                )}
              </Button>
            )}

            {order.status === 'completed' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                disabled={updatingId === order.id}
                onClick={() => updateOrderStatus(order.id, 'ready')}
              >
                <RotateCcw size={13} className="mr-1" />
                Reset Status
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <MainLayout title="Order List & Status Pesanan">
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-5 rounded-2xl border border-border shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                <ChefHat size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Order List Dapur & Kasir</h1>
                <p className="text-xs text-muted-foreground">Pantau dan konfirmasi status pembuatan pesanan pelanggan secara terpusat.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`text-xs gap-1.5 ${soundEnabled ? 'border-primary/50 text-primary bg-primary/5' : 'text-muted-foreground'}`}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {soundEnabled ? 'Suara On' : 'Suara Off'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchOrders(false)}
              className="text-xs gap-1.5"
            >
              <RefreshCw size={14} className={isLoadingData ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Status Counters */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <Card 
            className={`cursor-pointer transition-all border ${statusFilter === 'preparing' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-border'}`}
            onClick={() => setStatusFilter(statusFilter === 'preparing' ? 'all' : 'preparing')}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">⏳ Sedang Dibuat</p>
                <h3 className="text-2xl font-black text-amber-500 mt-1">{preparingOrders.length}</h3>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl hidden sm:block">
                <Utensils size={20} />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all border ${statusFilter === 'ready' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-border'}`}
            onClick={() => setStatusFilter(statusFilter === 'ready' ? 'all' : 'ready')}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">🔔 Siap Disajikan</p>
                <h3 className="text-2xl font-black text-emerald-500 mt-1">{readyOrders.length}</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hidden sm:block">
                <Bell size={20} />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all border ${statusFilter === 'completed' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-border'}`}
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">✅ Selesai Hari Ini</p>
                <h3 className="text-2xl font-black text-foreground mt-1">{completedOrders.length}</h3>
              </div>
              <div className="p-3 bg-muted text-muted-foreground rounded-xl hidden sm:block">
                <PackageCheck size={20} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Cari No Order / Nama Item..."
              className="pl-9 bg-background border-border text-sm h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full sm:w-auto">
              <TabsList className="bg-muted h-9">
                <TabsTrigger value="kanban" className="text-xs px-3">Kanban Board</TabsTrigger>
                <TabsTrigger value="list" className="text-xs px-3">Daftar List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Main Content View */}
        {isLoadingData ? (
          <div className="py-20 text-center text-muted-foreground space-y-3">
            <RefreshCw size={32} className="animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium">Memuat daftar pesanan...</p>
          </div>
        ) : activeTab === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Column 1: Sedang Dibuat */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  <h2 className="font-bold text-sm text-amber-700 dark:text-amber-400">Sedang Dibuat (Antrean)</h2>
                </div>
                <Badge className="bg-amber-500 text-white font-bold">{preparingOrders.length}</Badge>
              </div>

              <div className="space-y-4">
                {preparingOrders.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-xs">
                    Tidak ada pesanan dalam antrean
                  </div>
                ) : (
                  preparingOrders.map(renderOrderCard)
                )}
              </div>
            </div>

            {/* Column 2: Siap Disajikan */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h2 className="font-bold text-sm text-emerald-700 dark:text-emerald-400">Siap Disajikan</h2>
                </div>
                <Badge className="bg-emerald-500 text-white font-bold">{readyOrders.length}</Badge>
              </div>

              <div className="space-y-4">
                {readyOrders.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-xs">
                    Belum ada pesanan yang siap
                  </div>
                ) : (
                  readyOrders.map(renderOrderCard)
                )}
              </div>
            </div>

            {/* Column 3: Selesai */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-muted border border-border px-4 py-2.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
                  <h2 className="font-bold text-sm text-muted-foreground">Diserahkan (Selesai)</h2>
                </div>
                <Badge variant="secondary" className="font-bold">{completedOrders.length}</Badge>
              </div>

              <div className="space-y-4">
                {completedOrders.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-xs">
                    Belum ada pesanan diserahkan
                  </div>
                ) : (
                  completedOrders.slice(0, 10).map(renderOrderCard)
                )}
              </div>
            </div>

          </div>
        ) : (
          /* List Mode View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAllOrders.length === 0 ? (
              <div className="col-span-full border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground text-sm">
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
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader>
              <div className="flex justify-between items-center pr-6">
                <DialogTitle className="text-xl font-bold font-mono">Order #{selectedOrder.id}</DialogTitle>
                <Badge variant="outline" className={`capitalize font-semibold ${
                  selectedOrder.status === 'preparing' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                  selectedOrder.status === 'ready' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {selectedOrder.status === 'preparing' ? '⏳ Sedang Dibuat' : selectedOrder.status === 'ready' ? '🔔 Siap Disajikan' : '✅ Selesai'}
                </Badge>
              </div>
              <DialogDescription className="text-xs">
                {selectedOrder.date} • Kasir: {selectedOrder.cashier_name}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Receipt Box */}
              <div className="bg-background p-4 rounded-xl border border-border space-y-3 font-mono text-sm">
                <div className="border-b border-dashed border-border pb-2 text-center">
                  <p className="font-bold text-base">SAMBA CAFE</p>
                  <p className="text-xs text-muted-foreground">Order Slip #{selectedOrder.id}</p>
                </div>

                <div className="space-y-2 py-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span>{item.qty}x {item.name}</span>
                        <span>Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-amber-500 font-sans italic pl-3">
                          Catatan: {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-border pt-2 flex justify-between font-bold text-sm">
                  <span>TOTAL ({selectedOrder.method})</span>
                  <span className="text-primary">Rp {selectedOrder.total.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-row justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => window.print()}
              >
                <Printer size={14} className="mr-1.5" />
                Cetak Slip
              </Button>

              {selectedOrder.status === 'preparing' && (
                <Button
                  size="sm"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs"
                  onClick={() => updateOrderStatus(selectedOrder.id, 'ready')}
                >
                  <Bell size={14} className="mr-1.5" />
                  Tandai Siap
                </Button>
              )}

              {selectedOrder.status === 'ready' && (
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                  onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                >
                  <CheckCircle2 size={14} className="mr-1.5" />
                  Diserahkan
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </MainLayout>
  );
}
