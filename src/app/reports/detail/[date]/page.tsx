'use client';

import { useState, useEffect, use } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Receipt, CheckCircle2, Copy, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type Transaction = {
  id: string;
  created_at: string;
  method: string;
  total: number;
  status: string;
  cashier_name: string;
  transaction_items?: { product_name: string; price: number; quantity: number }[];
};

type DailyReport = {
  date: string;
  rawDate: string;
  totalTransactions: number;
  qrisRevenue: number;
  cashRevenue: number;
  regularRevenue: number;
  regularQris: number;
  regularCash: number;
  titipanRevenue: number;
  titipanQris: number;
  titipanCash: number;
  titipanBreakdown: Record<string, number>;
  totalRevenue: number;
};

type ProductSummary = {
  product_name: string;
  quantity: number;
  revenue: number;
};

type VendorSummary = {
  vendor_name: string;
  total_revenue: number;
  products: Record<string, ProductSummary>;
};

export default function DailyReportDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const unwrappedParams = use(params);
  const dateParam = unwrappedParams.date;
  
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [vendorSummaries, setVendorSummaries] = useState<VendorSummary[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [titipanProductNames, setTitipanProductNames] = useState<Map<string, string | null>>(new Map());
  const [productStocks, setProductStocks] = useState<Map<string, number | string>>(new Map());

  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalContent, setReportModalContent] = useState('');
  const [reportModalTitle, setReportModalTitle] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleOpenReport = (vendor: VendorSummary) => {
    setReportModalTitle(`Report ${vendor.vendor_name}`);
    
    let text = `${vendor.vendor_name}\n\n`;
    text += `Produk terjual dari tanggal \n`;
    text += `${report?.date || dateParam}:\n\n`;

    let totalProduk = 0;
    const sortedProducts = Object.values(vendor.products).sort((a,b) => b.revenue - a.revenue);
    
    sortedProducts.forEach(p => {
      text += `• ${p.product_name.toLowerCase()} ${p.quantity}\n`;
      totalProduk += p.quantity;
    });

    text += `\ntotal ${totalProduk} produk\n\n`;
    text += `SISA STOK:\n`;
    
    sortedProducts.forEach(p => {
      const stock = productStocks.get(p.product_name) ?? 0;
      text += `• ${p.product_name.toLowerCase()} sisa ${stock}\n`;
    });

    text += `\nTOTAL SETORAN PER TANGGAL ${report?.date || dateParam}\n`;
    text += `Rp ${vendor.total_revenue.toLocaleString('id-ID')}\n`;

    setReportModalContent(text);
    setReportModalOpen(true);
    setIsCopied(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(reportModalContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    if (!isLoading && role !== 'manager') {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  useEffect(() => {
    if (role === 'manager' && dateParam) {
      fetchData();
    }
  }, [role, dateParam]);

  const fetchData = async () => {
    setIsLoadingData(true);
    
    // Fetch products, stocks, and recipes to calculate actual remaining portions
    const [productsRes, stocksRes, recipesRes] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('stocks').select('id, quantity, name'),
      supabase.from('product_ingredients').select('product_id, stock_id, quantity_required')
    ]);

    const titipanMap = new Map<string, string | null>();
    const stockMap = new Map<string, number | string>();
    
    if (productsRes.data) {
      const stocksData = stocksRes.data || [];
      const recipesData = recipesRes.data || [];

      productsRes.data.forEach(p => {
        if (p.is_titipan) {
          titipanMap.set(p.name, p.titipan_name);
        }
        
        // Calculate stock based on recipe
        const productRecipes = recipesData.filter(r => r.product_id === p.id);
        if (productRecipes.length === 0) {
          // Fallback: check if there is a stock item with the exact same name
          const exactStock = stocksData.find(s => s.name.toLowerCase().trim() === p.name.toLowerCase().trim());
          if (exactStock) {
            stockMap.set(p.name, exactStock.quantity);
          } else {
            stockMap.set(p.name, '-'); // Untracked / no recipe
          }
        } else {
          let minPortions = Infinity;
          for (const recipe of productRecipes) {
            const stockItem = stocksData.find(s => s.id === recipe.stock_id);
            if (!stockItem) {
              minPortions = 0;
              break;
            }
            const possiblePortions = Math.floor(stockItem.quantity / recipe.quantity_required);
            if (possiblePortions < minPortions) minPortions = possiblePortions;
          }
          stockMap.set(p.name, minPortions === Infinity ? 0 : minPortions);
        }
      });
      setTitipanProductNames(titipanMap);
      setProductStocks(stockMap);
    }

    // Since date in DB is UTC, and we want to match local date, it's safer to fetch around the date.
    // However, the previous logic fetched all and filtered. We can just fetch transactions for that date string in created_at.
    // Or we fetch last 2 days just to be safe with timezone, then filter.
    // Let's fetch order by created_at desc.
    const { data: txData } = await supabase
      .from('transactions')
      .select('id, created_at, method, total, status, cashier_name, transaction_items(product_name, price, quantity)')
      .order('created_at', { ascending: false });

    if (txData) {
      // Filter transactions for this date
      const dateTx = txData.filter(tx => new Date(tx.created_at).toISOString().split('T')[0] === dateParam);
      setTransactions(dateTx);
      
      let qris = 0, cash = 0, titipan = 0, regular = 0, total = 0;
      let regularQris = 0, regularCash = 0, titipanQris = 0, titipanCash = 0;
      const breakdown: Record<string, number> = {};
      
      const vSummaries: Record<string, VendorSummary> = {
        'Samba Cafe': { vendor_name: 'Samba Cafe', total_revenue: 0, products: {} }
      };

      dateTx.forEach(tx => {
        total += tx.total;
        if (tx.method === 'QRIS') qris += tx.total;
        if (tx.method === 'Cash') cash += tx.total;

        let txTitipan = 0;
        if (tx.transaction_items) {
          tx.transaction_items.forEach(item => {
            const isTitipan = titipanMap.has(item.product_name);
            const vendorName = isTitipan ? (titipanMap.get(item.product_name) || 'Titipan (Tanpa Nama)') : 'Samba Cafe';
            
            if (!vSummaries[vendorName]) {
              vSummaries[vendorName] = { vendor_name: vendorName, total_revenue: 0, products: {} };
            }
            
            const itemTotal = item.price * item.quantity;
            
            if (isTitipan) {
              txTitipan += itemTotal;
              
              if (!breakdown[vendorName]) breakdown[vendorName] = 0;
              breakdown[vendorName] += itemTotal;
            }

            vSummaries[vendorName].total_revenue += itemTotal;
            
            if (!vSummaries[vendorName].products[item.product_name]) {
              vSummaries[vendorName].products[item.product_name] = { product_name: item.product_name, quantity: 0, revenue: 0 };
            }
            vSummaries[vendorName].products[item.product_name].quantity += item.quantity;
            vSummaries[vendorName].products[item.product_name].revenue += itemTotal;
          });
        }
        
        const txRegular = tx.total - txTitipan;
        titipan += txTitipan;
        regular += txRegular;
        
        if (tx.method === 'QRIS') {
          titipanQris += txTitipan;
          regularQris += txRegular;
        }
        if (tx.method === 'Cash') {
          titipanCash += txTitipan;
          regularCash += txRegular;
        }
      });
      
      setVendorSummaries(Object.values(vSummaries).sort((a, b) => {
        if (a.vendor_name === 'Samba Cafe') return -1;
        if (b.vendor_name === 'Samba Cafe') return 1;
        return b.total_revenue - a.total_revenue;
      }));

      const dateObj = new Date(dateParam);
      const dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      setReport({
        date: dateStr,
        rawDate: dateParam,
        totalTransactions: dateTx.length,
        qrisRevenue: qris,
        cashRevenue: cash,
        regularRevenue: regular,
        regularQris: regularQris,
        regularCash: regularCash,
        titipanRevenue: titipan,
        titipanQris: titipanQris,
        titipanCash: titipanCash,
        titipanBreakdown: breakdown,
        totalRevenue: total,
      });
    }
    
    setIsLoadingData(false);
  };

  if (role !== 'manager') return null;



  return (
    <MainLayout title="Detail Laporan">
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-8 max-w-7xl mx-auto w-full">
        {/* Header & Back Button */}
        <div className="flex items-center gap-4 mb-6 lg:mb-8">
          <button 
            onClick={() => router.push('/reports')}
            className="p-2.5 bg-card border border-border rounded-xl text-muted-foreground hover:text-primary transition-colors shadow-sm"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
              Detail Transaksi Harian
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base mt-1">
              {report?.date || 'Memuat...'}
            </p>
          </div>
        </div>

        {isLoadingData ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : !report ? (
          <div className="bg-card p-10 rounded-2xl border border-border text-center text-muted-foreground">
            Data tidak ditemukan untuk tanggal ini.
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Metrik Utama */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-sm flex flex-col relative overflow-hidden group hover:border-primary/50 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                  <Receipt size={100} />
                </div>
                <CardContent className="p-6 flex flex-col justify-center h-full relative z-10">
                  <p className="text-muted-foreground text-[10px] md:text-xs uppercase font-bold tracking-widest mb-2">Total Pesanan</p>
                  <p className="text-4xl lg:text-5xl font-black text-foreground">{report.totalTransactions}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-3 font-medium">Transaksi Berhasil</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-primary/20 shadow-sm flex flex-col">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="mb-4">
                    <p className="text-primary text-[10px] md:text-xs uppercase font-bold tracking-widest mb-1.5">Total Omzet</p>
                    <p className="text-2xl lg:text-3xl font-black text-foreground">Rp {report.totalRevenue.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-3">
                    <div className="bg-background/80 rounded-lg p-2.5 border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">QRIS</p>
                      <p className="text-xs md:text-sm font-black">Rp {(report.qrisRevenue || 0).toLocaleString('id-ID')}</p>
                    </div>
                    <div className="bg-background/80 rounded-lg p-2.5 border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">Tunai</p>
                      <p className="text-xs md:text-sm font-black">Rp {(report.cashRevenue || 0).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/20 shadow-sm flex flex-col">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="mb-4">
                    <p className="text-emerald-500 text-[10px] md:text-xs uppercase font-bold tracking-widest mb-1.5">Pendapatan Kafe</p>
                    <p className="text-2xl lg:text-3xl font-black text-emerald-500">Rp {report.regularRevenue.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-3">
                    <div className="bg-emerald-500/5 rounded-lg p-2.5 border border-emerald-500/10">
                      <p className="text-[10px] text-emerald-500/70 font-bold uppercase mb-0.5">QRIS</p>
                      <p className="text-xs md:text-sm font-black text-emerald-500">Rp {(report.regularQris || 0).toLocaleString('id-ID')}</p>
                    </div>
                    <div className="bg-emerald-500/5 rounded-lg p-2.5 border border-emerald-500/10">
                      <p className="text-[10px] text-emerald-500/70 font-bold uppercase mb-0.5">Tunai</p>
                      <p className="text-xs md:text-sm font-black text-emerald-500">Rp {(report.regularCash || 0).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500/10 via-card to-card border-orange-500/20 shadow-sm flex flex-col">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="mb-4">
                    <p className="text-orange-500 text-[10px] md:text-xs uppercase font-bold tracking-widest mb-1.5">Uang Titipan</p>
                    <p className="text-2xl lg:text-3xl font-black text-orange-500">Rp {report.titipanRevenue.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-3">
                    <div className="bg-orange-500/5 rounded-lg p-2.5 border border-orange-500/10">
                      <p className="text-[10px] text-orange-500/70 font-bold uppercase mb-0.5">QRIS</p>
                      <p className="text-xs md:text-sm font-black text-orange-500">Rp {(report.titipanQris || 0).toLocaleString('id-ID')}</p>
                    </div>
                    <div className="bg-orange-500/5 rounded-lg p-2.5 border border-orange-500/10">
                      <p className="text-[10px] text-orange-500/70 font-bold uppercase mb-0.5">Tunai</p>
                      <p className="text-xs md:text-sm font-black text-orange-500">Rp {(report.titipanCash || 0).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Ringkasan Penjualan Per Vendor */}
            <div className="pt-4">
              <h2 className="text-xl font-bold mb-4">Ringkasan Penjualan Produk</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {vendorSummaries.map(vendor => (
                  <Card key={vendor.vendor_name} className={`bg-card shadow-sm overflow-hidden flex flex-col border h-[400px] ${vendor.vendor_name === 'Samba Cafe' ? 'border-emerald-500/30' : 'border-orange-500/20'}`}>
                    <div className={`p-4 border-b flex justify-between items-center shrink-0 ${vendor.vendor_name === 'Samba Cafe' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-orange-500/10 border-orange-500/20'}`}>
                      <div>
                        <h3 className={`font-bold text-lg ${vendor.vendor_name === 'Samba Cafe' ? 'text-emerald-500' : 'text-orange-500'}`}>
                          {vendor.vendor_name}
                        </h3>
                        <p className={`text-[10px] uppercase font-bold mt-0.5 ${vendor.vendor_name === 'Samba Cafe' ? 'text-emerald-500/70' : 'text-orange-500/70'}`}>Total Pendapatan</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-black text-2xl text-foreground">Rp {vendor.total_revenue.toLocaleString('id-ID')}</p>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 shrink-0 rounded-full bg-background/50 hover:bg-background border-border/50"
                          onClick={() => handleOpenReport(vendor)}
                          title="Copy Text Report"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-0 flex-1 bg-background/50 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                      <div className="p-4 space-y-3">
                        {Object.values(vendor.products).sort((a,b) => b.revenue - a.revenue).map((product, idx) => {
                          const stock = productStocks.get(product.product_name) ?? 0;
                          return (
                            <div key={idx} className="flex flex-col border-b border-border/50 pb-2.5 last:border-0 last:pb-0 gap-1.5">
                              <div className="flex justify-between items-start">
                                <div className="flex gap-2 items-center flex-wrap flex-1">
                                  <span className="font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded text-xs">{product.quantity}x</span>
                                  <span className="font-medium text-foreground text-sm">{product.product_name}</span>
                                </div>
                                <span className="font-semibold text-muted-foreground text-sm shrink-0 pl-2">Rp {product.revenue.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-end">
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                  Sisa Stok: {stock}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(vendor.products).length === 0 && (
                          <div className="text-muted-foreground text-sm italic">Tidak ada produk terjual.</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{reportModalTitle}</DialogTitle>
          </DialogHeader>
          <div className="py-2 flex-1 min-h-0">
            <Textarea 
              value={reportModalContent}
              onChange={(e) => setReportModalContent(e.target.value)}
              className="h-[50vh] min-h-[300px] resize-none font-mono text-xs bg-background/50 focus-visible:ring-primary/20 ![field-sizing:fixed] overflow-y-auto"
            />
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setReportModalOpen(false)}>
              Tutup
            </Button>
            <Button onClick={handleCopy} className="gap-2">
              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {isCopied ? 'Tersalin!' : 'Salin Text'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
