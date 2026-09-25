'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/lib/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, BarChart3 } from 'lucide-react';
import { DateFilter, DateFilterValue } from '@/components/ui/DateFilter';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function DashboardPage() {
  const { role } = useAuth();
  
  const [isFetching, setIsFetching] = useState(true);
  
  const [todayOmzet, setTodayOmzet] = useState(0);
  const [yesterdayOmzet, setYesterdayOmzet] = useState(0);
  
  const [todayTx, setTodayTx] = useState(0);
  const [yesterdayTx, setYesterdayTx] = useState(0);
  
  const [todayItems, setTodayItems] = useState(0);
  const [yesterdayItems, setYesterdayItems] = useState(0);
  
  const [todayProfit, setTodayProfit] = useState(0);
  const [yesterdayProfit, setYesterdayProfit] = useState(0);
  const [todaySamba, setTodaySamba] = useState(0);
  const [yesterdaySamba, setYesterdaySamba] = useState(0);
  const [todayQris, setTodayQris] = useState(0);
  const [todayCash, setTodayCash] = useState(0);
  const [todayKasMasuk, setTodayKasMasuk] = useState(0);
  
  const [totalOmzetValue, setTotalOmzetValue] = useState(0);
  const [omzetFilter, setOmzetFilter] = useState<DateFilterValue>({
    mode: 'month',
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });
  const [isFetchingTotalOmzet, setIsFetchingTotalOmzet] = useState(false);
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);
  const [qrisCount, setQrisCount] = useState(0);
  const [cashCount, setCashCount] = useState(0);
  const [qrisTotal, setQrisTotal] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [sambaQrisTotal, setSambaQrisTotal] = useState(0);
  const [sambaCashTotal, setSambaCashTotal] = useState(0);
  const [titipanQrisTotal, setTitipanQrisTotal] = useState(0);
  const [titipanCashTotal, setTitipanCashTotal] = useState(0);
  
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [lowStocks, setLowStocks] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  const [isKasModalOpen, setIsKasModalOpen] = useState(false);
  const [kasAmount, setKasAmount] = useState('');
  const [kasMethod, setKasMethod] = useState<'Cash'|'QRIS'>('Cash');
  const [isSubmittingKas, setIsSubmittingKas] = useState(false);
  const [kasMasukTxs, setKasMasukTxs] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleKasMasuk = async () => {
    if (!kasAmount || parseInt(kasAmount) <= 0) return;
    setIsSubmittingKas(true);
    const amt = parseInt(kasAmount);
    
    const txId = `ADJ-${Math.random().toString(36).substr(2, 9)}`;
    const tx = {
      id: txId,
      method: kasMethod,
      total: amt,
      cashier_name: role === 'manager' ? 'Manager' : 'Kasir',
      status: 'completed',
      customer_name: 'Penyesuaian Kas Masuk',
      cash_received: kasMethod === 'Cash' ? amt : null
    };

    const { error } = await supabase.from('transactions').insert([tx]);
    setIsSubmittingKas(false);
    if (!error) {
      setIsKasModalOpen(false);
      setKasAmount('');
      setRefreshKey(prev => prev + 1);
    } else {
      alert("Gagal menambah kas: " + error.message);
    }
  };

  const executeDelete = async () => {
    if (!confirmDeleteTx) return;
    setIsDeleting(true);
    const { error } = await supabase.from('transactions').delete().eq('id', confirmDeleteTx.id);
    setIsDeleting(false);
    if (!error) {
      setConfirmDeleteTx(null);
      if (selectedTx && selectedTx.id === confirmDeleteTx.id) {
        setIsTxModalOpen(false);
      }
      setRefreshKey(prev => prev + 1);
    } else {
      alert("Gagal menghapus: " + error.message);
    }
  };

  useEffect(() => {
    const fetchTotalOmzet = async () => {
      if (!role) return;
      setIsFetchingTotalOmzet(true);
      
      let queryTx = supabase.from('transactions').select('total, customer_name, created_at').neq('status', 'cancelled');
      let querySummary = supabase.from('daily_summaries').select('total_omzet, date');
      
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (omzetFilter.mode === 'month') {
        startDate = new Date(omzetFilter.year || new Date().getFullYear(), omzetFilter.month || 0, 1);
        endDate = new Date(omzetFilter.year || new Date().getFullYear(), (omzetFilter.month || 0) + 1, 1);
      } else if (omzetFilter.mode === 'year') {
        startDate = new Date(omzetFilter.year || new Date().getFullYear(), 0, 1);
        endDate = new Date((omzetFilter.year || new Date().getFullYear()) + 1, 0, 1);
      } else if (omzetFilter.mode === 'date' && omzetFilter.date) {
        startDate = new Date(omzetFilter.date);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(omzetFilter.date);
        endDate.setHours(23, 59, 59, 999);
      }

      if (startDate && endDate) {
        queryTx = queryTx.gte('created_at', startDate.toISOString()).lt('created_at', endDate.toISOString());
        
        const startDateStr = startDate.toLocaleDateString('en-CA');
        const summaryEndDate = new Date(endDate);
        summaryEndDate.setMilliseconds(summaryEndDate.getMilliseconds() - 1);
        const endDateStr = summaryEndDate.toLocaleDateString('en-CA');
        
        querySummary = querySummary.gte('date', startDateStr).lte('date', endDateStr);
      }

      const [resTx, resSummary] = await Promise.all([queryTx, querySummary]);
      let total = 0;
      
      const summaryDates = new Set(resSummary.data?.map(s => s.date) || []);
      
      if (resSummary.data) {
        total += resSummary.data.reduce((sum, s) => sum + Number(s.total_omzet), 0);
      }
      
      if (resTx.data) {
        total += resTx.data.filter(tx => {
          if (tx.customer_name === 'Penyesuaian Kas Masuk') return false;
          // Cek apakah tanggal transaksi ini sudah direkap di daily_summaries
          const txDate = new Date(tx.created_at).toLocaleDateString('en-CA');
          return !summaryDates.has(txDate);
        }).reduce((sum, tx) => sum + tx.total, 0);
      }
      
      setTotalOmzetValue(total);
      setIsFetchingTotalOmzet(false);
    };
    
    fetchTotalOmzet();
  }, [role, omzetFilter]);

  useEffect(() => {
    if (!role) return;

    const fetchData = async () => {
      const now = new Date();
      
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      
      const thirtyDaysAgo = new Date(todayStart);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

      const { data: txs } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });
        
      const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString('en-CA');
      const { data: summaries } = await supabase
        .from('daily_summaries')
        .select('*')
        .gte('date', thirtyDaysAgoStr)
        .order('date', { ascending: false });

      const { data: products } = await supabase.from('products').select('name, is_titipan');
      const titipanNames = new Set(products?.filter(p => p.is_titipan).map(p => p.name) || []);

      if (txs) {
        let tOmzet = 0, yOmzet = 0;
        let tTx = 0, yTx = 0;
        let tItems = 0, yItems = 0;
        let tProfit = 0, yProfit = 0;
        let tSamba = 0, ySamba = 0;
        let tQris = 0, tCash = 0;
        let tKasMasuk = 0;

        let qCount = 0, cCount = 0;
        let qTotal = 0, cTotal = 0;
        let sQTotal = 0, sCTotal = 0;
        let tQTotal = 0, tCTotal = 0;
        const productsMap: Record<string, { qty: number, rev: number }> = {};
        const dailyStatsMap: Record<string, { total: number, cash: number, qris: number, kasMasuk: number }> = {};

        for (let i = 29; i >= 0; i--) {
          const d = new Date(todayStart);
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString('en-CA');
          dailyStatsMap[key] = { total: 0, cash: 0, qris: 0, kasMasuk: 0 };
        }

        const recentTxs: any[] = [];
        const kasTxsLocal: any[] = [];

        txs.forEach((tx) => {
          const txDate = new Date(tx.created_at);
          const txDateKey = txDate.toLocaleDateString('en-CA');
          
          const isToday = txDate >= todayStart;
          const isYesterday = txDate >= yesterdayStart && txDate < todayStart;
          
          if (tx.status !== 'cancelled') {
             let txItemCount = 0;
             let txProfit = 0;
             let txSamba = 0;
             let txTitipan = 0;

             tx.transaction_items?.forEach((item: any) => {
               txItemCount += item.quantity;
               txProfit += (item.price - (item.supplier_price || 0)) * item.quantity;
               
               if (!titipanNames.has(item.product_name)) {
                 txSamba += item.price * item.quantity;
               } else {
                 txTitipan += item.price * item.quantity;
               }
               
               if (!productsMap[item.product_name]) productsMap[item.product_name] = { qty: 0, rev: 0 };
               productsMap[item.product_name].qty += item.quantity;
               productsMap[item.product_name].rev += (item.price * item.quantity);
             });

             if (tx.method === 'QRIS') {
               qCount++;
               qTotal += tx.total;
               sQTotal += txSamba;
               tQTotal += txTitipan;
             }
             if (tx.method && tx.method.includes('Cash')) {
               cCount++;
               cTotal += tx.total;
               sCTotal += txSamba;
               tCTotal += txTitipan;
             }

             const isKasMasuk = tx.customer_name === 'Penyesuaian Kas Masuk';
             
             if (isKasMasuk) {
               kasTxsLocal.push(tx);
               if (isToday) tKasMasuk += tx.total;
               
               if (dailyStatsMap[txDateKey]) {
                 dailyStatsMap[txDateKey].kasMasuk += tx.total;
               }
             }

             if (!isKasMasuk && dailyStatsMap[txDateKey]) {
                dailyStatsMap[txDateKey].total += tx.total;
                if (tx.method === 'QRIS') dailyStatsMap[txDateKey].qris += tx.total;
                if (tx.method && tx.method.includes('Cash')) dailyStatsMap[txDateKey].cash += tx.total;
             }
             
             if (isToday) {
               if (!isKasMasuk) {
                 tOmzet += tx.total;
                 tTx++;
               }
               tItems += txItemCount;
               tProfit += txProfit;
               tSamba += txSamba;
               if (tx.method === 'QRIS') tQris += tx.total;
               if (tx.method && tx.method.includes('Cash')) tCash += tx.total;
             } else if (isYesterday) {
               if (!isKasMasuk) {
                 yOmzet += tx.total;
                 yTx++;
               }
               yItems += txItemCount;
               yProfit += txProfit;
               ySamba += txSamba;
             }

             if (recentTxs.length < 20 && tx.cashier_name !== 'System Recovery') {
               recentTxs.push(tx);
             }
          }
        });

        // Merging data from daily_summaries
        if (summaries) {
          const yesterdayStr = yesterdayStart.toLocaleDateString('en-CA');
          
          summaries.forEach((s: any) => {
             const sDateKey = s.date;
             
             // Mencegah double-count: hanya ambil summary jika belum ada data real dari transactions
             if (dailyStatsMap[sDateKey] && dailyStatsMap[sDateKey].total === 0) {
               dailyStatsMap[sDateKey].total = Number(s.total_omzet || 0);
               dailyStatsMap[sDateKey].cash = Number(s.total_cash || 0);
               dailyStatsMap[sDateKey].qris = Number(s.total_qris || 0);
             }
             
             // Pastikan kita tidak menambah qCount, cCount dll ganda jika kita sudah memprosesnya dari transactions
             // (Catatan: ini sederhana saja karena kita berasumsi daily_summaries mengisi data lama yang sudah dihapus dari transactions)
             if (sDateKey === yesterdayStr && yOmzet === 0) {
               yOmzet = Number(s.total_omzet || 0);
               yTx = Number(s.total_transactions || 0);
               yItems = Number(s.total_items || 0);
               yProfit = Number(s.total_profit || 0);
               ySamba = Number(s.samba_qris || 0) + Number(s.samba_cash || 0);
             }
          });
        }

        setTodayOmzet(tOmzet); setYesterdayOmzet(yOmzet);
        setTodayTx(tTx); setYesterdayTx(yTx);
        setTodayItems(tItems); setYesterdayItems(yItems);
        setTodayProfit(tProfit); setYesterdayProfit(yProfit);
        setTodaySamba(tSamba); setYesterdaySamba(ySamba);
        setTodayQris(tQris); setTodayCash(tCash);
        setTodayKasMasuk(tKasMasuk);
        
        setQrisCount(qCount); setCashCount(cCount);
        setQrisTotal(qTotal); setCashTotal(cTotal);
        setSambaQrisTotal(sQTotal); setSambaCashTotal(sCTotal);
        setTitipanQrisTotal(tQTotal); setTitipanCashTotal(tCTotal);
        setRecentTransactions(recentTxs);
        setKasMasukTxs(kasTxsLocal);

        const sortedProducts = Object.entries(productsMap)
          .sort((a, b) => b[1].qty - a[1].qty)
          .slice(0, 5)
          .map(([name, data]) => ({ name, ...data }));
        setTopProducts(sortedProducts);

        const chartArr = Object.entries(dailyStatsMap)
          .map(([dateStr, stats]) => {
             const d = new Date(dateStr);
             const isToday = d.getTime() === todayStart.getTime();
             return {
               label: isToday ? 'Hari ini' : `${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })}`,
               value: stats.total,
               cash: stats.cash,
               qris: stats.qris,
               kasMasuk: stats.kasMasuk,
               isToday
             };
          })
          .filter(d => d.value > 0 || d.kasMasuk > 0);
          
        setChartData(chartArr);
      }

      const { data: stocks } = await supabase.from('stocks').select('*').order('quantity', { ascending: true }).limit(5);
      if (stocks) {
        setLowStocks(stocks.filter(s => s.quantity <= 10));
      }

      setIsFetching(false);
    };

    fetchData();
  }, [role, refreshKey]);

  const formatCompact = (num: number) => {
    if (num === 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'jt';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'rb';
    return num.toString();
  };

  const getDiffNode = (today: number, yesterday: number) => {
    if (today === 0) return null;
    const diff = yesterday === 0 ? 100 : ((today - yesterday) / yesterday) * 100;
    const isUp = diff > 0;
    const isZero = diff === 0;
    const color = isUp ? 'text-[#38a169] bg-[#38a169]/10' : isZero ? 'text-zinc-500 bg-zinc-800/50' : 'text-[#e53e3e] bg-[#e53e3e]/10';
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${color} ml-2`}>
        {isUp ? '+' : ''}{diff.toFixed(0)}%
      </span>
    );
  };

  if (!role) return null;

  const maxChartValue = Math.max(...chartData.map(d => d.value), 1);
  
  const totalPaymentMethods = cashCount + qrisCount || 1;
  const cashPercent = (cashCount / totalPaymentMethods) * 100;
  const qrisPercent = (qrisCount / totalPaymentMethods) * 100;

  const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <MainLayout title="Dashboard">
      <div className="bg-transparent min-h-screen text-zinc-100 font-sans overflow-x-hidden selection:bg-amber-500/30 relative">
        
        {/* Top 1/3 Hero Background Image */}
        <div className="absolute top-0 left-0 right-0 h-[400px] md:h-[500px] z-0 pointer-events-none overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80&w=2000" 
            alt="Hero Background" 
            className="w-full h-full object-cover opacity-[0.25] blur-[4px] scale-105"
          />
          {/* Fading gradient so it blends smoothly with the rest of the dark dashboard */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/10 via-zinc-950/60 to-zinc-950"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 to-transparent"></div>
        </div>

        {isFetching ? (
          <div className="h-full flex items-center justify-center pt-32 relative z-10">
            <Loader2 className="animate-spin text-zinc-400" size={32} />
          </div>
        ) : (
          <div className="relative z-10 p-8 max-w-7xl mx-auto space-y-12 pt-10 md:pt-16">
            
            {/* Elegant Floating Hero Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
              <div className="max-w-xl">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2 drop-shadow-lg">
                  Dashboard
                </h1>
                <p className="text-zinc-300 text-sm md:text-base font-medium drop-shadow-md">
                  {dateStr}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button onClick={() => window.location.href='/history'} className="flex-1 md:flex-none px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all border border-white/10 backdrop-blur-md">
                  Lihat Riwayat
                </button>
                <button onClick={() => window.location.href='/pos'} className="flex-1 md:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-sm font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5">
                  + Transaksi Baru
                </button>
              </div>
            </div>

            {/* Top Metrics - 4 Columns */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              
              {/* Pendapatan Cafe */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase">Pendapatan Cafe</h2>
                    {getDiffNode(todaySamba, yesterdaySamba)}
                  </div>
                  <div className="text-3xl font-extrabold text-[#38a169] tracking-tight mt-1 mb-1.5">Rp {todaySamba.toLocaleString('id-ID')}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500 font-bold uppercase">Omzet Kotor</span>
                    <span className="text-white font-semibold">Rp {todayOmzet.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500 font-bold uppercase">Uang Titipan</span>
                    <span className="text-amber-500 font-semibold">Rp {(todayOmzet - todaySamba).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500 font-bold uppercase">Kas Masuk</span>
                    <span className="text-blue-500 font-semibold">+ Rp {todayKasMasuk.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Kas & Bank */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase">Penerimaan Tunai</h2>
                    <button onClick={() => setIsKasModalOpen(true)} className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full hover:bg-primary/30 transition-colors font-bold">+ Kas Masuk</button>
                  </div>
                  <div className="text-3xl font-extrabold text-white tracking-tight mt-1 mb-1.5">Rp {todayCash.toLocaleString('id-ID')}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500 font-bold uppercase">Masuk via QRIS</span>
                    <span className="text-[#e53e3e] font-bold">Rp {todayQris.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Statistik Penjualan */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase">Total Transaksi</h2>
                    {getDiffNode(todayTx, yesterdayTx)}
                  </div>
                  <div className="text-3xl font-extrabold text-white tracking-tight mt-1 mb-1.5">{todayTx}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500 font-bold uppercase">Item Terjual</span>
                    <span className="text-white font-semibold">{todayItems} pcs</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500 font-bold uppercase">Rata-rata/Trx</span>
                    <span className="text-white font-semibold">Rp {(todayTx > 0 ? todayOmzet / todayTx : 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>


              {/* Total Omzet Keseluruhan */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors shadow-sm relative flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase">Total Omzet</h2>
                </div>
                
                <div className="text-3xl font-extrabold text-white tracking-tight mt-1 mb-1.5 flex items-center gap-2">
                  Rp {totalOmzetValue.toLocaleString('id-ID')}
                  {isFetchingTotalOmzet && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
                </div>
                
                <div className="relative mt-2">
                  <DateFilter
                    value={omzetFilter}
                    onChange={setOmzetFilter}
                    align="left"
                  />
                </div>
              </div>
            </div>

            {/* Middle Section: Chart & Payment Methods */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
              
              {/* Chart */}
              <div className="lg:col-span-2 bg-zinc-900/40 border border-white/5 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                  <h3 className="text-[15px] font-bold text-white">Omzet 30 Hari Terakhir</h3>
                  <button onClick={() => window.location.href='/reports'} className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 border border-primary/20 shadow-sm shadow-primary/5">
                    <BarChart3 size={14} /> Laporan Detail
                  </button>
                </div>
                <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
                  <div className="h-[340px] pt-32 flex items-end justify-start px-4 gap-12 min-w-max w-full">
                  {chartData.map((d, i) => {
                    const heightPercent = Math.max((d.value / maxChartValue) * 100, 2);
                    const isZero = d.value === 0;
                    return (
                      <div 
                        key={i} 
                        className="flex flex-col items-center w-14 group h-full relative cursor-pointer"
                        onClick={() => setActiveTooltipIndex(activeTooltipIndex === i ? null : i)}
                      >
                        
                        {/* Chart Area */}
                        <div className="flex-1 w-full flex items-end justify-center pt-6">
                          <div 
                            className={`w-full max-w-[36px] rounded-t-lg relative transition-all duration-1000 ease-out hover:brightness-110 ${d.isToday ? 'bg-[#4ade80]' : 'bg-gradient-to-t from-[#B98A2E] to-[#E3B24C]'}`}
                            style={{ height: `${heightPercent}%`, minHeight: isZero ? '4px' : undefined }}
                          >
                            {/* Custom Tooltip */}
                            <div className={`transition-opacity absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 mb-2 bg-zinc-800 text-white text-[10px] p-2.5 rounded-lg shadow-xl z-50 whitespace-nowrap border border-white/10 ${activeTooltipIndex === i ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                              <div className="font-bold border-b border-white/10 pb-1.5 mb-1.5 text-zinc-300">{d.label}</div>
                              <div className="space-y-1">
                                <div className="flex justify-between gap-4">
                                  <span className="text-zinc-400">Total Omzet</span>
                                  <span className="font-bold">Rp {d.value.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-zinc-400">Tunai (Cash)</span>
                                  <span className="font-bold text-[#38a169]">Rp {d.cash.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-zinc-400">QRIS</span>
                                  <span className="font-bold text-[#e53e3e]">Rp {d.qris.toLocaleString('id-ID')}</span>
                                </div>
                                {d.kasMasuk > 0 && (
                                  <div className="flex justify-between gap-4 border-t border-white/5 pt-1 mt-1">
                                    <span className="text-zinc-400">Kas Masuk</span>
                                    <span className="font-bold text-blue-400">+ Rp {d.kasMasuk.toLocaleString('id-ID')}</span>
                                  </div>
                                )}
                              </div>
                              {/* Triangle Pointer */}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-[6px] border-transparent border-t-zinc-800"></div>
                            </div>

                            {!isZero && (
                              <span className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-bold transition-colors ${d.isToday ? 'text-[#38a169]' : 'text-zinc-400 group-hover:text-white'}`}>
                                {formatCompact(d.value)}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Bottom Label */}
                        <span className={`text-[10px] font-semibold mt-3 whitespace-nowrap ${d.isToday ? 'text-[#38a169]' : 'text-zinc-400'}`}>
                          {d.label}
                        </span>
                      </div>
                    )
                  })}
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 shadow-sm">
                <h3 className="text-[15px] font-bold text-white mb-6 border-b border-white/5 pb-4">Metode Pembayaran - 30 hari</h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-[13px] font-bold mb-1 text-white">
                      <span>Tunai <span className="text-zinc-500 font-normal ml-1">({cashCount} trx)</span></span>
                      <span className="text-zinc-300">Rp {cashTotal.toLocaleString('id-ID')}</span>
                    </div>

                    <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#38a169] rounded-full transition-all duration-1000" style={{ width: `${cashPercent}%` }} />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-[13px] font-bold mb-1 text-white">
                      <span>QRIS <span className="text-zinc-500 font-normal ml-1">({qrisCount} trx)</span></span>
                      <span className="text-zinc-300">Rp {qrisTotal.toLocaleString('id-ID')}</span>
                    </div>

                    <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#e53e3e] rounded-full transition-all duration-1000" style={{ width: `${qrisPercent}%` }} />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-[13px] font-bold text-white">
                      <span>Total Bersih Cafe (Samba)</span>
                      <span className="text-[#38a169]">Rp {(sambaCashTotal + sambaQrisTotal).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13px] font-bold text-white">
                      <span>Total Uang Titipan</span>
                      <span className="text-amber-500">Rp {(titipanCashTotal + titipanQrisTotal).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-[11px] font-medium text-[#777] mt-2 pt-2 border-t border-white/5">
                      Rata-rata / transaksi: Rp {(totalPaymentMethods > 0 ? chartData.reduce((s, a) => s + a.value, 0) / totalPaymentMethods : 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Top Products, Low Stock, Recent Tx */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2 pb-20">
              
              {/* Produk Terlaris */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 shadow-sm">
                <h3 className="text-[15px] font-bold text-white mb-6 border-b border-white/5 pb-4">Produk Terlaris · 30 hari</h3>
                <div className="space-y-4">
                  {topProducts.length === 0 ? (
                    <p className="text-sm text-[#888]">Belum ada data penjualan.</p>
                  ) : (
                    topProducts.map((p, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                          i === 0 ? 'bg-[#38a169] text-white' : 'bg-transparent'
                        } ${
                          i === 1 ? 'text-[#e53e3e]' : i === 2 ? 'text-[#319795]' : i > 2 ? 'text-[#718096]' : ''
                        }`}>
                          {i + 1}
                        </div>
                        <span className="text-[13px] font-bold text-white flex-1 truncate">{p.name}</span>
                        <span className="text-[11px] font-bold text-[#81e6d9] shrink-0 w-8 text-right">{p.qty}x</span>
                        <span className="text-[12px] font-bold text-zinc-400 shrink-0 w-12 text-right">{formatCompact(p.rev)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Stok Menipis */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 shadow-sm relative">
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                  <h3 className="text-[15px] font-bold text-white">Stok Menipis</h3>
                  <span className="text-[11px] font-bold text-[#e53e3e] bg-[#e53e3e]/10 px-2 py-0.5 rounded-full">{lowStocks.length} SKU</span>
                </div>
                <div className="space-y-4">
                  {lowStocks.length === 0 ? (
                    <p className="text-sm text-zinc-400">Semua stok terpantau aman.</p>
                  ) : (
                    lowStocks.map((s, i) => (
                      <div key={i} className="flex justify-between items-center py-0.5">
                        <span className="text-sm font-bold text-zinc-200 truncate pr-4">{s.name}</span>
                        <span className="text-xs font-bold text-[#e53e3e]">sisa {s.quantity}</span>
                      </div>
                    ))
                  )}
                </div>
                <button className="mt-8 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                  Kirim notif stok ke WA owner
                </button>
              </div>

              {/* Transaksi Terbaru */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 shadow-sm">
                <h3 className="text-[15px] font-bold text-white mb-6 border-b border-white/5 pb-4">Transaksi Terbaru</h3>
                <div className="space-y-1 overflow-y-auto max-h-[250px] scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900 pr-2">
                  {recentTransactions.length === 0 ? (
                    <p className="text-sm text-zinc-400">Belum ada transaksi.</p>
                  ) : (
                    recentTransactions.map((tx, i) => (
                      <div 
                        key={i} 
                        className="flex items-center gap-3 py-2 cursor-pointer hover:bg-white/5 px-2 rounded-lg transition-colors group"
                        onClick={() => {
                          setSelectedTx(tx);
                          setIsTxModalOpen(true);
                        }}
                      >
                        <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold bg-zinc-800 text-zinc-400 shrink-0 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                          {recentTransactions.length - i}
                        </div>
                        <span className="text-[11px] font-mono font-bold text-zinc-500 shrink-0 group-hover:text-amber-500 transition-colors w-[140px] truncate">
                          {tx.id.startsWith('order_') || tx.id.startsWith('ADJ-') ? tx.id : `order_${tx.id}`}
                        </span>
                        <span className="text-[13px] font-bold text-white truncate flex-1">
                          {tx.customer_name || 'Umum'}
                        </span>
                        <span className="text-[12px] font-bold text-emerald-400 shrink-0">
                          Rp {tx.total.toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        <Dialog open={isTxModalOpen} onOpenChange={setIsTxModalOpen}>
          <DialogContent className="bg-card border-border sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detail Transaksi</DialogTitle>
            </DialogHeader>
            {selectedTx && (
              <div className="space-y-4 py-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-mono text-xs text-right max-w-[60%] truncate" title={selectedTx.id}>
                    {selectedTx.id}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Waktu:</span>
                  <span>{new Date(selectedTx.created_at).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold">{selectedTx.customer_name || 'Umum'}</span>
                </div>
                {selectedTx.cashier_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kasir:</span>
                    <span>{selectedTx.cashier_name}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Metode:</span>
                  <span className="font-semibold">{selectedTx.method}</span>
                </div>
                
                <div className="pt-4 border-t border-border space-y-3">
                  <h4 className="font-semibold text-sm">Item Pesanan:</h4>
                  {selectedTx.transaction_items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div className="max-w-[70%]">
                        <span>{item.quantity}x {item.product_name}</span>
                        {item.notes && <p className="text-xs text-muted-foreground mt-0.5 break-words">Note: {item.notes}</p>}
                      </div>
                      <span className="font-medium whitespace-nowrap">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-border flex justify-between font-bold text-lg items-center">
                  <span>Total</span>
                  <span className="text-primary">Rp {selectedTx.total?.toLocaleString('id-ID')}</span>
                </div>
                {selectedTx.customer_name === 'Penyesuaian Kas Masuk' && (
                  <div className="pt-4 border-t border-border flex justify-end">
                    <button 
                      onClick={() => setConfirmDeleteTx(selectedTx)} 
                      className="px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors rounded-lg text-sm font-bold"
                    >
                      Hapus Catatan Ini
                    </button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isKasModalOpen} onOpenChange={setIsKasModalOpen}>
          <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-md text-zinc-100">
            <DialogHeader>
              <DialogTitle>Penyesuaian Kas Masuk</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400">Jumlah Uang</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Rp</span>
                  <input 
                    type="text" 
                    className="w-full pl-9 pr-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-zinc-100 focus:outline-none focus:border-primary"
                    placeholder="0"
                    value={kasAmount === '' ? '' : Number(kasAmount).toLocaleString('id-ID')}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setKasAmount(val);
                    }}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400">Dimasukkan ke</label>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setKasMethod('Cash')}
                    className={`flex-1 py-3 rounded-xl border font-semibold text-sm transition-all ${kasMethod === 'Cash' ? 'bg-green-500/20 border-green-500 text-green-500' : 'bg-zinc-900 border-white/10 text-zinc-500 hover:border-white/30'}`}
                  >
                    Laci Kasir (Cash)
                  </button>
                  <button 
                    onClick={() => setKasMethod('QRIS')}
                    className={`flex-1 py-3 rounded-xl border font-semibold text-sm transition-all ${kasMethod === 'QRIS' ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'bg-zinc-900 border-white/10 text-zinc-500 hover:border-white/30'}`}
                  >
                    Saldo QRIS
                  </button>
                </div>
              </div>
            </div>
            
            {/* History Kas Masuk (7 hari terakhir) */}
            {kasMasukTxs.length > 0 && (
              <div className="pt-6 border-t border-white/10 mt-2 space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300">Riwayat Kas Masuk (7 Hari Terakhir)</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {kasMasukTxs.map(tx => (
                    <div key={tx.id} className="flex justify-between items-center bg-zinc-900 border border-white/5 p-3 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-white">Rp {tx.total.toLocaleString('id-ID')}</p>
                        <p className="text-xs text-zinc-500">{new Date(tx.created_at).toLocaleString('id-ID')} - {tx.method}</p>
                      </div>
                      <button 
                        onClick={() => setConfirmDeleteTx(tx)}
                        className="text-xs text-destructive hover:text-red-400 font-bold px-2 py-1 rounded bg-destructive/10 hover:bg-destructive/20 transition-colors"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
              <button onClick={() => setIsKasModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold transition-colors">Tutup</button>
              <button disabled={isSubmittingKas || !kasAmount} onClick={handleKasMasuk} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm">
                {isSubmittingKas ? 'Menyimpan...' : 'Simpan Kas Masuk'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Custom Confirmation Dialog */}
        <Dialog open={!!confirmDeleteTx} onOpenChange={(open) => !open && setConfirmDeleteTx(null)}>
          <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-sm text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                Hapus Kas Masuk?
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-zinc-400 text-sm mb-4">Apakah Anda yakin ingin menghapus catatan penyesuaian kas masuk ini?</p>
              {confirmDeleteTx && (
                <div className="bg-zinc-900 border border-white/5 p-4 rounded-xl flex justify-between items-center">
                  <span className="text-sm font-bold text-white">Rp {confirmDeleteTx.total.toLocaleString('id-ID')}</span>
                  <span className="text-xs text-zinc-500 font-medium">{confirmDeleteTx.method}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button disabled={isDeleting} onClick={() => setConfirmDeleteTx(null)} className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold transition-colors disabled:opacity-50">Batal</button>
              <button disabled={isDeleting} onClick={executeDelete} className="px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90 transition-colors disabled:opacity-50 text-sm">
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
