'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChefHat, Search, Plus, Trash2, Loader2, Save } from 'lucide-react';
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

  const handleRemoveIngredient = async (id: string) => {
    if (!confirm('Hapus bahan baku dari resep ini?')) return;
    
    const { error } = await supabase.from('product_ingredients').delete().eq('id', id);
    if (!error) {
      setRecipes(recipes.filter(r => r.id !== id));
    } else {
      alert("Gagal menghapus bahan baku.");
    }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!role) return null;

  return (
    <MainLayout title="Resep Menu">
      <div className="h-full flex flex-col md:flex-row gap-4 p-4 lg:p-8">
        
        {/* Left Panel: Product List */}
        <Card className="flex-1 md:w-1/3 flex flex-col bg-card border-border overflow-hidden">
          <CardHeader className="border-b border-border p-4">
            <CardTitle className="text-lg">Daftar Menu</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input 
                className="pl-9 bg-background h-9 text-sm"
                placeholder="Cari menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isLoadingData ? (
                <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-xs">Memuat menu...</span>
                </div>
              ) : (
                filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex justify-between items-center ${
                      selectedProductId === product.id 
                        ? 'bg-primary text-primary-foreground font-semibold shadow-md' 
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <span>{product.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      selectedProductId === product.id ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}>
                      {recipes.filter(r => r.product_id === product.id).length} bahan
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Right Panel: Recipe Editor */}
        <Card className="flex-[2] flex flex-col bg-card border-border overflow-hidden">
          {selectedProduct ? (
            <>
              <CardHeader className="border-b border-border p-5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl text-primary">{selectedProduct.name}</CardTitle>
                  <CardDescription className="text-xs mt-1">Kelola komposisi bahan baku (resep) yang akan memotong stok otomatis saat menu terjual.</CardDescription>
                </div>
                <Button onClick={() => setIsAddIngredientOpen(true)} className="gap-2 h-9">
                  <Plus size={16} />
                  Tambah Bahan
                </Button>
              </CardHeader>
              
              <ScrollArea className="flex-1 p-5">
                {productIngredients.length === 0 ? (
                  <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                    <ChefHat size={48} className="text-muted-foreground/30 mb-4" />
                    <p className="font-semibold text-foreground">Belum Ada Resep</p>
                    <p className="text-xs mt-1 max-w-sm mx-auto">Menu ini belum dihubungkan dengan bahan baku apapun. Stok tidak akan terpotong saat menu ini terjual.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {productIngredients.map((ing) => {
                      const stock = stocks.find(s => s.id === ing.stock_id);
                      return (
                        <div key={ing.id} className="flex items-center justify-between p-4 bg-background border border-border rounded-xl shadow-sm">
                          <div>
                            <p className="font-semibold">{stock?.name || 'Unknown Stock'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Memotong <span className="font-bold text-amber-500">{ing.quantity_required} {stock?.unit}</span> setiap porsi terjual</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleRemoveIngredient(ing.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <ChefHat size={64} className="text-muted-foreground/20 mb-4" />
              <p className="font-semibold text-lg">Pilih Menu</p>
              <p className="text-sm">Pilih menu dari daftar di sebelah kiri untuk mengelola resepnya.</p>
            </div>
          )}
        </Card>
      </div>

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
                  {newIngredient.stock_id ? stocks.find(s => s.id === newIngredient.stock_id)?.unit : 'Unit'}
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
    </MainLayout>
  );
}
