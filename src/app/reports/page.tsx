'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CalendarDays, UserSquare2, TrendingUp, AlertCircle, Receipt, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { DateFilter, DateFilterValue } from '@/components/ui/DateFilter';

type DailyReport = {
  date: string;
  rawDate: string;
  totalTransactions: number;
  qrisRevenue: number;
  cashRevenue: number;
  titipanRevenue: number;
  titipanBreakdown: Record<string, number>;
  regularRevenue: number;
  totalRevenue: number;
};

type ShiftReport = {
  id: string;
  cashierName: string;
  date: string;
  timeRange: string;
  startingCash: number;
  expectedRevenue: number | null;
  actualRevenue: number | null;
  difference: number | null;
  status: string;
};

type Transaction = {
  id: string;
  created_at: string;
  method: string;
  total: number;
  status: string;
  cashier_name: string;
  transaction_items?: { product_name: string; price: number; quantity: number }[];
};

export default function ReportsPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    mode: 'month',
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [titipanProductNames, setTitipanProductNames] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!isLoading && role !== 'manager') {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  useEffect(() => {
    if (role === 'manager') {
      fetchReports();
    }
  }, [role]);

  const fetchReports = async () => {
    setIsLoadingData(true);
    
    const productsRes = await supabase.from('products').select('*'); // fetch all products even unavailable ones
    
    if (productsRes.data) {
      const titipanMap = new Map<string, string | null>();
      productsRes.data.forEach(p => {
        if (p.is_titipan) {
          titipanMap.set(p.name, p.titipan_name);
        }
      });
      setTitipanProductNames(titipanMap);
    }
    
    // Fetch Transactions for Daily Report
    const { data: txData } = await supabase
      .from('transactions')
      .select('id, created_at, method, total, status, cashier_name, transaction_items(product_name, price, quantity)')
      .order('created_at', { ascending: false });

    if (txData) {
      setAllTransactions(txData);
    }
    
    // Fetch Shifts for Shift Report
    const { data: shiftData } = await supabase
      .from('shifts')
      .select('*')
      .order('start_time', { ascending: false });
      
    if (shiftData) {
      const formattedShifts: ShiftReport[] = shiftData.map(s => {
        const startDate = new Date(s.start_time);
        const endDate = s.end_time ? new Date(s.end_time) : null;
        const dateStr = startDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
        const timeRange = `${startDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} - ${endDate ? endDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : 'Active'}`;
        
        const expectedRevenue = s.expected_cash !== null ? s.expected_cash - s.starting_cash : null;
        const actualRevenue = s.ending_cash !== null ? s.ending_cash - s.starting_cash : null;
        
        const diff = s.ending_cash !== null && s.expected_cash !== null 
          ? s.ending_cash - s.expected_cash 
          : null;

        return {
          id: s.id,
          cashierName: s.cashier_name,
          date: dateStr,
          timeRange,
          startingCash: s.starting_cash,
          expectedRevenue,
          actualRevenue,
          difference: diff,
          status: s.status
        };
      });
      setShiftReports(formattedShifts);
    }
    
    setIsLoadingData(false);
  };

  useEffect(() => {
    if (allTransactions.length > 0) {
      const grouped = allTransactions.reduce((acc: Record<string, DailyReport>, tx) => {
        const dateObj = new Date(tx.created_at);
        let groupKey = '';
        let dateStr = '';
        let rawDate = '';
        
        let shouldInclude = true;
        // Filter based on selected dateFilter
        if (dateFilter.mode === 'date' && dateFilter.date) {
           const txDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
           const filterDateStr = `${dateFilter.date.getFullYear()}-${String(dateFilter.date.getMonth() + 1).padStart(2, '0')}-${String(dateFilter.date.getDate()).padStart(2, '0')}`;
           if (txDateStr !== filterDateStr) shouldInclude = false;
        } else if (dateFilter.mode === 'month') {
           if (dateObj.getMonth() !== dateFilter.month || dateObj.getFullYear() !== dateFilter.year) shouldInclude = false;
        } else if (dateFilter.mode === 'year') {
           if (dateObj.getFullYear() !== dateFilter.year) shouldInclude = false;
        }

        if (!shouldInclude) return acc;
        
        // Grouping based on filter mode
        if (dateFilter.mode === 'date' || dateFilter.mode === 'month') {
          // group by day
          rawDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
          groupKey = rawDate;
          dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } else if (dateFilter.mode === 'year') {
          // group by month
          groupKey = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
          rawDate = groupKey;
          dateStr = dateObj.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
        } else if (dateFilter.mode === 'all') {
          // group by year
          groupKey = `${dateObj.getFullYear()}`;
          rawDate = groupKey;
          dateStr = `${dateObj.getFullYear()}`;
        }
        
        if (!acc[groupKey]) {
          acc[groupKey] = {
            date: dateStr,
            rawDate: rawDate,
            totalTransactions: 0,
            qrisRevenue: 0,
            cashRevenue: 0,
            titipanRevenue: 0,
            titipanBreakdown: {},
            regularRevenue: 0,
            totalRevenue: 0
          };
        }
        
        acc[groupKey].totalTransactions += 1;
        acc[groupKey].totalRevenue += tx.total;
        
        if (tx.method === 'QRIS') acc[groupKey].qrisRevenue += tx.total;
        if (tx.method === 'Cash') acc[groupKey].cashRevenue += tx.total;
        
        let txTitipan = 0;
        if (tx.transaction_items) {
          tx.transaction_items.forEach(item => {
            if (titipanProductNames.has(item.product_name)) {
              const itemTotal = item.price * item.quantity;
              txTitipan += itemTotal;
              
              const titipanName = titipanProductNames.get(item.product_name) || 'Tanpa Nama';
              if (!acc[groupKey].titipanBreakdown[titipanName]) {
                acc[groupKey].titipanBreakdown[titipanName] = 0;
              }
              acc[groupKey].titipanBreakdown[titipanName] += itemTotal;
            }
          });
        }
        acc[groupKey].titipanRevenue += txTitipan;
        acc[groupKey].regularRevenue += (tx.total - txTitipan);
        
        return acc;
      }, {});
      
      const sortedReports = Object.values(grouped).sort((a, b) => b.rawDate.localeCompare(a.rawDate));
      setDailyReports(sortedReports);
    } else {
      setDailyReports([]);
    }
  }, [allTransactions, dateFilter, titipanProductNames]);

  if (role !== 'manager') return null;

  return (
    <MainLayout title="Reports">
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="text-primary" /> Reports & Analytics
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base mt-1">Laporan harian dan performa kasir (Manajer)</p>
        </div>

        <Tabs defaultValue="daily" className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-muted inline-flex mb-6 w-fit h-12 p-1 rounded-xl">
            <TabsTrigger value="daily" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-6 flex items-center gap-2">
              <CalendarDays size={18} /> Daily Revenue
            </TabsTrigger>
            <TabsTrigger value="shifts" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-6 flex items-center gap-2">
              <UserSquare2 size={18} /> Shift Performance
            </TabsTrigger>
          </TabsList>

          {/* DAILY REPORTS TAB */}
          <TabsContent value="daily" className="flex-1 m-0 data-[state=active]:flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden shadow-sm">
              <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Ringkasan Pendapatan Harian</CardTitle>
                  <span className="text-xs text-muted-foreground italic">* Klik pada baris untuk melihat detail transaksi</span>
                </div>
                <div className="z-50">
                  <DateFilter
                    value={dateFilter}
                    onChange={setDateFilter}
                    align="right"
                  />
                </div>
              </CardHeader>
              <ScrollArea className="flex-1">
                {/* Mobile Card List View */}
                <div className="md:hidden space-y-3 p-4">
                  {isLoadingData ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    </div>
                  ) : dailyReports.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                      Belum ada data transaksi.
                    </div>
                  ) : (
                    dailyReports.map((report, idx) => (
                      <div
                        key={idx}
                        onClick={() => router.push(`/reports/detail/${report.rawDate}`)}
                        className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary/50 transition-all cursor-pointer space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                          <span className="font-bold text-foreground">{report.date}</span>
                          <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold">
                            {report.totalTransactions} Pesanan
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground/70">QRIS</p>
                            <p className="font-medium text-foreground mt-0.5">Rp {report.qrisRevenue.toLocaleString('id-ID')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground/70">Cash</p>
                            <p className="font-medium text-foreground mt-0.5">Rp {report.cashRevenue.toLocaleString('id-ID')}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-2">
                          <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                            <p className="text-[10px] uppercase font-semibold text-emerald-500">Pendapatan Kafe</p>
                            <p className="font-bold text-emerald-400 mt-0.5">Rp {report.regularRevenue.toLocaleString('id-ID')}</p>
                          </div>
                          <div className="bg-orange-500/10 p-2 rounded border border-orange-500/20 flex flex-col justify-between">
                            <div>
                              <p className="text-[10px] uppercase font-semibold text-orange-500">Uang Titipan</p>
                              <p className="font-bold text-orange-400 mt-0.5">Rp {report.titipanRevenue.toLocaleString('id-ID')}</p>
                            </div>
                            <span className="text-[9px] text-orange-500/60 mt-1">Ketuk untuk detail</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-border/40 text-xs">
                          <span className="text-muted-foreground font-medium">Total Omzet:</span>
                          <span className="font-bold text-sm text-primary">Rp {report.totalRevenue.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block p-0">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
                      <tr>
                        <th className="font-medium p-5 pl-8">Tanggal</th>
                        <th className="font-medium p-5 text-center">Total Pesanan</th>
                        <th className="font-medium p-5 text-right">QRIS</th>
                        <th className="font-medium p-5 text-right">Tunai</th>
                        <th className="font-semibold p-5 text-right text-emerald-500">Pendapatan Kafe</th>
                        <th className="font-semibold p-5 text-right text-orange-400">Uang Titipan</th>
                        <th className="font-bold p-5 text-right pr-8 text-primary">Total Omzet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                          </td>
                        </tr>
                      ) : (
                        <>
                          {dailyReports.map((report, idx) => (
                            <tr 
                              key={idx} 
                              onClick={() => router.push(`/reports/detail/${report.rawDate}`)}
                              className="hover:bg-primary/5 cursor-pointer transition-colors group"
                            >
                              <td className="p-5 pl-8 font-medium group-hover:text-primary transition-colors">{report.date}</td>
                              <td className="p-5 text-center">
                                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
                                  {report.totalTransactions}
                                </span>
                              </td>
                              <td className="p-5 text-right font-medium text-muted-foreground">Rp {report.qrisRevenue.toLocaleString('id-ID')}</td>
                              <td className="p-5 text-right font-medium text-muted-foreground">Rp {report.cashRevenue.toLocaleString('id-ID')}</td>
                              <td className="p-5 text-right font-medium text-emerald-400">Rp {report.regularRevenue.toLocaleString('id-ID')}</td>
                              <td className="p-5 text-right font-medium text-orange-400">Rp {report.titipanRevenue.toLocaleString('id-ID')}</td>
                              <td className="p-5 text-right pr-8 font-bold text-lg text-primary">Rp {report.totalRevenue.toLocaleString('id-ID')}</td>
                            </tr>
                          ))}
                          {dailyReports.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-12 text-center text-muted-foreground">
                                Belum ada data transaksi.
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          {/* SHIFT REPORTS TAB */}
          <TabsContent value="shifts" className="flex-1 m-0 data-[state=active]:flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden shadow-sm">
              <CardHeader className="bg-muted/30 border-b border-border pb-4 pt-6">
                <CardTitle className="text-lg">Laporan Setoran Kasir (Shift)</CardTitle>
              </CardHeader>
              <ScrollArea className="flex-1">
                {/* Mobile Card List View for Shifts */}
                <div className="md:hidden space-y-3 p-4">
                  {isLoadingData ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                    </div>
                  ) : shiftReports.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                      Belum ada data shift kasir.
                    </div>
                  ) : (
                    shiftReports.map((shift) => (
                      <div key={shift.id} className="p-4 bg-card border border-border rounded-xl shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2 font-bold text-foreground">
                            <UserSquare2 className="text-muted-foreground" size={18} />
                            <span>{shift.cashierName}</span>
                          </div>
                          {shift.status === 'active' ? (
                            <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">Aktif</span>
                          ) : (
                            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">Shift Selesai</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground/70">Waktu & Jam</p>
                            <p className="font-medium text-foreground mt-0.5">{shift.date} • {shift.timeRange}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground/70">Modal Awal</p>
                            <p className="font-medium text-foreground mt-0.5">Rp {shift.startingCash.toLocaleString('id-ID')}</p>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-border/40 text-xs">
                          <span className="text-muted-foreground font-medium">Setoran Fisik:</span>
                          <span className="font-bold text-foreground">{shift.actualRevenue !== null ? `Rp ${shift.actualRevenue.toLocaleString('id-ID')}` : '-'}</span>
                        </div>

                        {shift.difference !== null && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground font-medium">Selisih:</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              shift.difference < 0 
                                ? "bg-destructive/10 text-destructive border border-destructive/20" 
                                : shift.difference > 0 
                                  ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                                  : "bg-muted text-muted-foreground"
                            }`}>
                              {shift.difference > 0 ? '+' : ''}Rp {shift.difference.toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block p-0">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                      <tr>
                        <th className="font-medium p-5 pl-8">Nama Kasir</th>
                        <th className="font-medium p-5">Tanggal & Waktu</th>
                        <th className="font-medium p-5 text-right">Modal Awal</th>
                        <th className="font-medium p-5 text-right">Ekspektasi (Sistem)</th>
                        <th className="font-medium p-5 text-right">Setoran Fisik (Hasil)</th>
                        <th className="font-bold p-5 text-right pr-8">Status Selisih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                          </td>
                        </tr>
                      ) : (
                        <>
                          {shiftReports.map((shift) => (
                            <tr key={shift.id} className="hover:bg-muted/50 transition-colors">
                              <td className="p-5 pl-8 font-bold flex items-center gap-2">
                                <UserSquare2 className="text-muted-foreground" size={18} />
                                {shift.cashierName}
                                {shift.status === 'active' && (
                                  <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">Aktif</span>
                                )}
                              </td>
                              <td className="p-5 text-muted-foreground">
                                {shift.date} <span className="mx-2">•</span> {shift.timeRange}
                              </td>
                              <td className="p-5 text-right text-muted-foreground">Rp {shift.startingCash.toLocaleString('id-ID')}</td>
                              <td className="p-5 text-right text-muted-foreground">
                                {shift.expectedRevenue !== null ? `Rp ${shift.expectedRevenue.toLocaleString('id-ID')}` : '-'}
                              </td>
                              <td className="p-5 text-right font-medium">
                                {shift.actualRevenue !== null ? `Rp ${shift.actualRevenue.toLocaleString('id-ID')}` : '-'}
                              </td>
                              <td className="p-5 text-right pr-8">
                                {shift.difference !== null ? (
                                  <div className="flex justify-end">
                                    <span className={`px-3 py-1 rounded-full font-bold flex items-center gap-1 ${
                                      shift.difference < 0 
                                        ? "bg-destructive/10 text-destructive border border-destructive/20" 
                                        : shift.difference > 0 
                                          ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                                          : "bg-muted text-muted-foreground"
                                    }`}>
                                      {shift.difference < 0 && <AlertCircle size={14} />}
                                      {shift.difference > 0 ? '+' : ''}Rp {shift.difference.toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground italic">Belum Tutup Shift</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {shiftReports.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-12 text-center text-muted-foreground">
                                Belum ada data shift kasir.
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
