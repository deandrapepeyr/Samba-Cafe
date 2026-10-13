'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Package, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Filter, 
  RefreshCw, 
  Sparkles,
  Coffee,
  Check,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface ProductItem {
  id: string;
  name: string;
  price: number;
  category_id: string;
  image_url: string | null;
  is_available: boolean;
  is_titipan?: boolean;
  titipan_name?: string | null;
  sort_order?: number;
}

interface CategoryItem {
  id: string;
  name: string;
}

export default function StockAvailabilityPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'cafe' | 'titipan'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Dialog for bulk "Mark All Available"
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    if (!isLoading && !role) {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  // Load products & categories
  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('*').order('sort_order', { ascending: true }),
        supabase.from('categories').select('*')
      ]);

      if (prodRes.data) {
        setProducts(prodRes.data as ProductItem[]);
      }
      if (catRes.data) {
        setCategories(catRes.data as CategoryItem[]);
      }
    } catch (err) {
      console.error('Failed to load menu availability data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Realtime listener for external product availability updates
    const channel = supabase
      .channel('products_availability_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        const updated = payload.new as ProductItem;
        if (updated && updated.id) {
          setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, is_available: updated.is_available } : p));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Quick 1-click toggle availability
  const toggleAvailability = async (product: ProductItem) => {
    const nextState = !product.is_available;
    setTogglingId(product.id);

    // Optimistic UI update
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_available: nextState } : p));

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_available: nextState })
        .eq('id', product.id);

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('Failed to update product availability:', err);
      // Rollback on error
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_available: product.is_available } : p));
      alert('Gagal memperbarui status menu. Silakan coba lagi.');
    } finally {
      setTogglingId(null);
    }
  };

  // Bulk mark all as available
  const handleMarkAllAvailable = async () => {
    setIsBulkProcessing(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_available: true })
        .neq('is_available', true);

      if (error) throw error;

      setProducts(prev => prev.map(p => ({ ...p, is_available: true })));
      setIsBulkConfirmOpen(false);
    } catch (err) {
      console.error('Failed to mark all as available:', err);
      alert('Gagal menandai semua menu. Silakan periksa koneksi.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search filter
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'available' && !p.is_available) return false;
      if (statusFilter === 'unavailable' && p.is_available) return false;

      // Category filter
      if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false;

      // Type filter
      if (typeFilter === 'cafe' && p.is_titipan) return false;
      if (typeFilter === 'titipan' && !p.is_titipan) return false;

      return true;
    });
  }, [products, searchQuery, statusFilter, categoryFilter, typeFilter]);

  // Statistics
  const totalCount = products.length;
  const availableCount = products.filter(p => p.is_available).length;
  const unavailableCount = totalCount - availableCount;

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  return (
    <MainLayout
      title="Ketersediaan Menu"
      headerAction={
        <div className="flex items-center gap-2">
          {unavailableCount > 0 && (
            <Button
              onClick={() => setIsBulkConfirmOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs font-bold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            >
              <CheckCircle2 size={14} className="mr-1.5 text-emerald-400" />
              Tandai Semua Tersedia
            </Button>
          )}
          <Button
            onClick={fetchData}
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white"
            title="Muat Ulang Data"
          >
            <RefreshCw size={16} className={isLoadingData ? 'animate-spin' : ''} />
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-20 max-w-7xl mx-auto">
        
        {/* Top Stat Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="bg-zinc-900/60 border-white/5 shadow-lg">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Menu</p>
                <h3 className="text-2xl font-black text-white mt-0.5">{totalCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Coffee size={20} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-950/20 border-emerald-500/20 shadow-lg">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-emerald-400/80 uppercase tracking-wider">Siap Dipesan (Tersedia)</p>
                <h3 className="text-2xl font-black text-emerald-400 mt-0.5">{availableCount}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={20} />
              </div>
            </CardContent>
          </Card>

          <Card className={`border shadow-lg transition-colors ${
            unavailableCount > 0 
              ? 'bg-rose-950/30 border-rose-500/30' 
              : 'bg-zinc-900/40 border-white/5 opacity-70'
          }`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${
                  unavailableCount > 0 ? 'text-rose-400' : 'text-zinc-400'
                }`}>
                  Kosong (Habis)
                </p>
                <h3 className={`text-2xl font-black mt-0.5 ${
                  unavailableCount > 0 ? 'text-rose-400' : 'text-zinc-400'
                }`}>
                  {unavailableCount}
                </h3>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                unavailableCount > 0 
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400' 
                  : 'bg-zinc-800 text-zinc-500'
              }`}>
                <XCircle size={20} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter & Controls Bar */}
        <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl space-y-3.5 backdrop-blur-md shadow-xl">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <Input
                placeholder="Cari nama menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-black/40 border-white/10 rounded-xl text-sm placeholder:text-zinc-500 focus:border-primary/50 text-white"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/5 rounded-xl self-start sm:self-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'all' 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Semua ({totalCount})
              </button>
              <button
                onClick={() => setStatusFilter('available')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'available' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm' 
                    : 'text-zinc-400 hover:text-emerald-400'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Tersedia ({availableCount})
              </button>
              <button
                onClick={() => setStatusFilter('unavailable')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'unavailable' 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-sm' 
                    : 'text-zinc-400 hover:text-rose-400'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Habis ({unavailableCount})
              </button>
            </div>
          </div>

          {/* Category Chips Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-white/5">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                categoryFilter === 'all'
                  ? 'bg-primary text-black shadow-md shadow-primary/20'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              Semua Kategori
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  categoryFilter === cat.id
                    ? 'bg-primary text-black shadow-md shadow-primary/20'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        {isLoadingData ? (
          <div className="p-16 text-center text-zinc-500 flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-primary" />
            <p className="text-sm font-medium">Memuat ketersediaan menu...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center bg-zinc-900/20 border border-white/5 rounded-3xl flex flex-col items-center gap-3">
            <Coffee size={36} className="text-zinc-600" />
            <h4 className="font-bold text-white text-base">Tidak ada menu yang cocok</h4>
            <p className="text-xs text-zinc-400 max-w-sm">
              Coba sesuaikan kata kunci pencarian atau filter kategori di atas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {filteredProducts.map(product => {
              const isToggling = togglingId === product.id;
              const isAvailable = product.is_available;

              return (
                <div
                  key={product.id}
                  className={`group relative rounded-2xl border p-3.5 transition-all duration-300 flex flex-col justify-between ${
                    isAvailable
                      ? 'bg-zinc-900/50 border-white/10 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5'
                      : 'bg-rose-950/10 border-rose-500/20 hover:border-rose-500/40 opacity-90'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Image & Status Badge */}
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/60 flex items-center justify-center border border-white/5">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                            !isAvailable ? 'grayscale opacity-50' : ''
                          }`}
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-zinc-600 font-bold text-xl uppercase">
                          {product.name.charAt(0)}
                        </span>
                      )}

                      {/* Status Tag Overlay */}
                      <div className="absolute top-2 left-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border backdrop-blur-md uppercase tracking-wider ${
                          isAvailable
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40 shadow-sm'
                            : 'bg-rose-950/90 text-rose-300 border-rose-500/50 shadow-sm'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {isAvailable ? 'Tersedia' : 'Habis'}
                        </span>
                      </div>

                      {/* Category Tag Overlay */}
                      {product.category_id && categoryMap[product.category_id] && (
                        <div className="absolute top-2 right-2">
                          <span className="text-[9px] font-bold bg-black/70 text-zinc-300 px-1.5 py-0.5 rounded-md border border-white/10 backdrop-blur-md">
                            {categoryMap[product.category_id]}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div>
                      <h4 className="font-bold text-sm text-white line-clamp-1 leading-snug" title={product.name}>
                        {product.name}
                      </h4>
                      <p className="text-xs font-extrabold text-primary mt-1">
                        Rp {product.price.toLocaleString('id-ID')}
                      </p>
                      {product.is_titipan && product.titipan_name && (
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                          Titipan: <span className="text-zinc-300">{product.titipan_name}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 1-Click Interactive Availability Toggle Switch */}
                  <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-400">
                      Status Kasir & Web:
                    </span>
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => toggleAvailability(product)}
                      className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                        isAvailable
                          ? 'bg-emerald-600 border-emerald-500'
                          : 'bg-zinc-800 border-zinc-700'
                      }`}
                      title={isAvailable ? 'Klik untuk tandai HABIS' : 'Klik untuk tandai TERSEDIA'}
                    >
                      <span className="sr-only">Ubah status ketersediaan</span>
                      <span
                        className={`pointer-events-none flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out mt-[2px] ${
                          isAvailable ? 'translate-x-7 text-emerald-600' : 'translate-x-1 text-zinc-500'
                        }`}
                      >
                        {isToggling ? (
                          <RefreshCw size={10} className="animate-spin text-zinc-700" />
                        ) : isAvailable ? (
                          <Check size={11} strokeWidth={3} />
                        ) : (
                          <X size={11} strokeWidth={3} />
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Confirmation Dialog: Tandai Semua Tersedia */}
      <Dialog open={isBulkConfirmOpen} onOpenChange={setIsBulkConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] bg-zinc-950 border-white/10 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={18} /> Tandai Semua Menu Tersedia
            </DialogTitle>
            <DialogDescription className="text-zinc-300 text-xs pt-1.5 leading-relaxed">
              Apakah Anda yakin ingin menyalakan status ketersediaan untuk semua menu di kafe? 
              Semua menu yang sebelumnya berstatus <b>Habis</b> akan langsung bisa dipesan kembali di kasir dan web customer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3 flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsBulkConfirmOpen(false)}
              disabled={isBulkProcessing}
              className="text-zinc-400 hover:text-white"
            >
              Batal
            </Button>
            <Button
              onClick={handleMarkAllAvailable}
              disabled={isBulkProcessing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {isBulkProcessing ? 'Memproses...' : 'Ya, Aktifkan Semua Menu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
