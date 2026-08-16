'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Receipt, Loader2, Calendar, DollarSign, Package } from 'lucide-react';
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

export default function HistoryPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!isLoading && !role) {
      router.replace('/login');
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
          rawDate: dateObj.toISOString().split('T')[0],
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

  if (!role) return null;

  const filters = ['All', 'QRIS', 'Cash'];

  const filteredTransactions = transactions.filter(trx => {
    const matchesFilter = activeFilter === 'All' || trx.method === activeFilter;
    const matchesSearch = trx.id.includes(searchQuery);
    const matchesDate = !filterDate || trx.rawDate === filterDate;
    return matchesFilter && matchesSearch && matchesDate;
  });
  
  const filteredShifts = shifts.filter(shift => {
    const shiftDate = new Date(shift.start_time).toISOString().split('T')[0];
    return !filterDate || shiftDate === filterDate;
  });

  // Calculate Summary
  const summaryRevenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
  const summaryOrders = filteredTransactions.length;

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
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
                <TabsTrigger value="shifts" className="data-[state=active]:bg-background">Shifts History</TabsTrigger>
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
                <div className="p-0">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                      <tr>
                        <th className="font-medium p-4 pl-6">Order ID</th>
                        <th className="font-medium p-4">Date & Time</th>
                        <th className="font-medium p-4">Cashier</th>
                        <th className="font-medium p-4">Items</th>
                        <th className="font-medium p-4">Payment Method</th>
                        <th className="font-medium p-4 text-right pr-6">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-4">
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                              <p>Memuat riwayat transaksi...</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <>
                          {filteredTransactions.map((trx) => (
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
                              <td className="p-4 text-right pr-6 font-bold">
                                Rp {trx.total.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))}
                          {filteredTransactions.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-muted-foreground">
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
                  <div className="p-0">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                        <tr>
                          <th className="font-medium p-4 pl-6">Cashier</th>
                          <th className="font-medium p-4">Time (Start - End)</th>
                          <th className="font-medium p-4">Starting Cash</th>
                          <th className="font-medium p-4">Expected Cash</th>
                          <th className="font-medium p-4">Actual Cash</th>
                          <th className="font-medium p-4 text-right pr-6">Difference</th>
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
                            {filteredShifts.map((shift) => {
                              const diff = shift.ending_cash !== null && shift.expected_cash !== null 
                                ? shift.ending_cash - shift.expected_cash 
                                : null;
                              
                              const startDate = new Date(shift.start_time);
                              const endDate = shift.end_time ? new Date(shift.end_time) : null;
                              const timeStr = `${startDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} - ${endDate ? endDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : 'Active'}`;

                              return (
                                <tr key={shift.id} className="hover:bg-muted/50 transition-colors">
                                  <td className="p-4 pl-6 font-medium">
                                    <div className="flex items-center gap-2">
                                      {shift.cashier_name}
                                      {shift.status === 'active' && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Active Shift" />}
                                    </div>
                                  </td>
                                  <td className="p-4 text-muted-foreground">{timeStr}</td>
                                  <td className="p-4 text-muted-foreground">Rp {shift.starting_cash.toLocaleString('id-ID')}</td>
                                  <td className="p-4 text-muted-foreground">{shift.expected_cash !== null ? `Rp ${shift.expected_cash.toLocaleString('id-ID')}` : '-'}</td>
                                  <td className="p-4 font-medium">{shift.ending_cash !== null ? `Rp ${shift.ending_cash.toLocaleString('id-ID')}` : '-'}</td>
                                  <td className="p-4 text-right pr-6 font-bold">
                                    {diff !== null ? (
                                      <span className={diff < 0 ? "text-destructive" : diff > 0 ? "text-green-500" : "text-muted-foreground"}>
                                        {diff > 0 ? '+' : ''}Rp {diff.toLocaleString('id-ID')}
                                      </span>
                                    ) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                            {filteredShifts.length === 0 && (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                  No shifts recorded for this date.
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
    </div>
  );
}
