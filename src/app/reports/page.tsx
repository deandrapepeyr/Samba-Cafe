'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CalendarDays, UserSquare2, TrendingUp, AlertCircle, Receipt, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

type DailyReport = {
  date: string;
  rawDate: string;
  totalTransactions: number;
  qrisRevenue: number;
  cashRevenue: number;
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
};

export default function ReportsPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // States for Details Dialog
  const [selectedDailyReport, setSelectedDailyReport] = useState<DailyReport | null>(null);

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
    
    // Fetch Transactions for Daily Report
    const { data: txData } = await supabase
      .from('transactions')
      .select('id, created_at, method, total, status, cashier_name')
      .order('created_at', { ascending: false });

    if (txData) {
      setAllTransactions(txData);
      
      const grouped = txData.reduce((acc: Record<string, DailyReport>, tx) => {
        const dateObj = new Date(tx.created_at);
        const rawDate = dateObj.toISOString().split('T')[0];
        const dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        if (!acc[rawDate]) {
          acc[rawDate] = {
            date: dateStr,
            rawDate: rawDate,
            totalTransactions: 0,
            qrisRevenue: 0,
            cashRevenue: 0,
            totalRevenue: 0
          };
        }
        
        acc[rawDate].totalTransactions += 1;
        acc[rawDate].totalRevenue += tx.total;
        
        if (tx.method === 'QRIS') acc[rawDate].qrisRevenue += tx.total;
        if (tx.method === 'Cash') acc[rawDate].cashRevenue += tx.total;
        
        return acc;
      }, {});

      setDailyReports(Object.values(grouped));
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

  if (role !== 'manager') return null;

  // Filter transactions for the selected date dialog
  const selectedTransactions = selectedDailyReport 
    ? allTransactions.filter(tx => new Date(tx.created_at).toISOString().split('T')[0] === selectedDailyReport.rawDate)
    : [];

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
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
                <CardTitle className="text-lg">Ringkasan Pendapatan Harian</CardTitle>
                <span className="text-xs text-muted-foreground italic">* Klik pada baris untuk melihat detail transaksi</span>
              </CardHeader>
              <ScrollArea className="flex-1">
                <div className="p-0">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10">
                      <tr>
                        <th className="font-medium p-5 pl-8">Tanggal</th>
                        <th className="font-medium p-5 text-center">Total Pesanan</th>
                        <th className="font-medium p-5 text-right">Pendapatan QRIS</th>
                        <th className="font-medium p-5 text-right">Pendapatan Cash</th>
                        <th className="font-bold p-5 text-right pr-8 text-primary">Total Pendapatan</th>
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
                          {dailyReports.map((report, idx) => (
                            <tr 
                              key={idx} 
                              onClick={() => setSelectedDailyReport(report)}
                              className="hover:bg-primary/5 cursor-pointer transition-colors group"
                            >
                              <td className="p-5 pl-8 font-medium group-hover:text-primary transition-colors">{report.date}</td>
                              <td className="p-5 text-center">
                                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
                                  {report.totalTransactions}
                                </span>
                              </td>
                              <td className="p-5 text-right text-muted-foreground group-hover:text-foreground transition-colors">Rp {report.qrisRevenue.toLocaleString('id-ID')}</td>
                              <td className="p-5 text-right text-muted-foreground group-hover:text-foreground transition-colors">Rp {report.cashRevenue.toLocaleString('id-ID')}</td>
                              <td className="p-5 text-right pr-8 font-bold text-lg">Rp {report.totalRevenue.toLocaleString('id-ID')}</td>
                            </tr>
                          ))}
                          {dailyReports.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-12 text-center text-muted-foreground">
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
                <div className="p-0">
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

      {/* Detail Laporan Harian Dialog */}
      <Dialog open={!!selectedDailyReport} onOpenChange={(open) => !open && setSelectedDailyReport(null)}>
        <DialogContent className="bg-card border-border sm:max-w-3xl max-w-[95vw] max-h-[85vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="pb-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2.5 rounded-xl text-primary">
                <Receipt size={24} />
              </div>
              <div>
                <DialogTitle className="text-xl">Detail Transaksi Harian</DialogTitle>
                <DialogDescription className="text-base">{selectedDailyReport?.date}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 shrink-0">
            <div className="bg-muted/50 p-4 rounded-xl text-center">
              <p className="text-muted-foreground text-sm font-medium mb-1">Total Pesanan</p>
              <p className="text-2xl font-bold">{selectedDailyReport?.totalTransactions}</p>
            </div>
            <div className="bg-blue-500/10 p-4 rounded-xl text-center border border-blue-500/20">
              <p className="text-blue-500 text-sm font-medium mb-1">QRIS</p>
              <p className="text-2xl font-bold text-blue-500">Rp {selectedDailyReport?.qrisRevenue.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-green-500/10 p-4 rounded-xl text-center border border-green-500/20">
              <p className="text-green-500 text-sm font-medium mb-1">Cash</p>
              <p className="text-2xl font-bold text-green-500">Rp {selectedDailyReport?.cashRevenue.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <Separator className="bg-border shrink-0" />

          <div className="flex-1 mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-border pr-2 min-h-0">
            <div className="space-y-3">
              {selectedTransactions.map(tx => {
                const txTime = new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-sm border border-border shadow-sm">
                        {txTime}
                      </div>
                      <div>
                        <p className="font-bold text-base">Order #{tx.id}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Kasir: {tx.cashier_name || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-bold text-xl text-foreground">Rp {tx.total.toLocaleString('id-ID')}</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 ${
                        tx.method === 'QRIS' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/20' : 'bg-green-500/20 text-green-500 border border-green-500/20'
                      }`}>
                        {tx.method}
                      </span>
                    </div>
                  </div>
                );
              })}
              {selectedTransactions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Tidak ada transaksi.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
