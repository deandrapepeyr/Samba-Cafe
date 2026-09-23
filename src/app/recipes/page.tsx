'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/lib/supabase';
import { Loader2, X, Plus, Search, Info } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export default function RecipesPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!role || role !== 'manager') {
        router.replace('/pos');
      }
    }
  }, [role, isLoading, router]);

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [productIngredients, setProductIngredients] = useState<any[]>([]);
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<'cafe' | 'titipan'>('cafe');
  const [activeCategory, setActiveCategory] = useState<string>('Semua');

  // States for adding new ingredient
  const [newStockId, setNewStockId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddIngredientModalOpen, setIsAddIngredientModalOpen] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoadingData(true);
    const [catRes, prodRes, stockRes, ingRes] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('products').select('*'),
      supabase.from('stocks').select('*'),
      supabase.from('product_ingredients').select('*')
    ]);
    
    if (catRes.data) setCategories(catRes.data);
    if (prodRes.data) setProducts(prodRes.data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    if (stockRes.data) {
      const parsedStocks = stockRes.data.map((s: any) => {
        const match = s.name.match(/^(.*?)\s*\|titipan:(.+?)\|$/);
        if (match) {
          return { ...s, name: match[1], is_titipan: true, titipan_name: match[2], original_name: s.name };
        }
        return { ...s, is_titipan: false, original_name: s.name };
      });
      setStocks(parsedStocks.sort((a, b) => a.name.localeCompare(b.name)));
    }
    if (ingRes.data) setProductIngredients(ingRes.data);
    
    setIsLoadingData(false);
  };

  const handleAddIngredient = async (productId: string) => {
    if (!newStockId || !newQuantity) return;
    setIsAdding(true);
    try {
      const quantity = parseFloat(newQuantity);
      if (isNaN(quantity) || quantity <= 0) {
        alert("Jumlah tidak valid");
        return;
      }

      // Check if already exists
      const existing = productIngredients.find(pi => pi.product_id === productId && pi.stock_id === newStockId);

      if (existing) {
        const { error } = await supabase.from('product_ingredients').update({ quantity_required: quantity }).eq('id', existing.id);
        if (error) throw error;
        setProductIngredients(productIngredients.map(pi => pi.id === existing.id ? { ...pi, quantity_required: quantity } : pi));
      } else {
        const { data, error } = await supabase.from('product_ingredients').insert([{
          product_id: productId,
          stock_id: newStockId,
          quantity_required: quantity
        }]).select();

        if (error) throw error;
        if (data) {
          setProductIngredients([...productIngredients, data[0]]);
        }
      }
      setNewStockId('');
      setNewQuantity('');
      setIsAddIngredientModalOpen(false);
      setStockSearch('');
    } catch (err: any) {
      console.error(err);
      alert("Gagal menambah bahan: " + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteIngredient = async (ingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from('product_ingredients').delete().eq('id', ingId);
      if (error) throw error;
      setProductIngredients(productIngredients.filter(pi => pi.id !== ingId));
    } catch (err: any) {
      console.error(err);
      alert("Gagal menghapus bahan: " + err.message);
    }
  };

  const getHPP = (productId: string) => {
    const ings = productIngredients.filter(pi => pi.product_id === productId);
    let total = 0;
    ings.forEach(ing => {
      const stock = stocks.find(s => s.id === ing.stock_id);
      if (stock) {
        total += (stock.cost_per_unit || 0) * ing.quantity_required;
      }
    });
    return total;
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // 1. Type filter
      if (activeType === 'cafe' && p.is_titipan) return false;
      if (activeType === 'titipan' && !p.is_titipan) return false;
      
      // 2. Search filter
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      // 3. Category filter (only for cafe)
      if (activeType === 'cafe' && activeCategory !== 'Semua') {
        const cat = categories.find(c => c.id === p.category_id);
        if (cat?.name !== activeCategory) return false;
      }
      
      return true;
    });
  }, [products, searchQuery, activeType, activeCategory, categories]);

  // Group by category (for cafe) or by titipan_name (for titipan)
  const groupedProducts = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredProducts.forEach(p => {
      let groupName = 'Lainnya';
      if (activeType === 'cafe') {
        groupName = categories.find(c => c.id === p.category_id)?.name || 'Lainnya';
      } else {
        groupName = p.titipan_name || 'Lainnya';
      }
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(p);
    });
    return groups;
  }, [filteredProducts, activeType, categories]);

  // Calculations for meta line
  const totalItems = filteredProducts.length;
  let avgPct = 0;
  if (totalItems > 0) {
    let sumPct = 0;
    filteredProducts.forEach(p => {
      const hpp = getHPP(p.id);
      const pct = p.price > 0 ? (hpp / p.price) * 100 : 0;
      sumPct += pct;
    });
    avgPct = Math.round(sumPct / totalItems);
  }

  // Generate available categories for chips (only for current type)
  const availableCategories = useMemo(() => {
    if (activeType === 'titipan') return [];
    const usedCatIds = new Set(products.filter(p => !p.is_titipan).map(p => p.category_id));
    const cats = categories.filter(c => usedCatIds.has(c.id)).map(c => c.name);
    return ['Semua', ...cats];
  }, [products, categories, activeType]);

  const pctColor = (p: number) => {
    if (p <= 30) return 'bg-emerald-500';
    if (p <= 45) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [selectedProductId, products]);

  const selectedProductIngredients = useMemo(() => {
    if (!selectedProductId) return [];
    return productIngredients.filter(pi => pi.product_id === selectedProductId);
  }, [selectedProductId, productIngredients]);

  const selectedProductHPP = selectedProductId ? getHPP(selectedProductId) : 0;

  if (role !== 'manager') return null;

  return (
    <MainLayout title="Resep Menu">
      <div className="flex-1 overflow-y-auto bg-[#0a0a0a] min-h-[calc(100vh-64px)] pb-20 relative">
        <div className="max-w-4xl mx-auto p-6 lg:p-8">
          
          {/* Header */}
          <header className="mb-6">
            <h1 className="font-serif text-3xl font-semibold text-white mb-1 tracking-wide">Resep Menu</h1>
            <div className="text-zinc-500 text-sm">
              {totalItems} menu · rata-rata HPP {avgPct}%
            </div>
          </header>

          {/* Toolbar (Type Filter & Search) */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/5 w-fit">
              <button 
                onClick={() => { setActiveType('cafe'); setActiveCategory('Semua'); }}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeType === 'cafe' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-zinc-400 hover:text-white'}`}
              >
                Menu Cafe
              </button>
              <button 
                onClick={() => { setActiveType('titipan'); setActiveCategory('Semua'); }}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeType === 'titipan' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-zinc-400 hover:text-white'}`}
              >
                Titipan
              </button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                placeholder="Cari menu..." 
                className="w-full h-full min-h-[44px] pl-10 pr-4 bg-zinc-900 border border-white/10 rounded-xl text-zinc-100 focus:outline-none focus:border-primary text-sm"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Chips */}
          {activeType === 'cafe' && availableCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-none">
              {availableCategories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full border text-sm transition-colors ${
                    activeCategory === cat 
                      ? 'bg-primary border-primary text-primary-foreground font-semibold' 
                      : 'border-white/10 text-zinc-400 hover:text-white bg-transparent'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {isLoadingData ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p>Memuat data...</p>
            </div>
          ) : Object.keys(groupedProducts).length === 0 ? (
            <div className="text-center p-12 text-zinc-500 text-sm border border-dashed border-white/10 rounded-2xl bg-zinc-900/30">
              Tidak ada menu yang cocok
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedProducts).map(([groupName, items]) => (
                <div key={groupName} className="space-y-2">
                  <div className="flex items-baseline gap-2 mb-3">
                    <h2 className="font-serif text-lg font-medium text-white">{groupName}</h2>
                    <span className="text-xs text-zinc-500 font-sans">{items.length} menu</span>
                  </div>
                  
                  {items.map(product => {
                    const ingredients = productIngredients.filter(pi => pi.product_id === product.id);
                    const hpp = getHPP(product.id);
                    const p = product.price > 0 ? Math.round((hpp / product.price) * 100) : 0;
                    
                    return (
                      <div 
                        key={product.id} 
                        className={`bg-zinc-900 border border-white/5 rounded-xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:bg-zinc-800 cursor-pointer select-none ${selectedProductId === product.id ? 'ring-2 ring-primary/50' : ''}`}
                        onClick={() => {
                          setSelectedProductId(product.id);
                          setNewStockId('');
                          setNewQuantity('');
                        }}
                      >
                        <div className="flex items-center gap-4 p-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-serif font-semibold text-zinc-100 text-base truncate">{product.name}</h3>
                            <p className="font-sans text-xs text-zinc-500 mt-0.5">{ingredients.length} bahan</p>
                          </div>
                          <div className="flex items-center gap-2 w-28 sm:w-32 hidden sm:flex">
                            <div className="flex-1 h-1.5 rounded-full bg-black/50 overflow-hidden">
                              <div className={`h-full rounded-full ${pctColor(p)}`} style={{ width: `${Math.min(p, 100)}%` }} />
                            </div>
                            <span className="text-xs text-zinc-500 w-8 text-right">{p}%</span>
                          </div>
                          <div className="font-semibold text-sm w-24 text-right text-zinc-200">
                            Rp {product.price.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal / Popup for Recipe Editor */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-zinc-950/50">
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="font-serif text-xl font-bold text-white truncate">{selectedProduct.name}</h3>
                <div className="text-zinc-500 text-sm mt-0.5">Rp {selectedProduct.price.toLocaleString('id-ID')}</div>
              </div>
              <button 
                onClick={() => setSelectedProductId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1">
              
              <div className="mb-5 flex items-center gap-2 text-primary/90 bg-primary/10 p-3 rounded-xl border border-primary/20">
                <Info size={16} className="shrink-0" />
                <p className="text-xs">Bahan baku yang tercatat di sini akan otomatis berkurang dari stok saat menu terjual.</p>
              </div>

              <h4 className="text-sm font-semibold text-zinc-300 mb-3">Komposisi Bahan</h4>
              
              <div className="space-y-2 mb-6">
                {selectedProductIngredients.length === 0 ? (
                  <div className="text-zinc-500 text-sm py-8 text-center border-2 border-dashed border-white/5 rounded-xl bg-black/20">
                    Belum ada bahan yang ditambahkan
                  </div>
                ) : (
                  selectedProductIngredients.map((ing) => {
                    const stockItem = stocks.find(s => s.id === ing.stock_id);
                    const cost = (stockItem?.cost_per_unit || 0) * ing.quantity_required;
                    return (
                      <div key={ing.id} className="flex items-center gap-3 p-3 text-sm bg-black/40 border border-white/5 rounded-xl hover:bg-black/60 transition-colors">
                        <span className="flex-1 text-zinc-300">
                          {stockItem?.name || 'Unknown'} — <span className="font-semibold text-zinc-100">{ing.quantity_required}</span><span className="text-zinc-500">{stockItem?.unit?.replace(/[^a-zA-Z]/g, '') || ''}</span>
                        </span>
                        <span className="text-zinc-500 text-xs w-20 text-right">Rp {Math.round(cost).toLocaleString('id-ID')}</span>
                        <button 
                          onClick={(e) => handleDeleteIngredient(ing.id, e)}
                          className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 bg-zinc-950/50 rounded-xl border border-white/5 mb-6">
                <div className="flex justify-between text-sm text-zinc-400 mb-2">
                  <div>Total HPP (Modal):</div>
                  <strong className="text-zinc-200">Rp {Math.round(selectedProductHPP).toLocaleString('id-ID')}</strong>
                </div>
                <div className="flex justify-between text-sm text-zinc-400 pb-2 border-b border-white/5 mb-2">
                  <div>Harga Jual:</div>
                  <strong className="text-zinc-200">Rp {selectedProduct.price.toLocaleString('id-ID')}</strong>
                </div>
                <div className="flex justify-between text-sm text-primary">
                  <div>Estimasi Keuntungan (Margin):</div>
                  <strong className="font-bold">Rp {Math.round(selectedProduct.price - selectedProductHPP).toLocaleString('id-ID')}</strong>
                </div>
              </div>

              <div className="flex justify-end border-t border-white/5 pt-4 mt-2">
                <button 
                  onClick={() => setIsAddIngredientModalOpen(true)}
                  className="px-4 py-2.5 bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <Plus size={16} />
                  Tambah Bahan Baru
                </button>
              </div>

            </div>
          </div>

          {/* Nested Modal for Adding Ingredient */}
          {isAddIngredientModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-950/50 rounded-t-2xl">
                  <h3 className="font-bold text-white">Pilih Bahan Baku</h3>
                  <button 
                    onClick={() => {
                      setIsAddIngredientModalOpen(false);
                      setNewStockId('');
                      setNewQuantity('');
                      setStockSearch('');
                      setIsDropdownOpen(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                
                <div className="p-5 space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Cari & Pilih Bahan</label>
                    <div className="relative">
                      <div 
                        className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-200 cursor-pointer flex justify-between items-center"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      >
                        {newStockId ? stocks.find(s => s.id === newStockId)?.name : 'Pilih bahan baku...'}
                        <svg className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </div>

                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border border-white/10 rounded-xl shadow-2xl z-10 max-h-60 overflow-y-auto overflow-x-hidden">
                          <div className="p-2 sticky top-0 bg-zinc-800 border-b border-white/5">
                            <div className="relative">
                              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                              <input 
                                type="text" 
                                placeholder="Ketik untuk mencari..." 
                                className="w-full bg-black/30 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary"
                                value={stockSearch}
                                onChange={e => setStockSearch(e.target.value)}
                                onClick={e => e.stopPropagation()}
                              />
                            </div>
                          </div>
                          <div className="p-1">
                            {(() => {
                              const selectedProduct = products.find(p => p.id === selectedProductId);
                              let baseFiltered = stocks;
                              if (selectedProduct?.is_titipan) {
                                baseFiltered = stocks.filter(s => s.is_titipan && s.titipan_name?.trim().toLowerCase() === selectedProduct.titipan_name?.trim().toLowerCase());
                              } else {
                                baseFiltered = stocks.filter(s => !s.is_titipan);
                              }
                              
                              const finalStocks = baseFiltered.filter(s => 
                                s.name.toLowerCase().includes(stockSearch.toLowerCase()) || 
                                (s.titipan_name && s.titipan_name.toLowerCase().includes(stockSearch.toLowerCase()))
                              );

                              if (finalStocks.length === 0) {
                                return <div className="px-3 py-4 text-xs text-zinc-500 text-center">Bahan tidak ditemukan</div>;
                              }

                              return finalStocks.map(s => (
                                <div 
                                  key={s.id}
                                  className={`px-3 py-2.5 text-sm rounded-lg cursor-pointer hover:bg-white/10 transition-colors ${newStockId === s.id ? 'bg-primary/20 text-primary font-bold' : 'text-zinc-300'}`}
                                  onClick={() => {
                                    setNewStockId(s.id);
                                    setIsDropdownOpen(false);
                                  }}
                                >
                                  {s.name} 
                                  {s.is_titipan && <span className="text-orange-400 text-[10px] uppercase ml-2 tracking-wider bg-orange-400/10 px-1.5 py-0.5 rounded border border-orange-400/20">{s.titipan_name}</span>}
                                  <span className="text-zinc-500 text-xs ml-1">(Rp {s.cost_per_unit}/{s.unit?.replace(/[^a-zA-Z]/g, '') || ''})</span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Takaran / Jumlah</label>
                    <div className="relative">
                      <input 
                        type="number" step="any"
                        placeholder="Contoh: 1.5"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-primary pr-16"
                        value={newQuantity}
                        onChange={(e) => setNewQuantity(e.target.value)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-bold uppercase">
                        {newStockId ? stocks.find(s => s.id === newStockId)?.unit?.replace(/[^a-zA-Z]/g, '') : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-white/5 bg-zinc-950/50 flex justify-end gap-3 rounded-b-2xl">
                  <button 
                    onClick={() => {
                      setIsAddIngredientModalOpen(false);
                      setNewStockId('');
                      setNewQuantity('');
                      setStockSearch('');
                      setIsDropdownOpen(false);
                    }}
                    className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => handleAddIngredient(selectedProduct.id)}
                    disabled={isAdding || !newStockId || !newQuantity}
                    className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {isAdding ? <Loader2 size={16} className="animate-spin" /> : null}
                    Simpan Bahan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
