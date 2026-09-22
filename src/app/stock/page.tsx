'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package, Search, Plus, AlertTriangle, ArrowDownUp, Edit, Loader2, Trash2, MoreVertical, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function TitipanAutocomplete({ id, value, onChange, options, placeholder }: { id?: string, value: string, onChange: (val: string) => void, options: string[], placeholder?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const filtered = options.filter(o => o.toLowerCase().includes(value?.toLowerCase() || '') && o !== value);

  return (
    <div className="relative w-full">
      <Input 
        id={id}
        className="bg-background border-border w-full" 
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsFocused(true);
          setIsOpen(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          setTimeout(() => setIsOpen(false), 200);
        }}
      />
      {isOpen && isFocused && filtered.length > 0 && (
        <div className="absolute z-[100] w-full mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden py-1 animate-in fade-in slide-in-from-top-1">
          {filtered.map(opt => (
            <div 
              key={opt}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setIsOpen(false);
              }} 
              className="px-3 py-2 hover:bg-muted cursor-pointer text-sm text-foreground transition-colors"
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type StockItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  min_stock_alert: number;
  last_updated: string;
  is_titipan?: boolean;
  titipan_name?: string | null;
};

export default function StockPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | 'aman' | 'tipis' | 'habis'>('semua');
  const [penitipFilter, setPenitipFilter] = useState<string>('semua');
  const [activeTab, setActiveTab] = useState<'cafe' | 'titipan'>('cafe');

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdateStockDialogOpen, setIsUpdateStockDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);

  const [newItem, setNewItem] = useState({ 
    name: '', 
    unit_value: '', 
    unit_type: 'pcs', 
    cost_per_unit: '', 
    min_stock_alert: '', 
    quantity: '',
    is_titipan: false,
    titipan_name: '',
    sell_price: ''
  });

  const [editUnitValue, setEditUnitValue] = useState('');
  const [editUnitType, setEditUnitType] = useState('pcs');

  const [stockUpdateAmount, setStockUpdateAmount] = useState('');
  const [stockUpdateType, setStockUpdateType] = useState<'add' | 'subtract'>('add');

  useEffect(() => {
    if (!isLoading && role !== 'manager') {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  useEffect(() => {
    if (role === 'manager') {
      fetchStocks();
    }
  }, [role]);

  const fetchStocks = async () => {
    setIsLoadingData(true);
    const [stocksRes, productsRes] = await Promise.all([
      supabase.from('stocks').select('*').order('name', { ascending: true }),
      supabase.from('products').select('*').eq('is_titipan', true).order('name', { ascending: true })
    ]);
    
    let combined: StockItem[] = [];
    if (stocksRes.data) {
      combined = [...stocksRes.data.map((s: any) => ({ ...s, is_titipan: false }))];
    }
    if (productsRes.data) {
      const titipanStocks = productsRes.data.map((p: any) => ({
        id: p.id,
        name: p.name + (p.titipan_name ? ` (${p.titipan_name})` : ''),
        quantity: p.stock || 0,
        unit: 'pcs',
        cost_per_unit: p.supplier_price || 0,
        min_stock_alert: 0,
        last_updated: p.created_at || new Date().toISOString(),
        is_titipan: true,
        titipan_name: p.titipan_name
      }));
      combined = [...combined, ...titipanStocks];
    }
    
    combined.sort((a, b) => a.name.localeCompare(b.name));
    setStocks(combined);
    setIsLoadingData(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Handlers
  const handleAddItem = async () => {
    if (!newItem.name || !newItem.cost_per_unit) return;

    // Prevent duplicate item names (case-insensitive)
    const duplicateExists = stocks.some(s => s.name.toLowerCase() === newItem.name.trim().toLowerCase() && s.is_titipan === newItem.is_titipan);
    if (duplicateExists) {
      alert(`Item "${newItem.name.trim()}" already exists in the inventory.`);
      return;
    }

    if (newItem.is_titipan) {
       if (!newItem.titipan_name || !newItem.sell_price) {
           alert("Nama Penitip dan Harga Jual wajib diisi untuk barang titipan.");
           return;
       }
       const { data: catData } = await supabase.from('categories').select('id').limit(1);
       const categoryId = catData && catData.length > 0 ? catData[0].id : '1';

       const newProduct = {
           id: `p${Math.random().toString(36).substr(2, 9)}`,
           name: newItem.name.trim(),
           price: parseInt(newItem.sell_price) || 0,
           category_id: categoryId,
           image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=400&h=300',
           is_available: true,
           is_titipan: true,
           titipan_name: newItem.titipan_name.trim(),
           supplier_price: parseInt(newItem.cost_per_unit) || 0,
           stock: parseInt(newItem.quantity) || 0,
           is_quick: false,
           variants: []
       };

       const { error } = await supabase.from('products').insert([newProduct]);
       if (!error) {
           const newStockEntry = {
              id: newProduct.id,
              name: newProduct.name + ` (${newProduct.titipan_name})`,
              quantity: newProduct.stock,
              unit: 'pcs',
              cost_per_unit: newProduct.supplier_price,
              min_stock_alert: 0,
              last_updated: new Date().toISOString(),
              is_titipan: true,
              titipan_name: newProduct.titipan_name
           };
           setStocks([...stocks, newStockEntry].sort((a, b) => a.name.localeCompare(b.name)));
           setIsAddDialogOpen(false);
           setNewItem({ name: '', unit_value: '', unit_type: 'pcs', cost_per_unit: '', min_stock_alert: '', quantity: '', is_titipan: false, titipan_name: '', sell_price: '' });
       } else {
           alert("Failed to add titipan item: " + error.message);
       }
    } else {
        if (!newItem.unit_value) {
            alert("Satuan wajib diisi untuk bahan baku cafe.");
            return;
        }
        const { data, error } = await supabase.from('stocks').insert([{
          name: newItem.name.trim(),
          unit: `${newItem.unit_value} ${newItem.unit_type}`.trim(),
          cost_per_unit: parseInt(newItem.cost_per_unit),
          min_stock_alert: parseInt(newItem.min_stock_alert) || 0,
          quantity: parseInt(newItem.quantity) || 0
        }]).select();
    
        if (data && !error) {
          setStocks([...stocks, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
          setIsAddDialogOpen(false);
          setNewItem({ name: '', unit_value: '', unit_type: 'pcs', cost_per_unit: '', min_stock_alert: '', quantity: '', is_titipan: false, titipan_name: '', sell_price: '' });
        } else {
          alert("Failed to add stock item.");
        }
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedStock || !stockUpdateAmount) return;
    
    const amount = parseInt(stockUpdateAmount);
    if (isNaN(amount)) return;

    const newQuantity = stockUpdateType === 'add' 
      ? Number(selectedStock.quantity) + amount 
      : Math.max(0, Number(selectedStock.quantity) - amount);

    if (selectedStock.is_titipan) {
      const { error } = await supabase
        .from('products')
        .update({ stock: newQuantity })
        .eq('id', selectedStock.id);

      if (!error) {
        setStocks(stocks.map(s => s.id === selectedStock.id ? { ...s, quantity: newQuantity } : s));
        setIsUpdateStockDialogOpen(false);
        setSelectedStock(null);
        setStockUpdateAmount('');
      } else {
        alert("Failed to update stock quantity.");
      }
    } else {
      const { error } = await supabase
        .from('stocks')
        .update({ quantity: newQuantity, last_updated: new Date().toISOString() })
        .eq('id', selectedStock.id);

      if (!error) {
        setStocks(stocks.map(s => s.id === selectedStock.id ? { ...s, quantity: newQuantity, last_updated: new Date().toISOString() } : s));
        setIsUpdateStockDialogOpen(false);
        setSelectedStock(null);
        setStockUpdateAmount('');
      } else {
        alert("Failed to update stock quantity.");
      }
    }
  };

  const handleEditSave = async () => {
    if (!selectedStock) return;
    
    // Prevent duplicate item names on edit
    const duplicateExists = stocks.some(s => s.id !== selectedStock.id && s.name.toLowerCase() === selectedStock.name.trim().toLowerCase() && s.is_titipan === selectedStock.is_titipan);
    if (duplicateExists) {
      alert(`Another item named "${selectedStock.name.trim()}" already exists.`);
      return;
    }

    if (selectedStock.is_titipan) {
      const { error } = await supabase
        .from('products')
        .update({ 
          name: selectedStock.name.trim(), 
          titipan_name: selectedStock.titipan_name?.trim(),
          supplier_price: selectedStock.cost_per_unit
        })
        .eq('id', selectedStock.id);

      if (!error) {
        setStocks(stocks.map(s => s.id === selectedStock.id ? { ...selectedStock } : s));
        setIsEditDialogOpen(false);
      } else {
        alert("Failed to edit titipan.");
      }
    } else {
      const { error } = await supabase
        .from('stocks')
        .update({ 
          name: selectedStock.name.trim(), 
          unit: `${editUnitValue} ${editUnitType}`.trim(), 
          cost_per_unit: selectedStock.cost_per_unit, 
          min_stock_alert: selectedStock.min_stock_alert 
        })
        .eq('id', selectedStock.id);

      if (!error) {
        setStocks(stocks.map(s => s.id === selectedStock.id ? { ...selectedStock, unit: `${editUnitValue} ${editUnitType}`.trim() } : s));
        setIsEditDialogOpen(false);
      } else {
        alert("Failed to edit stock.");
      }
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedStock) return;

    if (selectedStock.is_titipan) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', selectedStock.id);

      if (!error) {
        setStocks(stocks.filter(s => s.id !== selectedStock.id));
        setIsDeleteDialogOpen(false);
        setSelectedStock(null);
      } else {
        alert("Failed to delete titipan.");
      }
    } else {
      const { error } = await supabase
        .from('stocks')
        .delete()
        .eq('id', selectedStock.id);

      if (!error) {
        setStocks(stocks.filter(s => s.id !== selectedStock.id));
        setIsDeleteDialogOpen(false);
        setSelectedStock(null);
      } else {
        alert("Failed to delete stock item.");
      }
    }
  };

  if (role !== 'manager') return null;

  const tabStocks = stocks.filter(s => {
    if (activeTab === 'cafe' && s.is_titipan) return false;
    if (activeTab === 'titipan' && !s.is_titipan) return false;
    return true;
  });

  const filteredStocks = tabStocks.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (activeTab === 'titipan' && penitipFilter !== 'semua' && s.titipan_name !== penitipFilter) return false;

    if (statusFilter === 'semua') return true;
    if (statusFilter === 'habis') return s.quantity === 0;
    if (statusFilter === 'tipis') return s.quantity > 0 && s.quantity <= s.min_stock_alert;
    if (statusFilter === 'aman') return s.quantity > s.min_stock_alert;
    return true;
  });

  const titipanNames = Array.from(new Set(stocks.filter(s => s.is_titipan && s.titipan_name).map(s => s.titipan_name as string))).sort();

  const totalModal = tabStocks.reduce((sum, s) => sum + (s.quantity * s.cost_per_unit), 0);
  const lowStockCount = tabStocks.filter(s => s.quantity <= s.min_stock_alert).length;

  return (
    <MainLayout title="Stock">
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-8">
        <Tabs defaultValue="cafe" value={activeTab} onValueChange={(val) => setActiveTab(val as 'cafe' | 'titipan')} className="flex-1 flex flex-col min-w-0">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Stok & Inventaris</h1>
              <p className="text-muted-foreground text-sm lg:text-base mt-1">Kelola bahan baku dan barang titipan</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              <TabsList className="bg-muted/80 p-1 rounded-xl flex w-full sm:w-auto !h-12 shadow-sm border border-border/40">
                <TabsTrigger value="cafe" className="!h-full px-6 rounded-lg transition-all font-semibold text-sm w-full sm:w-auto">
                  Bahan Baku Cafe
                </TabsTrigger>
                <TabsTrigger value="titipan" className="!h-full px-6 rounded-lg transition-all font-semibold text-sm w-full sm:w-auto">
                  Barang Titipan
                </TabsTrigger>
              </TabsList>

              {activeTab === 'cafe' ? (
                <Button 
                  onClick={() => { setNewItem({...newItem, is_titipan: false}); setIsAddDialogOpen(true); }} 
                  className="w-full sm:w-auto flex items-center gap-2 px-6 !h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg transition-all"
                >
                  <Plus size={18} className="stroke-[2.5]" />
                  <span className="hidden sm:inline">Tambah Bahan</span>
                </Button>
              ) : (
                <Button 
                  onClick={() => { setNewItem({...newItem, is_titipan: true}); setIsAddDialogOpen(true); }} 
                  className="w-full sm:w-auto flex items-center gap-2 px-6 !h-12 rounded-xl font-bold bg-orange-500 text-white hover:bg-orange-600 hover:shadow-lg transition-all border-border"
                >
                  <Plus size={18} className="stroke-[2.5]" />
                  <span className="hidden sm:inline">Tambah Titipan</span>
                </Button>
              )}
            </div>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">Total Nilai Stok</CardDescription>
              <CardTitle className="text-2xl lg:text-3xl text-primary">Rp {totalModal.toLocaleString('id-ID')}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">Peringatan Stok Tipis</CardDescription>
              <CardTitle className="text-2xl lg:text-3xl flex items-center gap-2 text-destructive">
                {lowStockCount} <span className="text-base font-normal text-muted-foreground">Barang</span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-6 flex-wrap gap-4 shrink-0">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                className="pl-9 bg-background border-border"
                placeholder="Cari bahan baku..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-3 w-full sm:w-auto">

              {activeTab === 'titipan' && titipanNames.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger className={buttonVariants({ variant: 'outline', className: 'flex-1 sm:flex-none items-center gap-2 border-border bg-background shadow-sm h-10 max-w-[150px] sm:max-w-none' })}>
                    <Filter size={16} className="text-muted-foreground shrink-0" />
                    <span className="hidden sm:inline text-muted-foreground font-normal">Penitip:</span>
                    <span className="font-semibold text-foreground truncate">{penitipFilter === 'semua' ? 'Semua' : penitipFilter}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-card border-border max-h-[60vh] overflow-y-auto">
                    <DropdownMenuRadioGroup value={penitipFilter} onValueChange={setPenitipFilter}>
                      <DropdownMenuRadioItem value="semua">Semua Penitip</DropdownMenuRadioItem>
                      {titipanNames.map((name, i) => (
                        <DropdownMenuRadioItem key={i} value={name}>{name}</DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger className={buttonVariants({ variant: 'outline', className: 'flex-1 sm:flex-none items-center gap-2 border-border bg-background shadow-sm h-10' })}>
                  <Filter size={16} className="text-muted-foreground" />
                  <span className="hidden sm:inline text-muted-foreground font-normal">Status:</span>
                  <span className="font-semibold text-foreground capitalize">{statusFilter === 'semua' ? 'Semua' : statusFilter}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                    <DropdownMenuRadioItem value="semua">Semua Status</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="aman" className="text-green-500 data-[state=checked]:text-green-600">Aman</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="tipis" className="text-amber-500 data-[state=checked]:text-amber-600">Stok Tipis</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="habis" className="text-destructive data-[state=checked]:text-destructive">Habis</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          
          <div className="flex-1 overflow-auto min-h-0">
            {/* Mobile Card List View */}
            <div className="md:hidden space-y-3 p-4">
              {isLoadingData ? (
                <div className="py-12 text-center text-muted-foreground space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  <p className="text-xs">Loading inventory...</p>
                </div>
              ) : filteredStocks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                  No stock items found.
                </div>
              ) : (
                filteredStocks.map((item) => {
                  const isLowStock = item.quantity <= item.min_stock_alert;
                  return (
                    <div 
                      key={item.id} 
                      className={`p-4 bg-card border border-border rounded-xl shadow-sm space-y-3 cursor-pointer hover:border-primary/50 transition-colors ${isLowStock ? 'bg-destructive/5 border-destructive/30' : ''}`}
                      onClick={() => {
                        setSelectedStock(item);
                        setIsDetailDialogOpen(true);
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 font-bold text-foreground">
                            <span>{item.name}</span>
                            {isLowStock && <AlertTriangle size={14} className="text-destructive" />}
                          </div>
                          {activeTab === 'titipan' && (
                            <div className="text-[10px] font-semibold text-orange-500 bg-orange-500/10 w-fit px-2 py-0.5 rounded-md mt-0.5 mb-0.5">Penitip: {item.titipan_name || '-'}</div>
                          )}
                          <div className="text-[10px] text-muted-foreground">Pembaruan: {formatDate(item.last_updated)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${item.quantity === 0 ? 'bg-destructive/10 text-destructive' : isLowStock ? 'bg-amber-500/10 text-amber-600' : 'bg-green-500/10 text-green-600'}`}>
                            Stok: {item.quantity} <span className="font-normal text-[10px] ml-0.5">{/^\d/.test(item.unit) ? `(${item.unit})` : item.unit}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">Batas minimum: {item.min_stock_alert} {/^\d/.test(item.unit) ? `(${item.unit})` : item.unit}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-semibold uppercase">Harga Beli/Satuan</p>
                          <p className="font-medium text-foreground mt-0.5">Rp {item.cost_per_unit.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-semibold uppercase">Total Nilai Stok</p>
                          <p className="font-bold text-primary mt-0.5">Rp {(item.quantity * item.cost_per_unit).toLocaleString('id-ID')}</p>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="font-medium p-4 pl-6">Nama Item</th>
                    {activeTab === 'titipan' && <th className="font-medium p-4 text-left">Penitip</th>}
                    <th className="font-medium p-4 text-center">Status Stok</th>
                    <th className="font-medium p-4 text-center">Stok Tersedia</th>
                    <th className="font-medium p-4 text-center hidden lg:table-cell">Batas Minimum</th>
                    <th className="font-medium p-4 text-right hidden xl:table-cell">Harga Beli/Satuan</th>
                    <th className="font-medium p-4 text-right">Total Nilai Stok</th>
                    <th className="font-medium p-4 text-center">Pembaruan Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingData ? (
                    <tr>
                      <td colSpan={activeTab === 'titipan' ? 8 : 7} className="p-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-4">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <p>Loading inventory...</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredStocks.map((item) => {
                        const isLowStock = item.quantity <= item.min_stock_alert;
                        return (
                          <tr 
                            key={item.id} 
                            className={`hover:bg-muted/50 transition-colors cursor-pointer ${isLowStock ? 'bg-destructive/5' : ''}`}
                            onClick={() => {
                              setSelectedStock(item);
                              setIsDetailDialogOpen(true);
                            }}
                          >
                            <td className="p-4 pl-6">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isLowStock ? 'text-destructive' : ''}`}>{item.name}</span>
                                {isLowStock && <AlertTriangle size={14} className="text-destructive" />}
                              </div>
                            </td>
                            {activeTab === 'titipan' && (
                              <td className="p-4 text-left font-semibold text-orange-500 text-xs">
                                {item.titipan_name || '-'}
                              </td>
                            )}
                            <td className="p-4 text-center">
                              {item.quantity === 0 ? (
                                <span className="bg-destructive/10 text-destructive text-xs font-bold px-2 py-1 rounded-md inline-block whitespace-nowrap">Habis</span>
                              ) : isLowStock ? (
                                <span className="bg-amber-500/10 text-amber-600 text-xs font-bold px-2 py-1 rounded-md inline-block whitespace-nowrap">Tipis</span>
                              ) : (
                                <span className="bg-green-500/10 text-green-600 text-xs font-bold px-2 py-1 rounded-md inline-block whitespace-nowrap">Aman</span>
                              )}
                            </td>
                            <td className="p-4 text-center font-bold">
                              {item.quantity} <span className="font-normal text-xs text-muted-foreground ml-1">{/^\d/.test(item.unit) ? `(${item.unit})` : item.unit}</span>
                            </td>
                            <td className="p-4 text-center text-muted-foreground hidden lg:table-cell">
                              {item.min_stock_alert} <span className="text-xs ml-0.5">{/^\d/.test(item.unit) ? `(${item.unit})` : item.unit}</span>
                            </td>
                            <td className="p-4 text-right hidden xl:table-cell">Rp {item.cost_per_unit.toLocaleString('id-ID')}</td>
                            <td className="p-4 text-right font-bold text-primary">Rp {(item.quantity * item.cost_per_unit).toLocaleString('id-ID')}</td>
                            <td className="p-4 text-center text-xs text-muted-foreground">{formatDate(item.last_updated)}</td>
                          </tr>
                        );
                      })}
                      {filteredStocks.length === 0 && (
                        <tr>
                          <td colSpan={activeTab === 'titipan' ? 8 : 7} className="p-8 text-center text-muted-foreground">
                            No items found.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
        </Tabs>
      </div>

      {/* Add New Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{newItem.is_titipan ? 'Tambah Barang Titipan Baru' : 'Tambah Bahan Baku Cafe'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            
            <div className="flex gap-4 p-1 bg-muted/50 rounded-lg mb-2">
              <Button 
                variant={!newItem.is_titipan ? 'default' : 'ghost'} 
                onClick={() => setNewItem({...newItem, is_titipan: false})} 
                className={`flex-1 h-9 ${!newItem.is_titipan ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                Bahan Cafe
              </Button>
              <Button 
                variant={newItem.is_titipan ? 'default' : 'ghost'} 
                onClick={() => setNewItem({...newItem, is_titipan: true})} 
                className={`flex-1 h-9 ${newItem.is_titipan ? 'bg-orange-500 text-white shadow-sm hover:bg-orange-600' : 'text-muted-foreground'}`}
              >
                Barang Titipan
              </Button>
            </div>

            {newItem.is_titipan && (
              <div className="grid grid-cols-4 items-center gap-4 overflow-visible">
                <label className="text-right text-sm font-medium">Nama Penitip</label>
                <div className="col-span-3 overflow-visible relative">
                  <TitipanAutocomplete 
                    placeholder="Cth: Bu Karti" 
                    value={newItem.titipan_name} 
                    onChange={val => setNewItem({...newItem, titipan_name: val})} 
                    options={Array.from(new Set(stocks.filter(s => s.is_titipan && s.titipan_name).map(s => s.titipan_name as string)))}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Nama Barang</label>
              <Input className="col-span-3 bg-background border-border" placeholder={newItem.is_titipan ? "Cth: Cendol" : "Cth: Biji Kopi, Susu"} value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            </div>

            {!newItem.is_titipan && (
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Satuan</label>
                <div className="col-span-3 flex gap-2">
                  <Input 
                    type="text" 
                    className="bg-background border-border flex-1" 
                    placeholder="Angka (cth: 20)" 
                    value={newItem.unit_value} 
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9.,]/g, '');
                      setNewItem({...newItem, unit_value: val});
                    }} 
                  />
                  <select 
                    className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newItem.unit_type}
                    onChange={e => setNewItem({...newItem, unit_type: e.target.value})}
                  >
                    <option value="pcs">Pcs</option>
                    <option value="kg">Kg</option>
                    <option value="gram">Gram</option>
                    <option value="liter">Liter</option>
                    <option value="ml">Ml</option>
                    <option value="pack">Pack</option>
                    <option value="botol">Botol</option>
                    <option value="box">Box</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">{newItem.is_titipan ? 'Harga Setor (Modal)' : 'Harga Beli/Satuan'}</label>
              <div className="relative col-span-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
                <Input 
                  type="text" 
                  className="pl-9 bg-background border-border" 
                  placeholder="0" 
                  value={newItem.cost_per_unit === '' ? '' : Number(newItem.cost_per_unit).toLocaleString('id-ID')} 
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNewItem({...newItem, cost_per_unit: val === '' ? '' : parseInt(val, 10).toString()});
                  }} 
                />
              </div>
            </div>

            {newItem.is_titipan && (
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Harga Jual</label>
                <div className="relative col-span-3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
                  <Input 
                    type="text" 
                    className="pl-9 bg-background border-border" 
                    placeholder="0" 
                    value={newItem.sell_price === '' ? '' : Number(newItem.sell_price).toLocaleString('id-ID')} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewItem({...newItem, sell_price: val === '' ? '' : parseInt(val, 10).toString()});
                    }} 
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Stok Awal</label>
              <Input 
                type="text" 
                className="col-span-3 bg-background border-border" 
                placeholder="Jumlah stok saat ini" 
                value={newItem.quantity === '' ? '' : Number(newItem.quantity).toLocaleString('id-ID')} 
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setNewItem({...newItem, quantity: val === '' ? '' : parseInt(val, 10).toString()});
                }} 
              />
            </div>

            {!newItem.is_titipan && (
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium text-destructive">Batas Min</label>
                <Input 
                  type="text" 
                  className="col-span-3 bg-background border-border" 
                  placeholder="Peringatan jika stok dibawah ini" 
                  value={newItem.min_stock_alert === '' ? '' : Number(newItem.min_stock_alert).toLocaleString('id-ID')} 
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNewItem({...newItem, min_stock_alert: val === '' ? '' : parseInt(val, 10).toString()});
                  }} 
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Batal</Button>
            <Button onClick={handleAddItem} className="bg-primary text-primary-foreground hover:bg-primary/90">Tambah Bahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Quantity Dialog */}
      <Dialog open={isUpdateStockDialogOpen} onOpenChange={setIsUpdateStockDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Stok: <span className="text-primary">{selectedStock?.name}</span></DialogTitle>
            <DialogDescription>
              Sisa stok saat ini: <span className="font-bold text-foreground">{selectedStock?.quantity}</span> (Satuan: {selectedStock?.unit})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex rounded-md shadow-sm p-1 bg-muted/50" role="group">
              <button 
                type="button" 
                className={`flex-1 px-4 py-2.5 text-sm font-bold rounded-md transition-all ${stockUpdateType === 'add' ? 'bg-background text-green-600 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setStockUpdateType('add')}
              >
                + Tambah Stok
              </button>
              <button 
                type="button" 
                className={`flex-1 px-4 py-2.5 text-sm font-bold rounded-md transition-all ${stockUpdateType === 'subtract' ? 'bg-background text-destructive shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setStockUpdateType('subtract')}
              >
                - Kurangi Stok
              </button>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Input 
                  type="number" 
                  className="pr-16 text-lg h-12 bg-background border-border focus-visible:ring-primary" 
                  placeholder="Masukkan jumlah..." 
                  value={stockUpdateAmount} 
                  onChange={e => setStockUpdateAmount(e.target.value)} 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  {selectedStock?.unit}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg">
                <span className="text-sm font-medium text-muted-foreground">Estimasi Stok Akhir:</span>
                <span className="text-xl font-bold text-foreground">
                  {stockUpdateType === 'add' 
                    ? Number(selectedStock?.quantity || 0) + (parseInt(stockUpdateAmount) || 0) 
                    : Math.max(0, Number(selectedStock?.quantity || 0) - (parseInt(stockUpdateAmount) || 0))
                  } <span className="text-sm font-normal text-muted-foreground">{selectedStock?.unit}</span>
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateStockDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateStock} className="bg-primary text-primary-foreground hover:bg-primary/90">Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Details Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Detail {selectedStock?.is_titipan ? 'Barang Titipan' : 'Bahan'}</DialogTitle>
          </DialogHeader>
          {selectedStock && (
            <div className="grid gap-4 py-4">
              {selectedStock.is_titipan && (
                <div className="grid grid-cols-4 items-center gap-4 overflow-visible">
                  <label className="text-right text-sm font-medium">Penitip</label>
                  <div className="col-span-3 overflow-visible relative">
                    <TitipanAutocomplete 
                      placeholder="Cth: Bu Karti" 
                      value={selectedStock.titipan_name || ''} 
                      onChange={val => setSelectedStock({...selectedStock, titipan_name: val})} 
                      options={Array.from(new Set(stocks.filter(s => s.is_titipan && s.titipan_name).map(s => s.titipan_name as string)))}
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Nama {selectedStock.is_titipan ? 'Barang' : 'Bahan'}</label>
                <Input className="col-span-3 bg-background border-border" value={selectedStock.name} onChange={e => setSelectedStock({...selectedStock, name: e.target.value})} />
              </div>
              {!selectedStock.is_titipan && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right text-sm font-medium">Satuan</label>
                  <div className="col-span-3 flex gap-2">
                    <Input 
                      type="text" 
                      className="bg-background border-border flex-1" 
                      placeholder="Angka (cth: 20, 1)" 
                      value={editUnitValue} 
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9.,]/g, '');
                        setEditUnitValue(val);
                      }} 
                    />
                    <select 
                      className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={editUnitType}
                      onChange={e => setEditUnitType(e.target.value)}
                    >
                      <option value="pcs">Pcs</option>
                      <option value="kg">Kg</option>
                      <option value="gram">Gram</option>
                      <option value="liter">Liter</option>
                      <option value="ml">Ml</option>
                      <option value="pack">Pack</option>
                      <option value="botol">Botol</option>
                      <option value="box">Box</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">{selectedStock.is_titipan ? 'Harga Setor' : 'Harga Beli/Satuan'}</label>
                <div className="relative col-span-3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
                  <Input 
                    type="text" 
                    className="pl-9 bg-background border-border" 
                    value={selectedStock.cost_per_unit === '' as any ? '' : Number(selectedStock.cost_per_unit).toLocaleString('id-ID')} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setSelectedStock({...selectedStock, cost_per_unit: val === '' ? '' as any : parseInt(val, 10)});
                    }} 
                  />
                </div>
              </div>
              {!selectedStock.is_titipan && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right text-sm font-medium text-destructive">Batas Minimum</label>
                  <Input 
                    type="text" 
                    className="col-span-3 bg-background border-border" 
                    value={selectedStock.min_stock_alert === '' as any ? '' : Number(selectedStock.min_stock_alert).toLocaleString('id-ID')} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setSelectedStock({...selectedStock, min_stock_alert: val === '' ? '' as any : parseInt(val, 10)});
                    }} 
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Batal</Button>
            <Button onClick={handleEditSave} className="bg-primary text-primary-foreground hover:bg-primary/90">Simpan Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle size={20} />
              Hapus Bahan
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus <span className="font-bold text-foreground">{selectedStock?.name}</span>? Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
            <Button onClick={handleDeleteItem} variant="destructive">Hapus Bahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] overflow-hidden p-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-500"></div>
          
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-bold flex items-center justify-between">
                <span>{selectedStock?.is_titipan ? 'Detail Barang Titipan' : 'Detail Bahan Cafe'}</span>
              </DialogTitle>
            </DialogHeader>
            
            {selectedStock && (
              <div className="space-y-6">
                {/* Highlight Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 p-4 rounded-xl border border-border flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Sisa Stok</p>
                    <p className="text-2xl font-black text-foreground">{selectedStock.quantity} <span className="text-sm font-medium text-muted-foreground">{/^\d/.test(selectedStock.unit) ? `(${selectedStock.unit})` : selectedStock.unit}</span></p>
                  </div>
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-primary/80 uppercase font-bold tracking-wider mb-1">Total Nilai</p>
                    <p className="text-xl font-black text-primary">Rp {(selectedStock.quantity * selectedStock.cost_per_unit).toLocaleString('id-ID')}</p>
                  </div>
                </div>

                {/* Data List */}
                <div className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/50 text-sm">
                  {selectedStock.is_titipan && (
                    <div className="flex justify-between items-center border-b border-border/50 pb-2">
                      <span className="text-muted-foreground font-medium">Penitip</span>
                      <span className="font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-md">{selectedStock.titipan_name || '-'}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-b border-border/50 pb-2">
                    <span className="text-muted-foreground font-medium">{selectedStock.is_titipan ? 'Nama Barang' : 'Nama Bahan'}</span>
                    <span className="font-bold text-foreground text-right">{selectedStock.name}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/50 pb-2">
                    <span className="text-muted-foreground font-medium">Status</span>
                    <span>
                      {selectedStock.quantity === 0 ? (
                        <span className="text-destructive font-bold bg-destructive/10 px-2 py-0.5 rounded-md text-xs">Habis</span>
                      ) : selectedStock.quantity <= selectedStock.min_stock_alert ? (
                        <span className="text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md text-xs">Stok Tipis</span>
                      ) : (
                        <span className="text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded-md text-xs">Aman</span>
                      )}
                    </span>
                  </div>
                  {!selectedStock.is_titipan && (
                    <div className="flex justify-between items-center border-b border-border/50 pb-2">
                      <span className="text-muted-foreground font-medium">Batas Minimum</span>
                      <span className="font-medium text-foreground">{selectedStock.min_stock_alert} {/^\d/.test(selectedStock.unit) ? `(${selectedStock.unit})` : selectedStock.unit}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-b border-border/50 pb-2">
                    <span className="text-muted-foreground font-medium">{selectedStock.is_titipan ? 'Harga Setor' : 'Harga Beli'}</span>
                    <span className="font-medium text-foreground">Rp {Number(selectedStock.cost_per_unit).toLocaleString('id-ID')} /{/^\d/.test(selectedStock.unit) ? `(${selectedStock.unit})` : selectedStock.unit}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-muted-foreground font-medium">Pembaruan</span>
                    <span className="font-medium text-muted-foreground text-xs">{formatDate(selectedStock.last_updated)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-6">
              <Button 
                  onClick={() => {
                    setIsDetailDialogOpen(false);
                    setTimeout(() => setIsUpdateStockDialogOpen(true), 150);
                  }} 
                  className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl shadow-lg shadow-primary/20"
              >
                  <Plus size={18} className="mr-2" /> Update Stok
              </Button>

              <div className="flex gap-3">
                <Button 
                    variant="outline"
                    onClick={() => {
                      setIsDetailDialogOpen(false);
                      setTimeout(() => {
                        if (!selectedStock?.is_titipan) {
                          const unitParts = selectedStock?.unit.match(/^([\d.,]+)\s*(.*)$/);
                          setEditUnitValue(unitParts ? unitParts[1] : selectedStock!.unit.replace(/[a-zA-Z\s]/g, ''));
                          setEditUnitType(unitParts && unitParts[2] ? unitParts[2] : (selectedStock!.unit.replace(/[\d.,\s]/g, '') || 'pcs'));
                        }
                        setIsEditDialogOpen(true);
                      }, 150);
                    }}
                    className="flex-1 h-11 rounded-xl border-border hover:bg-muted font-semibold"
                >
                    <Edit size={16} className="mr-2" /> Edit Info
                </Button>
                <Button 
                    variant="outline"
                    onClick={() => {
                      setIsDetailDialogOpen(false);
                      setTimeout(() => setIsDeleteDialogOpen(true), 150);
                    }}
                    className="flex-1 h-11 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 font-semibold"
                >
                    <Trash2 size={16} className="mr-2" /> Hapus
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
