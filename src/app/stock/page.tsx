'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package, Search, Plus, AlertTriangle, ArrowDownUp, Edit, Loader2, Trash2, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type StockItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  min_stock_alert: number;
  last_updated: string;
};

export default function StockPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | 'aman' | 'tipis' | 'habis'>('semua');

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
    quantity: ''
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
    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .order('name', { ascending: true });
    
    if (data) {
      setStocks(data);
    }
    setIsLoadingData(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Handlers
  const handleAddItem = async () => {
    if (!newItem.name || !newItem.unit_value || !newItem.cost_per_unit) return;

    // Prevent duplicate item names (case-insensitive)
    const duplicateExists = stocks.some(s => s.name.toLowerCase() === newItem.name.trim().toLowerCase());
    if (duplicateExists) {
      alert(`Item "${newItem.name.trim()}" already exists in the inventory.`);
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
      setNewItem({ name: '', unit_value: '', unit_type: 'pcs', cost_per_unit: '', min_stock_alert: '', quantity: '' });
    } else {
      alert("Failed to add stock item.");
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedStock || !stockUpdateAmount) return;
    
    const amount = parseInt(stockUpdateAmount);
    if (isNaN(amount)) return;

    const newQuantity = stockUpdateType === 'add' 
      ? Number(selectedStock.quantity) + amount 
      : Math.max(0, Number(selectedStock.quantity) - amount);

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
  };

  const handleEditSave = async () => {
    if (!selectedStock) return;
    
    // Prevent duplicate item names on edit
    const duplicateExists = stocks.some(s => s.id !== selectedStock.id && s.name.toLowerCase() === selectedStock.name.trim().toLowerCase());
    if (duplicateExists) {
      alert(`Another item named "${selectedStock.name.trim()}" already exists.`);
      return;
    }

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
  };

  const handleDeleteItem = async () => {
    if (!selectedStock) return;

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
  };

  if (role !== 'manager') return null;

  const filteredStocks = stocks.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (statusFilter === 'semua') return true;
    if (statusFilter === 'habis') return s.quantity === 0;
    if (statusFilter === 'tipis') return s.quantity > 0 && s.quantity <= s.min_stock_alert;
    if (statusFilter === 'aman') return s.quantity > s.min_stock_alert;
    return true;
  });

  const totalModal = stocks.reduce((sum, s) => sum + (s.quantity * s.cost_per_unit), 0);
  const lowStockCount = stocks.filter(s => s.quantity <= s.min_stock_alert).length;

  return (
    <MainLayout title="Stock">
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-8">
        <div className="flex items-center justify-between mb-6 lg:mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Stok & Inventaris</h1>
            <p className="text-muted-foreground text-sm lg:text-base">Kelola bahan baku dan modal</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
            <Plus size={18} />
            <span className="hidden sm:inline">Tambah Bahan</span>
          </Button>
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
            
            <div className="flex bg-muted/50 p-1 rounded-lg overflow-x-auto w-full sm:w-auto">
              <button onClick={() => setStatusFilter('semua')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${statusFilter === 'semua' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Semua</button>
              <button onClick={() => setStatusFilter('aman')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${statusFilter === 'aman' ? 'bg-background shadow-sm text-green-500' : 'text-muted-foreground hover:text-foreground'}`}>Aman</button>
              <button onClick={() => setStatusFilter('tipis')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${statusFilter === 'tipis' ? 'bg-background shadow-sm text-amber-500' : 'text-muted-foreground hover:text-foreground'}`}>Stok Tipis</button>
              <button onClick={() => setStatusFilter('habis')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${statusFilter === 'habis' ? 'bg-background shadow-sm text-destructive' : 'text-muted-foreground hover:text-foreground'}`}>Habis</button>
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
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 font-bold text-foreground">
                            <span>{item.name}</span>
                            {isLowStock && <AlertTriangle size={14} className="text-destructive" />}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Pembaruan: {formatDate(item.last_updated)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${item.quantity === 0 ? 'bg-destructive/10 text-destructive' : isLowStock ? 'bg-amber-500/10 text-amber-600' : 'bg-green-500/10 text-green-600'}`}>
                            Stok: {item.quantity} <span className="font-normal text-[10px]">(per {item.unit})</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">Batas minimum: {item.min_stock_alert}</span>
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

                      <div className="flex items-center justify-end pt-2 border-t border-border/40">
                        <DropdownMenu>
                          <DropdownMenuTrigger 
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical size={16} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 bg-card border-border">
                            <DropdownMenuItem className="cursor-pointer" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStock(item);
                              setIsUpdateStockDialogOpen(true);
                            }}>
                              Update Stok
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={(e) => {
                              e.stopPropagation();
                              const unitParts = item.unit.match(/^([\d.,]+)\s*(.*)$/);
                              setEditUnitValue(unitParts ? unitParts[1] : item.unit.replace(/[a-zA-Z\s]/g, ''));
                              setEditUnitType(unitParts && unitParts[2] ? unitParts[2] : (item.unit.replace(/[\d.,\s]/g, '') || 'pcs'));
                              setSelectedStock(item);
                              setIsEditDialogOpen(true);
                            }}>
                              Edit Bahan
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStock(item);
                              setIsDeleteDialogOpen(true);
                            }}>
                              Hapus Bahan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                    <th className="font-medium p-4 text-center">Status Stok</th>
                    <th className="font-medium p-4 text-center">Stok Tersedia</th>
                    <th className="font-medium p-4 text-center hidden lg:table-cell">Batas Minimum</th>
                    <th className="font-medium p-4 text-center hidden lg:table-cell">Satuan</th>
                    <th className="font-medium p-4 text-right hidden xl:table-cell">Harga Beli/Satuan</th>
                    <th className="font-medium p-4 text-right">Total Nilai Stok</th>
                    <th className="font-medium p-4 text-center">Pembaruan Terakhir</th>
                    <th className="font-medium p-4 text-right pr-6 w-[80px]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoadingData ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-muted-foreground">
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
                            <td className="p-4 text-center">
                              {item.quantity === 0 ? (
                                <span className="bg-destructive/10 text-destructive text-xs font-bold px-2 py-1 rounded-md inline-block whitespace-nowrap">Habis</span>
                              ) : isLowStock ? (
                                <span className="bg-amber-500/10 text-amber-600 text-xs font-bold px-2 py-1 rounded-md inline-block whitespace-nowrap">Tipis</span>
                              ) : (
                                <span className="bg-green-500/10 text-green-600 text-xs font-bold px-2 py-1 rounded-md inline-block whitespace-nowrap">Aman</span>
                              )}
                            </td>
                            <td className="p-4 text-center font-bold">{item.quantity}</td>
                            <td className="p-4 text-center text-muted-foreground hidden lg:table-cell">{item.min_stock_alert}</td>
                            <td className="p-4 text-center text-muted-foreground hidden lg:table-cell">{item.unit}</td>
                            <td className="p-4 text-right hidden xl:table-cell">Rp {item.cost_per_unit.toLocaleString('id-ID')}</td>
                            <td className="p-4 text-right font-bold text-primary">Rp {(item.quantity * item.cost_per_unit).toLocaleString('id-ID')}</td>
                            <td className="p-4 text-center text-xs text-muted-foreground">{formatDate(item.last_updated)}</td>
                            <td className="p-4 pr-6">
                              <div className="flex items-center justify-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger 
                                    className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical size={16} />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40 bg-card border-border">
                                    <DropdownMenuItem className="cursor-pointer" onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedStock(item);
                                      setIsUpdateStockDialogOpen(true);
                                    }}>
                                      Update Stok
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer" onClick={(e) => {
                                      e.stopPropagation();
                                      const unitParts = item.unit.match(/^([\d.,]+)\s*(.*)$/);
                                      setEditUnitValue(unitParts ? unitParts[1] : item.unit.replace(/[a-zA-Z\s]/g, ''));
                                      setEditUnitType(unitParts && unitParts[2] ? unitParts[2] : (item.unit.replace(/[\d.,\s]/g, '') || 'pcs'));
                                      setSelectedStock(item);
                                      setIsEditDialogOpen(true);
                                    }}>
                                      Edit Bahan
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer" onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedStock(item);
                                      setIsDeleteDialogOpen(true);
                                    }}>
                                      Hapus Bahan
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredStocks.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
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
      </div>

      {/* Add New Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Tambah Bahan Baku Baru</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Nama Bahan</label>
              <Input className="col-span-3 bg-background border-border" placeholder="Cth: Biji Kopi, Susu" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Satuan</label>
              <div className="col-span-3 flex gap-2">
                <Input 
                  type="text" 
                  className="bg-background border-border flex-1" 
                  placeholder="Angka (cth: 20, 1)" 
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
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Harga Beli/Satuan</label>
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
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium text-destructive">Batas Minimum</label>
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
            <DialogTitle>Edit Detail Bahan</DialogTitle>
          </DialogHeader>
          {selectedStock && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Nama Bahan</label>
                <Input className="col-span-3 bg-background border-border" value={selectedStock.name} onChange={e => setSelectedStock({...selectedStock, name: e.target.value})} />
              </div>
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
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Harga Beli/Satuan</label>
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
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Detail Bahan</DialogTitle>
          </DialogHeader>
          {selectedStock && (
            <div className="grid gap-3 py-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Nama Bahan</span>
                <span className="col-span-2 font-medium">{selectedStock.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Status</span>
                <span className="col-span-2">
                  {selectedStock.quantity === 0 ? (
                    <span className="text-destructive font-bold">Habis</span>
                  ) : selectedStock.quantity <= selectedStock.min_stock_alert ? (
                    <span className="text-amber-500 font-bold">Stok Tipis</span>
                  ) : (
                    <span className="text-green-500 font-bold">Aman</span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Satuan</span>
                <span className="col-span-2">{selectedStock.unit}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Sisa Stok</span>
                <span className="col-span-2 font-bold">{selectedStock.quantity}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Batas Minimum</span>
                <span className="col-span-2">{selectedStock.min_stock_alert}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Harga Beli/Satuan</span>
                <span className="col-span-2">Rp {Number(selectedStock.cost_per_unit).toLocaleString('id-ID')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Total Nilai Stok</span>
                <span className="col-span-2 font-bold text-primary">Rp {(selectedStock.quantity * selectedStock.cost_per_unit).toLocaleString('id-ID')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Pembaruan Terakhir</span>
                <span className="col-span-2">{formatDate(selectedStock.last_updated)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailDialogOpen(false)} className="bg-primary text-primary-foreground hover:bg-primary/90">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
