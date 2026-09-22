'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChefHat, Search, Plus, Trash2, Loader2, Save, Pencil, Wand2, BookOpen, Package, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

type Product = {
  id: string;
  name: string;
  category_id: string;
  variants?: any[];
  is_titipan: boolean;
  titipan_name: string | null;
};

type Category = {
  id: string;
  name: string;
};

type StockItem = {
  id: string;
  name: string;
  unit: string;
  titipan_name?: string | null;
};

type RecipeIngredient = {
  id: string;
  product_id: string;
  stock_id: string;
  quantity_required: number;
  variant_name?: string;
  choice_name?: string;
};

export default function RecipesPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeIngredient[]>([]);
  
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Dialog State (Keeping only Quick Add Stock)
  const [newIngredient, setNewIngredient] = useState({ stock_id: '', quantity: '', variant_choice: '' });
  const [ingredientSearch, setIngredientSearch] = useState('');
  
  const [isQuickAddStockOpen, setIsQuickAddStockOpen] = useState(false);
  const [newQuickStock, setNewQuickStock] = useState({ name: '', unit: '' });
  const [isSavingQuickStock, setIsSavingQuickStock] = useState(false);
  
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editVariantChoice, setEditVariantChoice] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  // Auto Match State
  const [isAutoMatchModalOpen, setIsAutoMatchModalOpen] = useState(false);
  const [autoMatchPendingItems, setAutoMatchPendingItems] = useState<any[]>([]);
  const [autoMatchStatus, setAutoMatchStatus] = useState<'idle' | 'success'>('idle');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && role !== 'manager') {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  useEffect(() => {
    if (role === 'manager') {
      fetchData();
    }
  }, [role]);

  const fetchData = async () => {
    setIsLoadingData(true);
    const [productsRes, stocksRes, recipesRes, categoriesRes] = await Promise.all([
      supabase.from('products').select('id, name, category_id, variants, is_titipan, titipan_name').order('name'),
      supabase.from('stocks').select('id, name, unit, titipan_name').order('name'),
      supabase.from('product_ingredients').select('*'),
      supabase.from('categories').select('id, name').order('name')
    ]);

    if (productsRes.data) setProducts(productsRes.data);
    if (stocksRes.data) setStocks(stocksRes.data);
    if (recipesRes.data) setRecipes(recipesRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    
    setIsLoadingData(false);
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const productIngredients = recipes.filter(r => r.product_id === selectedProductId);
  const filteredStocksForDropdown = stocks.filter(s => selectedProduct?.is_titipan ? s.titipan_name === selectedProduct.titipan_name : !s.titipan_name);

  useEffect(() => {
    if (selectedProduct) {
      const pName = selectedProduct.name.toLowerCase().trim();
      const pNameNoSpace = pName.replace(/\s+/g, '');
      
      let matchedStock = stocks.find(s => s.name.toLowerCase().trim() === pName);
      
      if (!matchedStock) {
         matchedStock = stocks.find(s => {
            const sName = s.name.toLowerCase().trim();
            const sNameNoSpace = sName.replace(/\s+/g, '');
            
            if (sNameNoSpace === pNameNoSpace) return true;
            if (pName.length > 3 && sName.length > 3) {
               if (sName.includes(pName) || pName.includes(sName)) return true;
            }
            return false;
         });
      }
      
      if (matchedStock) {
         setNewIngredient({ stock_id: matchedStock.id, quantity: '', variant_choice: '' });
         setIngredientSearch(matchedStock.name);
      } else {
         setNewIngredient({ stock_id: '', quantity: '', variant_choice: '' });
         setIngredientSearch('');
      }
    }
  }, [selectedProductId, selectedProduct, stocks]);

  const handleAddIngredient = async () => {
    if (!selectedProductId || !newIngredient.stock_id || !newIngredient.quantity) return;
    setIsSaving(true);
    
    const quantity = parseFloat(newIngredient.quantity);
    
    const [varName, choiceName] = newIngredient.variant_choice ? newIngredient.variant_choice.split('::') : [null, null];
    
    const { data, error } = await supabase.from('product_ingredients').insert([{
      product_id: selectedProductId,
      stock_id: newIngredient.stock_id,
      quantity_required: quantity,
      variant_name: varName,
      choice_name: choiceName
    }]).select();

    if (data && !error) {
      setRecipes([...recipes, data[0]]);
      setNewIngredient({ stock_id: '', quantity: '', variant_choice: '' });
    } else {
      alert("Gagal menambah bahan baku. Mungkin tabel product_ingredients belum ada.");
    }
    setIsSaving(false);
  };

  const handleQuickAddStock = async () => {
    if (!newQuickStock.name || !newQuickStock.unit) return;
    setIsSavingQuickStock(true);
    
    const { data, error } = await supabase.from('stocks').insert([{
      name: newQuickStock.name.trim(),
      unit: newQuickStock.unit.trim(),
      cost_per_unit: 0,
      min_stock_alert: 0,
      quantity: 0,
      titipan_name: selectedProduct?.is_titipan ? selectedProduct.titipan_name : null
    }]).select();

    if (data && !error) {
      setStocks([...stocks, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
      setNewIngredient({ ...newIngredient, stock_id: data[0].id });
      setIsQuickAddStockOpen(false);
      setNewQuickStock({ name: '', unit: '' });
    } else {
      alert("Gagal menambahkan bahan baru.");
    }
    setIsSavingQuickStock(false);
  };

  const handleSaveEdit = async () => {
    if (!editingIngredientId || !editQuantity) return;
    setIsSaving(true);
    
    const quantity = parseFloat(editQuantity);
    
    const [varName, choiceName] = editVariantChoice ? editVariantChoice.split('::') : [null, null];
    
    const { error } = await supabase
      .from('product_ingredients')
      .update({ quantity_required: quantity, variant_name: varName, choice_name: choiceName })
      .eq('id', editingIngredientId);

    if (!error) {
      setRecipes(recipes.map(r => r.id === editingIngredientId ? { ...r, quantity_required: quantity, variant_name: varName || undefined, choice_name: choiceName || undefined } : r));
      setEditingIngredientId(null);
    } else {
      alert("Gagal mengubah takaran bahan baku.");
    }
    setIsSaving(false);
  };

  const confirmRemoveIngredient = async () => {
    if (!itemToDelete) return;
    setIsSaving(true);
    
    const { error } = await supabase.from('product_ingredients').delete().eq('id', itemToDelete);
    if (!error) {
      setRecipes(recipes.filter(r => r.id !== itemToDelete));
      setItemToDelete(null);
    } else {
      alert("Gagal menghapus bahan baku.");
    }
    setIsSaving(false);
  };

  const handleOpenAutoMatch = () => {
    const newRecipesToInsert: any[] = [];
    
    products.forEach(p => {
      const hasRecipe = recipes.some(r => r.product_id === p.id);
      if (!hasRecipe) {
        const pName = p.name.toLowerCase().trim();
        const pNameNoSpace = pName.replace(/\s+/g, '');
        
        let matchedStock = stocks.find(s => s.name.toLowerCase().trim() === pName);
        
        if (!matchedStock) {
           matchedStock = stocks.find(s => {
              const sName = s.name.toLowerCase().trim();
              const sNameNoSpace = sName.replace(/\s+/g, '');
              
              if (sNameNoSpace === pNameNoSpace) return true;
              if (pName.length > 3 && sName.length > 3) {
                 if (sName.includes(pName) || pName.includes(sName)) return true;
              }
              return false;
           });
        }

        newRecipesToInsert.push({
          product_id: p.id,
          product_name: p.name,
          stock_id: matchedStock ? matchedStock.id : '',
          stock_name: matchedStock ? matchedStock.name : '',
          quantity_required: 1
        });
      }
    });

    setAutoMatchPendingItems(newRecipesToInsert);
    setAutoMatchStatus('idle');
    setIsAutoMatchModalOpen(true);
  };

  const confirmAutoMatch = async () => {
    const validItems = autoMatchPendingItems.filter(item => item.stock_id);
    if (validItems.length === 0) {
      setIsAutoMatchModalOpen(false);
      return;
    }
    
    setIsSaving(true);
    const inserts = validItems.map(item => ({
      product_id: item.product_id,
      stock_id: item.stock_id,
      quantity_required: item.quantity_required
    }));

    const { data, error } = await supabase.from('product_ingredients').insert(inserts).select();
    
    if (data && !error) {
      setRecipes([...recipes, ...data]);
      setAutoMatchStatus('success');
    } else {
      alert("Gagal melakukan auto-match.");
    }
    setIsSaving(false);
  };

  const titipanBooks = Array.from(new Set(products.filter(p => p.is_titipan && p.titipan_name).map(p => p.titipan_name as string)));

  const filteredProducts = products.filter(p => {
    if (!p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
    if (selectedBook === 'cafe') return !p.is_titipan;
    if (selectedBook) return p.is_titipan && p.titipan_name === selectedBook;
    return true;
  });

  if (!role) return null;

  return (
    <MainLayout title="Resep Menu">
      <div className="flex flex-col space-y-6 p-4 lg:p-8 max-w-[1600px] mx-auto w-full h-[calc(100vh-64px)] md:h-screen">
        
        {/* Premium Header */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shrink-0">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">Resep Menu</h1>
            <p className="text-sm text-zinc-400">Kelola komposisi bahan baku (BOM) untuk pemotongan stok otomatis saat menu terjual.</p>
          </div>
          <Button 
            onClick={handleOpenAutoMatch}
            disabled={isSaving}
            className="gap-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20 transition-all"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 size={16} />}
            Auto-Match Resep (1:1)
          </Button>
        </div>

        {!selectedBook ? (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-2 overflow-y-auto custom-scrollbar content-start">
            <Card 
              className="group cursor-pointer bg-black/40 backdrop-blur-xl border-amber-500/30 hover:border-amber-500 overflow-hidden rounded-3xl shadow-2xl transition-all duration-300 hover:scale-[1.03]"
              onClick={() => setSelectedBook('cafe')}
            >
              <CardContent className="p-8 flex flex-col items-center justify-center text-center h-full relative min-h-[220px]">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-50" />
                <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.15)] group-hover:scale-110 transition-transform">
                  <BookOpen size={40} className="text-amber-500" strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-black text-white mb-2 relative z-10">Buku Menu Utama</h3>
                <p className="text-sm text-amber-500/80 font-bold uppercase tracking-wider relative z-10">
                  {products.filter(p => !p.is_titipan).length} Menu Tersedia
                </p>
              </CardContent>
            </Card>

            {titipanBooks.map(titipanName => {
              const bookProducts = products.filter(p => p.is_titipan && p.titipan_name === titipanName);
              return (
                <Card 
                  key={titipanName}
                  className="group cursor-pointer bg-black/40 backdrop-blur-xl border-white/10 hover:border-white/30 overflow-hidden rounded-3xl shadow-2xl transition-all duration-300 hover:scale-[1.03]"
                  onClick={() => setSelectedBook(titipanName)}
                >
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center h-full relative min-h-[220px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
                    <div className="w-20 h-20 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 border border-white/5 group-hover:scale-110 transition-transform">
                      <Package size={40} className="text-zinc-400" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 relative z-10">Titipan: {titipanName}</h3>
                    <p className="text-sm text-zinc-500 font-medium relative z-10">
                      {bookProducts.length} Produk
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
            {/* Left Panel: Product List */}
            <Card className="flex-1 md:w-1/3 max-w-sm flex flex-col bg-black/40 backdrop-blur-xl border-white/10 overflow-hidden rounded-3xl shadow-2xl">
              <CardHeader className="border-b border-white/5 p-5 bg-white/[0.02]">
                <Button 
                  variant="ghost" 
                  onClick={() => { setSelectedBook(null); setSelectedProductId(null); }}
                  className="w-fit -ml-2 mb-2 text-zinc-400 hover:text-white hover:bg-white/5 h-8 px-2"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Rak Buku
                </Button>
                <CardTitle className="text-lg font-bold text-white">
                  {selectedBook === 'cafe' ? 'Menu Utama Cafe' : `Titipan: ${selectedBook}`}
                </CardTitle>
                <div className="relative mt-3">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <Input 
                    className="pl-10 bg-black/50 border-white/10 h-10 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/50"
                    placeholder="Cari menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                {/* Categories Filter (Pills) */}
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 mt-3 pt-1">
                  <button 
                    onClick={() => setSelectedCategory('all')}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      selectedCategory === 'all' ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:border-white/10 hover:text-zinc-200'
                    }`}
                  >
                    Semua
                  </button>
                  {categories.map(c => (
                    <button 
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                        selectedCategory === c.id ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:border-white/10 hover:text-zinc-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                  {isLoadingData ? (
                    <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
                      <Loader2 className="w-6 h-6 animate-spin mb-2" />
                      <span className="text-xs">Memuat menu...</span>
                    </div>
                  ) : (
                    filteredProducts.map(product => {
                      const isSelected = selectedProductId === product.id;
                      const count = recipes.filter(r => r.product_id === product.id).length;
                      return (
                        <button
                          key={product.id}
                          onClick={() => setSelectedProductId(product.id)}
                          className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex justify-between items-center group relative overflow-hidden ${
                            isSelected 
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]' 
                              : 'hover:bg-white/5 text-zinc-300 border border-transparent'
                          }`}
                        >
                          {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />}
                          <span className={`font-medium ${isSelected ? 'ml-1' : ''} transition-all`}>{product.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isSelected ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-500 group-hover:bg-white/10 group-hover:text-zinc-400'
                          }`}>
                            {count} bahan
                          </span>
                        </button>
                      );
                    })
                  )}
              </div>
            </Card>

            {/* Right Panel: Recipe Editor */}
            <Card className="flex-[2] flex flex-col bg-black/40 backdrop-blur-xl border-white/10 overflow-hidden rounded-3xl shadow-2xl relative">
              {selectedProduct ? (
                <>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <CardHeader className="border-b border-white/5 p-6 bg-white/[0.02] shrink-0 relative z-10">
                    <div>
                      <CardTitle className="text-2xl font-black text-white">{selectedProduct.name}</CardTitle>
                      <CardDescription className="text-xs text-zinc-400 mt-1.5">Resep ini akan terhubung langsung dengan sistem stok otomatis.</CardDescription>
                    </div>
                  </CardHeader>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                  <div className="space-y-3 mb-8">
                    {productIngredients.length === 0 && (
                      <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center flex flex-col items-center justify-center bg-white/[0.01] mb-6">
                        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-3 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                          <ChefHat size={32} className="text-amber-500/50" strokeWidth={1.5} />
                        </div>
                        <p className="font-bold text-base text-white mb-1">Belum Ada Resep</p>
                        <p className="text-xs text-zinc-500 max-w-sm mx-auto">Tambahkan komposisi bahan baku di bawah ini.</p>
                      </div>
                    )}
                    {productIngredients.map((ing) => {
                      const stock = stocks.find(s => s.id === ing.stock_id);
                      if (editingIngredientId === ing.id) {
                        return (
                          <div key={ing.id} className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row gap-3 items-end transition-all shadow-inner relative z-20">
                             <div className="flex-1 w-full">
                               <label className="text-xs font-bold text-amber-500/80 mb-1.5 block">Bahan Baku (Tetap)</label>
                               <div className="h-11 px-3 bg-black/30 border border-amber-500/20 rounded-xl flex items-center text-sm font-semibold text-white/80">
                                 {stock?.name || 'Unknown'}
                               </div>
                             </div>
                             <div className="w-full sm:w-28">
                               <label className="text-xs font-bold text-amber-500/80 mb-1.5 block">Takaran</label>
                               <Input 
                                 type="number"
                                 step="0.01"
                                 className="bg-black/50 border-amber-500/30 h-11 rounded-xl focus-visible:ring-amber-500/50"
                                 value={editQuantity}
                                 onChange={e => setEditQuantity(e.target.value)}
                               />
                             </div>
                             <div className="flex-[2] w-full">
                               <label className="text-xs font-bold text-amber-500/80 mb-1.5 block">Spesifik Varian</label>
                               <div className="relative group">
                                 <button 
                                   type="button"
                                   className="w-full bg-black/50 border border-amber-500/30 text-white text-sm rounded-xl h-11 px-3 text-left focus:ring-1 focus:ring-amber-500 outline-none flex items-center justify-between peer"
                                 >
                                   <span className="truncate">
                                     {!editVariantChoice ? 'Semua Varian (Dasar)' : editVariantChoice.replace('::', ' - ')}
                                   </span>
                                   <svg className="w-4 h-4 text-amber-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                 </button>
                                 
                                 <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-amber-500/30 rounded-xl shadow-2xl z-50 opacity-0 invisible peer-focus:opacity-100 peer-focus:visible hover:opacity-100 hover:visible transition-all max-h-[200px] overflow-y-auto custom-scrollbar">
                                   <div 
                                     className="px-4 py-2.5 hover:bg-amber-500/10 cursor-pointer text-sm border-b border-amber-500/10 font-medium text-zinc-200"
                                     onMouseDown={(e) => { e.preventDefault(); setEditVariantChoice(''); }}
                                   >
                                     Semua Varian (Dasar)
                                   </div>
                                   {selectedProduct.variants?.map((v, vIdx) => (
                                     <div key={vIdx}>
                                       <div className="px-3 py-1 bg-amber-500/10 text-[10px] font-bold text-amber-500 uppercase tracking-wider">{v.name}</div>
                                       {v.choices.map((c: any) => (
                                         <div 
                                           key={`${v.name}::${c.name}`} 
                                           className="px-4 py-2 hover:bg-white/5 cursor-pointer text-sm border-b border-amber-500/10 last:border-0 pl-6 flex items-center gap-2"
                                           onMouseDown={(e) => { e.preventDefault(); setEditVariantChoice(`${v.name}::${c.name}`); }}
                                         >
                                           <div className={`w-1.5 h-1.5 rounded-full ${editVariantChoice === `${v.name}::${c.name}` ? 'bg-amber-500' : 'bg-white/20'}`} />
                                           <span className={editVariantChoice === `${v.name}::${c.name}` ? 'text-amber-500 font-bold' : 'text-zinc-300'}>{c.name}</span>
                                         </div>
                                       ))}
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             </div>
                             <div className="flex gap-2">
                               <Button variant="ghost" onClick={() => setEditingIngredientId(null)} className="h-11 w-11 p-0 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl">X</Button>
                               <Button onClick={handleSaveEdit} disabled={isSaving || !editQuantity} className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-11 px-4 rounded-xl shrink-0 shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95">
                                 {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
                               </Button>
                             </div>
                          </div>
                        );
                      }
                      return (
                        <div key={ing.id} className="group flex items-center justify-between p-4 bg-black/40 border border-white/5 hover:border-white/10 rounded-2xl transition-all hover:bg-white/[0.03]">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800/50 border border-white/5 flex items-center justify-center shrink-0">
                              <ChefHat size={18} className="text-zinc-500" />
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm">{stock?.name || 'Unknown Stock'}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-zinc-500">Memotong</span>
                                <span className="text-[11px] font-black text-amber-400 bg-amber-400/10 px-1.5 py-[1px] rounded-[4px] border border-amber-400/20">
                                  {ing.quantity_required} <span className="font-semibold opacity-90 text-[9px] ml-[2px]">{/^\d/.test(stock?.unit || '') ? `(${stock?.unit})` : stock?.unit}</span>
                                </span>
                                <span className="text-xs text-zinc-500">per porsi</span>
                                {ing.variant_name && ing.choice_name && (
                                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-[1px] rounded-[4px] border border-emerald-400/20 ml-2">
                                    Khusus: {ing.variant_name} - {ing.choice_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg h-8 w-8"
                              onClick={() => {
                                setEditingIngredientId(ing.id);
                                setEditQuantity(ing.quantity_required.toString());
                                setEditVariantChoice(ing.variant_name && ing.choice_name ? `${ing.variant_name}::${ing.choice_name}` : '');
                              }}
                              title="Edit takaran"
                            >
                              <Pencil size={14} strokeWidth={2} />
                            </Button>
                              <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-zinc-500 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all rounded-lg h-8 w-8"
                              onClick={() => setItemToDelete(ing.id)}
                              title="Hapus bahan"
                            >
                              <Trash2 size={14} strokeWidth={2} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Inline Builder Form */}
                  <div className="p-5 rounded-2xl border border-dashed border-white/10 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.02] transition-colors relative shadow-inner mt-auto shrink-0">
                     <h4 className="text-sm font-bold text-zinc-100 mb-1 flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                         <Plus size={14} className="text-white" /> 
                       </div>
                       Tambahkan Komposisi Baru
                     </h4>
                     <p className="text-[11px] text-zinc-400 mb-4 ml-8">Isi lalu simpan untuk menambahkan baris baru ke dalam daftar resep di atas.</p>
                     <div className="flex flex-col xl:flex-row gap-4 items-end">
                       
                       <div className="flex-[2] w-full relative">
                         <div className="flex items-center justify-between mb-1.5">
                           <label className="text-xs text-zinc-400 font-semibold block">Cari Bahan Baku</label>
                           <button 
                             onClick={() => setIsQuickAddStockOpen(true)} 
                             className="flex items-center text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 px-2 py-1 rounded-md font-bold transition-all"
                           >
                             <Plus size={10} className="mr-1" /> Stok Baru
                           </button>
                         </div>
                         <div className="relative group">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                           <input 
                             className="w-full bg-black/50 border border-white/10 text-white text-sm rounded-xl h-11 pl-9 pr-3 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-zinc-600 peer"
                             placeholder="Ketik untuk mencari..."
                             value={ingredientSearch}
                             onChange={e => {
                               setIngredientSearch(e.target.value);
                               const matched = filteredStocksForDropdown.find(s => `${s.name} (${s.unit})` === e.target.value || s.id === e.target.value);
                               if (matched) {
                                 setNewIngredient({...newIngredient, stock_id: matched.id});
                               } else {
                                 setNewIngredient({...newIngredient, stock_id: ''});
                               }
                             }}
                           />
                           
                           {/* Custom Dropdown List */}
                           <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 opacity-0 invisible peer-focus:opacity-100 peer-focus:visible hover:opacity-100 hover:visible transition-all max-h-[200px] overflow-y-auto custom-scrollbar">
                             {filteredStocksForDropdown.filter(s => s.name.toLowerCase().includes(ingredientSearch.toLowerCase())).map(s => (
                               <div 
                                 key={s.id} 
                                 className="px-4 py-2.5 hover:bg-amber-500/10 cursor-pointer flex justify-between items-center text-sm border-b border-white/5 last:border-0"
                                 onMouseDown={(e) => {
                                   e.preventDefault(); // Prevents input from losing focus immediately
                                   setNewIngredient({...newIngredient, stock_id: s.id});
                                   setIngredientSearch(s.name);
                                 }}
                               >
                                 <span className="font-medium text-zinc-200">{s.name}</span>
                                 <span className="text-[10px] font-bold text-amber-500/80 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">{s.unit}</span>
                               </div>
                             ))}
                             {filteredStocksForDropdown.filter(s => s.name.toLowerCase().includes(ingredientSearch.toLowerCase())).length === 0 && (
                               <div className="px-4 py-3 text-xs text-zinc-500 text-center">Bahan tidak ditemukan</div>
                             )}
                           </div>
                         </div>
                         {newIngredient.stock_id && (
                           <div className="absolute -bottom-5 left-1 text-[10px] text-emerald-500 font-medium">✓ Terpilih: {filteredStocksForDropdown.find(s=>s.id===newIngredient.stock_id)?.name}</div>
                         )}
                       </div>

                       <div className="w-full xl:w-28">
                         <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">Takaran</label>
                         <Input 
                           type="number"
                           step="0.01"
                           placeholder="0"
                           className="bg-black/50 border-white/10 h-11 rounded-xl focus-visible:ring-amber-500"
                           value={newIngredient.quantity}
                           onChange={e => setNewIngredient({...newIngredient, quantity: e.target.value})}
                         />
                       </div>

                       <div className="flex-[2] w-full">
                         <label className="text-xs text-zinc-400 font-semibold mb-1.5 block">Varian (Opsional)</label>
                         <div className="relative group">
                           <button 
                             type="button"
                             className="w-full bg-black/50 border border-white/10 text-white text-sm rounded-xl h-11 px-4 text-left focus:ring-1 focus:ring-amber-500 outline-none flex items-center justify-between peer"
                           >
                             <span className="truncate">
                               {!newIngredient.variant_choice ? 'Semua Varian (Dasar)' : newIngredient.variant_choice.replace('::', ' - ')}
                             </span>
                             <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                           </button>
                           
                           {/* Custom Variant Dropdown */}
                           <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 opacity-0 invisible peer-focus:opacity-100 peer-focus:visible hover:opacity-100 hover:visible transition-all max-h-[200px] overflow-y-auto custom-scrollbar">
                             <div 
                               className="px-4 py-2.5 hover:bg-amber-500/10 cursor-pointer text-sm border-b border-white/5 font-medium text-zinc-200"
                               onMouseDown={(e) => { e.preventDefault(); setNewIngredient({...newIngredient, variant_choice: ''}); }}
                             >
                               Semua Varian (Dasar)
                             </div>
                             {selectedProduct.variants?.map((v, vIdx) => (
                               <div key={vIdx}>
                                 <div className="px-3 py-1.5 bg-black/40 text-[10px] font-bold text-amber-500/70 uppercase tracking-wider">{v.name}</div>
                                 {v.choices.map((c: any) => (
                                   <div 
                                     key={`${v.name}::${c.name}`} 
                                     className="px-4 py-2 hover:bg-white/5 cursor-pointer text-sm border-b border-white/5 last:border-0 pl-6 flex items-center gap-2"
                                     onMouseDown={(e) => { e.preventDefault(); setNewIngredient({...newIngredient, variant_choice: `${v.name}::${c.name}`}); }}
                                   >
                                     <div className={`w-1.5 h-1.5 rounded-full ${newIngredient.variant_choice === `${v.name}::${c.name}` ? 'bg-amber-500' : 'bg-white/20'}`} />
                                     <span className={newIngredient.variant_choice === `${v.name}::${c.name}` ? 'text-amber-500 font-bold' : 'text-zinc-300'}>{c.name}</span>
                                   </div>
                                 ))}
                               </div>
                             ))}
                           </div>
                         </div>
                       </div>
                       
                       <Button 
                         onClick={handleAddIngredient}
                         disabled={isSaving || !newIngredient.stock_id || !newIngredient.quantity}
                         className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 px-6 rounded-xl shrink-0 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 w-full xl:w-auto"
                       >
                         {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                       </Button>
                     </div>
                  </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 bg-white/[0.01]">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <ChefHat size={48} className="text-zinc-600" strokeWidth={1} />
                  </div>
                  <p className="font-bold text-lg text-white mb-2">Pilih Menu</p>
                  <p className="text-sm text-zinc-500 max-w-sm text-center">Pilih salah satu menu di daftar untuk mulai meracik resep dan menghubungkannya dengan inventaris stok.</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Auto-Match Dialog */}
      <Dialog open={isAutoMatchModalOpen} onOpenChange={setIsAutoMatchModalOpen}>
        <DialogContent className="sm:max-w-3xl bg-zinc-950 border border-white/10 text-white max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Wand2 className="text-amber-500" size={20} />
              {autoMatchStatus === 'success' ? 'Sukses Menghubungkan Resep!' : 'Batch Auto-Match Resep'}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {autoMatchStatus === 'success' 
                ? 'Semua menu terpilih telah berhasil dihubungkan dengan stok.' 
                : autoMatchPendingItems.length === 0
                  ? 'Semua menu saat ini sudah memiliki resep komposisi.'
                  : `Ditemukan ${autoMatchPendingItems.length} menu yang belum memiliki resep. Sistem telah menebak stok yang paling mirip, namun Anda dapat mengubahnya di bawah ini.`
              }
            </DialogDescription>
          </DialogHeader>
          
          {autoMatchStatus === 'idle' && autoMatchPendingItems.length > 0 && (
            <ScrollArea className="flex-1 mt-4 border border-white/5 rounded-xl bg-black/50 p-1">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 p-3 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-white/5">
                <div>Menu (Produk)</div>
                <div className="w-8"></div>
                <div>Bahan Baku (Stok)</div>
              </div>
              {autoMatchPendingItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center p-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <span className="font-medium text-sm text-zinc-200">{item.product_name}</span>
                  <span className="text-amber-500/50">↔</span>
                  <div className="relative group">
                    <select 
                      className="w-full bg-black/60 border border-white/10 text-white text-sm rounded-lg h-9 px-3 focus:ring-1 focus:ring-amber-500 outline-none appearance-none"
                      value={item.stock_id}
                      onChange={(e) => {
                        const newItems = [...autoMatchPendingItems];
                        newItems[idx].stock_id = e.target.value;
                        const stock = stocks.find(s => s.id === e.target.value);
                        newItems[idx].stock_name = stock ? stock.name : '';
                        setAutoMatchPendingItems(newItems);
                      }}
                    >
                      <option value="">-- Abaikan (Jangan hubungkan) --</option>
                      {stocks.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                      <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          )}

          <DialogFooter className="mt-6 flex gap-2">
            {autoMatchStatus === 'success' || autoMatchPendingItems.length === 0 ? (
              <Button onClick={() => setIsAutoMatchModalOpen(false)} className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold">
                Tutup
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsAutoMatchModalOpen(false)} className="border-white/10 hover:bg-white/5 text-zinc-300">
                  Batal
                </Button>
                <Button onClick={confirmAutoMatch} disabled={isSaving} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Simpan {autoMatchPendingItems.filter(i => i.stock_id).length} Resep
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Stock Dialog */}
      <Dialog open={isQuickAddStockOpen} onOpenChange={setIsQuickAddStockOpen}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Tambah Bahan Baru</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Bahan yang tidak ada di daftar dapat ditambahkan dengan cepat di sini.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs font-semibold text-zinc-300">Nama Bahan</label>
              <Input
                placeholder="Contoh: Susu Indomilk"
                value={newQuickStock.name}
                onChange={(e) => setNewQuickStock({...newQuickStock, name: e.target.value})}
                className="bg-black/50 border-white/10 focus-visible:ring-amber-500"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-semibold text-zinc-300">Satuan Takaran</label>
              <Input
                placeholder="Contoh: gram, pcs, mililiter, pack"
                value={newQuickStock.unit}
                onChange={(e) => setNewQuickStock({...newQuickStock, unit: e.target.value})}
                className="bg-black/50 border-white/10 focus-visible:ring-amber-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickAddStockOpen(false)} className="border-white/10 hover:bg-white/5 text-zinc-300">Batal</Button>
            <Button onClick={handleQuickAddStock} disabled={!newQuickStock.name || !newQuickStock.unit || isSavingQuickStock} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
              {isSavingQuickStock ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              Simpan Bahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-500 flex items-center gap-2">
              <Trash2 size={20} />
              Hapus Bahan Baku
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Apakah Anda yakin ingin menghapus bahan baku ini dari resep? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setItemToDelete(null)} className="border-white/10 hover:bg-white/5 text-zinc-300">
              Batal
            </Button>
            <Button onClick={confirmRemoveIngredient} disabled={isSaving} className="bg-red-500 hover:bg-red-600 text-white font-bold">
              {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
