'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DollarSign, Package, TrendingUp, Users, TrendingDown, Loader2, CreditCard, Banknote, AlertTriangle, Clock, ArrowUpRight, ArrowDownRight, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const { role, userName, isLoading } = useAuth();
  const router = useRouter();

  const [isFetching, setIsFetching] = useState(true);
  
  // Stats
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueYesterday, setRevenueYesterday] = useState(0);
  const [revenuePercent, setRevenuePercent] = useState(0);
  
  const [txToday, setTxToday] = useState(0);
  const [txDiff, setTxDiff] = useState(0);
  
  const [qrisToday, setQrisToday] = useState(0);
  const [cashToday, setCashToday] = useState(0);
  
  const [allTimeRevenue, setAllTimeRevenue] = useState(0);
  const [allTimeOrders, setAllTimeOrders] = useState(0);
  const [allTimeQris, setAllTimeQris] = useState(0);
  const [allTimeCash, setAllTimeCash] = useState(0);
  const [allTimeItems, setAllTimeItems] = useState<{name: string; count: number; revenue: number}[]>([]);
  
  const [topItems, setTopItems] = useState<{name: string; count: number; revenue: number}[]>([]);
  const [activeCashiers, setActiveCashiers] = useState(0);
  const [activeShifts, setActiveShifts] = useState<{name: string; since: string}[]>([]);
  
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [lowStocks, setLowStocks] = useState<any[]>([]);
  
  // Time
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!role) {
        router.replace('/login');
      } else if (role !== 'manager') {
        router.replace('/pos');
      } else {
        fetchDashboardData();
      }
    }
  }, [role, isLoading, router]);

  const fetchDashboardData = async () => {
    setIsFetching(true);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString();
    const tomorrowStr = tomorrow.toISOString();
    const yesterdayStr = yesterday.toISOString();

    // Fetch Transactions (Today & Yesterday)
    const { data: allTxData } = await supabase
      .from('transactions')
      .select('id, total, created_at, cashier_name, method')
      .gte('created_at', yesterdayStr)
      .lt('created_at', tomorrowStr)
      .order('created_at', { ascending: false });

    const txList = allTxData || [];
    const txTodayList = txList.filter(tx => new Date(tx.created_at) >= today);
    const txYesterdayList = txList.filter(tx => new Date(tx.created_at) < today);

    // Revenue
    const revToday = txTodayList.reduce((sum, tx) => sum + tx.total, 0);
    const revYesterday = txYesterdayList.reduce((sum, tx) => sum + tx.total, 0);
    setRevenueToday(revToday);
    setRevenueYesterday(revYesterday);
    
    // All-time Metrics
    const { data: allTimeTx } = await supabase.from('transactions').select('id, total, method');
    if (allTimeTx) {
      setAllTimeOrders(allTimeTx.length);
      setAllTimeRevenue(allTimeTx.reduce((sum, tx) => sum + tx.total, 0));
      setAllTimeQris(allTimeTx.filter(tx => tx.method === 'QRIS').reduce((sum, tx) => sum + tx.total, 0));
      setAllTimeCash(allTimeTx.filter(tx => tx.method === 'Cash').reduce((sum, tx) => sum + tx.total, 0));
      
      const { data: allTimeItemsData } = await supabase.from('transaction_items').select('product_name, quantity, price');
      if (allTimeItemsData) {
        const itemMap: Record<string, {count: number; revenue: number}> = {};
        allTimeItemsData.forEach(item => {
          if (!itemMap[item.product_name]) itemMap[item.product_name] = { count: 0, revenue: 0 };
          itemMap[item.product_name].count += item.quantity;
          itemMap[item.product_name].revenue += item.quantity * item.price;
        });
        
        const sorted = Object.entries(itemMap)
          .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
          .sort((a, b) => b.count - a.count);
        
        setAllTimeItems(sorted);
      }
    }
    
    let revPct = 0;
    if (revYesterday === 0) {
      revPct = revToday > 0 ? 100 : 0;
    } else {
      revPct = ((revToday - revYesterday) / revYesterday) * 100;
    }
    setRevenuePercent(revPct);

    // Transactions Count
    setTxToday(txTodayList.length);
    setTxDiff(txTodayList.length - txYesterdayList.length);

    // QRIS vs Cash
    const qris = txTodayList.filter(tx => tx.method === 'QRIS').reduce((s, tx) => s + tx.total, 0);
    const cash = txTodayList.filter(tx => tx.method === 'Cash').reduce((s, tx) => s + tx.total, 0);
    setQrisToday(qris);
    setCashToday(cash);

    // Active Cashiers
    const cashiers = new Set(txTodayList.map(tx => tx.cashier_name));
    setActiveCashiers(cashiers.size);

    // Recent Transactions
    setRecentTransactions(txTodayList.slice(0, 6));

    // Top Items Today
    if (txTodayList.length > 0) {
      const todayTxIds = txTodayList.map(tx => tx.id);
      const { data: itemsData } = await supabase
        .from('transaction_items')
        .select('product_name, quantity, price')
        .in('transaction_id', todayTxIds);
        
      if (itemsData && itemsData.length > 0) {
        const itemMap: Record<string, {count: number; revenue: number}> = {};
        itemsData.forEach(item => {
          if (!itemMap[item.product_name]) itemMap[item.product_name] = { count: 0, revenue: 0 };
          itemMap[item.product_name].count += item.quantity;
          itemMap[item.product_name].revenue += item.quantity * item.price;
        });
        
        const sorted = Object.entries(itemMap)
          .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        
        setTopItems(sorted);
      }
    }

    // Active Shifts
    const { data: shiftData } = await supabase
      .from('shifts')
      .select('cashier_name, start_time')
      .eq('status', 'active');
    
    if (shiftData) {
      setActiveShifts(shiftData.map(s => ({
        name: s.cashier_name,
        since: new Date(s.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      })));
    }

    // Low Stock Alerts
    const { data: stockData } = await supabase
      .from('stocks')
      .select('name, quantity, unit, min_stock_alert');
      
    if (stockData) {
      const low = stockData.filter(s => s.quantity <= s.min_stock_alert);
      setLowStocks(low);
    }

    setIsFetching(false);
  };

  if (role !== 'manager') return null;

  const greeting = currentTime.getHours() < 12 ? 'Selamat Pagi' : currentTime.getHours() < 17 ? 'Selamat Siang' : 'Selamat Malam';
  const dateString = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <MainLayout title="Dashboard">
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 shrink-0">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">{greeting}, {userName || 'Manager'} 👋</h1>
            <p className="text-muted-foreground text-sm lg:text-base mt-1">{dateString}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground bg-card border border-border px-4 py-2 rounded-xl">
            <Clock size={16} />
            <span className="font-medium">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {isFetching ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-50" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Row 1: Revenue Hero Card + Payment Breakdown */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Revenue Hero */}
              <Card className="lg:col-span-2 bg-gradient-to-br from-primary/15 via-primary/5 to-card border-primary/20 relative overflow-hidden">
                <CardContent className="p-6 lg:p-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Pendapatan Hari Ini</p>
                      <p className="text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
                        Rp {revenueToday.toLocaleString('id-ID')}
                      </p>
                      <div className="flex items-center gap-3 mt-4">
                        <span className={`inline-flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${
                          revenuePercent >= 0 
                            ? 'bg-green-500/15 text-green-500 border border-green-500/20' 
                            : 'bg-destructive/15 text-destructive border border-destructive/20'
                        }`}>
                          {revenuePercent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {revenuePercent > 0 ? '+' : ''}{revenuePercent.toFixed(1)}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                          vs kemarin (Rp {revenueYesterday.toLocaleString('id-ID')})
                        </span>
                      </div>
                    </div>
                    <div className="bg-primary/20 p-3 rounded-2xl">
                      <DollarSign size={28} className="text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method Breakdown */}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/15 rounded-xl flex items-center justify-center shrink-0">
                      <CreditCard size={22} className="text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">QRIS</p>
                      <p className="text-lg font-bold truncate">Rp {qrisToday.toLocaleString('id-ID')}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500/15 rounded-xl flex items-center justify-center shrink-0">
                      <Banknote size={22} className="text-green-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">Cash</p>
                      <p className="text-lg font-bold truncate">Rp {cashToday.toLocaleString('id-ID')}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Row 1.5: All Time Stats */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-4">
              <Dialog>
                <DialogTrigger className="text-left w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Card className="bg-card border-border border-l-4 border-l-primary cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Total Pendapatan (Keseluruhan)</p>
                        <p className="text-2xl font-bold">Rp {allTimeRevenue.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="w-12 h-12 bg-primary/15 rounded-xl flex items-center justify-center shrink-0">
                        <DollarSign size={24} className="text-primary" />
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="bg-card border-border sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Detail Total Pendapatan</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-background">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center">
                          <CreditCard size={20} className="text-blue-500" />
                        </div>
                        <span className="font-semibold">QRIS</span>
                      </div>
                      <span className="text-lg font-bold">Rp {allTimeQris.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-background">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/15 rounded-lg flex items-center justify-center">
                          <Banknote size={20} className="text-green-500" />
                        </div>
                        <span className="font-semibold">Cash</span>
                      </div>
                      <span className="text-lg font-bold">Rp {allTimeCash.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 pt-2">
                      <span className="text-muted-foreground font-medium">Total Keseluruhan</span>
                      <span className="text-xl font-bold text-primary">Rp {allTimeRevenue.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger className="text-left w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Card className="bg-card border-border border-l-4 border-l-blue-500 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Total Orderan (Keseluruhan)</p>
                        <p className="text-2xl font-bold">{allTimeOrders}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/15 rounded-xl flex items-center justify-center shrink-0">
                        <ShoppingBag size={24} className="text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="bg-card border-border sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Detail Total Menu Dipesan</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
                      {allTimeItems.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">Belum ada data pesanan</p>
                      ) : (
                        allTimeItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 border border-border rounded-lg bg-background">
                            <span className="font-medium text-sm">{item.name}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">{item.count} porsi</span>
                              <span className="text-sm text-muted-foreground w-24 text-right">Rp {item.revenue.toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Row 2: Quick Stats */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center">
                      <ShoppingBag size={18} className="text-primary" />
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      txDiff >= 0 ? 'bg-green-500/15 text-green-500' : 'bg-destructive/15 text-destructive'
                    }`}>
                      {txDiff >= 0 ? '+' : ''}{txDiff}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{txToday}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pesanan Hari Ini</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center">
                      <Users size={18} className="text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{activeCashiers}</p>
                  <p className="text-xs text-muted-foreground mt-1">Kasir Aktif</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center">
                      <TrendingUp size={18} className="text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold truncate" title={topItems[0]?.name || '-'}>{topItems[0]?.name || '-'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Best Seller ({topItems[0]?.count || 0} terjual)</p>
                </CardContent>
              </Card>

              <Card className={`border-border ${lowStocks.length > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-card'}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lowStocks.length > 0 ? 'bg-destructive/15' : 'bg-primary/15'}`}>
                      <AlertTriangle size={18} className={lowStocks.length > 0 ? 'text-destructive' : 'text-primary'} />
                    </div>
                    {lowStocks.length > 0 && (
                      <span className="text-[10px] font-bold bg-destructive/20 text-destructive px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Alert</span>
                    )}
                  </div>
                  <p className="text-2xl font-bold">{lowStocks.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Stok Menipis</p>
                </CardContent>
              </Card>
            </div>

            {/* Row 3: Top Items + Active Shifts + Low Stock */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Top Items */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <TrendingUp size={16} className="text-primary" /> Menu Terlaris Hari Ini
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {topItems.length > 0 ? topItems.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                            idx === 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-sm font-bold">{item.count}x</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Belum ada penjualan hari ini</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Active Shifts */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Clock size={16} className="text-primary" /> Shift Aktif Sekarang
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {activeShifts.length > 0 ? activeShifts.map((shift, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/15 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-sm font-medium">{shift.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Masuk {shift.since}</span>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Tidak ada shift aktif</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Low Stock */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <AlertTriangle size={16} className={lowStocks.length > 0 ? 'text-destructive' : 'text-primary'} /> Peringatan Stok
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {lowStocks.length > 0 ? lowStocks.map((stock, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/15 rounded-xl">
                        <span className="text-sm font-medium">{stock.name}</span>
                        <span className="text-xs font-bold bg-destructive/20 text-destructive px-2 py-1 rounded-lg">
                          {stock.quantity} {stock.unit}
                        </span>
                      </div>
                    )) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-green-500 font-medium">✓ Semua stok aman</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 4: Recent Transactions */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Package size={16} className="text-primary" /> Transaksi Terakhir Hari Ini
                  </CardTitle>
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{txToday} total</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {recentTransactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left font-medium text-muted-foreground py-3 pr-4">Order ID</th>
                          <th className="text-left font-medium text-muted-foreground py-3 pr-4">Kasir</th>
                          <th className="text-left font-medium text-muted-foreground py-3 pr-4">Waktu</th>
                          <th className="text-left font-medium text-muted-foreground py-3 pr-4">Metode</th>
                          <th className="text-right font-medium text-muted-foreground py-3">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {recentTransactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 pr-4 font-medium">#{tx.id}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{tx.cashier_name}</td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {new Date(tx.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                tx.method === 'QRIS' ? 'bg-blue-500/15 text-blue-500' : 'bg-green-500/15 text-green-500'
                              }`}>
                                {tx.method}
                              </span>
                            </td>
                            <td className="py-3 text-right font-bold">Rp {tx.total.toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Belum ada transaksi hari ini</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
