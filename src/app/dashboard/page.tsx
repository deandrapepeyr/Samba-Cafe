'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Package, TrendingUp, Users, TrendingDown, Loader2, CreditCard, Banknote, AlertTriangle, Clock, ArrowUpRight, ArrowDownRight, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const { role, userName, isLoading } = useAuth();
  const router = useRouter();

  const [isFetching, setIsFetching] = useState(true);
  const [activeSection, setActiveSection] = useState('hari-ini');

  useEffect(() => {
    if (isFetching) return;

    // Scroll reveal observer
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
          } else {
            entry.target.classList.remove('opacity-100', 'translate-y-0');
            entry.target.classList.add('opacity-0', 'translate-y-10');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    // Scroll spy observer for active nav
    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.4 }
    );

    setTimeout(() => {
      document.querySelectorAll('.reveal-on-scroll').forEach((el) => revealObserver.observe(el));
      document.querySelectorAll('.dashboard-section').forEach((el) => spyObserver.observe(el));
    }, 100);

    return () => {
      revealObserver.disconnect();
      spyObserver.disconnect();
    };
  }, [isFetching]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };
  
  // Stats
  const [revenueToday, setRevenueToday] = useState(0);
  const [revenueYesterday, setRevenueYesterday] = useState(0);
  const [revenuePercent, setRevenuePercent] = useState(0);
  
  const [netProfitToday, setNetProfitToday] = useState(0);
  const [titipanPayoutToday, setTitipanPayoutToday] = useState(0);
  
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
        router.replace('/pos');
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

    // Top Items Today & Profit Calculation
    if (txTodayList.length > 0) {
      const todayTxIds = txTodayList.map(tx => tx.id);
      const { data: itemsData } = await supabase
        .from('transaction_items')
        .select('product_name, quantity, price, supplier_price')
        .in('transaction_id', todayTxIds);
        
      if (itemsData && itemsData.length > 0) {
        let totalSupplierCost = 0;
        
        const itemMap: Record<string, {count: number; revenue: number}> = {};
        itemsData.forEach(item => {
          if (!itemMap[item.product_name]) itemMap[item.product_name] = { count: 0, revenue: 0 };
          itemMap[item.product_name].count += item.quantity;
          itemMap[item.product_name].revenue += item.quantity * item.price;
          
          totalSupplierCost += (item.supplier_price || 0) * item.quantity;
        });
        
        setNetProfitToday(revToday - totalSupplierCost);
        setTitipanPayoutToday(totalSupplierCost);
        
        const sorted = Object.entries(itemMap)
          .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        
        setTopItems(sorted);
      } else {
        setNetProfitToday(revToday);
        setTitipanPayoutToday(0);
      }
    } else {
      setNetProfitToday(0);
      setTitipanPayoutToday(0);
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

  const dateString = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <MainLayout title="Dashboard">
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-8 overflow-y-auto bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 shrink-0">
          <div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white">Laporan Dasbor</h1>
            <p className="text-zinc-400 text-sm lg:text-base mt-2 font-medium">{dateString}</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-sm text-zinc-300 bg-zinc-900/50 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-2xl shadow-inner">
            <Clock size={18} className="text-primary" />
            <span className="font-bold font-mono text-base">{currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {isFetching ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="relative w-full">
            {/* Sticky Nav */}
            <div className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-b border-white/10 pb-4 pt-4 mb-8">
              <div className="flex bg-zinc-900/50 border border-white/5 p-1.5 rounded-2xl w-full max-w-md mx-auto lg:mx-0 shadow-lg">
                <button onClick={() => scrollToSection('hari-ini')} className={`flex-1 rounded-xl font-bold text-xs lg:text-sm h-9 transition-colors ${activeSection === 'hari-ini' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white'}`}>Hari Ini</button>
                <button onClick={() => scrollToSection('insight')} className={`flex-1 rounded-xl font-bold text-xs lg:text-sm h-9 transition-colors ${activeSection === 'insight' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white'}`}>Insight</button>
                <button onClick={() => scrollToSection('keseluruhan')} className={`flex-1 rounded-xl font-bold text-xs lg:text-sm h-9 transition-colors ${activeSection === 'keseluruhan' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white'}`}>Total</button>
              </div>
            </div>
            
            <div className="space-y-16 pb-32">
            
            <section id="hari-ini" className="dashboard-section space-y-6 pt-24 -mt-24">
              {/* Row 1: Revenue Hero Card + Payment Breakdown */}
            <div className="reveal-on-scroll opacity-0 translate-y-10 transition-all duration-700 ease-out grid gap-6 lg:grid-cols-3">
              {/* Revenue Hero */}
              <div className="lg:col-span-2 bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-3xl relative overflow-hidden group hover:border-primary/30 transition-all duration-500 shadow-2xl">
                {/* Glow Effect */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="p-8 lg:p-10 relative z-10 flex flex-col justify-between h-full">
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex items-start justify-between mb-8">
                      <div>
                        <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3">Pendapatan Kotor Hari Ini</p>
                        <p className="text-5xl lg:text-6xl font-black text-white tracking-tighter drop-shadow-md">
                          <span className="text-3xl text-zinc-500 mr-2">Rp</span>
                          {revenueToday.toLocaleString('id-ID')}
                        </p>
                        <div className="flex items-center gap-4 mt-6">
                          <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-full shadow-inner ${
                            revenuePercent >= 0 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {revenuePercent >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                            {revenuePercent > 0 ? '+' : ''}{revenuePercent.toFixed(1)}%
                          </span>
                          <span className="text-sm font-medium text-zinc-500">
                            vs kemarin (Rp {revenueYesterday.toLocaleString('id-ID')})
                          </span>
                        </div>
                      </div>
                      <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                        <DollarSign size={36} className="text-primary" />
                      </div>
                    </div>
                    
                    {/* Net Profit & Titipan Breakdown */}
                    <div className="grid grid-cols-2 gap-4 mt-auto pt-6 border-t border-white/10">
                      <div>
                        <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp size={14}/> Laba Bersih</p>
                        <p className="text-2xl font-bold text-white truncate">Rp {netProfitToday.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="pl-4 border-l border-white/10">
                        <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Users size={14}/> Uang Setoran (Titipan)</p>
                        <p className="text-2xl font-bold text-white truncate">Rp {titipanPayoutToday.toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Breakdown */}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
                <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 flex items-center gap-5 hover:bg-zinc-900/60 transition-colors shadow-lg">
                  <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                    <CreditCard size={26} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">QRIS</p>
                    <p className="text-2xl font-bold text-white truncate">Rp {qrisToday.toLocaleString('id-ID')}</p>
                  </div>
                </div>
                
                <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 flex items-center gap-5 hover:bg-zinc-900/60 transition-colors shadow-lg">
                  <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                    <Banknote size={26} className="text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Cash</p>
                    <p className="text-2xl font-bold text-white truncate">Rp {cashToday.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Operational Stats (Quick Stats) - Dipindahkan ke atas agar lebih relevan dengan Hari Ini */}
            <div className="reveal-on-scroll opacity-0 translate-y-10 transition-all duration-700 ease-out grid gap-4 md:gap-6 grid-cols-2 xl:grid-cols-4 delay-100">
              <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-3xl p-5 md:p-6 transition-all hover:bg-zinc-900/60 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center">
                    <ShoppingBag size={18} className="text-primary" />
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                    txDiff >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {txDiff >= 0 ? '+' : ''}{txDiff}
                  </span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-white mb-1">{txToday}</p>
                <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">Pesanan Hari Ini</p>
              </div>

              <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-3xl p-5 md:p-6 transition-all hover:bg-zinc-900/60 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center">
                    <Users size={18} className="text-purple-400" />
                  </div>
                </div>
                <p className="text-2xl md:text-3xl font-black text-white mb-1">{activeCashiers}</p>
                <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">Kasir Aktif</p>
              </div>

              <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-3xl p-5 md:p-6 transition-all hover:bg-zinc-900/60 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                    <TrendingUp size={18} className="text-amber-400" />
                  </div>
                </div>
                <p className="text-xl md:text-2xl font-black text-white truncate mb-1" title={topItems[0]?.name || '-'}>{topItems[0]?.name || '-'}</p>
                <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">Best Seller ({topItems[0]?.count || 0} terjual)</p>
              </div>

              <div className={`backdrop-blur-sm border rounded-3xl p-5 md:p-6 transition-all shadow-lg ${lowStocks.length > 0 ? 'bg-rose-950/20 border-rose-500/30' : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center border ${lowStocks.length > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-zinc-800/50 border-white/10'}`}>
                    <AlertTriangle size={18} className={lowStocks.length > 0 ? 'text-rose-400' : 'text-zinc-400'} />
                  </div>
                  {lowStocks.length > 0 && (
                    <span className="text-[10px] font-bold bg-rose-500/20 border border-rose-500/30 text-rose-400 px-3 py-1 rounded-lg uppercase tracking-wider animate-pulse">Alert</span>
                  )}
                </div>
                <p className="text-2xl md:text-3xl font-black text-white mb-1">{lowStocks.length}</p>
                <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">Stok Menipis</p>
              </div>
            </div>



              {/* Row 4: Recent Transactions */}
              <div className="reveal-on-scroll opacity-0 translate-y-10 transition-all duration-700 ease-out bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 shadow-lg delay-200">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package size={16} className="text-primary" />
                    </div>
                    <h3 className="font-bold text-white">Transaksi Terakhir Hari Ini</h3>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 bg-zinc-800 border border-zinc-700 px-3 py-1 rounded-lg shadow-inner">{txToday} total</span>
                </div>
                <div className="pt-0">
                  {recentTransactions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/5">
                            <th className="text-left text-xs font-bold text-zinc-500 uppercase tracking-widest py-4 pr-4">Order ID</th>
                            <th className="text-left text-xs font-bold text-zinc-500 uppercase tracking-widest py-4 pr-4">Kasir</th>
                            <th className="text-left text-xs font-bold text-zinc-500 uppercase tracking-widest py-4 pr-4">Waktu</th>
                            <th className="text-left text-xs font-bold text-zinc-500 uppercase tracking-widest py-4 pr-4">Metode</th>
                            <th className="text-right text-xs font-bold text-zinc-500 uppercase tracking-widest py-4">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {recentTransactions.map(tx => (
                            <tr key={tx.id} className="hover:bg-zinc-800/30 transition-colors group">
                              <td className="py-4 pr-4 font-mono font-bold text-white">#{tx.id}</td>
                              <td className="py-4 pr-4 font-medium text-zinc-400 group-hover:text-zinc-300">{tx.cashier_name}</td>
                              <td className="py-4 pr-4 font-medium text-zinc-500">
                                {new Date(tx.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                              </td>
                              <td className="py-4 pr-4">
                                <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                  tx.method === 'QRIS' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                  {tx.method}
                                </span>
                              </td>
                              <td className="py-4 text-right font-black text-white">Rp {tx.total.toLocaleString('id-ID')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 font-medium text-center py-10">Belum ada transaksi hari ini</p>
                  )}
                </div>
              </div>
            </section>

            {/* Insight & Stok */}
            <section id="insight" className="dashboard-section space-y-6 pt-24 -mt-24">
              <div className="reveal-on-scroll opacity-0 translate-y-10 transition-all duration-700 ease-out grid gap-6 lg:grid-cols-3">
              {/* Top Items */}
              <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <TrendingUp size={16} className="text-amber-500" />
                  </div>
                  <h3 className="font-bold text-white">Menu Terlaris Hari Ini</h3>
                </div>
                <div className="space-y-4">
                  {topItems.length > 0 ? topItems.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                          idx === 0 ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-zinc-800/50 text-zinc-400 border border-white/5'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm font-bold text-zinc-200 truncate">{item.name}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-sm font-black text-white">{item.count}x</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-zinc-500 font-medium text-center py-4">Belum ada penjualan hari ini</p>
                  )}
                </div>
              </div>

              {/* Active Shifts */}
              <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Clock size={16} className="text-blue-500" />
                  </div>
                  <h3 className="font-bold text-white">Shift Aktif Sekarang</h3>
                </div>
                <div className="space-y-3">
                  {activeShifts.length > 0 ? activeShifts.map((shift, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-zinc-900/50 border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center w-2 h-2">
                          <span className="absolute w-full h-full rounded-full bg-emerald-500 animate-ping opacity-75" />
                          <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                        <span className="text-sm font-bold text-white">{shift.name}</span>
                      </div>
                      <span className="text-xs font-medium text-zinc-500">Masuk {shift.since}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-zinc-500 font-medium text-center py-4">Tidak ada shift aktif</p>
                  )}
                </div>
              </div>

              {/* Low Stock */}
              <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-3xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <AlertTriangle size={16} className="text-rose-500" />
                  </div>
                  <h3 className="font-bold text-white">Peringatan Stok</h3>
                </div>
                <div className="space-y-3">
                  {lowStocks.length > 0 ? lowStocks.map((stock, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-rose-950/20 border border-rose-500/20 rounded-2xl">
                      <span className="text-sm font-bold text-white">{stock.name}</span>
                      <span className="text-xs font-black bg-rose-500 text-white px-2.5 py-1 rounded-md shadow-lg shadow-rose-500/20">
                        {stock.quantity} {stock.unit}
                      </span>
                    </div>
                  )) : (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 size={24} className="text-emerald-500" />
                      </div>
                      <p className="text-sm text-emerald-500 font-bold">Semua stok aman</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Data Keseluruhan */}
            <section id="keseluruhan" className="dashboard-section space-y-6 pt-24 -mt-24">
              <div className="reveal-on-scroll opacity-0 translate-y-10 transition-all duration-700 ease-out grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
                <Dialog>
                  <DialogTrigger className="text-left w-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/5 hover:border-primary/30 rounded-3xl p-5 md:p-6 flex items-center justify-between transition-all duration-300 hover:shadow-[0_0_30px_rgba(234,179,8,0.1)] group">
                      <div>
                        <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 md:mb-2 group-hover:text-primary/70 transition-colors">Total Pendapatan (Keseluruhan)</p>
                        <p className="text-2xl md:text-3xl font-black text-white">Rp {allTimeRevenue.toLocaleString('id-ID')}</p>
                      </div>
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                        <DollarSign size={24} className="text-zinc-400 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-md rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold">Detail Total Pendapatan</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                      <div className="flex items-center justify-between p-5 border border-white/5 rounded-2xl bg-zinc-900/50">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <CreditCard size={24} className="text-blue-500" />
                          </div>
                          <span className="font-bold text-lg">QRIS</span>
                        </div>
                        <span className="text-xl font-bold text-white">Rp {allTimeQris.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between p-5 border border-white/5 rounded-2xl bg-zinc-900/50">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                            <Banknote size={24} className="text-emerald-500" />
                          </div>
                          <span className="font-bold text-lg">Cash</span>
                        </div>
                        <span className="text-xl font-bold text-white">Rp {allTimeCash.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex items-center justify-between px-5 pt-4 border-t border-white/10 mt-4">
                        <span className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Total Keseluruhan</span>
                        <span className="text-2xl font-black text-primary">Rp {allTimeRevenue.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger className="text-left w-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/5 hover:border-blue-500/30 rounded-3xl p-5 md:p-6 flex items-center justify-between transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)] group">
                      <div>
                        <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1 md:mb-2 group-hover:text-blue-500/70 transition-colors">Total Orderan (Keseluruhan)</p>
                        <p className="text-2xl md:text-3xl font-black text-white">{allTimeOrders}</p>
                      </div>
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-colors">
                        <ShoppingBag size={24} className="text-zinc-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-lg rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold">Detail Total Menu Dipesan</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                        {allTimeItems.length === 0 ? (
                          <p className="text-center text-zinc-500 font-medium py-8">Belum ada data pesanan</p>
                        ) : (
                          allTimeItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-4 border border-white/5 rounded-2xl bg-zinc-900/40">
                              <span className="font-bold text-sm text-zinc-200">{item.name}</span>
                              <div className="flex items-center gap-5">
                                <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">{item.count} porsi</span>
                                <span className="text-sm text-zinc-400 font-mono w-24 text-right">Rp {item.revenue.toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </section>
          </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
