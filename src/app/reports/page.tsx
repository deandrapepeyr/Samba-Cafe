'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, CalendarDays, CalendarRange, Clock, Calendar, BarChart3, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Rectangle } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Transaction = {
  id: string;
  created_at: string;
  method: string;
  total: number;
  status: string;
  customer_name: string;
  transaction_items?: { product_name: string; price: number; quantity: number }[];
};

type ChartDataPoint = {
  label: string;
  rawDate: string;
  value: number;
  pesanan: number;
  qris: number;
  cash: number;
  pendapatanKafe: number;
  uangTitipan: number;
  kasMasuk: number;
  isCurrent: boolean;
};

export default function ReportsPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [titipanProductNames, setTitipanProductNames] = useState<Set<string>>(new Set());
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const [showAllDates, setShowAllDates] = useState(false);

  useEffect(() => {
    if (!isLoading && role !== 'manager') {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  useEffect(() => {
    if (role === 'manager') {
      fetchData();
    }
  }, [role]);

  const fetchData = async () => {
    setIsLoadingData(true);
    
    const productsRes = await supabase.from('products').select('name, is_titipan');
    const titipanSet = new Set<string>();
    if (productsRes.data) {
      productsRes.data.forEach(p => {
        if (p.is_titipan) titipanSet.add(p.name);
      });
      setTitipanProductNames(titipanSet);
    }
    
    const { data: txData } = await supabase
      .from('transactions')
      .select('id, created_at, method, total, status, customer_name, transaction_items(product_name, price, quantity)')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (txData) {
      setAllTransactions(txData);
    }
    
    setIsLoadingData(false);
  };

  useEffect(() => {
    if (allTransactions.length > 0 || !isLoadingData) {
      processChartData();
    }
  }, [allTransactions, activeTab, titipanProductNames, isLoadingData]);

  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const processChartData = () => {
    const toLocalISOString = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const now = new Date();
    const dataMap: Record<string, ChartDataPoint> = {};
    
    let startDateLimit: Date = new Date(0);
    
    if (activeTab === 'daily') {
      startDateLimit = new Date();
      startDateLimit.setDate(startDateLimit.getDate() - 29);
      startDateLimit.setHours(0,0,0,0);
      
      for (let i = 0; i < 30; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const rawDate = toLocalISOString(d);
        dataMap[rawDate] = createEmptyPoint(
          d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
          rawDate,
          rawDate === toLocalISOString(now)
        );
      }
    } else if (activeTab === 'weekly') {
      startDateLimit = new Date();
      startDateLimit.setDate(startDateLimit.getDate() - (11 * 7));
      startDateLimit = getStartOfWeek(startDateLimit);
      
      for (let i = 0; i < 12; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - (i * 7));
        const start = getStartOfWeek(d);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const rawDate = `${toLocalISOString(start)}~${toLocalISOString(end)}`;
        
        const currentStart = getStartOfWeek(now);
        
        const startDay = start.getDate();
        const endDay = end.getDate();
        const startMonth = start.toLocaleDateString('id-ID', {month:'short'});
        const endMonth = end.toLocaleDateString('id-ID', {month:'short'});
        const label = startMonth === endMonth ? `${startDay}-${endDay} ${startMonth}` : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
        
        dataMap[rawDate] = createEmptyPoint(
          label,
          rawDate,
          start.getTime() === currentStart.getTime()
        );
      }
    } else if (activeTab === 'monthly') {
      startDateLimit = new Date();
      startDateLimit.setMonth(startDateLimit.getMonth() - 11);
      startDateLimit.setDate(1);
      startDateLimit.setHours(0,0,0,0);
      
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const rawDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        dataMap[rawDate] = createEmptyPoint(
          d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
          rawDate,
          d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        );
      }
    } else if (activeTab === 'yearly') {
      startDateLimit = new Date();
      startDateLimit.setFullYear(startDateLimit.getFullYear() - 4);
      startDateLimit.setMonth(0, 1);
      startDateLimit.setHours(0,0,0,0);
      
      for (let i = 0; i < 5; i++) {
        const y = now.getFullYear() - i;
        const rawDate = `${y}`;
        dataMap[rawDate] = createEmptyPoint(
          rawDate,
          rawDate,
          y === now.getFullYear()
        );
      }
    }

    allTransactions.forEach(tx => {
      const txDate = new Date(tx.created_at);
      if (txDate < startDateLimit) return;
      
      let key = '';
      if (activeTab === 'daily') {
        key = toLocalISOString(txDate);
      } else if (activeTab === 'weekly') {
        const start = getStartOfWeek(txDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        key = `${toLocalISOString(start)}~${toLocalISOString(end)}`;
      } else if (activeTab === 'monthly') {
        key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
      } else if (activeTab === 'yearly') {
        key = `${txDate.getFullYear()}`;
      }

      if (!dataMap[key]) return;

      const isKasMasuk = tx.customer_name === 'Penyesuaian Kas Masuk';
      
      if (isKasMasuk) {
        dataMap[key].kasMasuk += tx.total;
        return; 
      }

      dataMap[key].value += tx.total;
      dataMap[key].pesanan += 1;
      
      if (tx.method === 'QRIS') dataMap[key].qris += tx.total;
      if (tx.method === 'Cash') dataMap[key].cash += tx.total;

      let txTitipan = 0;
      if (tx.transaction_items) {
        tx.transaction_items.forEach(item => {
          if (titipanProductNames.has(item.product_name)) {
            txTitipan += (item.price * item.quantity);
          }
        });
      }
      
      dataMap[key].uangTitipan += txTitipan;
      dataMap[key].pendapatanKafe += (tx.total - txTitipan);
    });

    let sortedKeys = Object.keys(dataMap).sort();
    const resultData = sortedKeys.map(k => dataMap[k]);
    setChartData(resultData);
  };

  const createEmptyPoint = (label: string, rawDate: string, isCurrent: boolean): ChartDataPoint => ({
    label, rawDate, isCurrent, value: 0, pesanan: 0, qris: 0, cash: 0, pendapatanKafe: 0, uangTitipan: 0, kasMasuk: 0
  });

  const formatCompact = (value: number) => {
    if (value === 0) return '0';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}jt`;
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}rb`;
    return value.toString();
  };

  if (role !== 'manager') return null;

  let displayData = chartData;
  if (!showAllDates) {
    const firstActiveIndex = chartData.findIndex(d => d.value > 0 || d.kasMasuk > 0);
    if (firstActiveIndex !== -1) {
      displayData = chartData.slice(firstActiveIndex);
    } else {
      displayData = chartData.slice(-7); // Default to last 7 days if completely empty
    }
  }

  const maxChartValue = Math.max(...displayData.map(d => Math.max(d.value, d.kasMasuk)), 1);

  const tabs = [
    { id: 'daily', label: 'Harian', icon: <CalendarDays size={16} /> },
    { id: 'weekly', label: 'Mingguan', icon: <CalendarRange size={16} /> },
    { id: 'monthly', label: 'Bulanan', icon: <Calendar size={16} /> },
    { id: 'yearly', label: 'Tahunan', icon: <Clock size={16} /> }
  ] as const;

  const scrollToItem = (id: string) => {
    const el = document.getElementById(`row-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-primary/20', 'border-primary/50');
      setTimeout(() => {
        el.classList.remove('bg-primary/20', 'border-primary/50');
      }, 1500);
    }
  };

  return (
    <MainLayout title="Reports">
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-8 bg-zinc-950 overflow-y-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3 text-white">
            <TrendingUp className="text-primary" /> Reports & Analytics
          </h1>
          <p className="text-zinc-400 text-sm lg:text-base mt-1">Laporan grafik performa dan omzet (Manajer)</p>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-zinc-900/60 p-1.5 rounded-xl inline-flex w-fit mb-6 border border-white/5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  activeTab === tab.id 
                    ? 'bg-zinc-800 text-white shadow-sm border border-white/10' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <Card className="flex-shrink-0 flex flex-col bg-zinc-900/40 border-white/5 overflow-hidden shadow-none mb-8">
            <CardHeader className="border-b border-white/5 pb-4 pt-6 flex flex-row items-center justify-between">
              <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                <BarChart3 className="text-primary" size={20} />
                Grafik Omzet {activeTab === 'daily' ? '30 Hari Terakhir' : activeTab === 'weekly' ? '12 Minggu Terakhir' : activeTab === 'monthly' ? '12 Bulan Terakhir' : '5 Tahun Terakhir'}
              </CardTitle>
              <button 
                onClick={() => setShowAllDates(!showAllDates)}
                className="text-xs font-semibold px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-white/10"
              >
                {showAllDates ? 'Sembunyikan Tanggal Kosong' : 'Lihat Semua Tanggal'}
              </button>
            </CardHeader>
            <div className="p-6 flex flex-col h-[350px] w-full">
              {isLoadingData ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={displayData}
                    margin={{ top: 20, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorYellow" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#E3B24C" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#B98A2E" stopOpacity={1}/>
                      </linearGradient>
                      <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#16a34a" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      stroke="#a1a1aa" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      stroke="#a1a1aa" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `${formatCompact(value)}`}
                      width={60}
                    />
                    <RechartsTooltip 
                      cursor={false}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl text-white min-w-[220px]">
                              <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                                <span className="font-bold text-sm">{data.label}</span>
                                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">{data.pesanan} Trx</span>
                              </div>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between"><span className="text-zinc-400">QRIS</span> <span className="font-medium">Rp {data.qris.toLocaleString('id-ID')}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Cash</span> <span className="font-medium">Rp {data.cash.toLocaleString('id-ID')}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Kafe</span> <span className="font-medium text-emerald-400">Rp {data.pendapatanKafe.toLocaleString('id-ID')}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-400">Titipan</span> <span className="font-medium text-orange-400">Rp {data.uangTitipan.toLocaleString('id-ID')}</span></div>
                                {data.kasMasuk > 0 && <div className="flex justify-between"><span className="text-zinc-400">Kas Masuk</span> <span className="font-medium text-blue-400">+ Rp {data.kasMasuk.toLocaleString('id-ID')}</span></div>}
                              </div>
                              <div className="mt-3 pt-2 border-t border-white/10 flex justify-between items-center">
                                <span className="text-xs font-bold text-zinc-300">Total Omzet</span>
                                <span className="text-primary font-black text-sm">Rp {data.value.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="text-[10px] text-zinc-500 mt-2 text-center">Klik batang grafik untuk ke list</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[6, 6, 0, 0]} 
                      maxBarSize={48}
                      activeBar={<Rectangle fillOpacity={0.8} stroke="#ffffff" strokeWidth={2} />}
                      onClick={(data: any) => {
                        const payload = data?.payload || data;
                        if (payload && payload.rawDate) scrollToItem(payload.rawDate);
                      }}
                      cursor="pointer"
                    >
                      {displayData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isCurrent ? 'url(#colorGreen)' : 'url(#colorYellow)'} 
                          className="transition-all duration-300"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* List Section */}
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-bold text-white mb-4">Rincian Laporan</h2>
            
            {isLoadingData ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : displayData.length === 0 || displayData.every(d => d.value === 0 && d.kasMasuk === 0) ? (
              <div className="p-8 text-center text-zinc-500 text-sm border border-dashed border-white/10 rounded-xl bg-zinc-900/20">
                Belum ada data transaksi.
              </div>
            ) : (
              <div className="space-y-3 pb-20">
                {[...displayData].reverse().map((report, idx) => (
                  <div
                    key={idx}
                    id={`row-${report.rawDate}`}
                    onClick={() => router.push(`/reports/detail/${report.rawDate}`)}
                    className="p-4 md:p-5 bg-zinc-900/40 border border-white/5 rounded-2xl shadow-sm hover:border-primary/50 hover:bg-white/5 transition-all duration-300 cursor-pointer flex flex-col md:flex-row md:items-center gap-4 group"
                  >
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-zinc-100 group-hover:text-primary transition-colors">{report.label}</span>
                        {report.isCurrent && (
                          <span className="bg-primary/20 text-primary px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Terbaru</span>
                        )}
                        <span className="bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-lg text-xs font-semibold ml-auto md:ml-0">
                          {report.pesanan} Trx
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 font-medium">Periode: {report.rawDate}</p>
                    </div>

                    <div className="grid grid-cols-2 md:flex gap-4 md:gap-8 text-sm text-zinc-400">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase font-bold text-zinc-500">QRIS</span>
                        <span className="font-semibold text-zinc-200">Rp {report.qris.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase font-bold text-zinc-500">Cash</span>
                        <span className="font-semibold text-zinc-200">Rp {report.cash.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase font-bold text-zinc-500">Milik Kafe</span>
                        <span className="font-bold text-emerald-400">Rp {report.pendapatanKafe.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase font-bold text-zinc-500">Titipan</span>
                        <span className="font-bold text-orange-400">Rp {report.uangTitipan.toLocaleString('id-ID')}</span>
                      </div>
                      {report.kasMasuk > 0 && (
                        <div className="flex flex-col col-span-2 md:col-span-1 border-t border-white/5 pt-2 md:pt-0 md:border-none gap-0.5">
                          <span className="text-[10px] uppercase font-bold text-zinc-500">Kas Masuk</span>
                          <span className="font-bold text-blue-400">+ Rp {report.kasMasuk.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/5 md:border-none md:pt-0 md:pl-6 md:ml-2 flex items-center justify-between md:flex-col md:items-end md:justify-center">
                      <span className="text-zinc-500 font-bold text-[10px] uppercase tracking-wider md:mb-1">Total Omzet</span>
                      <span className="font-black text-lg text-primary">Rp {report.value.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
