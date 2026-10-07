'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Package, Search, Plus, AlertTriangle, ArrowDownUp, Edit, Loader2, Trash2, MoreVertical, Filter, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  is_topping?: boolean;
  sell_price?: number;
  item_type?: string;
  tracking_method?: 'EXACT' | 'CHECKPOINT';
  checkpoint_usage?: number | null;
  usage_since_restock?: number;
  restock_qty_default?: number | null;
  restock_price_default?: number | null;
};

export default function StockPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | 'aman' | 'tipis' | 'habis'>('semua');
  const [penitipFilter, setPenitipFilter] = useState<string>('semua');
  const [activeTab, setActiveTab] = useState<'cafe' | 'topping_cafe' | 'topping_titipan' | 'titipan'>('cafe');

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdateStockDialogOpen, setIsUpdateStockDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false);
  const [isQuickRestockOpen, setIsQuickRestockOpen] = useState(false);

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
    is_direct_sell: false,
    is_topping: false,
    tracking_method: 'EXACT',
    checkpoint_usage: ''
  });

  const [editUnitValue, setEditUnitValue] = useState('');
  const [editUnitType, setEditUnitType] = useState('pcs');
  const [editPackPrice, setEditPackPrice] = useState('');

  const [stockUpdateAmount, setStockUpdateAmount] = useState('');
  const [stockUpdateType, setStockUpdateType] = useState<'add' | 'subtract' | 'set'>('add');
  const [restockPacks, setRestockPacks] = useState('1');
  const [restockPackContent, setRestockPackContent] = useState('');
  const [restockTotalPrice, setRestockTotalPrice] = useState('');

  const [restockData, setRestockData] = useState({ quantity: '', price: '', saveAsDefault: true });

  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');

  const [linkedPrice, setLinkedPrice] = useState<number | null>(null);
  const [checkpointRecommendation, setCheckpointRecommendation] = useState<number | null>(null);

  useEffect(() => {
    if (isDetailDialogOpen && selectedStock?.tracking_method === 'CHECKPOINT') {
      const fetchRec = async () => {
        const { data, error } = await supabase.from('inventory_consumption_cycles')
          .select('actual_usage_count')
          .eq('stock_id', selectedStock.id);
        if (!error && data && data.length > 0) {
          const sum = data.reduce((a, b) => a + (b.actual_usage_count || 0), 0);
          setCheckpointRecommendation(Math.round(sum / data.length));
        } else {
          setCheckpointRecommendation(null);
        }
      };
      fetchRec();
    } else {
      setCheckpointRecommendation(null);
    }
  }, [isDetailDialogOpen, selectedStock?.id]);

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
    let titipanStocks: StockItem[] = [];
    const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();

    if (productsRes.data) {
      titipanStocks = productsRes.data.map((p: any) => ({
        id: p.id,
        name: p.name.trim() + (p.titipan_name ? ` (${p.titipan_name.trim()})` : ''),
        quantity: p.stock || 0,
        unit: 'pcs',
        cost_per_unit: p.supplier_price || 0,
        min_stock_alert: 0,
        last_updated: p.created_at || new Date().toISOString(),
        is_titipan: true,
        titipan_name: p.titipan_name,
        price: p.price || 0,
        tracking_method: 'EXACT',
        item_type: 'INGREDIENT'
      }));
    }

    if (stocksRes.data) {
      const titipanProductNames = new Set(titipanStocks.map(p => normalize(p.name)));
      
      const processedStocks = stocksRes.data.reduce((acc: any[], s: any) => {
        const match = s.name.match(/^(.*?)\s*\|titipan:(.+?)\|$/);
        if (match) {
          const baseName = normalize(match[1]);
          const withPenitip = normalize(`${match[1]} (${match[2]})`);
          // Skip if we already loaded this from products table
          if (titipanProductNames.has(baseName) || titipanProductNames.has(withPenitip)) {
            const targetIndex = titipanStocks.findIndex(p => normalize(p.name) === baseName || normalize(p.name) === withPenitip);
            if (targetIndex !== -1) {
              titipanStocks[targetIndex].is_topping = s.is_topping;
              titipanStocks[targetIndex].sell_price = s.sell_price;
            }
            return acc;
          }
          // Orphan titipan stock (missing from products)
          acc.push({ ...s, name: match[1], is_titipan: true, titipan_name: match[2], original_name: s.name, is_topping: s.is_topping, sell_price: s.sell_price });
        } else {
          acc.push({ ...s, is_titipan: false, original_name: s.name, is_topping: s.is_topping, sell_price: s.sell_price });
        }
        return acc;
      }, []);
      
      combined = [...processedStocks, ...titipanStocks];
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
    if (!newItem.name) return;

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
                min_stock_alert: 0,
                is_topping: newItem.is_topping,
                sell_price: newItem.is_topping ? (parseInt(newItem.sell_price) || 0) : 0
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
              titipan_name: newProduct.titipan_name,
              is_topping: newItem.is_topping,
              sell_price: newItem.is_topping ? (parseInt(newItem.sell_price) || 0) : 0
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

        const computedCostPerUnit = Math.round(parseInt(newItem.cost_per_unit) / parseFloat(newItem.unit_value.replace(/,/g, '.'))) || 0;
        const computedQuantity = (parseInt(newItem.quantity) || 0) * (parseFloat(newItem.unit_value.replace(/,/g, '.')) || 1);
        
        // Use name hack to store titipan info for cafe stocks
        const packedName = newItem.titipan_name ? `${newItem.name.trim()} |titipan:${newItem.titipan_name.trim()}|` : newItem.name.trim();

        const { data, error } = await supabase.from('stocks').insert([{
          name: packedName,
          unit: `${newItem.unit_value} ${newItem.unit_type}`.trim(),
          cost_per_unit: computedCostPerUnit,
          min_stock_alert: newItem.tracking_method === 'EXACT' ? (parseInt(newItem.min_stock_alert) || 0) : 0,
          quantity: newItem.tracking_method === 'EXACT' ? computedQuantity : 0,
          is_topping: newItem.is_topping,
          sell_price: newItem.is_topping ? (parseInt(newItem.sell_price) || 0) : 0,
          item_type: newItem.is_topping ? 'TOPPING' : 'INGREDIENT',
          tracking_method: newItem.tracking_method,
          checkpoint_usage: newItem.tracking_method === 'CHECKPOINT' && newItem.checkpoint_usage !== '' ? parseInt(newItem.checkpoint_usage) : null,
          usage_since_restock: 0,
          // Initial purchase becomes the default for one-click restock
          ...(newItem.tracking_method === 'EXACT' && computedQuantity > 0 ? {
            restock_qty_default: computedQuantity,
            restock_price_default: (parseInt(newItem.cost_per_unit) || 0) * (parseInt(newItem.quantity) || 0)
          } : {})
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
            titipan_name: newItem.titipan_name || undefined,
            is_topping: newItem.is_topping
          };

          setStocks([...stocks, parsedStock].sort((a, b) => a.name.localeCompare(b.name)));
          setIsAddDialogOpen(false);
          setNewItem({ ...newItem, name: '', cost_per_unit: '', min_stock_alert: '', quantity: '', sell_price: '', is_topping: false, tracking_method: 'EXACT', checkpoint_usage: '' });
        } else {
          alert("Failed to add stock item: " + error?.message);
        }
    }
  };

  // Saved restock default, or fall back to the initial pack ("Total Beli Awal" x Harga/Satuan)
  const getRestockDefault = (s: any) => {
    if (!s) return null;
    if (s.restock_qty_default) return { qty: Number(s.restock_qty_default), price: Number(s.restock_price_default || 0) };
    const packQty = parseFloat(String(s.unit || '').replace(/,/g, '.'));
    if (/^\d/.test(s.unit || '') && packQty > 0) return { qty: packQty, price: Math.round(packQty * (s.cost_per_unit || 0)) };
    return null;
  };

  const openRestockDialog = () => {
    const def = getRestockDefault(selectedStock);
    setRestockData({
      quantity: def ? String(def.qty) : '',
      price: def ? String(def.price) : '',
      saveAsDefault: true
    });
    setIsDetailDialogOpen(false);
    setTimeout(() => setIsRestockDialogOpen(true), 150);
  };

  // override = one-click restock using the saved default qty/price
  const handleRestock = async (override?: { quantity: string; price?: string }) => {
    const data = override ? { ...override, price: override.price || '0', saveAsDefault: false } : { ...restockData, price: restockData.price || '0' };
    if (!selectedStock || !data.quantity) return;

    const rQty = parseFloat(data.quantity);
    const rPrice = parseInt(data.price) || 0;
    if (isNaN(rQty) || rQty <= 0) {
        alert("Kuantitas harus valid.");
        return;
    }

    const newUnitCost = rQty > 0 ? Math.round(rPrice / rQty) : 0;
    let finalCostPerUnit = newUnitCost || selectedStock.cost_per_unit || 0;
    let finalQuantity = selectedStock.quantity;
    
    if (selectedStock.tracking_method === 'EXACT') {
      finalQuantity = selectedStock.quantity + rQty;
    }

    try {
      const stockUpdatePayload: any = {
        cost_per_unit: finalCostPerUnit
      };

      if (selectedStock.tracking_method === 'EXACT') {
        stockUpdatePayload.quantity = finalQuantity;
      } else {
        stockUpdatePayload.usage_since_restock = 0; // reset checkpoint
      }

      if (data.saveAsDefault) {
        stockUpdatePayload.restock_qty_default = rQty;
        stockUpdatePayload.restock_price_default = rPrice;
      }

      const { error: stockError } = await supabase
        .from('stocks')
        .update(stockUpdatePayload)
        .eq('id', selectedStock.id);

      if (stockError) throw stockError;

      const { data: restockInserted, error: restockError } = await supabase
        .from('restocks')
        .insert([{
          stock_id: selectedStock.id,
          quantity: rQty,
          price: rPrice,
          unit_cost: newUnitCost,
          unit: selectedStock.unit
        }])
        .select()
        .single();

      if (restockError) throw restockError;

      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert([{
          stock_id: selectedStock.id,
          movement_type: 'RESTOCK',
          quantity_delta: rQty,
          usage_delta: 0,
          reference_type: 'restock_id',
          reference_id: restockInserted.id
        }]);

      if (movementError) throw movementError;

      const updatedStocks = stocks.map(s => {
        if (s.id === selectedStock.id) {
          return {
            ...s,
            cost_per_unit: finalCostPerUnit,
            quantity: selectedStock.tracking_method === 'EXACT' ? finalQuantity : s.quantity,
            usage_since_restock: selectedStock.tracking_method === 'CHECKPOINT' ? 0 : s.usage_since_restock,
            restock_qty_default: data.saveAsDefault ? rQty : s.restock_qty_default,
            restock_price_default: data.saveAsDefault ? rPrice : s.restock_price_default
          };
        }
        return s;
      });
      setStocks(updatedStocks);
      setIsRestockDialogOpen(false);
      setIsDetailDialogOpen(false);
    } catch (e: any) {
      alert("Error saat restock: " + e.message);
    }
  };

  const handleMarkEmpty = async () => {
    if (!selectedStock || selectedStock.tracking_method !== 'CHECKPOINT') return;
    
    // Check if there are unrecorded cycles (usage > 0)
    if (selectedStock.usage_since_restock === 0) {
      const proceed = confirm("Pemakaian masih 0. Apakah Anda yakin bahan ini sudah habis tanpa pemakaian tercatat?");
      if (!proceed) return;
    }

    try {
      // Create cycle
      const { data: cycle, error: cycleError } = await supabase.from('inventory_consumption_cycles').insert({
        stock_id: selectedStock.id,
        actual_usage_count: selectedStock.usage_since_restock
      }).select().single();
      if (cycleError) throw cycleError;

      // Log movement (Audit only, cycle is the source of truth)
      const { error: movError } = await supabase.from('inventory_movements').insert({
        stock_id: selectedStock.id,
        movement_type: 'MARK_EMPTY',
        quantity_delta: 0,
        usage_delta: 0,
        reference_type: 'cycle_id',
        reference_id: cycle.id
      });
      if (movError) console.error("Gagal mencatat log pergerakan (MARK_EMPTY):", movError);

      setIsDetailDialogOpen(false);
      alert("Barang berhasil ditandai habis. Siklus konsumsi telah direkam.");
    } catch(e: any) {
      alert("Gagal tandai habis: " + e.message);
    }
  };

  const handleApplyRecommendation = async () => {
    if (!selectedStock || !checkpointRecommendation) return;
    try {
      const { error } = await supabase.from('stocks').update({
        checkpoint_usage: checkpointRecommendation
      }).eq('id', selectedStock.id);
      if (error) throw error;
      setStocks(stocks.map(s => s.id === selectedStock.id ? { ...s, checkpoint_usage: checkpointRecommendation } : s));
      setSelectedStock({ ...selectedStock, checkpoint_usage: checkpointRecommendation });
      setCheckpointRecommendation(null);
      alert("Saran checkpoint berhasil diterapkan.");
    } catch(e: any) {
      alert("Gagal menerapkan rekomendasi: " + e.message);
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
          cost_per_unit: editUnitValue && editPackPrice ? Math.round(parseInt(editPackPrice) / parseFloat(editUnitValue.replace(/,/g, '.'))) : selectedStock.cost_per_unit, 
          min_stock_alert: selectedStock.min_stock_alert,
          checkpoint_usage: selectedStock.checkpoint_usage,
          is_topping: selectedStock.is_topping,
          sell_price: selectedStock.is_topping ? (selectedStock.sell_price || 0) : 0
        })
        .eq('id', selectedStock.id);

      if (!error) {
        const newCostPerUnit = editUnitValue && editPackPrice ? Math.round(parseInt(editPackPrice) / parseFloat(editUnitValue.replace(/,/g, '.'))) : selectedStock.cost_per_unit;
        setStocks(stocks.map(s => s.id === selectedStock.id ? { 
            ...selectedStock, 
            name: selectedStock.name.trim(), 
            original_name: packedName, 
            is_titipan: !!selectedStock.titipan_name, 
            unit: `${editUnitValue} ${editUnitType}`.trim(), 
            sell_price: selectedStock.sell_price,
            cost_per_unit: newCostPerUnit
        } : s));
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
    if (activeTab === 'cafe') return !s.is_titipan && !s.is_topping;
    if (activeTab === 'topping_cafe') return s.is_topping && !s.is_titipan;
    if (activeTab === 'topping_titipan') return s.is_topping && s.is_titipan;
    if (activeTab === 'titipan') return s.is_titipan && !s.is_topping;
    return true;
  });

  const filteredStocks = tabStocks.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if ((activeTab === 'titipan' || activeTab === 'topping_titipan') && penitipFilter !== 'semua' && s.titipan_name !== penitipFilter) return false;

    if (statusFilter === 'semua') return true;
    if (statusFilter === 'habis') return s.quantity === 0;
    if (statusFilter === 'tipis') return s.quantity > 0 && s.quantity <= s.min_stock_alert;
    if (statusFilter === 'aman') return s.quantity > s.min_stock_alert;
    return true;
  });

  const titipanNames = Array.from(new Set(stocks.filter(s => s.is_titipan && s.titipan_name).map(s => s.titipan_name as string))).sort();


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
                  onClick={() => setActiveTab('topping_cafe')}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'topping_cafe' ? 'bg-primary/20 text-primary font-semibold' : 'text-zinc-400 hover:text-white'}`}
                >
                  Topping Cafe
                </button>
                <button 
                  onClick={() => setActiveTab('topping_titipan')}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'topping_titipan' ? 'bg-primary/20 text-primary font-semibold' : 'text-zinc-400 hover:text-white'}`}
                >
                  Topping Titipan
                </button>
                <button 
                  onClick={() => setActiveTab('titipan')}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'titipan' ? 'bg-primary/20 text-primary font-semibold' : 'text-zinc-400 hover:text-white'}`}
                >
                  Barang Titipan
                </button>
              </div>
              <Link href="/stock/history">
                <button className="px-5 py-2.5 bg-zinc-800 text-zinc-100 rounded-xl text-sm font-semibold hover:bg-zinc-700 transition-colors whitespace-nowrap flex items-center gap-2 border border-white/5">
                  <History size={16} /> Riwayat
                </button>
              </Link>
              <button 
                onClick={() => { setNewItem({...newItem, is_titipan: activeTab === 'titipan' || activeTab === 'topping_titipan', is_topping: activeTab === 'topping_cafe' || activeTab === 'topping_titipan'}); setIsAddDialogOpen(true); }}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                + Tambah {(activeTab === 'topping_cafe' || activeTab === 'topping_titipan') ? 'Topping' : activeTab === 'titipan' ? 'Titipan' : 'Bahan'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-6">
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
                placeholder={activeTab === 'cafe' ? "Cari bahan baku..." : "Cari barang..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {(activeTab === 'titipan' || activeTab === 'topping_titipan') && titipanNames.length > 0 && (
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
                    <th className="font-medium py-3 px-4 w-40">Stok / Pemakaian</th>
                    <th className="font-medium py-3 px-4">Batas / Checkpoint</th>
                    <th className="font-medium py-3 px-4">Pembaruan</th>
                  </tr>
                ) : activeTab === 'titipan' ? (
                  <tr>
                    <th className="font-medium py-3 px-4">Nama Produk</th>
                    <th className="font-medium py-3 px-4">Penitip</th>
                    <th className="font-medium py-3 px-4">Status</th>
                    <th className="font-medium py-3 px-4 w-40">Stok Titip</th>
                    <th className="font-medium py-3 px-4">Batas Minimum</th>
                  </tr>
                ) : activeTab === 'topping_titipan' ? (
                  <tr>
                    <th className="font-medium py-3 px-4">Nama Topping</th>
                    <th className="font-medium py-3 px-4">Penitip</th>
                    <th className="font-medium py-3 px-4">Status</th>
                    <th className="font-medium py-3 px-4 w-40">Stok Tersedia</th>
                    <th className="font-medium py-3 px-4">Batas Minimum</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="font-medium py-3 px-4">Nama Topping</th>
                    <th className="font-medium py-3 px-4">Status</th>
                    <th className="font-medium py-3 px-4 w-40">Stok / Pemakaian</th>
                    <th className="font-medium py-3 px-4">Batas / Checkpoint</th>
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
                    const isCheckpoint = item.tracking_method === 'CHECKPOINT';
                    
                    let isLow = false;
                    let isEmpty = false;
                    let ratio = 0;
                    
                    if (isCheckpoint) {
                      if (item.checkpoint_usage !== null && item.checkpoint_usage !== undefined) {
                        isLow = item.usage_since_restock! >= item.checkpoint_usage;
                        ratio = Math.min((item.usage_since_restock! / item.checkpoint_usage) * 100, 100);
                      }
                    } else {
                      isLow = item.quantity > 0 && item.quantity <= item.min_stock_alert;
                      isEmpty = item.quantity === 0;
                      
                      let maxStock = item.min_stock_alert > 0 ? item.min_stock_alert * 2 : Math.max(item.quantity, 100);
                      if (activeTab === 'cafe') {
                        const unitMatch = item.unit.match(/^([\d.,]+)/);
                        if (unitMatch) {
                          const parsed = parseFloat(unitMatch[1].replace(/,/g, '.'));
                          if (parsed > 0) maxStock = Math.max(parsed, item.quantity);
                        }
                      }
                      ratio = Math.min((item.quantity / maxStock) * 100, 100);
                    }
                    
                    const statusText = isCheckpoint 
                      ? (item.checkpoint_usage === null ? 'Belum diketahui' : (isLow ? 'Perlu Dicek' : 'Aman')) 
                      : (isEmpty ? 'Habis' : isLow ? 'Menipis' : 'Aman');
                      
                    const statusBadgeClass = isCheckpoint 
                      ? (item.checkpoint_usage === null ? 'bg-zinc-500/10 text-zinc-400' : (isLow ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'))
                      : (isEmpty ? 'bg-red-500/10 text-red-500' : isLow ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500');
                      
                    const statusDotClass = isCheckpoint
                      ? (item.checkpoint_usage === null ? 'bg-zinc-500' : (isLow ? 'bg-amber-500' : 'bg-emerald-500'))
                      : (isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500');
                    
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
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadgeClass}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`} />
                                {statusText}
                              </span>
                            </td>
                            <td className="py-3 px-4" onClick={(e) => { if (isCheckpoint) return; e.stopPropagation(); setInlineEditId(item.id); setInlineEditValue(item.quantity.toString()); }}>
                              {inlineEditId === item.id && !isCheckpoint ? (
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
                                <div className="flex flex-col gap-1.5 group/edit relative" title={isCheckpoint ? "" : "Klik untuk edit cepat"}>
                                  <span className={`font-semibold text-zinc-200 transition-colors ${!isCheckpoint && 'group-hover/edit:text-primary cursor-text'}`}>
                                    {isCheckpoint ? `${item.usage_since_restock} pemakaian` : item.quantity} 
                                    {!isCheckpoint && <span className="text-zinc-500 font-normal text-xs ml-0.5">{item.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</span>}
                                  </span>
                                  <div className="h-1 rounded-full bg-black/50 overflow-hidden">
                                    <div className={`h-full rounded-full ${statusDotClass}`} style={{ width: `${ratio}%` }} />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-xs">{isCheckpoint ? (item.checkpoint_usage !== null ? `${item.checkpoint_usage} pemakaian` : 'Belum diketahui') : `${item.min_stock_alert} ${item.unit.replace(/[\d.,\s]/g, '') || 'pcs'}`}</td>
                            <td className="py-3 px-4 text-zinc-500 text-xs">{formatDate(item.last_updated)}</td>
                          </>
                        ) : activeTab === 'titipan' ? (
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
                                  <span className="font-semibold text-zinc-200 group-hover/edit:text-primary transition-colors cursor-text">{item.quantity} <span className="text-zinc-500 font-normal text-xs ml-0.5">{item.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</span></span>
                                  <div className="h-1 rounded-full bg-black/50 overflow-hidden">
                                    <div className={`h-full rounded-full ${isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${ratio}%` }} />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-xs">{item.min_stock_alert} {item.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</td>
                          </>
                        ) : activeTab === 'topping_titipan' ? (
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
                                  <span className="font-semibold text-zinc-200 group-hover/edit:text-primary transition-colors cursor-text">{item.quantity} <span className="text-zinc-500 font-normal text-xs ml-0.5">{item.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</span></span>
                                  <div className="h-1 rounded-full bg-black/50 overflow-hidden">
                                    <div className={`h-full rounded-full ${isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${ratio}%` }} />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-xs">{item.min_stock_alert} {item.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4 font-serif font-medium text-zinc-100">{item.name}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadgeClass}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${statusDotClass}`} />
                                {statusText}
                              </span>
                            </td>
                            <td className="py-3 px-4" onClick={(e) => { if (isCheckpoint) return; e.stopPropagation(); setInlineEditId(item.id); setInlineEditValue(item.quantity.toString()); }}>
                              {inlineEditId === item.id && !isCheckpoint ? (
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
                                <div className="flex flex-col gap-1.5 group/edit relative" title={isCheckpoint ? "" : "Klik untuk edit cepat"}>
                                  <span className={`font-semibold text-zinc-200 transition-colors ${!isCheckpoint && 'group-hover/edit:text-primary cursor-text'}`}>
                                    {isCheckpoint ? `${item.usage_since_restock} pemakaian` : item.quantity} 
                                    {!isCheckpoint && <span className="text-zinc-500 font-normal text-xs ml-0.5">{item.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</span>}
                                  </span>
                                  <div className="h-1 rounded-full bg-black/50 overflow-hidden">
                                    <div className={`h-full rounded-full ${statusDotClass}`} style={{ width: `${ratio}%` }} />
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-500 text-xs">{isCheckpoint ? (item.checkpoint_usage !== null ? `${item.checkpoint_usage} pemakaian` : 'Belum diketahui') : `${item.min_stock_alert} ${item.unit.replace(/[\d.,\s]/g, '') || 'pcs'}`}</td>
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
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-100">{newItem.is_titipan ? 'Tambah Barang Titipan' : 'Tambah Bahan Baku Cafe'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4 max-h-[70vh] overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-white/10">
            
            <div className="flex gap-2 p-1 bg-zinc-900/50 border border-white/5 rounded-xl mb-1">
              <Button 
                variant="ghost" 
                onClick={() => setNewItem({...newItem, is_titipan: false})} 
                className={`flex-1 h-9 text-xs sm:text-sm rounded-lg transition-all ${!newItem.is_titipan ? 'bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Bahan / Stok Cafe
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setNewItem({...newItem, is_titipan: true})} 
                className={`flex-1 h-9 text-xs sm:text-sm rounded-lg transition-all ${newItem.is_titipan ? 'bg-orange-500 text-white font-semibold shadow-sm hover:bg-orange-600' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Barang Titipan
              </Button>
            </div>

            {!newItem.is_titipan && (
              <div className="grid gap-2 p-3 bg-zinc-900/50 border border-white/5 rounded-xl mb-2">
                <label className="text-sm font-medium text-zinc-400">Metode Tracking</label>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    onClick={() => setNewItem({...newItem, tracking_method: 'EXACT'})} 
                    className={`flex-1 h-9 text-xs sm:text-sm rounded-lg transition-all ${newItem.tracking_method === 'EXACT' ? 'bg-primary/20 text-primary font-semibold border border-primary/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}
                  >
                    Jumlah Pasti (EXACT)
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setNewItem({...newItem, tracking_method: 'CHECKPOINT'})} 
                    className={`flex-1 h-9 text-xs sm:text-sm rounded-lg transition-all ${newItem.tracking_method === 'CHECKPOINT' ? 'bg-primary/20 text-primary font-semibold border border-primary/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}
                  >
                    Berdasarkan Pemakaian
                  </Button>
                </div>
              </div>
            )}

            {!newItem.is_titipan && (
              <div className="flex flex-col gap-2 p-3 bg-primary/5 border border-primary/10 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer w-fit">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-white/10 bg-zinc-900"
                    checked={newItem.is_direct_sell}
                    onChange={e => setNewItem({...newItem, is_direct_sell: e.target.checked})}
                  />
                  <span className="text-sm font-semibold text-primary">Jual Langsung di Kasir</span>
                </label>
                <p className="text-xs text-zinc-400 pl-7 leading-relaxed">Menu otomatis dibuat dan langsung bisa dipesan di halaman POS.</p>
              </div>
            )}

            {!newItem.is_titipan && (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-400">Suplier / Penitip (Opsional)</label>
                <div className="relative">
                  <TitipanAutocomplete 
                    placeholder="Contoh: Bu Karti (Kosongkan jika beli sendiri)" 
                    value={newItem.titipan_name || ''} 
                    onChange={val => setNewItem({...newItem, titipan_name: val})} 
                    options={Array.from(new Set(stocks.filter(s => s.is_titipan && s.titipan_name).map(s => s.titipan_name as string)))}
                  />
                </div>
              </div>
            )}

            {newItem.is_titipan && (
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-orange-400">Nama Penitip</label>
                <div className="relative">
                  <TitipanAutocomplete 
                    placeholder="Contoh: Bu Karti" 
                    value={newItem.titipan_name} 
                    onChange={val => setNewItem({...newItem, titipan_name: val})} 
                    options={Array.from(new Set(stocks.filter(s => s.is_titipan && s.titipan_name).map(s => s.titipan_name as string)))}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-400">Nama {newItem.is_titipan ? 'Barang' : 'Bahan'}</label>
              <Input className="bg-zinc-900/50 border-white/10 h-11 rounded-xl focus-visible:ring-primary text-zinc-100" placeholder={newItem.is_titipan ? "Contoh: Cendol" : "Contoh: Susu Diamond"} value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
            </div>

            {!newItem.is_titipan && (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-400">Isi / Berat Beli (Contoh: Beli 10 Pcs, 5 Kg)</label>
                <div className="flex gap-2">
                  <Input 
                    type="text" 
                    className="bg-zinc-900/50 border-white/10 h-11 rounded-xl focus-visible:ring-primary text-zinc-100 flex-1" 
                    placeholder="Angka (cth: 1)" 
                    value={newItem.unit_value} 
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9.,]/g, '');
                      setNewItem({...newItem, unit_value: val});
                    }} 
                  />
                  <select 
                    className="h-11 w-32 rounded-xl border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    value={newItem.unit_type}
                    onChange={e => setNewItem({...newItem, unit_type: e.target.value})}
                  >
                    <option className="bg-zinc-900 text-zinc-100" value="pcs">Pcs</option>
                    <option className="bg-zinc-900 text-zinc-100" value="kg">Kg</option>
                    <option className="bg-zinc-900 text-zinc-100" value="gram">Gram</option>
                    <option className="bg-zinc-900 text-zinc-100" value="liter">Liter</option>
                    <option className="bg-zinc-900 text-zinc-100" value="ml">Ml</option>
                    <option className="bg-zinc-900 text-zinc-100" value="pack">Pack</option>
                    <option className="bg-zinc-900 text-zinc-100" value="botol">Botol</option>
                    <option className="bg-zinc-900 text-zinc-100" value="box">Box</option>
                  </select>
                </div>
              </div>
            )}


            {newItem.tracking_method !== 'CHECKPOINT' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-400">{newItem.is_titipan ? 'Stok Saat Ini' : 'Stok Awal yang Dimasukkan'}</label>
                <div className="relative">
                  <Input 
                    type="text" 
                    className={`bg-zinc-900/50 border-white/10 h-11 rounded-xl focus-visible:ring-primary text-zinc-100 ${!newItem.is_titipan ? 'pr-20' : ''}`}
                    placeholder={newItem.is_titipan ? "Jumlah stok" : "Angka (cth: 1)"} 
                    value={newItem.quantity === '' ? '' : Number(newItem.quantity).toLocaleString('id-ID')} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewItem({...newItem, quantity: val === '' ? '' : parseInt(val, 10).toString()});
                    }} 
                  />
                  {!newItem.is_titipan && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">X (Kali)</span>}
                </div>
              </div>
            )}

            {!newItem.is_titipan && newItem.tracking_method !== 'CHECKPOINT' && (
              <div className="flex justify-between items-center px-4 py-3 bg-zinc-900 rounded-xl border border-white/5">
                <span className="text-sm font-medium text-zinc-400">Total Masuk (Otomatis)</span>
                <span className="font-bold text-zinc-100">
                  {newItem.quantity && newItem.unit_value ? (parseInt(newItem.quantity) * parseFloat(newItem.unit_value)).toLocaleString('id-ID') : '0'} 
                  <span className="text-xs font-normal text-zinc-500 ml-1">{newItem.unit_type || 'Satuan'}</span>
                </span>
              </div>
            )}

            {!newItem.is_titipan && newItem.tracking_method !== 'CHECKPOINT' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-red-400">Batas Minimum (Peringatan)</label>
                <div className="relative">
                  <Input 
                    type="text" 
                    className="bg-zinc-900/50 border-white/10 h-11 rounded-xl focus-visible:ring-red-400/50 text-zinc-100 pr-16" 
                    placeholder="Beri peringatan jika stok di bawah..." 
                    value={newItem.min_stock_alert === '' ? '' : Number(newItem.min_stock_alert).toLocaleString('id-ID')} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewItem({...newItem, min_stock_alert: val === '' ? '' : parseInt(val, 10).toString()});
                    }} 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">{newItem.unit_type || 'Satuan'}</span>
                </div>
              </div>
            )}
            
            {!newItem.is_titipan && newItem.tracking_method === 'CHECKPOINT' && (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-amber-400">Estimasi Pemakaian (Opsional)</label>
                <div className="relative">
                  <Input 
                    type="text" 
                    className="bg-zinc-900/50 border-white/10 h-11 rounded-xl focus-visible:ring-amber-400/50 text-zinc-100 pr-24" 
                    placeholder="Berapa kali pemakaian sampai habis?" 
                    value={newItem.checkpoint_usage === '' ? '' : Number(newItem.checkpoint_usage).toLocaleString('id-ID')} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewItem({...newItem, checkpoint_usage: val === '' ? '' : parseInt(val, 10).toString()});
                    }} 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">Pemakaian</span>
                </div>
                <p className="text-xs text-zinc-500">Kosongkan jika belum tahu, sistem akan menghitung rata-rata nantinya.</p>
              </div>
            )}
          </div>
          <DialogFooter className="pt-2 border-t border-white/5 mt-2">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl h-11" onClick={() => setIsAddDialogOpen(false)}>Batal</Button>
            <Button onClick={handleAddItem} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 font-semibold">Simpan Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Quantity Dialog */}
      <Dialog open={isUpdateStockDialogOpen} onOpenChange={setIsUpdateStockDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-100">Update Stok: <span className="text-primary">{selectedStock?.name}</span></DialogTitle>
            <DialogDescription className="text-zinc-400">
              Stok tercatat di sistem: <span className="font-bold text-zinc-200">{selectedStock?.quantity}</span> (Satuan: {selectedStock?.unit})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-4">
              <div className="relative">
                <Input 
                  type="number" 
                  className="pr-16 text-sm h-12 bg-zinc-900/50 border-white/10 focus-visible:ring-primary text-zinc-100 rounded-xl" 
                  placeholder="Masukkan sisa stok asli (Update Fisik)..."
                  value={stockUpdateAmount} 
                  onChange={e => {
                     setStockUpdateType('set');
                     setStockUpdateAmount(e.target.value);
                  }} 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium text-sm">
                  {selectedStock?.unit.replace(/[\d.,\s]/g, '') || 'pcs'}
                </span>
              </div>
              
              <div className="flex flex-col gap-1 p-4 bg-zinc-900/50 border border-white/5 rounded-xl">
                <span className="text-xs font-medium text-zinc-400">Nanti stok di sistem akan menjadi:</span>
                <span className="text-2xl font-bold text-primary">
                  {Math.max(0, parseInt(stockUpdateAmount) || 0)}
                  <span className="text-sm font-normal text-zinc-500 ml-1">{selectedStock?.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</span>
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2 border-t border-white/5 mt-2">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl h-11" onClick={() => setIsUpdateStockDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateStock} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 font-semibold">Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Restock Confirm Dialog */}
      <Dialog open={isQuickRestockOpen} onOpenChange={setIsQuickRestockOpen}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950/95 backdrop-blur-xl border-white/10 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-100">Restock Cepat</DialogTitle>
            <DialogDescription className="text-zinc-400">Tambah stok sesuai pembelian sebelumnya.</DialogDescription>
          </DialogHeader>
          {(() => {
            const def = getRestockDefault(selectedStock);
            if (!def || !selectedStock) return null;
            const unitLabel = selectedStock.unit?.replace(/[\d.,\s]/g, '') || 'pcs';
            return (
              <div className="space-y-3 py-2">
                <div className="flex justify-between rounded-xl bg-white/5 px-4 py-3">
                  <span className="text-zinc-400">Bahan</span>
                  <span className="font-semibold text-primary">{selectedStock.name}</span>
                </div>
                <div className="flex justify-between rounded-xl bg-white/5 px-4 py-3">
                  <span className="text-zinc-400">Jumlah</span>
                  <span className="font-semibold text-zinc-100">+{def.qty} {unitLabel}</span>
                </div>

                <div className="flex justify-between rounded-xl bg-emerald-500/10 px-4 py-3">
                  <span className="text-emerald-400">Stok setelah restock</span>
                  <span className="font-bold text-emerald-400">
                    {selectedStock.tracking_method === 'CHECKPOINT' ? 'Pemakaian direset ke 0' : `${Number(selectedStock.quantity) + def.qty} ${unitLabel}`}
                  </span>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="pt-2 border-t border-white/5 mt-2">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl h-11" onClick={() => setIsQuickRestockOpen(false)}>Batal</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-semibold"
              onClick={async () => {
                const def = getRestockDefault(selectedStock);
                setIsQuickRestockOpen(false);
                if (def) await handleRestock({ quantity: String(def.qty), price: String(def.price) });
              }}
            >
              Ya, Restock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={isRestockDialogOpen} onOpenChange={setIsRestockDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-100">Restock: <span className="text-primary">{selectedStock?.name}</span></DialogTitle>
            <DialogDescription className="text-zinc-400">
              Masukkan jumlah barang untuk di restock.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-400">Jumlah Beli Baru</label>
              <div className="relative">
                <Input 
                  type="text" 
                  className="bg-zinc-900/50 border-white/10 h-11 rounded-xl focus-visible:ring-primary text-zinc-100 pr-16" 
                  placeholder="Berapa banyak?"
                  value={restockData.quantity} 
                  onChange={e => setRestockData({...restockData, quantity: e.target.value.replace(/[^0-9.,]/g, '')})} 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 font-medium text-sm">
                  {selectedStock?.unit.replace(/[\d.,\s]/g, '') || 'pcs'}
                </span>
              </div>
            </div>



            <label className="flex items-center gap-3 cursor-pointer w-fit mt-4">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-white/10 bg-zinc-900/50 text-primary focus:ring-primary accent-primary"
                checked={restockData.saveAsDefault}
                onChange={e => setRestockData({...restockData, saveAsDefault: e.target.checked})}
              />
              <span className="text-sm font-medium text-zinc-300 select-none">Simpan sebagai default restock (Autofill berikutnya)</span>
            </label>
            
            {selectedStock?.tracking_method === 'CHECKPOINT' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-2">
                <p className="text-xs text-amber-500 font-medium">Note: Restock akan me-reset jumlah pemakaian kembali ke 0.</p>
              </div>
            )}
          </div>
          <DialogFooter className="pt-2 border-t border-white/5 mt-2">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl h-11" onClick={() => setIsRestockDialogOpen(false)}>Batal</Button>
            <Button onClick={() => handleRestock()} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 font-semibold">Simpan Restock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Details Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-100">Edit Detail {selectedStock?.is_titipan ? 'Barang Titipan' : 'Bahan'}</DialogTitle>
          </DialogHeader>
          {selectedStock && (
            <div className="grid gap-5 py-4 max-h-[70vh] overflow-y-auto px-1 scrollbar-thin scrollbar-thumb-white/10">
              {selectedStock.is_titipan && (
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-orange-400">Nama Penitip</label>
                  <div className="relative">
                    <TitipanAutocomplete 
                      placeholder="Contoh: Bu Karti" 
                      value={selectedStock.titipan_name || ''} 
                      onChange={val => setSelectedStock({...selectedStock, titipan_name: val})} 
                      options={Array.from(new Set(stocks.filter(s => s.is_titipan && s.titipan_name).map(s => s.titipan_name as string)))}
                    />
                  </div>
                </div>
              )}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-400">Nama {selectedStock.is_titipan ? 'Barang' : 'Bahan'}</label>
                <Input className="bg-zinc-900/50 border-white/10 h-11 rounded-xl focus-visible:ring-primary text-zinc-100" value={selectedStock.name} onChange={e => setSelectedStock({...selectedStock, name: e.target.value})} />
              </div>
              {!selectedStock.is_titipan && (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-zinc-400">Isi / Berat Beli (Contoh: Beli 10 Pcs, 5 Kg)</label>
                  <div className="flex gap-2">
                    <Input 
                      type="text" 
                      className="bg-zinc-900/50 border-white/10 h-11 rounded-xl focus-visible:ring-primary text-zinc-100 flex-1" 
                      placeholder="Angka (cth: 5)" 
                      value={editUnitValue} 
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9.,]/g, '');
                        setEditUnitValue(val);
                      }} 
                    />
                    <select 
                      className="h-11 w-32 rounded-xl border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                      value={editUnitType}
                      onChange={e => setEditUnitType(e.target.value)}
                    >
                      <option className="bg-zinc-900 text-zinc-100" value="pcs">Pcs</option>
                      <option className="bg-zinc-900 text-zinc-100" value="kg">Kg</option>
                      <option className="bg-zinc-900 text-zinc-100" value="gram">Gram</option>
                      <option className="bg-zinc-900 text-zinc-100" value="liter">Liter</option>
                      <option className="bg-zinc-900 text-zinc-100" value="ml">Ml</option>
                      <option className="bg-zinc-900 text-zinc-100" value="pack">Pack</option>
                      <option className="bg-zinc-900 text-zinc-100" value="botol">Botol</option>
                      <option className="bg-zinc-900 text-zinc-100" value="box">Box</option>
                    </select>
                  </div>
                </div>
              )}

              {!selectedStock.is_titipan && (
                <>
                  {selectedStock.tracking_method === 'EXACT' ? (
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-red-400">Batas Minimum (Peringatan)</label>
                      <div className="relative">
                        <Input 
                          type="text" 
                          className="bg-zinc-900/50 border-white/10 h-11 rounded-xl focus-visible:ring-red-400/50 text-zinc-100 pr-16" 
                          value={selectedStock.min_stock_alert === '' as any ? '' : Number(selectedStock.min_stock_alert).toLocaleString('id-ID')} 
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            setSelectedStock({...selectedStock, min_stock_alert: val === '' ? '' as any : parseInt(val, 10)});
                          }} 
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">{editUnitType}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <label className="text-sm font-medium text-blue-400">Target Pemakaian (Checkpoint)</label>
                      <div className="relative">
                        <Input 
                          type="text" 
                          className="bg-zinc-900/50 border-white/10 h-11 rounded-xl focus-visible:ring-blue-400/50 text-zinc-100 pr-16" 
                          value={selectedStock.checkpoint_usage === null || selectedStock.checkpoint_usage === undefined || selectedStock.checkpoint_usage === '' as any ? '' : Number(selectedStock.checkpoint_usage).toLocaleString('id-ID')} 
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            setSelectedStock({...selectedStock, checkpoint_usage: val === '' ? null : parseInt(val, 10)});
                          }} 
                          placeholder="Kosong = Belum diketahui"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">Kali pakai</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <DialogFooter className="pt-2 border-t border-white/5 mt-2">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl h-11" onClick={() => setIsEditDialogOpen(false)}>Batal</Button>
            <Button onClick={handleEditSave} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 font-semibold">Simpan Edit</Button>
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
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-muted/30 p-4 rounded-xl border border-border flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">{selectedStock.tracking_method === 'CHECKPOINT' ? 'Telah Terpakai' : 'Sisa Stok'}</p>
                    {selectedStock.tracking_method === 'CHECKPOINT' ? (
                      <p className="text-2xl font-black text-amber-500">{selectedStock.usage_since_restock} <span className="text-sm font-medium text-muted-foreground">x</span></p>
                    ) : (
                      <p className="text-2xl font-black text-foreground">{selectedStock.quantity} <span className="text-sm font-medium text-muted-foreground">{/^\d/.test(selectedStock.unit) ? `(${selectedStock.unit})` : selectedStock.unit}</span></p>
                    )}
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
                      {selectedStock.tracking_method === 'CHECKPOINT' ? (
                         selectedStock.checkpoint_usage === null || selectedStock.checkpoint_usage === undefined ? (
                            <span className="text-zinc-400 font-bold bg-zinc-500/10 px-2 py-0.5 rounded-md text-xs">Belum diketahui</span>
                         ) : (selectedStock.usage_since_restock! >= selectedStock.checkpoint_usage!) ? (
                            <span className="text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md text-xs">Perlu Dicek</span>
                         ) : (
                            <span className="text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded-md text-xs">Aman</span>
                         )
                      ) : (
                        selectedStock.quantity === 0 ? (
                          <span className="text-destructive font-bold bg-destructive/10 px-2 py-0.5 rounded-md text-xs">Habis</span>
                        ) : selectedStock.quantity <= selectedStock.min_stock_alert ? (
                          <span className="text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md text-xs">Stok Tipis</span>
                        ) : (
                          <span className="text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded-md text-xs">Aman</span>
                        )
                      )}
                    </span>
                  </div>
                  {!selectedStock.is_titipan && (
                    <div className="flex flex-col border-b border-border/50 pb-2 gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">{selectedStock.tracking_method === 'CHECKPOINT' ? 'Checkpoint Pemakaian' : 'Batas Minimum'}</span>
                        <span className="font-medium text-foreground">
                          {selectedStock.tracking_method === 'CHECKPOINT' 
                            ? (selectedStock.checkpoint_usage !== null ? `${selectedStock.checkpoint_usage} kali pakai` : 'Belum diketahui') 
                            : `${selectedStock.min_stock_alert} ${/^\d/.test(selectedStock.unit) ? `(${selectedStock.unit})` : selectedStock.unit}`
                          }
                        </span>
                      </div>
                      {selectedStock.tracking_method === 'CHECKPOINT' && checkpointRecommendation !== null && checkpointRecommendation !== selectedStock.checkpoint_usage && (
                        <div className="flex justify-between items-center bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
                          <span className="text-xs text-blue-400 font-medium">Saran berdasar riwayat: {checkpointRecommendation}</span>
                          <Button onClick={handleApplyRecommendation} size="sm" className="h-6 text-[10px] bg-blue-500 hover:bg-blue-600 text-white px-2 rounded-md">Gunakan</Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-muted-foreground font-medium">Pembaruan</span>
                    <span className="font-medium text-muted-foreground text-xs">{formatDate(selectedStock.last_updated)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-6">
              {!selectedStock?.is_titipan && getRestockDefault(selectedStock) ? (
                <Button
                    onClick={() => setIsQuickRestockOpen(true)}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20"
                >
                    Restock Cepat: +{getRestockDefault(selectedStock)!.qty}
                </Button>
              ) : null}
              {selectedStock?.tracking_method === 'CHECKPOINT' ? (
                <div className="flex gap-3">
                  <Button 
                      onClick={handleMarkEmpty} 
                      className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20"
                  >
                      Tandai Habis
                  </Button>
                  <Button 
                      onClick={openRestockDialog} 
                      className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl shadow-lg shadow-primary/20"
                  >
                      Restock
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  {!selectedStock?.is_titipan ? (
                    <Button 
                        onClick={openRestockDialog} 
                        className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl shadow-lg shadow-primary/20"
                    >
                        Restock (Manual)
                    </Button>
                  ) : (
                    <Button 
                        onClick={() => {
                          setIsDetailDialogOpen(false);
                          setTimeout(() => setIsUpdateStockDialogOpen(true), 150);
                        }} 
                        className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl shadow-lg shadow-primary/20"
                    >
                        Update Stok
                    </Button>
                  )}
                </div>
              )}

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
