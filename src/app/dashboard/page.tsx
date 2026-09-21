'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/lib/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { DateFilter, DateFilterValue } from '@/components/ui/DateFilter';

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
  
  const [totalOmzetValue, setTotalOmzetValue] = useState(0);
  const [omzetFilter, setOmzetFilter] = useState<DateFilterValue>({
    mode: 'month',
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });
  const [isFetchingTotalOmzet, setIsFetchingTotalOmzet] = useState(false);
  
  const [chartData, setChartData] = useState<any[]>([]);
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



  useEffect(() => {
    const fetchTotalOmzet = async () => {
      if (!role) return;
      setIsFetchingTotalOmzet(true);
      
      let query = supabase.from('transactions').select('total').neq('status', 'cancelled');
      
      if (omzetFilter.mode === 'month') {
        const start = new Date(omzetFilter.year || new Date().getFullYear(), omzetFilter.month || 0, 1);
        const end = new Date(omzetFilter.year || new Date().getFullYear(), (omzetFilter.month || 0) + 1, 1);
        query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
      } else if (omzetFilter.mode === 'year') {
        const start = new Date(omzetFilter.year || new Date().getFullYear(), 0, 1);
        const end = new Date((omzetFilter.year || new Date().getFullYear()) + 1, 0, 1);
        query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
      } else if (omzetFilter.mode === 'date' && omzetFilter.date) {
        const start = new Date(omzetFilter.date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(omzetFilter.date);
        end.setHours(23, 59, 59, 999);
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      const { data } = await query;
      if (data) {
        const total = data.reduce((sum, tx) => sum + tx.total, 0);
        setTotalOmzetValue(total);
      }
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
      
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const { data: txs } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      const { data: products } = await supabase.from('products').select('name, is_titipan');
      const titipanNames = new Set(products?.filter(p => p.is_titipan).map(p => p.name) || []);

      if (txs) {
        let tOmzet = 0, yOmzet = 0;
        let tTx = 0, yTx = 0;
        let tItems = 0, yItems = 0;
        let tProfit = 0, yProfit = 0;
        let tSamba = 0, ySamba = 0;
        let tQris = 0, tCash = 0;

        let qCount = 0, cCount = 0;
        let qTotal = 0, cTotal = 0;
        let sQTotal = 0, sCTotal = 0;
        let tQTotal = 0, tCTotal = 0;
        const productsMap: Record<string, { qty: number, rev: number }> = {};
        const dailyOmzetMap: Record<string, number> = {};

        for (let i = 6; i >= 0; i--) {
          const d = new Date(todayStart);
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString('en-CA');
          dailyOmzetMap[key] = 0;
        }

        const recentTxs: any[] = [];

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

             if (dailyOmzetMap[txDateKey] !== undefined) {
                dailyOmzetMap[txDateKey] += tx.total;
             }
             
             if (isToday) {
               tOmzet += tx.total;
               tTx++;
               tItems += txItemCount;
               tProfit += txProfit;
               tSamba += txSamba;
               if (tx.method === 'QRIS') tQris += tx.total;
               if (tx.method && tx.method.includes('Cash')) tCash += tx.total;
             } else if (isYesterday) {
               yOmzet += tx.total;
               yTx++;
               yItems += txItemCount;
               yProfit += txProfit;
               ySamba += txSamba;
             }

             if (recentTxs.length < 5) {
               recentTxs.push({
                 id: tx.id,
                 customer: tx.customer_name || 'Umum'
               });
             }
          }
        });

        setTodayOmzet(tOmzet); setYesterdayOmzet(yOmzet);
        setTodayTx(tTx); setYesterdayTx(yTx);
        setTodayItems(tItems); setYesterdayItems(yItems);
        setTodayProfit(tProfit); setYesterdayProfit(yProfit);
        setTodaySamba(tSamba); setYesterdaySamba(ySamba);
        setTodayQris(tQris); setTodayCash(tCash);
        
        setQrisCount(qCount); setCashCount(cCount);
        setQrisTotal(qTotal); setCashTotal(cTotal);
        setSambaQrisTotal(sQTotal); setSambaCashTotal(sCTotal);
        setTitipanQrisTotal(tQTotal); setTitipanCashTotal(tCTotal);
        setRecentTransactions(recentTxs);

        const sortedProducts = Object.entries(productsMap)
          .sort((a, b) => b[1].qty - a[1].qty)
          .slice(0, 5)
          .map(([name, data]) => ({ name, ...data }));
        setTopProducts(sortedProducts);

        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const chartArr = Object.entries(dailyOmzetMap).map(([dateStr, value]) => {
           const d = new Date(dateStr);
           const isToday = d.getTime() === todayStart.getTime();
           return {
             label: isToday ? 'Hari ini' : days[d.getDay()],
             value,
             isToday
           };
        });
        setChartData(chartArr);
      }

      const { data: stocks } = await supabase.from('stocks').select('*').order('quantity', { ascending: true }).limit(5);
      if (stocks) {
        setLowStocks(stocks.filter(s => s.quantity <= 10));
      }

      setIsFetching(false);
    };

    fetchData();
  }, [role]);

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
      <div className="bg-transparent min-h-screen text-zinc-100 font-sans overflow-x-hidden selection:bg-amber-500/30">
        {isFetching ? (
          <div className="h-full flex items-center justify-center pt-32">
            <Loader2 className="animate-spin text-zinc-400" size={32} />
          </div>
        ) : (
          <div className="p-8 max-w-7xl mx-auto space-y-12">
            
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
              <p className="text-[#666] text-sm mt-1">{dateStr}</p>
            </div>

            {/* Top Metrics - 5 Columns */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
              
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
                </div>
              </div>

              {/* Kas & Bank */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase">Penerimaan Tunai</h2>
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

              {/* Laba Kotor */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 hover:bg-zinc-900/60 transition-colors shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[11px] font-bold text-zinc-400 tracking-widest uppercase">Laba Kotor</h2>
                    {getDiffNode(todayProfit, yesterdayProfit)}
                  </div>
                  <div className="text-3xl font-extrabold text-white tracking-tight mt-1 mb-1.5">Rp {todayProfit.toLocaleString('id-ID')}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500 font-bold uppercase">Kemarin</span>
                    <span className="text-white font-semibold">Rp {yesterdayProfit.toLocaleString('id-ID')}</span>
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
                <h3 className="text-[15px] font-bold text-white mb-8 border-b border-white/5 pb-4">Omzet 7 Hari Terakhir</h3>
                <div className="h-[200px] flex items-end justify-between px-2 gap-4">
                  {chartData.map((d, i) => {
                    const heightPercent = Math.max((d.value / maxChartValue) * 100, 2);
                    const isZero = d.value === 0;
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 group h-full">
                        {/* Chart Area */}
                        <div className="flex-1 w-full flex items-end justify-center pt-6">
                          <div 
                            className={`w-full max-w-[48px] rounded-t-lg relative transition-all duration-1000 ease-out ${d.isToday ? 'bg-[#38a169]' : 'bg-[#9ae6b4]'}`}
                            style={{ height: `${heightPercent}%`, minHeight: isZero ? '4px' : undefined }}
                          >
                            {!isZero && (
                              <span className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-bold transition-colors ${d.isToday ? 'text-[#38a169]' : 'text-zinc-400 group-hover:text-white'}`}>
                                {formatCompact(d.value)}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Bottom Label */}
                        <span className={`text-[11px] font-semibold mt-3 ${d.isToday ? 'text-[#38a169]' : 'text-zinc-400'}`}>
                          {d.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 shadow-sm">
                <h3 className="text-[15px] font-bold text-white mb-6 border-b border-white/5 pb-4">Metode Pembayaran - 7 hari</h3>
                
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
                <h3 className="text-[15px] font-bold text-white mb-6 border-b border-white/5 pb-4">Produk Terlaris · 7 hari</h3>
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
                <div className="space-y-4">
                  {recentTransactions.length === 0 ? (
                    <p className="text-sm text-zinc-400">Belum ada transaksi.</p>
                  ) : (
                    recentTransactions.map((tx, i) => (
                      <div key={i} className="flex items-center gap-3 py-0.5">
                        <span className="text-xs font-mono font-bold text-zinc-500 shrink-0">{tx.id.startsWith('order_') ? tx.id : `order_${tx.id}`}</span>
                        <span className="text-sm font-bold text-white truncate">{tx.customer}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
