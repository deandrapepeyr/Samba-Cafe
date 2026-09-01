'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Receipt, Loader2, Calendar, DollarSign, Package, Clock, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type Transaction = {
  id: string;
  date: string;
  rawDate: string;
  method: string;
  total: number;
  cashier_name: string;
  itemsCount: number;
  status: string;
  cash_received?: number;
  itemsDetail: {
    name: string;
    price: number;
    qty: number;
    notes?: string;
  }[];
};

type Shift = {
  id: string;
  cashier_name: string;
  start_time: string;
  end_time: string | null;
  starting_cash: number;
  ending_cash: number | null;
  expected_cash: number | null;
  status: string;
};

type CashierGroup = {
  cashier_name: string;
  hasActiveShift: boolean;
  activeShift: Shift | null;
  latestShift: Shift;
  allShifts: Shift[];
  totalShiftsCount: number;
  totalRevenue: number;
  totalOrders: number;
};

export default function HistoryPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!isLoading && !role) {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  useEffect(() => {
    if (role) {
      fetchData();
    }
  }, [role]);

  const fetchData = async () => {
    setIsLoadingData(true);
    
    // Fetch transactions
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (txData && txData.length > 0) {
      const txIds = txData.map(t => t.id);
      
      const { data: itemsData } = await supabase
        .from('transaction_items')
        .select('*')
        .in('transaction_id', txIds);

      const formattedTxs: Transaction[] = txData.map(tx => {
        const items = itemsData ? itemsData.filter(i => i.transaction_id === tx.id) : [];
        
        const dateObj = new Date(tx.created_at);
        const dateStr = dateObj.toLocaleString('id-ID', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(/\./g, ':');

        return {
          id: tx.id,
          date: dateStr,
          rawDate: `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`,
          method: tx.method,
          total: tx.total,
          cashier_name: tx.cashier_name,
          cash_received: tx.cash_received,
          itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
          status: tx.status,
          itemsDetail: items.map(item => ({
            name: item.product_name,
            price: item.price,
            qty: item.quantity,
            notes: item.notes
          }))
        };
      });

      setTransactions(formattedTxs);
    } else {
      setTransactions([]);
    }
    
    // Fetch Shifts
    if (role === 'manager') {
      const { data: shiftData } = await supabase
        .from('shifts')
        .select('*')
        .order('start_time', { ascending: false });
        
      if (shiftData) setShifts(shiftData);
    }
    
    setIsLoadingData(false);
  };

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog state
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedCashierGroup, setSelectedCashierGroup] = useState<CashierGroup | null>(null);

  if (!role) return null;

  const filters = ['All', 'QRIS', 'Cash'];

  const filteredTransactions = transactions.filter(trx => {
    const matchesFilter = activeFilter === 'All' || trx.method === activeFilter;
    const matchesSearch = trx.id.includes(searchQuery);
    const matchesDate = !filterDate || trx.rawDate === filterDate;
    return matchesFilter && matchesSearch && matchesDate;
  });
  
  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  const filteredShifts = shifts.filter(shift => {
    const d = new Date(shift.start_time);
    const shiftDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isShiftActiveToday = shift.status === 'active' && filterDate === todayStr;
    return !filterDate || shiftDate === filterDate || isShiftActiveToday;
  });

  // Group shifts by Cashier and sort active ones to the top
  const cashierGroupsMap = new Map<string, Shift[]>();

  filteredShifts.forEach(shift => {
    const key = shift.cashier_name || 'Unknown Cashier';
    if (!cashierGroupsMap.has(key)) {
      cashierGroupsMap.set(key, []);
    }
    cashierGroupsMap.get(key)!.push(shift);
  });

  const groupedCashiers: CashierGroup[] = Array.from(cashierGroupsMap.entries()).map(([cashier_name, cashierShifts]) => {
    const sortedShifts = [...cashierShifts].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
    const activeShift = sortedShifts.find(s => s.status === 'active') || null;
    const latestShift = sortedShifts[0];

    const cashierTxs = filteredTransactions.filter(t => (t.cashier_name || '').toLowerCase() === cashier_name.toLowerCase());
    const totalRevenue = cashierTxs.reduce((sum, t) => sum + t.total, 0);
    const totalOrders = cashierTxs.length;

    return {
      cashier_name,
      hasActiveShift: !!activeShift,
      activeShift,
      latestShift,
      allShifts: sortedShifts,
      totalShiftsCount: sortedShifts.length,
      totalRevenue,
      totalOrders,
    };
  });

  // Active cashier stays at the top of the list!
  groupedCashiers.sort((a, b) => {
    if (a.hasActiveShift && !b.hasActiveShift) return -1;
    if (!a.hasActiveShift && b.hasActiveShift) return 1;
    
    const timeA = new Date(a.latestShift.start_time).getTime();
    const timeB = new Date(b.latestShift.start_time).getTime();
    return timeB - timeA;
  });

  // Calculate Summary
  const summaryRevenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
  const summaryOrders = filteredTransactions.length;

  return (
    <MainLayout title="History">
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Transaction History</h1>
            <p className="text-muted-foreground text-sm lg:text-base">View and filter past transactions & shifts</p>
          </div>
          
          <div className="flex items-center gap-2 bg-card border border-border p-2 rounded-lg">
            <Calendar size={18} className="text-muted-foreground ml-2" />
            <input 
              type="date" 
              className="bg-transparent border-none outline-none text-sm font-medium mr-2"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            {filterDate && (
              <button 
                onClick={() => setFilterDate('')}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-muted"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-primary">Daily Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">Rp {summaryRevenue.toLocaleString('id-ID')}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryOrders}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-muted">
              <TabsTrigger value="transactions" className="data-[state=active]:bg-background">Transactions</TabsTrigger>
              {role === 'manager' && (
                <TabsTrigger value="shifts" className="data-[state=active]:bg-background">Cashier Shifts</TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="transactions" className="flex-1 m-0 data-[state=active]:flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-6">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full md:w-auto">
                  {filters.map(filter => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                        activeFilter === filter 
                          ? 'bg-primary text-primary-foreground shadow-sm' 
                          : 'bg-background text-muted-foreground hover:bg-muted border border-border'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input 
                    className="pl-9 bg-background border-border"
                    placeholder="Search Order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              
              <ScrollArea className="flex-1">
                {/* Mobile Card List View (Visible on Mobile) */}
                <div className="md:hidden space-y-3 p-4">
                  {isLoadingData ? (
                    <div className="py-12 text-center text-muted-foreground space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                      <p className="text-xs">Memuat riwayat transaksi...</p>
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                      No transactions found.
                    </div>
                  ) : (
                    filteredTransactions.map((trx) => {
                      const normSt = (trx.status || 'preparing').toLowerCase();
                      const isPrep = normSt === 'preparing' || normSt === 'paid';
                      const isReady = normSt === 'ready';

                      return (
                        <div
                          key={trx.id}
                          onClick={() => setSelectedTx(trx)}
                          className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary/50 transition-all cursor-pointer space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                            <div className="flex items-center gap-2 font-bold text-foreground">
                              <Receipt size={16} className="text-primary" />
                              <span>#{trx.id}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                trx.method === 'QRIS' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'
                              }`}>
                                {trx.method}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                isPrep ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                                isReady ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                'bg-muted text-muted-foreground border-border'
                              }`}>
                                {isPrep ? '⏳ Sedang Dibuat' : isReady ? '🔔 Siap' : '✅ Selesai'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>
                              <p className="text-[10px] uppercase font-semibold text-muted-foreground/70">Waktu & Tanggal</p>
                              <p className="font-medium text-foreground mt-0.5">{trx.date}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-semibold text-muted-foreground/70">Kasir</p>
                              <p className="font-medium text-foreground mt-0.5 truncate">{trx.cashier_name || 'Unknown'}</p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-border/40 text-xs">
                            <span className="text-muted-foreground font-medium">{trx.itemsCount} item pesanan</span>
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-sm text-primary">Rp {trx.total.toLocaleString('id-ID')}</span>
                              <span className="text-muted-foreground text-xs">➔</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View (Hidden on Mobile) */}
                <div className="hidden md:block p-0">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                      <tr>
                        <th className="font-medium p-4 pl-6">Order ID</th>
                        <th className="font-medium p-4">Date & Time</th>
                        <th className="font-medium p-4">Cashier</th>
                        <th className="font-medium p-4">Items</th>
                        <th className="font-medium p-4">Payment Method</th>
                        <th className="font-medium p-4">Status Pesanan</th>
                        <th className="font-medium p-4 text-right pr-6">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-4">
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                              <p>Memuat riwayat transaksi...</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <>
                          {filteredTransactions.map((trx) => {
                            const normSt = (trx.status || 'preparing').toLowerCase();
                            const isPrep = normSt === 'preparing' || normSt === 'paid';
                            const isReady = normSt === 'ready';

                            return (
                              <tr 
                                key={trx.id} 
                                onClick={() => setSelectedTx(trx)}
                                className="hover:bg-muted/50 transition-colors cursor-pointer group"
                              >
                                <td className="p-4 pl-6 font-medium flex items-center gap-2 group-hover:text-primary transition-colors">
                                  <Receipt size={16} className="text-primary" />
                                  #{trx.id}
                                </td>
                                <td className="p-4 text-muted-foreground">{trx.date}</td>
                                <td className="p-4 text-muted-foreground">{trx.cashier_name || 'Unknown'}</td>
                                <td className="p-4">{trx.itemsCount} items</td>
                                <td className="p-4">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                    trx.method === 'QRIS' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'
                                  }`}>
                                    {trx.method}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                    isPrep ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                                    isReady ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    'bg-muted text-muted-foreground border-border'
                                  }`}>
                                    {isPrep ? '⏳ Sedang Dibuat' : isReady ? '🔔 Siap' : '✅ Selesai'}
                                  </span>
                                </td>
                                <td className="p-4 text-right pr-6 font-bold">
                                  Rp {trx.total.toLocaleString('id-ID')}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredTransactions.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                No transactions found.
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

          {role === 'manager' && (
            <TabsContent value="shifts" className="flex-1 m-0 data-[state=active]:flex flex-col min-h-0">
              <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
                <ScrollArea className="flex-1">
                  {/* Mobile Card List View for Shifts */}
                  <div className="md:hidden space-y-3 p-4">
                    {isLoadingData ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                      </div>
                    ) : groupedCashiers.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                        No cashiers recorded for this date.
                      </div>
                    ) : (
                      groupedCashiers.map((cg) => {
                        const startDate = new Date(cg.latestShift.start_time);
                        const endDate = cg.latestShift.end_time ? new Date(cg.latestShift.end_time) : null;
                        const timeStr = `${startDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} - ${endDate ? endDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : 'Active'}`;

                        return (
                          <div
                            key={cg.cashier_name}
                            onClick={() => setSelectedCashierGroup(cg)}
                            className="p-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary/50 transition-all cursor-pointer space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                  {cg.cashier_name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-bold text-foreground">{cg.cashier_name}</span>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                cg.hasActiveShift 
                                  ? 'bg-green-500/10 text-green-500 border-green-500/30' 
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}>
                                {cg.hasActiveShift && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                                {cg.hasActiveShift ? 'Active Shift' : 'Shift Ended'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-[10px] text-muted-foreground/70 font-semibold uppercase">Jam Shift</p>
                                <p className="font-medium text-foreground mt-0.5">{timeStr}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground/70 font-semibold uppercase">Shift Terekam</p>
                                <p className="font-medium text-foreground mt-0.5">{cg.totalShiftsCount} shift</p>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-border/40 text-xs">
                              <span className="text-muted-foreground">Total Penjualan:</span>
                              <span className="font-bold text-sm text-foreground">Rp {cg.totalRevenue.toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Desktop Table View for Shifts */}
                  <div className="hidden md:block p-0">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                        <tr>
                          <th className="font-medium p-4 pl-6">Cashier</th>
                          <th className="font-medium p-4">Status</th>
                          <th className="font-medium p-4">Latest Shift Time</th>
                          <th className="font-medium p-4">Shifts Recorded</th>
                          <th className="font-medium p-4">Sales Revenue</th>
                          <th className="font-medium p-4 text-right pr-6">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {isLoadingData ? (
                          <tr>
                            <td colSpan={6} className="p-12 text-center text-muted-foreground">
                              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                            </td>
                          </tr>
                        ) : (
                          <>
                            {groupedCashiers.map((cg) => {
                              const startDate = new Date(cg.latestShift.start_time);
                              const endDate = cg.latestShift.end_time ? new Date(cg.latestShift.end_time) : null;
                              const timeStr = `${startDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} - ${endDate ? endDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : 'Active'}`;

                              return (
                                <tr 
                                  key={cg.cashier_name} 
                                  onClick={() => setSelectedCashierGroup(cg)}
                                  className="hover:bg-muted/50 transition-colors cursor-pointer group"
                                >
                                  <td className="p-4 pl-6 font-medium">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                                        {cg.cashier_name.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="font-semibold group-hover:text-primary transition-colors">
                                        {cg.cashier_name}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                      cg.hasActiveShift 
                                        ? 'bg-green-500/10 text-green-500 border-green-500/30' 
                                        : 'bg-muted text-muted-foreground border-border'
                                    }`}>
                                      {cg.hasActiveShift && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                                      {cg.hasActiveShift ? 'Active Shift' : 'Shift Ended'}
                                    </span>
                                  </td>
                                  <td className="p-4 text-muted-foreground">{timeStr}</td>
                                  <td className="p-4 text-muted-foreground">{cg.totalShiftsCount} shift{cg.totalShiftsCount > 1 ? 's' : ''}</td>
                                  <td className="p-4 font-bold text-foreground">
                                    Rp {cg.totalRevenue.toLocaleString('id-ID')}
                                  </td>
                                  <td className="p-4 text-right pr-6">
                                    <button className="text-xs px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-all">
                                      View Details
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            {groupedCashiers.length === 0 && (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                  No cashiers recorded for this date.
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
          )}
        </Tabs>
      </div>

      {/* Transaction Details Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          {selectedTx && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="bg-primary/20 p-2 rounded-full text-primary">
                    <Receipt size={24} />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">Order #{selectedTx.id}</DialogTitle>
                    <DialogDescription>{selectedTx.date} • Kasir: {selectedTx.cashier_name || 'Unknown'}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="py-4 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Payment Method</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    selectedTx.method === 'QRIS' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'
                  }`}>
                    {selectedTx.method}
                  </span>
                </div>
                
                <Separator className="bg-border" />
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Order Items</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
                    {selectedTx.itemsDetail.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start text-sm">
                        <div className="flex gap-2">
                          <span className="font-medium text-muted-foreground">{item.qty}x</span>
                          <div>
                            <span>{item.name}</span>
                            {item.notes && <p className="text-xs text-primary italic mt-0.5">Note: {item.notes}</p>}
                          </div>
                        </div>
                        <span className="font-medium">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-border" />

                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">Rp {selectedTx.total.toLocaleString('id-ID')}</span>
                </div>

                {selectedTx.method === 'Cash' && selectedTx.cash_received && (
                  <div className="pt-2 border-t border-dashed border-border space-y-1">
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>Tunai Diterima</span>
                      <span>Rp {selectedTx.cash_received.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>Kembalian</span>
                      <span>Rp {(selectedTx.cash_received - selectedTx.total).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cashier Shift Details Dialog */}
      <Dialog open={!!selectedCashierGroup} onOpenChange={(open) => !open && setSelectedCashierGroup(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[550px] max-h-[85vh] flex flex-col">
          {selectedCashierGroup && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-lg">
                    {selectedCashierGroup.cashier_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <DialogTitle className="text-xl flex items-center gap-2">
                      {selectedCashierGroup.cashier_name}
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                        selectedCashierGroup.hasActiveShift 
                          ? 'bg-green-500/10 text-green-500 border-green-500/30' 
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {selectedCashierGroup.hasActiveShift ? 'Active Shift' : 'Shift Ended'}
                      </span>
                    </DialogTitle>
                    <DialogDescription>Detailed Shift History & Cashier Performance</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                  <p className="text-lg font-bold text-primary">Rp {selectedCashierGroup.totalRevenue.toLocaleString('id-ID')}</p>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                  <p className="text-lg font-bold">{selectedCashierGroup.totalOrders} orders</p>
                </div>
              </div>

              <Separator className="bg-border" />

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                <h4 className="font-semibold text-sm">Shift Records ({selectedCashierGroup.allShifts.length})</h4>
                <div className="space-y-3">
                  {selectedCashierGroup.allShifts.map((shift, idx) => {
                    const startDate = new Date(shift.start_time);
                    const endDate = shift.end_time ? new Date(shift.end_time) : null;
                    const timeStr = `${startDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} - ${endDate ? endDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : 'Active'}`;
                    
                    const diff = shift.ending_cash !== null && shift.expected_cash !== null 
                      ? shift.ending_cash - shift.expected_cash 
                      : null;

                    return (
                      <div key={shift.id || idx} className="p-3.5 rounded-lg bg-muted/30 border border-border space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Clock size={14} className="text-primary" />
                            {timeStr}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            shift.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'
                          }`}>
                            {shift.status === 'active' ? 'ACTIVE SHIFT' : 'ENDED'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-border/50">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Starting Cash</span>
                            <span className="font-medium">Rp {shift.starting_cash.toLocaleString('id-ID')}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Actual Cash</span>
                            <span className="font-medium">{shift.ending_cash !== null ? `Rp ${shift.ending_cash.toLocaleString('id-ID')}` : '-'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Difference</span>
                            <span className="font-bold">
                              {diff !== null ? (
                                <span className={diff < 0 ? "text-destructive" : diff > 0 ? "text-green-500" : "text-muted-foreground"}>
                                  {diff > 0 ? '+' : ''}Rp {diff.toLocaleString('id-ID')}
                                </span>
                              ) : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
