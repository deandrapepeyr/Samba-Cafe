'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChefHat, Search, Plus, Trash2, Loader2, Save, Pencil, Wand2 } from 'lucide-react';
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
};

type StockItem = {
  id: string;
  name: string;
  unit: string;
};

type RecipeIngredient = {
  id: string;
  product_id: string;
  stock_id: string;
  quantity_required: number;
};

export default function RecipesPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeIngredient[]>([]);
  
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [newIngredient, setNewIngredient] = useState({ stock_id: '', quantity: '' });
  
  const [isEditIngredientOpen, setIsEditIngredientOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<RecipeIngredient | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  
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
    const [productsRes, stocksRes, recipesRes] = await Promise.all([
      supabase.from('products').select('id, name, category_id').order('name'),
      supabase.from('stocks').select('id, name, unit').order('name'),
      supabase.from('product_ingredients').select('*')
    ]);

    if (productsRes.data) setProducts(productsRes.data);
    if (stocksRes.data) setStocks(stocksRes.data);
    if (recipesRes.data) setRecipes(recipesRes.data);
    
    setIsLoadingData(false);
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const productIngredients = recipes.filter(r => r.product_id === selectedProductId);

  const handleAddIngredient = async () => {
    if (!selectedProductId || !newIngredient.stock_id || !newIngredient.quantity) return;
    setIsSaving(true);
    
    const quantity = parseFloat(newIngredient.quantity);
    
    const { data, error } = await supabase.from('product_ingredients').insert([{
      product_id: selectedProductId,
      stock_id: newIngredient.stock_id,
      quantity_required: quantity
    }]).select();

    if (data && !error) {
      setRecipes([...recipes, data[0]]);
      setIsAddIngredientOpen(false);
      setNewIngredient({ stock_id: '', quantity: '' });
    } else {
      alert("Gagal menambah bahan baku. Mungkin tabel product_ingredients belum ada.");
    }
    setIsSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editingIngredient || !editQuantity) return;
    setIsSaving(true);
    
    const quantity = parseFloat(editQuantity);
    
    const { error } = await supabase
      .from('product_ingredients')
      .update({ quantity_required: quantity })
      .eq('id', editingIngredient.id);

    if (!error) {
      setRecipes(recipes.map(r => r.id === editingIngredient.id ? { ...r, quantity_required: quantity } : r));
      setIsEditIngredientOpen(false);
      setEditingIngredient(null);
    } else {
      alert("Gagal mengubah takaran bahan baku.");
    }
    setIsSaving(false);
  };

  const handleRemoveIngredient = async (id: string) => {
    if (!confirm('Hapus bahan baku dari resep ini?')) return;
    
    const { error } = await supabase.from('product_ingredients').delete().eq('id', id);
    if (!error) {
      setRecipes(recipes.filter(r => r.id !== id));
    } else {
      alert("Gagal menghapus bahan baku.");
    }
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

        if (matchedStock) {
          newRecipesToInsert.push({
            product_id: p.id,
            product_name: p.name,
            stock_id: matchedStock.id,
            stock_name: matchedStock.name,
            quantity_required: 1
          });
        }
      }
    });

    setAutoMatchPendingItems(newRecipesToInsert);
    setAutoMatchStatus('idle');
    setIsAutoMatchModalOpen(true);
  };

  const confirmAutoMatch = async () => {
    if (autoMatchPendingItems.length === 0) {
      setIsAutoMatchModalOpen(false);
      return;
    }
    
    setIsSaving(true);
    const inserts = autoMatchPendingItems.map(item => ({
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

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

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

        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
        
        {/* Left Panel: Product List */}
        <Card className="flex-1 md:w-1/3 max-w-sm flex flex-col bg-black/40 backdrop-blur-xl border-white/10 overflow-hidden rounded-3xl shadow-2xl">
          <CardHeader className="border-b border-white/5 p-5 bg-white/[0.02]">
            <CardTitle className="text-lg font-bold text-white">Daftar Menu</CardTitle>
            <div className="relative mt-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <Input 
                className="pl-10 bg-black/50 border-white/10 h-10 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-amber-500/50 focus-visible:border-amber-500/50"
                placeholder="Cari menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
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
              
              <CardHeader className="border-b border-white/5 p-6 bg-white/[0.02] flex flex-row items-center justify-between shrink-0 relative z-10">
                <div>
                  <CardTitle className="text-2xl font-black text-white">{selectedProduct.name}</CardTitle>
                  <CardDescription className="text-xs text-zinc-400 mt-1.5">Resep ini akan terhubung langsung dengan sistem stok otomatis.</CardDescription>
                </div>
                <Button onClick={() => setIsAddIngredientOpen(true)} className="gap-2 h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95">
                  <Plus size={18} strokeWidth={2.5} />
                  Tambah Bahan
                </Button>
              </CardHeader>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative z-10">
                {productIngredients.length === 0 ? (
                  <div className="border border-dashed border-white/10 rounded-2xl p-16 text-center flex flex-col items-center justify-center bg-white/[0.01]">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-5 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                      <ChefHat size={40} className="text-amber-500/50" strokeWidth={1.5} />
                    </div>
                    <p className="font-bold text-lg text-white mb-1">Belum Ada Resep</p>
                    <p className="text-sm text-zinc-500 max-w-sm mx-auto">Menu ini belum dihubungkan dengan bahan baku apapun. Tambahkan bahan untuk memulai pemotongan stok otomatis.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {productIngredients.map((ing) => {
                      const stock = stocks.find(s => s.id === ing.stock_id);
                      return (
                        <div key={ing.id} className="group flex items-center justify-between p-5 bg-black/40 border border-white/5 hover:border-white/10 rounded-2xl transition-all hover:bg-white/[0.03]">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-zinc-800/50 border border-white/5 flex items-center justify-center shrink-0">
                              <ChefHat size={20} className="text-zinc-500" />
                            </div>
                            <div>
                              <p className="font-bold text-white text-base">{stock?.name || 'Unknown Stock'}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs text-zinc-500">Memotong</span>
                                <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                                  {ing.quantity_required} <span className="font-semibold opacity-90 text-[10px] ml-0.5">{/^\d/.test(stock?.unit || '') ? `(${stock?.unit})` : stock?.unit}</span>
                                </span>
                                <span className="text-xs text-zinc-500">per porsi</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10 opacity-0 group-hover:opacity-100 transition-all rounded-xl h-10 w-10"
                              onClick={() => {
                                setEditingIngredient(ing);
                                setEditQuantity(ing.quantity_required.toString());
                                setIsEditIngredientOpen(true);
                              }}
                              title="Edit takaran"
                            >
                              <Pencil size={18} strokeWidth={2} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-zinc-500 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all rounded-xl h-10 w-10"
                              onClick={() => handleRemoveIngredient(ing.id)}
                              title="Hapus bahan"
                            >
                              <Trash2 size={18} strokeWidth={2} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 bg-white/[0.01]">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <ChefHat size={48} className="text-zinc-600" strokeWidth={1} />
              </div>
              <p className="font-bold text-lg text-white mb-2">Pilih Menu</p>
              <p className="text-sm text-zinc-500 max-w-sm text-center">Pilih salah satu menu di daftar kiri untuk mulai meracik resep dan menghubungkannya dengan inventaris stok.</p>
            </div>
          )}
        </Card>
        </div>
      </div>

      {/* Auto-Match Dialog */}
      <Dialog open={isAutoMatchModalOpen} onOpenChange={setIsAutoMatchModalOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Wand2 className="text-amber-500" size={20} />
              {autoMatchStatus === 'success' ? 'Sukses Auto-Match!' : 'Auto-Match Resep'}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {autoMatchStatus === 'success' 
                ? 'Semua menu telah berhasil dihubungkan dengan stok.' 
                : autoMatchPendingItems.length === 0
                  ? 'Tidak ada menu baru yang bisa dicocokkan (semua sudah memiliki resep, atau tidak ada kecocokan nama).'
                  : `Ditemukan ${autoMatchPendingItems.length} menu yang namanya mirip dengan bahan baku. Lanjutkan menghubungkan otomatis?`
              }
            </DialogDescription>
          </DialogHeader>
          
          {autoMatchStatus === 'idle' && autoMatchPendingItems.length > 0 && (
            <ScrollArea className="max-h-[300px] mt-4 border border-white/5 rounded-xl bg-black/50 p-2">
              {autoMatchPendingItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm p-2 border-b border-white/5 last:border-0">
                  <span className="font-medium">{item.product_name}</span>
                  <span className="text-amber-500">↔ {item.stock_name}</span>
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
                  Ya, Hubungkan {autoMatchPendingItems.length} Menu
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Ingredient Dialog */}
      <Dialog open={isAddIngredientOpen} onOpenChange={setIsAddIngredientOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Tambah Bahan Baku</DialogTitle>
            <DialogDescription className="text-xs">
              Pilih bahan baku dan tentukan takaran yang dibutuhkan untuk 1 porsi <strong className="text-foreground">{selectedProduct?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs font-semibold">Bahan Baku (Stock)</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={newIngredient.stock_id}
                onChange={(e) => setNewIngredient({...newIngredient, stock_id: e.target.value})}
              >
                <option value="" disabled>Pilih bahan...</option>
                {stocks.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (satuan: {s.unit})</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-semibold">Takaran (Quantity per porsi)</label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Misal: 15"
                  value={newIngredient.quantity}
                  onChange={(e) => setNewIngredient({...newIngredient, quantity: e.target.value})}
                  className="pr-16"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  {(() => {
                    const unit = newIngredient.stock_id ? stocks.find(s => s.id === newIngredient.stock_id)?.unit : 'Unit';
                    return /^\d/.test(unit || '') ? `(${unit})` : unit;
                  })()}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddIngredientOpen(false)}>Batal</Button>
            <Button onClick={handleAddIngredient} disabled={!newIngredient.stock_id || !newIngredient.quantity || isSaving}>
              {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Ingredient Dialog */}
      <Dialog open={isEditIngredientOpen} onOpenChange={setIsEditIngredientOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit Takaran Bahan</DialogTitle>
            <DialogDescription className="text-xs">
              Ubah takaran <strong className="text-foreground">{stocks.find(s => s.id === editingIngredient?.stock_id)?.name}</strong> untuk 1 porsi <strong className="text-foreground">{selectedProduct?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs font-semibold">Takaran (Quantity per porsi)</label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Misal: 15"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="pr-16"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  {(() => {
                    const unit = editingIngredient ? stocks.find(s => s.id === editingIngredient.stock_id)?.unit : 'Unit';
                    return /^\d/.test(unit || '') ? `(${unit})` : unit;
                  })()}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditIngredientOpen(false)}>Batal</Button>
            <Button onClick={handleSaveEdit} disabled={!editQuantity || isSaving}>
              {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
