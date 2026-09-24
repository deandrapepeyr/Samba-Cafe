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
    sell_price: '',
    is_direct_sell: false
  });

  const [editUnitValue, setEditUnitValue] = useState('');
  const [editUnitType, setEditUnitType] = useState('pcs');
  const [editPackPrice, setEditPackPrice] = useState('');

  const [stockUpdateAmount, setStockUpdateAmount] = useState('');
  const [stockUpdateType, setStockUpdateType] = useState<'add' | 'subtract' | 'set'>('add');
  const [restockPacks, setRestockPacks] = useState('1');
  const [restockPackContent, setRestockPackContent] = useState('');
  const [restockTotalPrice, setRestockTotalPrice] = useState('');

  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');

  const [linkedPrice, setLinkedPrice] = useState<number | null>(null);

  useEffect(() => {
    if (isDetailDialogOpen && selectedStock) {
      if (selectedStock.is_titipan) {
        setLinkedPrice((selectedStock as any).price || 0);
      } else {
        supabase.from('products').select('price').eq('name', selectedStock.name).eq('is_titipan', false).maybeSingle().then(({ data }) => {
          if (data) {
             setLinkedPrice(data.price);
          } else {
             setLinkedPrice(null);
          }
        });
      }
    }
  }, [isDetailDialogOpen, selectedStock]);

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

  useEffect(() => {
    if (isUpdateStockDialogOpen && selectedStock) {
      setStockUpdateType('set');
      setStockUpdateAmount('');
      if (!selectedStock.is_titipan) {
        const unitMatch = selectedStock.unit.match(/^([\d.,]+)/);
        if (unitMatch) {
           setRestockPackContent(unitMatch[1]);
        } else {
           setRestockPackContent('1');
        }
        setRestockPacks('1');
        setRestockTotalPrice('');
      }
    }
  }, [isUpdateStockDialogOpen, selectedStock]);

  const fetchStocks = async () => {
    setIsLoadingData(true);
    const [stocksRes, productsRes] = await Promise.all([
      supabase.from('stocks').select('*').order('name', { ascending: true }),
      supabase.from('products').select('*').eq('is_titipan', true).order('name', { ascending: true })
    ]);
    
    let combined: StockItem[] = [];
    if (stocksRes.data) {
      combined = [...stocksRes.data.map((s: any) => {
        const match = s.name.match(/^(.*?)\s*\|titipan:(.+?)\|$/);
        if (match) {
          return { ...s, name: match[1], is_titipan: true, titipan_name: match[2], original_name: s.name };
        }
        return { ...s, is_titipan: false, original_name: s.name };
      })];
    }
    if (productsRes.data) {
      // Build a set of titipan product names already present from the stocks table
      const existingTitipanNames = new Set(
        combined.filter(s => s.is_titipan).map(s => s.name.toLowerCase().trim())
      );

      const titipanStocks = productsRes.data
        .filter((p: any) => {
          // Skip if a matching entry already exists from the stocks table
          const baseName = p.name.toLowerCase().trim();
          const withPenitip = p.titipan_name 
            ? `${p.name} (${p.titipan_name})`.toLowerCase().trim() 
            : baseName;
          return !existingTitipanNames.has(baseName) && !existingTitipanNames.has(withPenitip);
        })
        .map((p: any) => ({
          id: p.id,
          name: p.name + (p.titipan_name ? ` (${p.titipan_name})` : ''),
          quantity: p.stock || 0,
          unit: 'pcs',
          cost_per_unit: p.supplier_price || 0,
          min_stock_alert: 0,
          last_updated: p.created_at || new Date().toISOString(),
          is_titipan: true,
          titipan_name: p.titipan_name,
          price: p.price || 0
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

    const { data: catData } = await supabase.from('categories').select('id').limit(1);
    const categoryId = catData && catData.length > 0 ? catData[0].id : '1';

    if (newItem.is_titipan) {
       if (!newItem.titipan_name || !newItem.sell_price) {
           alert("Nama Penitip dan Harga Jual wajib diisi untuk barang titipan.");
           return;
       }

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
           const packedName = newProduct.titipan_name ? `${newProduct.name} |titipan:${newProduct.titipan_name}|` : newProduct.name;
           const { data: stockData } = await supabase.from('stocks').insert([{
               name: packedName,
               quantity: newProduct.stock,
               unit: 'pcs',
               cost_per_unit: newProduct.supplier_price,
               min_stock_alert: 0
           }]).select();

           if (stockData && stockData[0]) {
               await supabase.from('product_ingredients').insert([{
                   product_id: newProduct.id,
                   stock_id: stockData[0].id,
                   quantity_required: 1
               }]);
           }

           const newStockEntry = {
              id: newProduct.id,
              name: newProduct.name,
              original_name: packedName,
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
           setNewItem({ ...newItem, name: '', cost_per_unit: '', min_stock_alert: '', quantity: '', sell_price: '' });
       } else {
           alert("Failed to add titipan item: " + error.message);
       }
    } else {
        if (!newItem.unit_value) {
            alert("Satuan wajib diisi untuk bahan baku cafe.");
            return;
        }
        if (newItem.is_direct_sell && !newItem.sell_price) {
            alert("Harga Jual wajib diisi jika ingin langsung membuat Menu.");
            return;
        }

        const computedCostPerUnit = Math.round(parseInt(newItem.cost_per_unit) / parseFloat(newItem.unit_value)) || 0;
        const computedQuantity = (parseInt(newItem.quantity) || 0) * (parseFloat(newItem.unit_value) || 1);
        
        // Use name hack to store titipan info for cafe stocks
        const packedName = newItem.titipan_name ? `${newItem.name.trim()} |titipan:${newItem.titipan_name.trim()}|` : newItem.name.trim();

        const { data, error } = await supabase.from('stocks').insert([{
          name: packedName,
          unit: `${newItem.unit_value} ${newItem.unit_type}`.trim(),
          cost_per_unit: computedCostPerUnit,
          min_stock_alert: parseInt(newItem.min_stock_alert) || 0,
          quantity: computedQuantity
        }]).select();
    
        if (data && !error) {
          const newStock = data[0];
          
          if (newItem.is_direct_sell) {
             const newProduct = {
                 id: `p${Math.random().toString(36).substr(2, 9)}`,
                 name: newItem.name.trim(),
                 price: parseInt(newItem.sell_price) || 0,
                 category_id: categoryId,
                 image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=400&h=300',
                 is_available: true,
                 is_titipan: false,
                 supplier_price: computedCostPerUnit,
                 stock: computedQuantity,
                 is_quick: false,
                 variants: []
             };
             
             const { error: prodError } = await supabase.from('products').insert([newProduct]);
             if (!prodError) {
                 await supabase.from('product_ingredients').insert([{
                     product_id: newProduct.id,
                     stock_id: newStock.id,
                     quantity_required: 1
                 }]);
             }
          }

          // Also store parsed info back into state
          const parsedStock = {
            ...newStock,
            name: newItem.name.trim(),
            original_name: packedName,
            is_titipan: !!newItem.titipan_name,
            titipan_name: newItem.titipan_name || undefined
          };

          setStocks([...stocks, parsedStock].sort((a, b) => a.name.localeCompare(b.name)));
          setIsAddDialogOpen(false);
          setNewItem({ ...newItem, name: '', cost_per_unit: '', min_stock_alert: '', quantity: '', sell_price: '' });
        } else {
          alert("Failed to add stock item.");
        }
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedStock) return;

    let newQuantity = 0;
    let newCostPerUnit = selectedStock.cost_per_unit;

    if (stockUpdateType === 'add') {
      const amountAdded = parseFloat(stockUpdateAmount) || 0;
      if (amountAdded <= 0) return;
      newQuantity = Number(selectedStock.quantity) + amountAdded;

      const totalPrice = parseInt(restockTotalPrice.replace(/\D/g, '')) || 0;
      if (totalPrice > 0) {
         newCostPerUnit = Math.round(totalPrice / amountAdded);
      }
    } else if (stockUpdateType === 'subtract') {
      const amount = parseInt(stockUpdateAmount) || 0;
      if (amount <= 0) return;
      newQuantity = Math.max(0, Number(selectedStock.quantity) - amount);
    } else if (stockUpdateType === 'set') {
      const amount = parseInt(stockUpdateAmount) || 0;
      newQuantity = Math.max(0, amount);
    }

    if (selectedStock.is_titipan) {
      const { error } = await supabase
        .from('products')
        .update({ stock: newQuantity })
        .eq('id', selectedStock.id);
        
      const { data: pi } = await supabase.from('product_ingredients').select('stock_id').eq('product_id', selectedStock.id).maybeSingle();
      if (pi && pi.stock_id) {
        await supabase.from('stocks').update({ quantity: newQuantity }).eq('id', pi.stock_id);
      }

      if (!error) {
        setStocks(stocks.map(s => s.id === selectedStock.id ? { ...s, quantity: newQuantity } : s));
        setIsUpdateStockDialogOpen(false);
        setSelectedStock(null);
        setStockUpdateAmount('');
      } else {
        alert("Failed to update stock quantity.");
      }
    } else {
      const updates: any = { quantity: newQuantity, last_updated: new Date().toISOString() };
      if (stockUpdateType === 'add' && newCostPerUnit !== selectedStock.cost_per_unit) {
         updates.cost_per_unit = newCostPerUnit;
      }

      const { error } = await supabase
        .from('stocks')
        .update(updates)
        .eq('id', selectedStock.id);

      if (!error) {
        setStocks(stocks.map(s => s.id === selectedStock.id ? { ...s, quantity: newQuantity, last_updated: updates.last_updated, cost_per_unit: newCostPerUnit } : s));
        setIsUpdateStockDialogOpen(false);
        setSelectedStock(null);
        setStockUpdateAmount('');
      } else {
        alert("Failed to update stock quantity.");
      }
    }
  };

  const handleInlineEditSave = async (item: any) => {
    if (!inlineEditValue) {
      setInlineEditId(null);
      return;
    }
    const newQty = parseInt(inlineEditValue);
    if (isNaN(newQty) || newQty === item.quantity) {
       setInlineEditId(null);
       return;
    }
    
    const table = item.is_titipan ? 'products' : 'stocks';
    const updates: any = item.is_titipan ? { stock: newQty } : { quantity: newQty, last_updated: new Date().toISOString() };
    
    const { error } = await supabase.from(table).update(updates).eq('id', item.id);
    if (!error) {
       if (item.is_titipan) {
          const { data: pi } = await supabase.from('product_ingredients').select('stock_id').eq('product_id', item.id).maybeSingle();
          if (pi && pi.stock_id) {
             await supabase.from('stocks').update({ quantity: newQty }).eq('id', pi.stock_id);
          }
       }
       setStocks(stocks.map(s => s.id === item.id ? { ...s, quantity: newQty, last_updated: updates.last_updated || s.last_updated } : s));
    } else {
       alert("Gagal update stok.");
    }
    setInlineEditId(null);
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
          supplier_price: selectedStock.cost_per_unit,
          price: (selectedStock as any).price || 0
        })
        .eq('id', selectedStock.id);

      if (!error) {
        const packedName = selectedStock.titipan_name ? `${selectedStock.name.trim()} |titipan:${selectedStock.titipan_name.trim()}|` : selectedStock.name.trim();
        const { data: pi } = await supabase.from('product_ingredients').select('stock_id').eq('product_id', selectedStock.id).maybeSingle();
        if (pi && pi.stock_id) {
           await supabase.from('stocks').update({ 
             name: packedName,
             cost_per_unit: selectedStock.cost_per_unit
           }).eq('id', pi.stock_id);
        }

        setStocks(stocks.map(s => s.id === selectedStock.id ? { ...selectedStock, original_name: packedName } : s));
        setIsEditDialogOpen(false);
      } else {
        alert("Failed to edit titipan.");
      }
    } else {
      const packedName = selectedStock.titipan_name ? `${selectedStock.name.trim()} |titipan:${selectedStock.titipan_name.trim()}|` : selectedStock.name.trim();
      const { error } = await supabase
        .from('stocks')
        .update({ 
          name: packedName, 
          unit: `${editUnitValue} ${editUnitType}`.trim(), 
          cost_per_unit: editUnitValue && editPackPrice ? Math.round(parseInt(editPackPrice) / parseFloat(editUnitValue)) : selectedStock.cost_per_unit, 
          min_stock_alert: selectedStock.min_stock_alert 
        })
        .eq('id', selectedStock.id);

      if (!error) {
        setStocks(stocks.map(s => s.id === selectedStock.id ? { ...selectedStock, name: selectedStock.name.trim(), original_name: packedName, is_titipan: !!selectedStock.titipan_name, unit: `${editUnitValue} ${editUnitType}`.trim() } : s));
        setIsEditDialogOpen(false);
      } else {
        alert("Failed to edit stock.");
      }
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedStock) return;

    if (selectedStock.is_titipan) {
      const { data: pi } = await supabase.from('product_ingredients').select('stock_id').eq('product_id', selectedStock.id).maybeSingle();
      if (pi && pi.stock_id) {
         await supabase.from('stocks').delete().eq('id', pi.stock_id);
      }
      
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
  const totalProfit = tabStocks.reduce((sum, s) => sum + (s.quantity * (((s as any).price || s.cost_per_unit) - s.cost_per_unit)), 0);
  const lowStockCount = tabStocks.filter(s => s.quantity <= s.min_stock_alert).length;

  return (
    <MainLayout title="Stock">
      <div className="flex-1 overflow-y-auto bg-[#0a0a0a] min-h-[calc(100vh-64px)] pb-20 relative">
        <div className="max-w-6xl mx-auto p-6 lg:p-8">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="font-serif text-3xl font-semibold text-white mb-1 tracking-wide">Stok & Inventaris</h1>
              <div className="text-zinc-500 text-sm">Kelola bahan baku dan barang titipan</div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/5">
                <button 
                  onClick={() => setActiveTab('cafe')}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'cafe' ? 'bg-primary/20 text-primary font-semibold' : 'text-zinc-400 hover:text-white'}`}
                >
                  Bahan Baku Cafe
                </button>
                <button 
                  onClick={() => setActiveTab('titipan')}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'titipan' ? 'bg-primary/20 text-primary font-semibold' : 'text-zinc-400 hover:text-white'}`}
                >
                  Barang Titipan
                </button>
              </div>
              <button 
                onClick={() => { setNewItem({...newItem, is_titipan: activeTab === 'titipan'}); setIsAddDialogOpen(true); }}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                + Tambah {activeTab === 'cafe' ? 'Bahan' : 'Titipan'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[180px] bg-zinc-900 border border-white/5 rounded-2xl p-5">
              <div className="text-zinc-500 text-xs mb-2">{activeTab === 'titipan' ? 'Total Setoran (Modal)' : 'Total Nilai Stok'}</div>
              <div className="font-serif text-2xl font-semibold text-zinc-100">Rp {totalModal.toLocaleString('id-ID')}</div>
            </div>
            {activeTab === 'titipan' && (
              <div className="flex-1 min-w-[180px] bg-zinc-900 border border-white/5 rounded-2xl p-5">
                <div className="text-zinc-500 text-xs mb-2">Estimasi Keuntungan Cafe</div>
                <div className="font-serif text-2xl font-semibold text-primary">Rp {totalProfit.toLocaleString('id-ID')}</div>
              </div>
            )}
            <div className="flex-1 min-w-[180px] bg-zinc-900 border border-white/5 rounded-2xl p-5">
              <div className="text-zinc-500 text-xs mb-2">Peringatan Stok Tipis</div>
              <div className="font-serif text-2xl font-semibold text-red-400">
                {lowStockCount} <small className="font-sans text-sm font-normal text-zinc-500">barang</small>
              </div>
            </div>
            <div className="flex-1 min-w-[180px] bg-zinc-900 border border-white/5 rounded-2xl p-5">
              <div className="text-zinc-500 text-xs mb-2">Jumlah Item</div>
              <div className="font-serif text-2xl font-semibold text-zinc-100">
                {tabStocks.length} <small className="font-sans text-sm font-normal text-zinc-500">item</small>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input 
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-primary"
                placeholder={activeTab === 'cafe' ? "Cari bahan baku..." : "Cari barang titipan..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {activeTab === 'titipan' && titipanNames.length > 0 && (
              <select 
                className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-primary"
                value={penitipFilter}
                onChange={e => setPenitipFilter(e.target.value)}
              >
                <option value="semua">Penitip: Semua</option>
                {titipanNames.map((name, i) => (
                  <option key={i} value={name}>{name}</option>
                ))}
              </select>
            )}
            <select 
              className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-primary"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
            >
              <option value="semua">Status: Semua</option>
              <option value="aman">Status: Aman</option>
              <option value="tipis">Status: Menipis</option>
              <option value="habis">Status: Habis</option>
            </select>
          </div>

          <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap min-w-[800px]">
              <thead className="text-zinc-500 border-b border-white/5 bg-black/20">
                {activeTab === 'cafe' ? (
                  <tr>
                    <th className="font-medium py-3 px-4">Nama Item</th>
                    <th className="font-medium py-3 px-4">Status</th>
                    <th className="font-medium py-3 px-4 w-40">Stok Tersedia</th>
                    <th className="font-medium py-3 px-4">Total Beli Awal</th>
                    <th className="font-medium py-3 px-4">Batas Minimum</th>
                    <th className="font-medium py-3 px-4 text-right">Harga/Satuan</th>
                    <th className="font-medium py-3 px-4 text-right">Total Modal Stok</th>
                    <th className="font-medium py-3 px-4">Pembaruan</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="font-medium py-3 px-4">Nama Produk</th>
                    <th className="font-medium py-3 px-4">Penitip</th>
                    <th className="font-medium py-3 px-4">Status</th>
                    <th className="font-medium py-3 px-4 w-40">Stok Titip</th>
                    <th className="font-medium py-3 px-4">Batas Minimum</th>
                    <th className="font-medium py-3 px-4 text-right">Harga Titip</th>
                    <th className="font-medium py-3 px-4 text-right">Harga Jual</th>
                    <th className="font-medium py-3 px-4 text-right">Untung/pcs</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoadingData ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                      Memuat data...
                    </td>
                  </tr>
                ) : filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      Tidak ada barang yang cocok
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((item) => {
                    const isLow = item.quantity > 0 && item.quantity <= item.min_stock_alert;
                    const isEmpty = item.quantity === 0;
                    
                    let maxStock = item.min_stock_alert > 0 ? item.min_stock_alert * 2 : Math.max(item.quantity, 100);
                    if (activeTab === 'cafe') {
                      const unitMatch = item.unit.match(/^([\d.,]+)/);
                      if (unitMatch) {
                        const parsed = parseFloat(unitMatch[1].replace(/,/g, '.'));
                        if (parsed > 0) maxStock = Math.max(parsed, item.quantity); // Ensures bar doesn't break if quantity > maxStock
                      }
                    }
                    const ratio = Math.min((item.quantity / maxStock) * 100, 100);
                    
                    return (
                      <tr 
                        key={item.id} 
                        className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedStock(item);
                          setIsDetailDialogOpen(true);
                        }}
                      >
                        {activeTab === 'cafe' ? (
                          <>
                            <td className="py-3 px-4 font-serif font-medium text-zinc-100">{item.name}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isEmpty ? 'bg-red-500/10 text-red-500' : isLow ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                {isEmpty ? 'Habis' : isLow ? 'Menipis' : 'Aman'}
                              </span>
                            </td>
                            <td className="py-3 px-4" onClick={(e) => { e.stopPropagation(); setInlineEditId(item.id); setInlineEditValue(item.quantity.toString()); }}>
                              {inlineEditId === item.id ? (
                                <div className="flex flex-col gap-1.5">
                                  <input 
                                    autoFocus
                                    className="w-20 bg-background border border-primary/50 rounded px-2 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={inlineEditValue}
                                    onChange={e => setInlineEditValue(e.target.value.replace(/\D/g, ''))}
                                    onBlur={() => handleInlineEditSave(item)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleInlineEditSave(item); else if (e.key === 'Escape') setInlineEditId(null); }}
                                  />
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5 group/edit relative" title="Klik untuk edit cepat">
                                  <span className="font-semibold text-zinc-200 group-hover/edit:text-primary transition-colors cursor-text">{item.quantity} <span className="text-zinc-500 font-normal text-xs ml-0.5">{item.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</span></span>
                                  <div className="h-1 rounded-full bg-black/50 overflow-hidden">
                                    <div className={`h-full rounded-full ${isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${ratio}%` }} />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-xs">{/^\d/.test(item.unit) ? item.unit : '-'}</td>
                            <td className="py-3 px-4 text-zinc-500 text-xs">{item.min_stock_alert} {item.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</td>
                            <td className="py-3 px-4 text-right tabular-nums text-zinc-200">Rp {item.cost_per_unit.toLocaleString('id-ID')}</td>
                            <td className="py-3 px-4 text-right tabular-nums font-semibold text-primary">Rp {(item.quantity * item.cost_per_unit).toLocaleString('id-ID')}</td>
                            <td className="py-3 px-4 text-zinc-500 text-xs">{formatDate(item.last_updated)}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4 font-serif font-medium text-zinc-100">{item.name}</td>
                            <td className="py-3 px-4 text-zinc-500 text-xs">{item.titipan_name || '-'}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isEmpty ? 'bg-red-500/10 text-red-500' : isLow ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                {isEmpty ? 'Habis' : isLow ? 'Menipis' : 'Aman'}
                              </span>
                            </td>
                            <td className="py-3 px-4" onClick={(e) => { e.stopPropagation(); setInlineEditId(item.id); setInlineEditValue(item.quantity.toString()); }}>
                              {inlineEditId === item.id ? (
                                <div className="flex flex-col gap-1.5">
                                  <input 
                                    autoFocus
                                    className="w-20 bg-background border border-primary/50 rounded px-2 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                    value={inlineEditValue}
                                    onChange={e => setInlineEditValue(e.target.value.replace(/\D/g, ''))}
                                    onBlur={() => handleInlineEditSave(item)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleInlineEditSave(item); else if (e.key === 'Escape') setInlineEditId(null); }}
                                  />
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1.5 group/edit relative" title="Klik untuk edit cepat">
                                  <span className="font-semibold text-zinc-200 group-hover/edit:text-primary transition-colors cursor-text">{item.quantity} <span className="text-zinc-500 font-normal text-xs ml-0.5">pcs</span></span>
                                  <div className="h-1 rounded-full bg-black/50 overflow-hidden">
                                    <div className={`h-full rounded-full ${isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${ratio}%` }} />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-xs">{item.min_stock_alert} pcs</td>
                            <td className="py-3 px-4 text-right tabular-nums text-zinc-500 text-xs">Rp {item.cost_per_unit.toLocaleString('id-ID')}</td>
                            <td className="py-3 px-4 text-right tabular-nums text-zinc-200 font-semibold">Rp {((item as any).price || item.cost_per_unit).toLocaleString('id-ID')}</td>
                            <td className="py-3 px-4 text-right tabular-nums font-semibold text-primary">Rp {(((item as any).price || item.cost_per_unit) - item.cost_per_unit).toLocaleString('id-ID')}</td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                className={`flex-1 h-9 text-xs sm:text-sm ${!newItem.is_titipan ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
              >
                Bahan / Stok (Bisa utk Penitip)
              </Button>
              <Button 
                variant={newItem.is_titipan ? 'default' : 'ghost'} 
                onClick={() => setNewItem({...newItem, is_titipan: true})} 
                className={`flex-1 h-9 text-xs sm:text-sm ${newItem.is_titipan ? 'bg-orange-500 text-white shadow-sm hover:bg-orange-600' : 'text-muted-foreground'}`}
              >
                Menu Titipan (Siap Jual)
              </Button>
            </div>

            {!newItem.is_titipan && (
              <div className="grid grid-cols-4 items-center gap-4 mb-2">
                <div className="col-start-2 col-span-3">
                  <label className="flex items-center gap-2 cursor-pointer p-2 border border-primary/20 bg-primary/5 rounded-lg w-fit transition-colors hover:bg-primary/10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-primary focus:ring-primary border-primary/50"
                      checked={newItem.is_direct_sell}
                      onChange={e => setNewItem({...newItem, is_direct_sell: e.target.checked})}
                    />
                    <span className="text-sm font-semibold text-primary">Jadikan Menu & Jual Langsung</span>
                  </label>
                  <p className="text-[10px] text-muted-foreground mt-1 ml-1">Stok otomatis dibuatkan menu dan siap dijual di Kasir</p>
                </div>
              </div>
            )}

            {!newItem.is_titipan && (
              <div className="grid grid-cols-4 items-center gap-4 overflow-visible">
                <label className="text-right text-sm font-medium">Bahan Titipan?</label>
                <div className="col-span-3 overflow-visible relative">
                  <TitipanAutocomplete 
                    placeholder="Kosongkan jika milik Cafe, isi nama penitip jika titipan" 
                    value={newItem.titipan_name || ''} 
                    onChange={val => setNewItem({...newItem, titipan_name: val})} 
                    options={Array.from(new Set(stocks.filter(s => s.is_titipan && s.titipan_name).map(s => s.titipan_name as string)))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 ml-1">Isi nama penitip jika bahan baku ini disuplai oleh penitip.</p>
                </div>
              </div>
            )}

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
                <label className="text-right text-sm font-medium">1 Kemasan Beli Isinya Berapa?</label>
                <div className="col-span-3 flex gap-2">
                  <Input 
                    type="text" 
                    className="bg-background border-border flex-1" 
                    placeholder="Angka (cth: 5)" 
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
              <label className="text-right text-sm font-medium">{newItem.is_titipan ? 'Harga Setor (Modal)' : 'Total Harga Beli 1 Kemasan'}</label>
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

            {!newItem.is_titipan && (
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium text-primary">Otomatis: Harga Modal 1 {newItem.unit_type || 'Satuan'}</label>
                <div className="col-span-3">
                  <div className="flex h-10 w-full rounded-md border border-input bg-primary/10 px-3 py-2 text-sm text-primary items-center font-bold">
                    Rp {newItem.unit_value && newItem.cost_per_unit ? Number(parseInt(newItem.cost_per_unit) / parseFloat(newItem.unit_value)).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '0'}
                  </div>
                </div>
              </div>
            )}

            {(newItem.is_titipan || newItem.is_direct_sell) && (
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
              <label className="text-right text-sm font-medium">{newItem.is_titipan ? 'Stok Awal' : 'Beli Berapa Kemasan?'}</label>
              <div className="col-span-3 relative">
                <Input 
                  type="text" 
                  className={`bg-background border-border ${!newItem.is_titipan ? 'pr-20' : ''}`}
                  placeholder={newItem.is_titipan ? "Jumlah stok saat ini" : "Angka (cth: 1)"} 
                  value={newItem.quantity === '' ? '' : Number(newItem.quantity).toLocaleString('id-ID')} 
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNewItem({...newItem, quantity: val === '' ? '' : parseInt(val, 10).toString()});
                  }} 
                />
                {!newItem.is_titipan && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">Kemasan</span>}
              </div>
            </div>

            {!newItem.is_titipan && (
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium text-primary">Otomatis: Total Porsi {newItem.unit_type || 'Satuan'}</label>
                <div className="col-span-3">
                  <div className="flex h-10 w-full rounded-md border border-input bg-primary/10 px-3 py-2 text-sm text-primary items-center font-bold">
                    {newItem.quantity && newItem.unit_value ? (parseInt(newItem.quantity) * parseFloat(newItem.unit_value)).toLocaleString('id-ID') : '0'} {newItem.unit_type || 'Satuan'}
                  </div>
                </div>
              </div>
            )}

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
              Stok tercatat di sistem: <span className="font-bold text-foreground">{selectedStock?.quantity}</span> (Satuan: {selectedStock?.unit})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-4">
              <div className="relative">
                <Input 
                  type="number" 
                  className="pr-16 text-sm h-12 bg-background border-border focus-visible:ring-primary" 
                  placeholder="Masukkan sisa stok asli (Update Fisik)..."
                  value={stockUpdateAmount} 
                  onChange={e => {
                     setStockUpdateType('set');
                     setStockUpdateAmount(e.target.value);
                  }} 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                  {selectedStock?.unit.replace(/[\d.,\s]/g, '') || 'pcs'}
                </span>
              </div>
              
              <div className="flex flex-col gap-1 p-3 bg-muted/30 border border-border rounded-lg">
                <span className="text-xs font-medium text-muted-foreground">Nanti stok di sistem akan menjadi:</span>
                <span className="text-xl font-bold text-foreground">
                  {Math.max(0, parseInt(stockUpdateAmount) || 0)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">{selectedStock?.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</span>
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
                  <label className="text-right text-xs font-medium leading-tight">1 Kemasan Beli Isinya Berapa?</label>
                  <div className="col-span-3 flex gap-2">
                    <Input 
                      type="text" 
                      className="bg-background border-border flex-1" 
                      placeholder="Angka (cth: 5)" 
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
                <label className="text-right text-xs font-medium leading-tight">{selectedStock.is_titipan ? 'Harga Setor' : 'Total Harga Beli 1 Kemasan'}</label>
                <div className="relative col-span-3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
                  <Input 
                    type="text" 
                    className="pl-9 bg-background border-border" 
                    value={
                      selectedStock.is_titipan 
                        ? (selectedStock.cost_per_unit === '' as any ? '' : Number(selectedStock.cost_per_unit).toLocaleString('id-ID'))
                        : (editPackPrice === '' ? '' : Number(editPackPrice).toLocaleString('id-ID'))
                    }
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (selectedStock.is_titipan) {
                        setSelectedStock({...selectedStock, cost_per_unit: val === '' ? '' as any : parseInt(val, 10)});
                      } else {
                        setEditPackPrice(val);
                      }
                    }} 
                  />
                </div>
              </div>
              {selectedStock.is_titipan && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right text-xs font-medium leading-tight">Harga Jual</label>
                  <div className="relative col-span-3">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
                    <Input 
                      type="text" 
                      className="pl-9 bg-background border-border" 
                      value={(selectedStock as any).price === '' || (selectedStock as any).price === undefined ? '' : Number((selectedStock as any).price).toLocaleString('id-ID')} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setSelectedStock({...selectedStock, price: val === '' ? '' : parseInt(val, 10)} as any);
                      }} 
                    />
                  </div>
                </div>
              )}
              {!selectedStock.is_titipan && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-xs font-medium leading-tight text-primary">Otomatis: Harga Modal 1 {editUnitType || 'Satuan'}</label>
                    <div className="col-span-3">
                      <div className="flex h-10 w-full rounded-md border border-input bg-primary/10 px-3 py-2 text-sm text-primary items-center font-bold">
                        Rp {editUnitValue && editPackPrice ? Number(parseInt(editPackPrice) / parseFloat(editUnitValue)).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '0'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-xs font-medium leading-tight text-destructive">Peringatan Stok Tipis (Batas Min)</label>
                    <div className="relative col-span-3">
                      <Input 
                        type="text" 
                        className="bg-background border-border pr-12" 
                        value={selectedStock.min_stock_alert === '' as any ? '' : Number(selectedStock.min_stock_alert).toLocaleString('id-ID')} 
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          setSelectedStock({...selectedStock, min_stock_alert: val === '' ? '' as any : parseInt(val, 10)});
                        }} 
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">{editUnitType}</span>
                    </div>
                  </div>
                </>
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
                    <p className="text-[10px] text-primary/80 uppercase font-bold tracking-wider mb-1">Total Modal Stok</p>
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
                  {(() => {
                    let packMultiplier = 1;
                    let baseUnit = selectedStock.unit;
                    if (!selectedStock.is_titipan) {
                      const unitMatch = selectedStock.unit.match(/^([\d.,]+)\s*(.*)/);
                      if (unitMatch) {
                         packMultiplier = parseFloat(unitMatch[1].replace(/,/g, '.'));
                         baseUnit = unitMatch[2] || 'pcs';
                      }
                    }
                    return (
                      <>
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <span className="text-muted-foreground font-medium">{selectedStock.is_titipan ? 'Harga Setor' : `Harga Beli (per 1 ${baseUnit})`}</span>
                          <span className="font-medium text-foreground">Rp {Number(selectedStock.cost_per_unit).toLocaleString('id-ID')} / 1 {baseUnit}</span>
                        </div>
                        {packMultiplier > 1 && (
                          <div className="flex justify-between items-center border-b border-border/50 pb-2">
                            <span className="text-muted-foreground font-medium">Harga Modal Kemasan ({packMultiplier} {baseUnit})</span>
                            <span className="font-medium text-amber-500">Rp {Number(selectedStock.cost_per_unit * packMultiplier).toLocaleString('id-ID')}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {linkedPrice !== null && (
                    <>
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <span className="text-muted-foreground font-medium">Harga Jual</span>
                        <span className="font-medium text-foreground">Rp {Number(linkedPrice).toLocaleString('id-ID')} /{/^\d/.test(selectedStock.unit) ? `(${selectedStock.unit})` : selectedStock.unit}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-border/50 pb-2">
                        <span className="text-muted-foreground font-medium">Estimasi Untung/pcs</span>
                        <span className="font-medium text-green-500">Rp {Number(linkedPrice - selectedStock.cost_per_unit).toLocaleString('id-ID')}</span>
                      </div>
                    </>
                  )}
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
                          const packMultiplier = unitParts ? parseFloat(unitParts[1].replace(/,/g, '.')) : parseFloat(selectedStock!.unit.replace(/[^0-9.,]/g, '') || '1');
                          setEditUnitValue(unitParts ? unitParts[1] : selectedStock!.unit.replace(/[a-zA-Z\s]/g, ''));
                          setEditUnitType(unitParts && unitParts[2] ? unitParts[2] : (selectedStock!.unit.replace(/[\d.,\s]/g, '') || 'pcs'));
                          setEditPackPrice(Math.round(selectedStock!.cost_per_unit * packMultiplier).toString());
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
