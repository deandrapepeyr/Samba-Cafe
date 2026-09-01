'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Search, Plus, AlertTriangle, ArrowDownUp, Edit, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdateStockDialogOpen, setIsUpdateStockDialogOpen] = useState(false);

  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);

  const [newItem, setNewItem] = useState({
    name: '',
    unit: '',
    cost_per_unit: '',
    min_stock_alert: ''
  });

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

  // Handlers
  const handleAddItem = async () => {
    if (!newItem.name || !newItem.unit || !newItem.cost_per_unit) return;

    const { data, error } = await supabase.from('stocks').insert([{
      name: newItem.name,
      unit: newItem.unit,
      cost_per_unit: parseInt(newItem.cost_per_unit),
      min_stock_alert: parseInt(newItem.min_stock_alert) || 0,
      quantity: 0
    }]).select();

    if (data && !error) {
      setStocks([...stocks, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
      setIsAddDialogOpen(false);
      setNewItem({ name: '', unit: '', cost_per_unit: '', min_stock_alert: '' });
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
    
    const { error } = await supabase
      .from('stocks')
      .update({ 
        name: selectedStock.name, 
        unit: selectedStock.unit, 
        cost_per_unit: selectedStock.cost_per_unit, 
        min_stock_alert: selectedStock.min_stock_alert 
      })
      .eq('id', selectedStock.id);

    if (!error) {
      setStocks(stocks.map(s => s.id === selectedStock.id ? selectedStock : s));
      setIsEditDialogOpen(false);
    } else {
      alert("Failed to edit stock.");
    }
  };

  if (role !== 'manager') return null;

  const filteredStocks = stocks.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalModal = stocks.reduce((sum, s) => sum + (s.quantity * s.cost_per_unit), 0);
  const lowStockCount = stocks.filter(s => s.quantity <= s.min_stock_alert).length;

  return (
    <MainLayout title="Stock">
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-8">
        <div className="flex items-center justify-between mb-6 lg:mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Stock & Inventory</h1>
            <p className="text-muted-foreground text-sm lg:text-base">Manage raw materials and capital</p>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
            <Plus size={18} />
            <span className="hidden sm:inline">Add Item</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">Total Capital (Modal Tertahan)</CardDescription>
              <CardTitle className="text-2xl lg:text-3xl text-primary">Rp {totalModal.toLocaleString('id-ID')}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">Low Stock Alerts</CardDescription>
              <CardTitle className="text-2xl lg:text-3xl flex items-center gap-2 text-destructive">
                {lowStockCount} <span className="text-base font-normal text-muted-foreground">Items</span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-6">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                className="pl-9 bg-background border-border"
                placeholder="Search inventory items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          
          <ScrollArea className="flex-1">
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
                    <div key={item.id} className={`p-4 bg-card border border-border rounded-xl shadow-sm space-y-3 ${isLowStock ? 'bg-destructive/5 border-destructive/30' : ''}`}>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                          <span>{item.name}</span>
                          {isLowStock && <AlertTriangle size={14} className="text-destructive" />}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isLowStock ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                          Stok: {item.quantity} {item.unit}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-semibold uppercase">Modal per Unit</p>
                          <p className="font-medium text-foreground mt-0.5">Rp {item.cost_per_unit.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground/70 font-semibold uppercase">Total Modal</p>
                          <p className="font-bold text-primary mt-0.5">Rp {(item.quantity * item.cost_per_unit).toLocaleString('id-ID')}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-none font-semibold"
                          onClick={() => {
                            setSelectedStock(item);
                            setIsUpdateStockDialogOpen(true);
                          }}
                        >
                          Update Stok
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setSelectedStock(item);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block p-0">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="font-medium p-4 pl-6">Item Name</th>
                    <th className="font-medium p-4 text-center">Stock</th>
                    <th className="font-medium p-4 text-center">Unit</th>
                    <th className="font-medium p-4 text-right">Cost/Unit</th>
                    <th className="font-medium p-4 text-right">Total Modal</th>
                    <th className="font-medium p-4 text-right pr-6">Actions</th>
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
                          <tr key={item.id} className={`hover:bg-muted/50 transition-colors ${isLowStock ? 'bg-destructive/5' : ''}`}>
                            <td className="p-4 pl-6">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isLowStock ? 'text-destructive' : ''}`}>{item.name}</span>
                                {isLowStock && <AlertTriangle size={14} className="text-destructive" />}
                              </div>
                            </td>
                            <td className={`p-4 text-center font-bold ${isLowStock ? 'text-destructive' : ''}`}>{item.quantity}</td>
                            <td className="p-4 text-center text-muted-foreground">{item.unit}</td>
                            <td className="p-4 text-right">Rp {item.cost_per_unit.toLocaleString('id-ID')}</td>
                            <td className="p-4 text-right font-bold text-primary">Rp {(item.quantity * item.cost_per_unit).toLocaleString('id-ID')}</td>
                            <td className="p-4 text-right pr-6">
                              <div className="flex items-center justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-600 border-none"
                                  onClick={() => {
                                    setSelectedStock(item);
                                    setIsUpdateStockDialogOpen(true);
                                  }}
                                >
                                  Update Stok
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setSelectedStock(item);
                                    setIsEditDialogOpen(true);
                                  }}
                                >
                                  <Edit size={16} />
                                </Button>
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
          </ScrollArea>
        </Card>
      </div>

      {/* Add New Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Name</label>
              <Input className="col-span-3 bg-background border-border" placeholder="E.g., Coffee Beans" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Unit</label>
              <Input className="col-span-3 bg-background border-border" placeholder="E.g., kg, pcs, g" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Cost/Unit</label>
              <Input type="number" className="col-span-3 bg-background border-border" placeholder="Rp" value={newItem.cost_per_unit} onChange={e => setNewItem({...newItem, cost_per_unit: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium text-destructive">Alert At</label>
              <Input type="number" className="col-span-3 bg-background border-border" placeholder="Min qty for alert" value={newItem.min_stock_alert} onChange={e => setNewItem({...newItem, min_stock_alert: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem} className="bg-primary text-primary-foreground hover:bg-primary/90">Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Quantity Dialog */}
      <Dialog open={isUpdateStockDialogOpen} onOpenChange={setIsUpdateStockDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Stock Quantity</DialogTitle>
            <DialogDescription>{selectedStock?.name} (Current: {selectedStock?.quantity} {selectedStock?.unit})</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex rounded-md shadow-sm" role="group">
              <button 
                type="button" 
                className={`flex-1 px-4 py-2 text-sm font-medium border rounded-l-lg transition-colors ${stockUpdateType === 'add' ? 'bg-green-500/20 text-green-500 border-green-500/50' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                onClick={() => setStockUpdateType('add')}
              >
                + Stock In
              </button>
              <button 
                type="button" 
                className={`flex-1 px-4 py-2 text-sm font-medium border-y border-r rounded-r-lg transition-colors ${stockUpdateType === 'subtract' ? 'bg-destructive/20 text-destructive border-destructive/50' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                onClick={() => setStockUpdateType('subtract')}
              >
                - Stock Out
              </button>
            </div>
            <div className="relative">
              <Input 
                type="number" 
                className="pr-16 text-lg h-12 bg-background border-border focus-visible:ring-primary" 
                placeholder="Amount" 
                value={stockUpdateAmount} 
                onChange={e => setStockUpdateAmount(e.target.value)} 
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                {selectedStock?.unit}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateStockDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateStock} className="bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Details Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Item Details</DialogTitle>
          </DialogHeader>
          {selectedStock && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Name</label>
                <Input className="col-span-3 bg-background border-border" value={selectedStock.name} onChange={e => setSelectedStock({...selectedStock, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Unit</label>
                <Input className="col-span-3 bg-background border-border" value={selectedStock.unit} onChange={e => setSelectedStock({...selectedStock, unit: e.target.value})} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Cost/Unit</label>
                <Input type="number" className="col-span-3 bg-background border-border" value={selectedStock.cost_per_unit} onChange={e => setSelectedStock({...selectedStock, cost_per_unit: Number(e.target.value)})} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium text-destructive">Alert At</label>
                <Input type="number" className="col-span-3 bg-background border-border" value={selectedStock.min_stock_alert} onChange={e => setSelectedStock({...selectedStock, min_stock_alert: Number(e.target.value)})} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} className="bg-primary text-primary-foreground hover:bg-primary/90">Save Edits</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
