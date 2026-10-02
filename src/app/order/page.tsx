'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCustomerSession, createCustomerSession, CustomerSession } from '@/lib/customerSession';
import { Search, Plus, Minus, ShoppingCart, ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, X, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Product, Category, ProductVariant } from '@/app/pos/page'; // reuse types
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  notes?: string;
  variantChoices?: Record<string, string[]>;
};

export default function CustomerOrderPage() {
  const router = useRouter();
  
  // States
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [view, setView] = useState<'welcome' | 'menu' | 'cart' | 'checkout'>('welcome');
  
  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // Menu State
  const [activeCategory, setActiveCategory] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Checkout State
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasReadyOrder, setHasReadyOrder] = useState(false);
  const activeOrderIdsRef = useRef<string[]>([]);

  // Variant Modal
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [selectedProductForOptions, setSelectedProductForOptions] = useState<Product | null>(null);
  const [selectedVariantChoices, setSelectedVariantChoices] = useState<Record<string, string[]>>({});

  useEffect(() => {
    // Check existing session
    const existing = getCustomerSession();
    if (existing) {
      setSession(existing);
      setView('menu');
    }

    // Load Menu
    async function loadMenu() {
      let topProductsList: Product[] = [];
      const [categoriesRes, productsRes, popularItemsRes] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('products').select('*'),
        supabase.from('transaction_items').select('product_name')
      ]);
      
      if (categoriesRes.data) {
        setCategories([{ id: '1', name: 'All Menu' }, ...categoriesRes.data]);
      }
      if (productsRes.data) {
        const sortedProducts = productsRes.data
          .filter(p => !p.is_titipan)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setProducts(sortedProducts);
        
        if (popularItemsRes.data && popularItemsRes.data.length > 0) {
          const counts: Record<string, number> = {};
          popularItemsRes.data.forEach(item => {
            counts[item.product_name] = (counts[item.product_name] || 0) + 1;
          });
          const sortedNames = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(e => e[0]);
          topProductsList = sortedProducts.filter(p => sortedNames.includes(p.name)).sort((a, b) => sortedNames.indexOf(a.name) - sortedNames.indexOf(b.name)).slice(0, 5);
        }
        if (topProductsList.length === 0) {
          topProductsList = sortedProducts.filter(p => p.is_available).slice(0, 5);
        }
        setTopProducts(topProductsList);
      }
      setIsLoadingData(false);
    }
    loadMenu();
  }, []);

  useEffect(() => {
    if (!session?.sessionId) return;
    
    const fetchOrders = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('customer_session_id', session.sessionId);
        
      if (data) {
        activeOrderIdsRef.current = data.map(d => d.id);
        setHasReadyOrder(data.some(d => d.status === 'ready'));
      }
    };
    
    fetchOrders();

    const channel = supabase
      .channel(`menu_tracking_${session.sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          const rowId = (payload.new as any)?.id || (payload.old as any)?.id;
          const newRow = payload.new as any;
          
          if (rowId && activeOrderIdsRef.current.includes(rowId)) {
            if (newRow && newRow.status) {
              if (newRow.status === 'ready') {
                setHasReadyOrder(true);
              } else {
                fetchOrders();
              }
            } else {
              fetchOrders();
            }
          } else if (newRow && newRow.customer_session_id === session.sessionId) {
            fetchOrders();
          }
        }
      )
      .subscribe();

    const pollInterval = setInterval(() => {
      fetchOrders();
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [session?.sessionId]);

  const handleStartOrdering = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const newSession = createCustomerSession(nameInput.trim());
    setSession(newSession);
    setView('menu');
  };

  const handleProductClick = (product: Product) => {
    if (!product.is_available) return;
    if (product.variants && product.variants.length > 0) {
      setSelectedProductForOptions(product);
      const initialChoices: Record<string, string[]> = {};
      product.variants.forEach(v => {
        if (v.is_required && v.choices.length > 0) {
          initialChoices[v.name] = [v.choices[0].name];
        } else {
          initialChoices[v.name] = [];
        }
      });
      setSelectedVariantChoices(initialChoices);
      setIsOptionsModalOpen(true);
    } else {
      addToCart(product, '', 0, {});
    }
  };

  const addToCart = (product: Product, notes: string = '', addonPrice: number = 0, variantChoices?: Record<string, string[]>) => {
    const cartItemId = notes ? `${product.id}-${notes}` : product.id;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && (item.notes || '') === notes);
      if (existing) {
        return prev.map(item =>
          (item.product.id === product.id && (item.notes || '') === notes)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      const productWithAddonPrice = { ...product, price: product.price + addonPrice };
      return [...prev, { id: cartItemId, product: productWithAddonPrice, quantity: 1, notes, variantChoices }];
    });
    setIsOptionsModalOpen(false);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const getProductQuantity = (productId: string) => {
    return cart.filter(item => item.product.id === productId).reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleDecreaseProduct = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const items = cart.filter(item => item.product.id === productId);
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      updateQuantity(lastItem.id, -1);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const generateOrderId = async () => {
    const today = new Date();
    const prefix = `C_${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}_`;
    
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .like('id', `${prefix}%`)
      .order('id', { ascending: false })
      .limit(1);
      
    if (data && data.length > 0) {
      const lastSequence = parseInt(data[0].id.split('_').pop() || '0', 10);
      return `${prefix}${(lastSequence + 1).toString().padStart(4, '0')}`;
    }
    return `${prefix}0001`;
  };

  const submitOrder = async () => {
    if (!session || isProcessing || cart.length === 0) return;
    setIsProcessing(true);

    try {
      // Create new order every time
      const targetOrderId = await generateOrderId();
      const paymentStatus = 'UNPAID';

      // Check if there's an existing session to label it (Tambahan)
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('customer_session_id', session.sessionId)
        .in('status', ['pending', 'preparing', 'ready'])
        .limit(1)
        .maybeSingle();

      const cName = existingTx ? `${session.customerName} (Tambahan)` : session.customerName;

      const transaction = {
        id: targetOrderId,
        method: 'Bayar Nanti',
        total: cartTotal,
        cashier_name: 'Customer QR',
        customer_name: cName,
        status: 'pending',
        order_source: 'CUSTOMER_QR',
        customer_session_id: session.sessionId,
        payment_status: paymentStatus
      };

      const { error: txError } = await supabase.from('transactions').insert([transaction]);
      if (txError) throw txError;

      const itemsToInsert = cart.map(item => ({
        transaction_id: targetOrderId,
        product_name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        notes: item.notes || null,
        supplier_price: item.product.supplier_price || 0
      }));

      const { error: itemsError } = await supabase.from('transaction_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Clear cart and redirect to the unified tracking page
      setCart([]);
      router.push(`/order/track`);

    } catch (err) {
      console.error("Order submission failed", err);
      alert("Gagal membuat pesanan, silakan coba lagi.");
      setIsProcessing(false);
    }
  };

  // --- RENDERS ---

  if (view === 'welcome') {
    return (
      <div 
        className="h-[100dvh] text-white flex flex-col justify-center px-6 py-12 relative overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/cafe_hero_bg.png')" }}
      >
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

        <div className="relative z-10 w-full max-w-md mx-auto space-y-8 mt-auto mb-10">
          <div className="space-y-3 text-center drop-shadow-lg">
            <h1 className="text-5xl md:text-6xl font-black tracking-tight bg-gradient-to-br from-white via-white/90 to-amber-200/50 bg-clip-text text-transparent">
              Samba Cafe
            </h1>
            <p className="text-zinc-200 text-base md:text-lg font-medium drop-shadow-md">
              Pesan langsung dari mejamu, tanpa antre.
            </p>
          </div>

          <form onSubmit={handleStartOrdering} className="bg-black/40 p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md space-y-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-bold text-white ml-1 drop-shadow-sm">
                Siapa namamu?
              </label>
              <Input
                id="name"
                autoFocus
                placeholder="Misal: Andi"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="h-14 text-lg bg-black/60 text-white placeholder:text-zinc-400 border-white/20 focus:border-amber-500 focus:ring-amber-500/30 rounded-2xl px-5 transition-all"
                maxLength={30}
              />
            </div>
            <Button
              type="submit"
              disabled={!nameInput.trim()}
              className="w-full h-14 rounded-2xl text-base font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
            >
              Mulai Pesan <ArrowRight className="ml-2" size={20} />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = searchQuery.trim() !== '' ? true : (activeCategory === '1' || p.category_id === activeCategory);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="h-[100dvh] bg-[#0a0a0a] text-white flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-amber-500">Hi, {session?.customerName} 👋</span>
          <h1 className="text-lg font-black tracking-tight">
            {view === 'menu' ? 'Mau pesan apa hari ini?' : view === 'cart' ? 'Keranjang' : 'Checkout'}
          </h1>
        </div>
        {view === 'menu' ? (
          <div className="flex items-center gap-2">
            {session && (
              <Button 
                variant="ghost" 
                onClick={() => router.push('/order/track')} 
                className={`rounded-full border text-[11px] font-bold px-3.5 py-1.5 h-auto flex items-center gap-2 transition-all ${
                  hasReadyOrder 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse'
                    : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20 hover:border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                }`}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasReadyOrder ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${hasReadyOrder ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                {hasReadyOrder ? 'Pesanan Siap! !' : 'Cek Status Order'}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setView('cart')} className="relative rounded-full bg-white/5 hover:bg-white/10 shrink-0">
              <ShoppingCart size={20} />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-[#0a0a0a]">
                  {cartItemCount}
                </span>
              )}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => setView('menu')} className="rounded-full bg-white/5 hover:bg-white/10 shrink-0">
            <X size={20} />
          </Button>
        )}
      </div>

      {view === 'menu' && (
        <div className="flex-1 overflow-y-auto">
          {hasReadyOrder && (
            <div className="px-4 pt-4 pb-2">
              <div 
                onClick={() => router.push('/order/track')}
                className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 shrink-0">
                    <BellRing size={20} className="animate-bounce" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-400 text-sm">Pesananmu Sudah Siap!</h3>
                    <p className="text-zinc-400 text-xs mt-0.5">Silakan ambil di kasir ya.</p>
                  </div>
                </div>
                <ChevronRight className="text-emerald-500" size={20} />
              </div>
            </div>
          )}
          {/* Search */}
          <div className="px-4 py-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-amber-500 transition-colors" size={18} />
              <input
                placeholder="Cari minuman, makanan..."
                className="w-full h-12 pl-12 pr-4 bg-zinc-900/50 border border-white/10 rounded-2xl text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all shadow-inner"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Categories */}
          {searchQuery.trim() === '' && (
            <div className="px-4 py-3 mb-2">
              <div className="flex gap-1 overflow-x-auto scrollbar-none bg-zinc-900/60 p-1 rounded-2xl border border-white/5">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`shrink-0 h-9 px-4 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center ${
                      activeCategory === cat.id 
                        ? 'bg-amber-500 text-black shadow-md' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product Grid */}
          {isLoadingData ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Memuat menu...</div>
          ) : (
            <div className="pb-32">
              {/* Best Sellers Carousel */}
              {searchQuery.trim() === '' && activeCategory === '1' && topProducts.length > 0 && (
                <div className="mb-6">
                  <div className="px-4 mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      <span className="text-amber-500">🔥</span> Paling Banyak Dipesan
                    </h2>
                  </div>
                  <div className="px-4 flex gap-4 overflow-x-auto snap-x scrollbar-none pb-4">
                    {topProducts.map(product => (
                      <div 
                        key={`top-${product.id}`}
                        onClick={() => handleProductClick(product)}
                        className={`snap-center shrink-0 w-[240px] bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden flex flex-col transition-all ${
                          product.is_available ? 'active:scale-95 cursor-pointer hover:border-amber-500/30' : 'opacity-50 grayscale cursor-not-allowed'
                        }`}
                      >
                        <div className="h-[160px] bg-zinc-800/50 relative overflow-hidden flex items-center justify-center">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-zinc-700 font-bold text-2xl uppercase">{product.name.charAt(0)}</span>
                          )}
                          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Best Seller</span>
                          </div>
                          {!product.is_available && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                              <div className="bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10">
                                HABIS
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-4 flex flex-col gap-2">
                          <h3 className="font-bold text-base leading-snug line-clamp-2 text-white">{product.name}</h3>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-black text-amber-500 text-base">Rp{product.price.toLocaleString('id-ID')}</span>
                            {product.is_available && (
                              getProductQuantity(product.id) > 0 ? (
                                <div className="flex items-center gap-2 bg-amber-500 rounded-full px-2 py-1 text-black font-bold shadow-lg shadow-amber-500/20" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={(e) => handleDecreaseProduct(product.id, e)} className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center">
                                    <Minus size={14} />
                                  </button>
                                  <span className="text-sm px-1">{getProductQuantity(product.id)}</span>
                                  <button onClick={(e) => { e.stopPropagation(); handleProductClick(product); }} className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center">
                                    <Plus size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleProductClick(product); }} className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold shadow-lg shadow-amber-500/20">
                                  <Plus size={16} />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Menu Section Title */}
              <div className="px-4 mb-3">
                <h2 className="text-lg font-black text-white">Semua Menu</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 px-4 pt-2">
              {filteredProducts.map(product => (
                <div 
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className={`bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden flex flex-col transition-all ${
                    product.is_available ? 'active:scale-95 cursor-pointer' : 'opacity-50 grayscale cursor-not-allowed'
                  }`}
                >
                  <div className="aspect-square bg-zinc-800/50 relative overflow-hidden flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-zinc-700 font-bold text-xs uppercase">{product.name.charAt(0)}</span>
                    )}
                    {!product.is_available && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10">
                          HABIS
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                    <h3 className="font-semibold text-[13px] leading-snug line-clamp-2">{product.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-500 text-sm">Rp{product.price.toLocaleString('id-ID')}</span>
                      {product.is_available && (
                        getProductQuantity(product.id) > 0 ? (
                          <div className="flex items-center gap-1.5 bg-amber-500 rounded-full px-1.5 py-0.5 text-black font-bold" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => handleDecreaseProduct(product.id, e)} className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center">
                              <Minus size={12} />
                            </button>
                            <span className="text-xs px-1">{getProductQuantity(product.id)}</span>
                            <button onClick={(e) => { e.stopPropagation(); handleProductClick(product); }} className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center">
                              <Plus size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleProductClick(product); }} className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                            <Plus size={14} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}

          {/* Floating Cart Button */}
          {cartItemCount > 0 && (
            <div className="absolute bottom-6 left-0 right-0 px-4 z-50">
              <button
                onClick={() => setView('cart')}
                className="w-full h-14 bg-amber-500/60 backdrop-blur-2xl border border-amber-200/40 rounded-2xl shadow-[0_8px_32px_rgba(245,158,11,0.4)] text-white font-black flex items-center justify-between px-5 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center text-sm backdrop-blur-md border border-white/10">
                    {cartItemCount}
                  </div>
                  <span>Lihat Keranjang</span>
                </div>
                <span>Rp {cartTotal.toLocaleString('id-ID')}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {view === 'cart' && (
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 px-4 py-2">
            <div className="space-y-3 pb-6">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-zinc-900/40 border border-white/5 p-3 rounded-2xl">
                  {item.product.image_url ? (
                    <img src={item.product.image_url} className="w-14 h-14 rounded-xl object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                      <span className="text-zinc-600 font-bold">{item.product.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-zinc-100 truncate">{item.product.name}</h4>
                    {item.notes && <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{item.notes}</p>}
                    <p className="font-bold text-amber-500 text-sm mt-1">Rp {item.product.price.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex flex-row items-center gap-2 shrink-0 bg-black/40 p-1 rounded-xl">
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center"><Minus size={14} /></button>
                    <span className="font-bold text-[13px] w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 rounded-lg bg-zinc-800 text-white flex items-center justify-center"><Plus size={14} /></button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="py-20 text-center text-zinc-500 flex flex-col items-center gap-3">
                  <ShoppingCart size={40} className="opacity-20" />
                  <p>Keranjang kosong</p>
                  <Button variant="outline" className="mt-4 border-white/10 text-white" onClick={() => setView('menu')}>
                    Pilih Menu
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {cart.length > 0 && (
            <div className="p-4 bg-[#0a0a0a] border-t border-white/5 space-y-4">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-zinc-400">Total Pesanan</span>
                <span className="text-lg font-black text-amber-500">Rp {cartTotal.toLocaleString('id-ID')}</span>
              </div>
              <Button
                onClick={() => setView('checkout')}
                className="w-full h-14 rounded-2xl text-base font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20"
              >
                Lanjutkan Pesanan
              </Button>
            </div>
          )}
        </div>
      )}

      {view === 'checkout' && (
        <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-sm">Nama Pemesan</span>
              <span className="font-bold text-amber-500">{session?.customerName}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-sm">Jumlah Item</span>
              <span className="font-bold">{cartItemCount} item</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-sm">Total Bayar</span>
              <span className="text-xl font-black text-amber-500">Rp {cartTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
            <div className="mt-1 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            </div>
            <div>
              <div className="font-bold text-sm text-amber-500">Pembayaran di Kasir</div>
              <div className="text-xs text-zinc-400 mt-1">Silakan selesaikan pembayaran langsung di kasir (tunai/QRIS) saat pesanan selesai.</div>
            </div>
          </div>

          <Button
            onClick={submitOrder}
            disabled={isProcessing}
            className="w-full h-14 rounded-2xl text-base font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-8"
          >
            {isProcessing ? 'Memproses...' : 'Buat Pesanan Sekarang'}
          </Button>
        </div>
      )}

      {/* Options Dialog for Variants (simplified for mobile) */}
      <Dialog open={isOptionsModalOpen} onOpenChange={setIsOptionsModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1a1a1a] border-white/10 text-white rounded-t-3xl sm:rounded-2xl mt-auto sm:mt-0 p-0 overflow-hidden">
          {selectedProductForOptions && (
            <div className="flex flex-col max-h-[85vh]">
              <div className="p-5 border-b border-white/5 bg-black/20">
                <h2 className="text-lg font-bold">{selectedProductForOptions.name}</h2>
                <p className="text-amber-500 font-bold text-sm">Rp {selectedProductForOptions.price.toLocaleString('id-ID')}</p>
              </div>
              <ScrollArea className="p-5 flex-1">
                {selectedProductForOptions.variants?.map(variant => (
                   <div key={variant.name} className="mb-6 last:mb-2">
                     <p className="font-semibold text-sm mb-3 text-zinc-300">
                       {variant.name} {variant.is_required && <span className="text-amber-500 text-xs ml-1">(Wajib)</span>}
                     </p>
                     <div className="space-y-2">
                       {variant.choices.map(choice => {
                         const isSelected = selectedVariantChoices[variant.name]?.includes(choice.name);
                         return (
                           <label key={choice.name} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                             isSelected ? 'bg-amber-500/10 border-amber-500/50' : 'bg-black/20 border-white/5'
                           }`}>
                             <div className="flex items-center gap-3">
                               <input 
                                 type={variant.is_multiple ? 'checkbox' : 'radio'}
                                 className="w-4 h-4 accent-amber-500"
                                 checked={isSelected}
                                 onChange={() => {
                                   setSelectedVariantChoices(prev => {
                                     const current = prev[variant.name] || [];
                                     if (variant.is_multiple) {
                                       if (isSelected) return { ...prev, [variant.name]: current.filter(c => c !== choice.name) };
                                       return { ...prev, [variant.name]: [...current, choice.name] };
                                     } else {
                                       return { ...prev, [variant.name]: [choice.name] };
                                     }
                                   });
                                 }}
                               />
                               <span className="text-sm font-medium">{choice.name}</span>
                             </div>
                             {choice.price > 0 && <span className="text-xs text-amber-500 font-bold">+Rp{choice.price.toLocaleString('id-ID')}</span>}
                           </label>
                         );
                       })}
                     </div>
                   </div>
                ))}
              </ScrollArea>
              <div className="p-5 bg-[#141414] border-t border-white/5">
                <Button 
                  onClick={() => {
                    // Logic to extract addons and calculate extra price
                    let addonPrice = 0;
                    let notesArr: string[] = [];
                    selectedProductForOptions.variants?.forEach(v => {
                      const selected = selectedVariantChoices[v.name] || [];
                      selected.forEach(s => {
                        const choice = v.choices.find(c => c.name === s);
                        if (choice) {
                          addonPrice += choice.price;
                          notesArr.push(s);
                        }
                      });
                    });
                    const notes = notesArr.join(', ');
                    addToCart(selectedProductForOptions, notes, addonPrice, selectedVariantChoices);
                  }}
                  className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl"
                >
                  Tambahkan ke Keranjang
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
