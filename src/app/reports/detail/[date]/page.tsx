'use client';

import { useState, useEffect, use } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, Receipt, CheckCircle2, Copy, Check, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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
  capital: number;
  profit: number;
};

type VendorSummary = {
  vendor_name: string;
  total_revenue: number;
  total_capital: number;
  total_profit: number;
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
  const [supplierPrices, setSupplierPrices] = useState<Map<string, number>>(new Map());

  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalContent, setReportModalContent] = useState('');
  const [reportModalTitle, setReportModalTitle] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const [selectedVendorForSheet, setSelectedVendorForSheet] = useState<VendorSummary | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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
    const spMap = new Map<string, number>();
    
    if (productsRes.data) {
      const stocksData = stocksRes.data || [];
      const recipesData = recipesRes.data || [];

      productsRes.data.forEach(p => {
        if (p.is_titipan) {
          titipanMap.set(p.name, p.titipan_name);
        }
        spMap.set(p.name, Number(p.supplier_price) || 0);
        
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
      setSupplierPrices(spMap);
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
      // Filter transactions for this date, month, year, or range
      const dateTx = txData.filter(tx => {
        const txDate = new Date(tx.created_at).toISOString().split('T')[0];
        if (dateParam.includes('~')) {
          const [start, end] = dateParam.split('~');
          return txDate >= start && txDate <= end;
        }
        return txDate.startsWith(dateParam);
      });
      setTransactions(dateTx);
      
      let qris = 0, cash = 0, titipan = 0, regular = 0, total = 0;
      let regularQris = 0, regularCash = 0, titipanQris = 0, titipanCash = 0;
      const breakdown: Record<string, number> = {};
      
      const vSummaries: Record<string, VendorSummary> = {
        'Samba Cafe': { vendor_name: 'Samba Cafe', total_revenue: 0, total_capital: 0, total_profit: 0, products: {} }
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
              vSummaries[vendorName] = { vendor_name: vendorName, total_revenue: 0, total_capital: 0, total_profit: 0, products: {} };
            }
            
            const itemTotal = item.price * item.quantity;
            const supplierPrice = spMap.get(item.product_name) || 0;
            const itemCapital = supplierPrice > 0 ? (supplierPrice * item.quantity) : (isTitipan ? itemTotal : 0);
            const itemProfit = isTitipan ? (itemTotal - itemCapital) : itemTotal;
            
            if (isTitipan) {
              txTitipan += itemTotal;
              
              if (!breakdown[vendorName]) breakdown[vendorName] = 0;
              breakdown[vendorName] += itemTotal;
            }

            vSummaries[vendorName].total_revenue += itemTotal;
            vSummaries[vendorName].total_capital += itemCapital;
            vSummaries[vendorName].total_profit += itemProfit;
            
            if (!vSummaries[vendorName].products[item.product_name]) {
              vSummaries[vendorName].products[item.product_name] = { product_name: item.product_name, quantity: 0, revenue: 0, capital: 0, profit: 0 };
            }
            vSummaries[vendorName].products[item.product_name].quantity += item.quantity;
            vSummaries[vendorName].products[item.product_name].revenue += itemTotal;
            vSummaries[vendorName].products[item.product_name].capital += itemCapital;
            vSummaries[vendorName].products[item.product_name].profit += itemProfit;
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-muted-foreground text-xs font-semibold tracking-wide">TOTAL PESANAN</p>
                    <Receipt className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground mb-3">{report.totalTransactions}</p>
                    <div className="border-t border-border/50 pt-3">
                      <p className="text-[11px] text-muted-foreground font-medium">Transaksi Berhasil Hari Ini</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-primary text-xs font-semibold tracking-wide">TOTAL OMZET</p>
                    <div className="w-2 h-2 rounded-full bg-primary/50" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground mb-3">Rp {report.totalRevenue.toLocaleString('id-ID')}</p>
                    <div className="flex items-center justify-between border-t border-border/50 pt-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">QRIS</span>
                        <span className="text-xs font-medium text-foreground">Rp {(report.qrisRevenue || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="w-px h-6 bg-border/50" />
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Tunai</span>
                        <span className="text-xs font-medium text-foreground">Rp {(report.cashRevenue || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-emerald-500 text-xs font-semibold tracking-wide">PENDAPATAN KAFE</p>
                    <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-emerald-500 mb-3">Rp {report.regularRevenue.toLocaleString('id-ID')}</p>
                    <div className="flex items-center justify-between border-t border-border/50 pt-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">QRIS</span>
                        <span className="text-xs font-medium text-foreground">Rp {(report.regularQris || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="w-px h-6 bg-border/50" />
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Tunai</span>
                        <span className="text-xs font-medium text-foreground">Rp {(report.regularCash || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-orange-500 text-xs font-semibold tracking-wide">UANG TITIPAN</p>
                    <div className="w-2 h-2 rounded-full bg-orange-500/50" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-orange-500 mb-3">Rp {report.titipanRevenue.toLocaleString('id-ID')}</p>
                    <div className="flex items-center justify-between border-t border-border/50 pt-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">QRIS</span>
                        <span className="text-xs font-medium text-foreground">Rp {(report.titipanQris || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="w-px h-6 bg-border/50" />
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Tunai</span>
                        <span className="text-xs font-medium text-foreground">Rp {(report.titipanCash || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Ringkasan Penjualan Per Vendor */}
            <div className="pt-2">
              <h2 className="text-lg font-semibold mb-4">Ringkasan Penjualan Produk</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {vendorSummaries.map(vendor => (
                  <Card 
                    key={vendor.vendor_name} 
                    className="bg-card border-border shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-primary/50 hover:bg-muted/5 transition-all group"
                    onClick={() => {
                      setSelectedVendorForSheet(vendor);
                      setIsSheetOpen(true);
                    }}
                  >
                    <div className="p-4 flex justify-between items-center h-full">
                      <div className="flex flex-col min-w-0">
                        <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {vendor.vendor_name}
                        </h3>
                        <div className="flex flex-col mt-1.5 space-y-0.5">
                          <p className="text-[11px] text-muted-foreground flex justify-between gap-3">
                            <span>Pendapatan:</span> 
                            <span className="font-medium text-foreground">Rp {vendor.total_revenue.toLocaleString('id-ID')}</span>
                          </p>
                          {vendor.vendor_name !== 'Samba Cafe' && (
                            <>
                              <p className="text-[11px] text-muted-foreground flex justify-between gap-3">
                                <span>Hak Penitip:</span> 
                                <span className="font-semibold text-orange-500">Rp {vendor.total_capital.toLocaleString('id-ID')}</span>
                              </p>
                              <p className="text-[11px] text-muted-foreground flex justify-between gap-3">
                                <span>Keuntungan Kafe:</span> 
                                <span className="font-semibold text-emerald-500">Rp {vendor.total_profit.toLocaleString('id-ID')}</span>
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground/30 group-hover:text-primary transition-colors ml-2" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetContent side="right" className="w-full sm:max-w-md bg-card border-l-border/50 p-0 flex flex-col h-full z-[200] !max-w-[450px] shadow-2xl">
                {selectedVendorForSheet && (
                  <>
                    <div className="px-6 py-6 border-b border-border/50 bg-muted/10 shrink-0">
                      <SheetHeader className="text-left space-y-2">
                        <SheetTitle className="text-2xl font-bold flex items-center justify-between">
                          <span className="truncate pr-4">{selectedVendorForSheet.vendor_name}</span>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 gap-2 rounded-xl bg-background hover:bg-muted border-border/50 text-xs px-4 shadow-sm shrink-0"
                            onClick={() => handleOpenReport(selectedVendorForSheet)}
                          >
                            <Copy className="h-4 w-4" />
                            Copy Text
                          </Button>
                        </SheetTitle>
                        <div className="flex flex-col gap-1">
                          <p className="text-sm text-muted-foreground flex justify-between">
                            <span>Total Pendapatan:</span> 
                            <span className="font-semibold text-foreground text-base ml-1">Rp {selectedVendorForSheet.total_revenue.toLocaleString('id-ID')}</span>
                          </p>
                          {selectedVendorForSheet.vendor_name !== 'Samba Cafe' && (
                            <>
                              <p className="text-xs text-muted-foreground flex justify-between">
                                <span>Hak Penitip:</span> 
                                <span className="font-semibold text-orange-500 text-sm ml-1">Rp {selectedVendorForSheet.total_capital.toLocaleString('id-ID')}</span>
                              </p>
                              <p className="text-xs text-muted-foreground flex justify-between">
                                <span>Keuntungan Kafe:</span> 
                                <span className="font-semibold text-emerald-500 text-sm ml-1">Rp {selectedVendorForSheet.total_profit.toLocaleString('id-ID')}</span>
                              </p>
                            </>
                          )}
                        </div>
                      </SheetHeader>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto bg-background/30 p-2 sm:p-4">
                      <div className="flex flex-col space-y-1">
                        {Object.values(selectedVendorForSheet.products).sort((a,b) => b.revenue - a.revenue).map((product, idx) => {
                          const stock = productStocks.get(product.product_name) ?? 0;
                          return (
                            <div key={idx} className="px-5 py-3.5 border border-transparent border-b-border/40 hover:bg-muted/10 transition-colors rounded-2xl">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4 min-w-0">
                                  <span className="font-semibold text-[15px] text-muted-foreground w-8 shrink-0 text-right mt-0.5">{product.quantity}x</span>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-semibold text-[15px] text-foreground truncate leading-tight">{product.product_name}</span>
                                    <span className="text-xs text-muted-foreground mt-1">Sisa stok: {stock}</span>
                                    {selectedVendorForSheet.vendor_name !== 'Samba Cafe' && product.capital > 0 && (
                                      <span className="text-[10px] text-orange-500/80 mt-0.5">Penitip: Rp {product.capital.toLocaleString('id-ID')}</span>
                                    )}
                                    {selectedVendorForSheet.vendor_name !== 'Samba Cafe' && product.profit > 0 && (
                                      <span className="text-[10px] text-emerald-500/80 mt-0.5">Untung Kafe: Rp {product.profit.toLocaleString('id-ID')}</span>
                                    )}
                                  </div>
                                </div>
                                <span className="font-bold text-[15px] text-foreground shrink-0 mt-0.5">Rp {product.revenue.toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(selectedVendorForSheet.products).length === 0 && (
                          <div className="p-8 text-muted-foreground text-sm italic text-center">Tidak ada produk terjual.</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </SheetContent>
            </Sheet>

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
