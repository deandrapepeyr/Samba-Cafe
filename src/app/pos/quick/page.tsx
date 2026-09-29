'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { ArrowLeft, QrCode, Banknote, CheckCircle2, Settings2, X, RotateCcw, Zap, Minus, ChevronDown, ChevronUp, Heart } from 'lucide-react';

type Product = {
  id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
  is_titipan: boolean;
  titipan_name: string | null;
  supplier_price?: number;
  is_quick?: boolean;
  stock?: number;
  variants?: any[];
};

type QuickCartItem = {
  product: Product;
  quantity: number;
};

const STORAGE_KEY = 'samba_oneclick_products';

export default function QuickPOSPage() {
  const { userName, role, isLoading } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [stocksData, setStocksData] = useState<{id: string, quantity: number}[]>([]);
  const [recipesData, setRecipesData] = useState<{product_id: string, stock_id: string, quantity_required: number}[]>([]);
  const [enabledProductIds, setEnabledProductIds] = useState<string[]>([]);
  const [cart, setCart] = useState<QuickCartItem[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [checkoutState, setCheckoutState] = useState<'idle' | 'ready' | 'processing' | 'success'>('idle');
  const [successOrderId, setSuccessOrderId] = useState('');
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isCheckingShift, setIsCheckingShift] = useState(true);
  const [searchSettings, setSearchSettings] = useState('');

  // Load enabled products from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setEnabledProductIds(JSON.parse(saved));
    } catch {}
  }, []);

  // Save enabled products to localStorage
  const saveEnabledProducts = (ids: string[]) => {
    setEnabledProductIds(ids);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  };

  // Fetch data
  useEffect(() => {
    if (isLoading) return;

    async function fetchData() {
      setIsCheckingShift(true);
      const [productsRes, stocksRes, recipesRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_available', true),
        supabase.from('stocks').select('id, quantity'),
        supabase.from('product_ingredients').select('product_id, stock_id, quantity_required')
      ]);

      if (stocksRes.data) setStocksData(stocksRes.data);
      if (recipesRes.data) setRecipesData(recipesRes.data);
      if (productsRes.data) {
        setProducts(productsRes.data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
      }
      setIsLoadingData(false);

      // Check active shift
      if (userName) {
        const { data } = await supabase
          .from('shifts')
          .select('*')
          .eq('cashier_name', userName)
          .eq('status', 'active')
          .order('start_time', { ascending: false })
          .limit(1);
        if (data && data.length > 0) setActiveShift(data[0]);
      }
      setIsCheckingShift(false);
    }

    fetchData();
  }, [userName, isLoading]);

  const getProductStock = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product?.is_titipan) return product.stock ?? null;

    const productRecipes = recipesData.filter(r => r.product_id === productId);
    if (productRecipes.length === 0) return null;

    let maxAvailable = Infinity;
    for (const recipe of productRecipes) {
      const stockItem = stocksData.find(s => s.id === recipe.stock_id);
      if (!stockItem) return 0;
      const possiblePortions = Math.floor(stockItem.quantity / recipe.quantity_required);
      if (possiblePortions < maxAvailable) maxAvailable = possiblePortions;
    }
    return maxAvailable;
  }, [products, stocksData, recipesData]);

  const enabledProducts = products.filter(p => enabledProductIds.includes(p.id));

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleProductTap = (product: Product) => {
    if (checkoutState === 'processing' || checkoutState === 'success') return;

    const stock = getProductStock(product.id);
    if (stock === 0) return;

    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (stock !== null && existing.quantity >= stock) return prev;
        return prev.map(c =>
          c.product.id === product.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    if (checkoutState === 'idle') setCheckoutState('ready');
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
  };

  const handleDecrease = (productId: string) => {
    setCart(prev => {
      const updated = prev.map(c =>
        c.product.id === productId
          ? { ...c, quantity: c.quantity - 1 }
          : c
      ).filter(c => c.quantity > 0);
      if (updated.length === 0) setCheckoutState('idle');
      return updated;
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
  };

  const generateOrderId = async () => {
    const today = new Date();
    const datePrefix = `order_${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}_`;
    try {
      const { data } = await supabase
        .from('transactions')
        .select('id')
        .like('id', `${datePrefix}%`)
        .order('id', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const lastSeq = parseInt(data[0].id.split('_').pop() || '0', 10);
        return `${datePrefix}${(lastSeq + 1).toString().padStart(4, '0')}`;
      }
    } catch {}
    return `${datePrefix}0001`;
  };

  const handlePayment = async (method: 'QRIS' | 'Cash') => {
    if (cart.length === 0) return;

    setCheckoutState('processing');

    const orderId = await generateOrderId();

    const transaction = {
      id: orderId,
      method,
      total,
      cashier_name: userName || 'MAMA MODE',
      status: `completed|${new Date().toISOString()}`,
      cash_received: method === 'Cash' ? total : null,
      customer_name: null
    };

    const itemsToInsert = cart.map(item => ({
      transaction_id: orderId,
      product_name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      notes: null,
      supplier_price: item.product.supplier_price || 0
    }));

    try {
      if (!navigator.onLine) throw new Error('Offline');

      const dbOps = async () => {
        const { error: txErr } = await supabase.from('transactions').insert([transaction]);
        if (txErr) throw txErr;
        const { error: itemsErr } = await supabase.from('transaction_items').insert(itemsToInsert);
        if (itemsErr) throw itemsErr;

        // Deduct titipan stock
        for (const cartItem of cart.filter(i => i.product.is_titipan)) {
          const newStock = Math.max(0, (cartItem.product.stock || 0) - cartItem.quantity);
          await supabase.from('products').update({ stock: newStock }).eq('id', cartItem.product.id);
        }

        // Deduct recipe-based stock
        const productIds = cart.map(i => i.product.id);
        const { data: recipes } = await supabase.from('product_ingredients').select('*').in('product_id', productIds);
        if (recipes && recipes.length > 0) {
          const stockDeductions: Record<string, number> = {};
          for (const cartItem of cart) {
            const itemRecipes = recipes.filter(r => r.product_id === cartItem.product.id && !r.variant_name);
            for (const recipe of itemRecipes) {
              if (!stockDeductions[recipe.stock_id]) stockDeductions[recipe.stock_id] = 0;
              stockDeductions[recipe.stock_id] += recipe.quantity_required * cartItem.quantity;
            }
          }
          const stockIds = Object.keys(stockDeductions);
          if (stockIds.length > 0) {
            const { data: currentStocks } = await supabase.from('stocks').select('id, quantity').in('id', stockIds);
            if (currentStocks) {
              for (const stock of currentStocks) {
                const amount = stockDeductions[stock.id];
                if (amount) {
                  await supabase.from('stocks').update({ quantity: Math.max(0, stock.quantity - amount), last_updated: new Date().toISOString() }).eq('id', stock.id);
                }
              }
            }
          }
        }
      };

      await Promise.race([
        dbOps(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
    } catch (err) {
      console.warn('Quick POS offline fallback:', err);
      const queue = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
      queue.push({ transaction, itemsToInsert });
      localStorage.setItem('offline_transactions', JSON.stringify(queue));
    }

    setSuccessOrderId(orderId);
    setCheckoutState('success');

    // Optimistically update local stock state so it decreases instantly
    setProducts(prevProducts => prevProducts.map(p => {
      const cartItem = cart.find(c => c.product.id === p.id);
      if (cartItem && p.is_titipan && p.stock !== undefined && p.stock !== null) {
        return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
      }
      return p;
    }));

    setStocksData(prevStocks => prevStocks.map(s => {
      let totalDeduction = 0;
      cart.forEach(cartItem => {
        const itemRecipes = recipesData.filter(r => r.product_id === cartItem.product.id);
        const recipe = itemRecipes.find(r => r.stock_id === s.id);
        if (recipe) {
          totalDeduction += recipe.quantity_required * cartItem.quantity;
        }
      });
      if (totalDeduction > 0) {
        return { ...s, quantity: Math.max(0, s.quantity - totalDeduction) };
      }
      return s;
    }));
    
    // Auto reset after 1.5 seconds
    setTimeout(() => {
      setCheckoutState(prev => {
        if (prev === 'success') {
          setCart([]);
          setSuccessOrderId('');
          return 'idle';
        }
        return prev;
      });
    }, 1500);
  };

  const handleNewOrder = () => {
    setCart([]);
    setCheckoutState('idle');
    setSuccessOrderId('');
  };

  const toggleProduct = (productId: string) => {
    const newIds = enabledProductIds.includes(productId)
      ? enabledProductIds.filter(id => id !== productId)
      : [...enabledProductIds, productId];
    saveEnabledProducts(newIds);
  };

  const isLocked = !isLoading && !isCheckingShift && (!role || !activeShift);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[30%] -left-[20%] w-[60%] h-[60%] bg-rose-500/5 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[5%] -right-[15%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[150px]"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl safe-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/pos')}
            className="p-2 -ml-1 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} className="text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-rose-500/10 rounded-lg border border-rose-500/20">
              <Heart size={16} className="text-rose-500 fill-rose-500" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">MAMA MODE</h1>
              <p className="text-[10px] text-zinc-500 font-medium">{userName || 'Guest'}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
        >
          <Settings2 size={18} className="text-zinc-400" />
        </button>
      </header>

      {/* Locked State */}
      {isLocked && !isLoading && !isCheckingShift && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Heart size={36} className="text-rose-500 fill-rose-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Shift Belum Dibuka</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-xs">
              Buka shift di halaman POS utama terlebih dahulu untuk menggunakan MAMA MODE.
            </p>
          </div>
          <button
            onClick={() => router.push('/pos')}
            className="mt-2 px-6 py-3 bg-rose-500 text-zinc-950 font-bold rounded-xl hover:bg-rose-400 transition-all"
          >
            Buka POS Utama
          </button>
        </div>
      )}

      {/* No Products Enabled */}
      {!isLocked && enabledProducts.length === 0 && !isLoadingData && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-white/10 flex items-center justify-center">
            <Settings2 size={36} className="text-zinc-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Belum Ada Menu Dipilih</h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-xs">
              Tap tombol ⚙ di kanan atas untuk memilih menu mana saja yang ingin dipakai di MAMA MODE.
            </p>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="mt-2 px-6 py-3 bg-primary text-zinc-950 font-bold rounded-xl hover:opacity-90 transition-all"
          >
            Pilih Menu
          </button>
        </div>
      )}

      {/* Loading */}
      {(isLoading || isCheckingShift || isLoadingData) && (
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}



      {/* Main Grid — Menu Items */}
      {!isLocked && !isLoading && !isCheckingShift && !isLoadingData && enabledProducts.length > 0 && checkoutState !== 'success' && (
        <div className="relative z-10 flex-1 overflow-y-auto p-3 pb-60">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {enabledProducts.map(product => {
              const cartItem = cart.find(c => c.product.id === product.id);
              const qty = cartItem?.quantity || 0;
              const stock = getProductStock(product.id);
              const isEmpty = stock === 0;

              return (
                <div
                  key={product.id}
                  onClick={() => !isEmpty && checkoutState !== 'processing' && handleProductTap(product)}
                  className={`relative flex flex-col justify-between p-3.5 rounded-2xl border-2 transition-all duration-200 text-left min-h-[100px] active:scale-[0.97] select-none
                    ${isEmpty
                      ? 'opacity-40 border-white/5 bg-zinc-900/30 cursor-not-allowed'
                      : qty > 0
                        ? 'border-rose-500/60 bg-rose-500/10 shadow-lg shadow-rose-500/10 cursor-pointer'
                        : 'border-white/5 bg-zinc-900/40 hover:border-white/15 hover:bg-zinc-800/60 active:bg-zinc-800 cursor-pointer'
                    }
                  `}
                >
                  {/* Quantity Badge */}
                  {qty > 0 && (
                    <div className="absolute -top-2 -right-2 bg-rose-500 text-zinc-950 text-sm font-black w-7 h-7 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 border-2 border-zinc-950 animate-in zoom-in duration-150">
                      {qty}
                    </div>
                  )}

                  <div>
                    <h3 className={`text-[13px] sm:text-sm font-bold leading-tight line-clamp-2 ${qty > 0 ? 'text-rose-400' : 'text-zinc-200'}`}>
                      {product.name}
                    </h3>
                  </div>

                  <div className="flex items-end justify-between mt-2 gap-1">
                    <span className={`text-xs font-bold ${qty > 0 ? 'text-rose-300/70' : 'text-zinc-500'}`}>
                      Rp {product.price.toLocaleString('id-ID')}
                    </span>
                    {stock !== null && stock !== Infinity && (
                      <span className={`text-[10px] font-bold ${isEmpty ? 'text-rose-500' : 'text-emerald-500/70'}`}>
                        {isEmpty ? 'Habis' : `${stock}`}
                      </span>
                    )}
                  </div>

                  {/* Decrease button overlay */}
                  {qty > 0 && (
                    <div
                      onClick={(e) => { e.stopPropagation(); handleDecrease(product.id); }}
                      className="absolute bottom-1 right-1 w-10 h-10 rounded-xl bg-zinc-900/95 border-2 border-white/20 shadow-lg flex items-center justify-center text-zinc-300 hover:text-rose-400 hover:border-rose-500/50 hover:bg-zinc-800 transition-all active:scale-90 cursor-pointer"
                    >
                      <Minus size={20} className="stroke-[3]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      {(checkoutState === 'ready' || checkoutState === 'processing') && cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom animate-in slide-in-from-bottom duration-300">
          <div className="bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 p-3 space-y-2.5 shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
            {/* Cart Details */}
            <div className="max-h-32 overflow-y-auto px-2 space-y-2 mb-2 scrollbar-thin scrollbar-thumb-zinc-700">
              {cart.map(item => (
                <div key={item.product.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="bg-rose-500/20 text-rose-400 font-bold px-2 py-0.5 rounded-md text-xs">
                      {item.quantity}x
                    </div>
                    <span className="text-zinc-200 truncate font-medium">{item.product.name}</span>
                  </div>
                  <span className="text-zinc-300 font-bold whitespace-nowrap ml-3">
                    Rp {(item.quantity * item.product.price).toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{cartItemCount} item</span>
                <button
                  onClick={handleNewOrder}
                  className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all ml-1 active:scale-95"
                >
                  Batal
                </button>
              </div>
              <span className="text-xl font-black text-white tracking-tight">
                Rp {total.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Payment Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handlePayment('QRIS')}
                disabled={checkoutState === 'processing'}
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 active:scale-[0.98] text-white transition-all shadow-lg shadow-blue-600/20 border border-blue-500/30 disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <QrCode size={24} />
                  <span className="font-bold text-lg">QRIS</span>
                </div>
                <span className="text-xs font-medium opacity-80">Bayar via QR</span>
              </button>
              <button
                onClick={() => handlePayment('Cash')}
                disabled={checkoutState === 'processing'}
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-[0.98] text-white transition-all shadow-lg shadow-emerald-600/20 border border-emerald-500/30 disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Banknote size={24} />
                  <span className="font-bold text-lg">Tunai</span>
                </div>
                <span className="text-xs font-medium opacity-80">Bayar Tunai</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {checkoutState === 'processing' && (
        <div className="fixed inset-0 z-[200] bg-zinc-950/90 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-zinc-400 font-medium animate-pulse">Memproses...</p>
          </div>
        </div>
      )}

      {/* Success Overlay */}
      {checkoutState === 'success' && (
        <div 
          className="fixed inset-0 z-[200] bg-zinc-950/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200 cursor-pointer"
          onClick={handleNewOrder}
        >
          <div className="w-24 h-24 bg-emerald-500/20 border-2 border-emerald-500/40 rounded-full flex items-center justify-center mb-5 shadow-[0_0_60px_rgba(16,185,129,0.4)]">
            <CheckCircle2 size={48} className="text-emerald-500 drop-shadow-lg" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-2">Selesai! ✅</h2>
          <p className="text-emerald-400 font-medium text-lg">Pesanan berhasil disimpan</p>
          <p className="text-xs text-zinc-500 mt-10 animate-pulse bg-zinc-900/50 px-4 py-2 rounded-full border border-white/5">Ketuk dimana saja untuk lanjut</p>
        </div>
      )}

      {/* Settings Sheet */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 rounded-t-3xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-zinc-700 rounded-full"></div>
            </div>

            {/* Settings Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <div>
                <h2 className="text-lg font-bold">Pilih Menu MAMA MODE</h2>
                <p className="text-xs text-zinc-500">Pilih menu yang bisa dipakai di mode one-click</p>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-xl hover:bg-white/5">
                <X size={20} className="text-zinc-400" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-white/5">
              <input
                type="text"
                placeholder="Cari menu..."
                value={searchSettings}
                onChange={(e) => setSearchSettings(e.target.value)}
                className="w-full h-10 bg-zinc-800/80 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {products
                .filter(p => !p.variants || p.variants.length === 0) // Only non-variant products for quick mode
                .filter(p => p.name.toLowerCase().includes(searchSettings.toLowerCase()))
                .map(product => {
                  const isEnabled = enabledProductIds.includes(product.id);
                  const stock = getProductStock(product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => toggleProduct(product.id)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                        isEnabled
                          ? 'bg-rose-500/10 border-rose-500/30 '
                          : 'bg-zinc-800/30 border-white/5 hover:bg-zinc-800/60'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isEnabled ? 'text-rose-400' : 'text-zinc-300'}`}>
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-zinc-500">Rp {product.price.toLocaleString('id-ID')}</span>
                          {stock !== null && stock !== Infinity && (
                            <span className={`text-[10px] font-bold ${stock === 0 ? 'text-rose-500' : 'text-emerald-500/70'}`}>
                              • stok {stock}
                            </span>
                          )}
                          {product.variants && product.variants.length > 0 && (
                            <span className="text-[10px] text-zinc-600">• Punya varian</span>
                          )}
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ml-3 ${
                        isEnabled
                          ? 'bg-rose-500 border-rose-500'
                          : 'border-zinc-600'
                      }`}>
                        {isEnabled && <CheckCircle2 size={14} className="text-zinc-950" />}
                      </div>
                    </button>
                  );
                })}
            </div>

            {/* Done Button */}
            <div className="p-4 border-t border-white/5 safe-bottom">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-3.5 bg-rose-500 text-zinc-950 font-bold rounded-xl text-base hover:bg-rose-400 transition-all active:scale-[0.98]"
              >
                Selesai ({enabledProductIds.length} menu dipilih)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
