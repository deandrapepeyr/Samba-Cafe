'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Plus, Minus, FileEdit, ShoppingCart, LockKeyhole, QrCode, Banknote, Clock, CheckCircle2, Zap, ArrowLeft, X, Utensils } from 'lucide-react';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { OrderQueueContainer } from '@/components/pos/OrderQueueContainer';

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

type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  notes?: string;
  variantChoices?: Record<string, string[]>;
};

type HybridSession = {
  orderNumber: string;
  cart: CartItem[];
  customerName: string;
  isEditMode: boolean;
  oldCartItems: any[];
};

function QuickPOSContent() {
  const { userName, role, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHybrid = searchParams.get('hybrid') === '1';

  useEffect(() => {
    router.replace('/pos');
  }, [router]);

  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isCheckingShift, setIsCheckingShift] = useState(true);
  const [hybridSession, setHybridSession] = useState<HybridSession | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileCartSheetOpen, setIsMobileCartSheetOpen] = useState(false);
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  // Automatically open cart when item is added, automatically close when cart is empty
  useEffect(() => {
    if (cart.length > 0) {
      setIsCartOpen(true);
    } else {
      setIsCartOpen(false);
      setIsMobileCartSheetOpen(false);
    }
  }, [cart.length]);

  // Active orders queue states
  const [pendingQrOrders, setPendingQrOrders] = useState<any[]>([]);
  const [preparingOrders, setPreparingOrders] = useState<any[]>([]);
  const [refreshActiveOrdersTrigger, setRefreshActiveOrdersTrigger] = useState(0);
  const [selectedActiveOrder, setSelectedActiveOrder] = useState<any | null>(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState<any | null>(null);
  const [confirmCompleteOrder, setConfirmCompleteOrder] = useState<any | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Note dialog
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [activeNoteItem, setActiveNoteItem] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  // Payment states (standalone quick POS)
  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'Cash' | 'Bayar Nanti' | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [isHutangNameDialogOpen, setIsHutangNameDialogOpen] = useState(false);

  const cartEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of cart when items are added (matching /pos behavior)
  useEffect(() => {
    if (cart.length > 0) {
      const timer = setTimeout(() => {
        if (cartEndRef.current) {
          cartEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [cart.length]);

  // Fetch data & Load hybrid session
  useEffect(() => {
    if (isLoading) return;

    // Load hybrid session or standard POS cart
    try {
      if (isHybrid) {
        const saved = localStorage.getItem('samba_hybrid_session');
        if (saved) {
          const session: HybridSession = JSON.parse(saved);
          setHybridSession(session);
          setCart(session.cart || []);
          setOrderNumber(session.orderNumber || '');
          setCustomerName(session.customerName || '');
        }
      } else {
        const savedCart = localStorage.getItem('samba_pos_cart');
        if (savedCart) setCart(JSON.parse(savedCart));
        const savedCustomer = localStorage.getItem('samba_pos_customer');
        if (savedCustomer) setCustomerName(savedCustomer);
      }
    } catch (err) {
      console.error('Error loading hybrid session or cart:', err);
    } finally {
      setIsStateLoaded(true);
    }

    // Cross-tab broadcast channel sync
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('samba_pos_cart_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'CART_CLEARED') {
          setCart([]);
          setCustomerName('');
          setOrderNumber('');
          setHybridSession(null);
        }
      };
    } catch (e) {}

    async function fetchData() {
      setIsCheckingShift(true);

      // Instant cache render
      try {
        const cachedCats = localStorage.getItem('samba_categories_cache');
        if (cachedCats) setCategories(JSON.parse(cachedCats));
        const cached = localStorage.getItem('samba_products_cache');
        if (cached) {
          const all = JSON.parse(cached);
          setAllProducts(all);
          const quickCached = all.filter((p: Product) => p.is_quick === true);
          setProducts(quickCached);
          setIsLoadingData(false);
        }
        const cachedPending = localStorage.getItem('samba_pending_orders_cache');
        if (cachedPending) setPendingQrOrders(JSON.parse(cachedPending));
        const cachedPreparing = localStorage.getItem('samba_preparing_orders_cache');
        if (cachedPreparing) setPreparingOrders(JSON.parse(cachedPreparing));
      } catch {}

      const [categoriesRes, productsRes] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('products').select('*')
      ]);

      if (categoriesRes.data) {
        const newCats = [{ id: '1', name: 'All Menu' }, ...categoriesRes.data];
        setCategories(newCats);
        try { localStorage.setItem('samba_categories_cache', JSON.stringify(newCats)); } catch {}
      }
      if (productsRes.data) {
        setAllProducts(productsRes.data);
        const quickProducts = productsRes.data
          .filter((p: any) => p.is_quick === true)
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
        setProducts(quickProducts);
        try { localStorage.setItem('samba_products_cache', JSON.stringify(productsRes.data)); } catch {}
      }
      setIsLoadingData(false);

      // Check shift
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

    return () => {
      if (bc) bc.close();
    };
  }, [userName, isLoading, isHybrid]);

  // Realtime subscription for active orders
  useEffect(() => {
    if (!role) return;

    const fetchActiveOrders = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: true });

      if (data && data.length > 0) {
        const txIds = data.map(t => t.id);
        const { data: itemsData } = await supabase
          .from('transaction_items')
          .select('*')
          .in('transaction_id', txIds);
          
        const txWithItems = data.map(tx => ({
          ...tx,
          items: itemsData ? itemsData.filter((i: any) => i.transaction_id === tx.id) : []
        }));

        // Only show pending QR orders on POS if customer has uploaded proof / waiting confirmation
        const newPending = txWithItems.filter(d => 
          d.status === 'pending' && 
          d.order_source === 'CUSTOMER_QR' && 
          (d.payment_status === 'WAITING_CONFIRMATION' || d.payment_status === 'AI_VERIFIED' || !!d.payment_proof_url)
        );
        const newPreparing = txWithItems.filter(d => d.status === 'preparing' || d.status === 'ready');
        setPendingQrOrders(newPending);
        setPreparingOrders(newPreparing);
        try {
          localStorage.setItem('samba_pending_orders_cache', JSON.stringify(newPending));
          localStorage.setItem('samba_preparing_orders_cache', JSON.stringify(newPreparing));
        } catch(e) {}
      } else {
        setPendingQrOrders([]);
        setPreparingOrders([]);
        try {
          localStorage.setItem('samba_pending_orders_cache', '[]');
          localStorage.setItem('samba_preparing_orders_cache', '[]');
        } catch(e) {}
      }
    };

    fetchActiveOrders();

    const channelId = `quick_pos_active_orders_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchActiveOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        const { data } = await supabase.from('products').select('*');
        if (data) {
          setAllProducts(data);
          const quickProducts = data
            .filter((p: any) => p.is_quick === true)
            .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
          setProducts(quickProducts);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, refreshActiveOrdersTrigger]);

  useEffect(() => {
    if (selectedActiveOrder) {
      const saved = localStorage.getItem(`checked_items_${selectedActiveOrder.id}`);
      if (saved) {
        try {
          setCheckedItems(JSON.parse(saved));
        } catch (e) {
          setCheckedItems({});
        }
      } else {
        setCheckedItems({});
      }
    }
  }, [selectedActiveOrder]);

  const toggleCheckItem = (idx: number) => {
    if (!selectedActiveOrder) return;
    const newChecked = { ...checkedItems, [idx]: !checkedItems[idx] };
    setCheckedItems(newChecked);
    localStorage.setItem(`checked_items_${selectedActiveOrder.id}`, JSON.stringify(newChecked));
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, overrideMethod?: string) => {
    let updateData: any = { status: newStatus };
    let finalStatus = newStatus;

    if (newStatus === 'completed') {
      finalStatus = `completed|${new Date().toISOString()}`;
      updateData.status = finalStatus;
    }
    
    if (overrideMethod) {
      updateData.method = overrideMethod;
    }

    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', orderId);

    if (!error) {
      setRefreshActiveOrdersTrigger(prev => prev + 1);
      if (selectedActiveOrder?.id === orderId && newStatus === 'completed') {
        setSelectedActiveOrder(null);
      } else if (selectedActiveOrder?.id === orderId) {
        setSelectedActiveOrder((prev: any) => ({ ...prev, status: newStatus, ...(updateData.method ? { method: updateData.method } : {}) }));
      }
    }
  };

  const loadOrderForEdit = (order: any) => {
    setSelectedActiveOrder(null);
    router.push(`/pos?edit=${order.id}`);
  };

  const isStockEmpty = (product: Product) => {
    return !product.is_available;
  };

  const getStockString = (product: Product) => {
    return product.is_available ? 'Tersedia' : 'Habis';
  };

  const isLocked = !isLoading && !isCheckingShift && (!role || !activeShift);

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const total = subtotal; // Tax & service Rp 0
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleProductClick = (product: Product) => {
    if (isLocked) return;
    if (isStockEmpty(product)) return;

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      if (existingIndex > -1) {
        const current = prev[existingIndex];
        const updated = [...prev];
        updated[existingIndex] = { ...current, quantity: current.quantity + 1 };
        return updated;
      }
      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          product: { ...product, is_quick: true },
          quantity: 1,
          notes: ''
        }
      ];
    });

    setIsCartOpen(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
  };

  const openNoteDialog = (item: CartItem) => {
    setActiveNoteItem(item.id);
    setTempNote(item.notes || '');
    setIsNoteDialogOpen(true);
  };

  const handleSaveNote = () => {
    if (activeNoteItem) {
      setCart(prev => prev.map(item =>
        item.id === activeNoteItem ? { ...item, notes: tempNote } : item
      ));
    }
    setIsNoteDialogOpen(false);
  };

  const handleReturnToPOSWithItems = () => {
    try {
      if (cart.length > 0) {
        localStorage.setItem('samba_pos_cart', JSON.stringify(cart));
        if (customerName) {
          localStorage.setItem('samba_pos_customer', customerName);
        }
      } else {
        localStorage.removeItem('samba_pos_cart');
        localStorage.removeItem('samba_pos_customer');
      }
      localStorage.removeItem('samba_hybrid_session');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('samba-pos-cart-sync', { detail: { action: 'updated' } }));
      }
      router.replace('/pos');
    } catch (e) {
      console.error('Failed to merge hybrid cart:', e);
      router.replace('/pos');
    }
  };

  const getQuickCashSuggestions = (totalAmount: number) => {
    const defaults = [5000, 10000, 15000, 20000, 30000, 50000, 100000];
    const suggestions = [totalAmount];
    defaults.forEach(d => {
      if (d > totalAmount && !suggestions.includes(d)) {
        suggestions.push(d);
      }
    });

    if (totalAmount > 100000) {
      const next50k = Math.ceil(totalAmount / 50000) * 50000;
      if (!suggestions.includes(next50k)) suggestions.push(next50k);
      const next100k = Math.ceil(totalAmount / 100000) * 100000;
      if (next100k !== next50k && !suggestions.includes(next100k)) suggestions.push(next100k);
    }

    return suggestions.slice(0, 6);
  };

  const handlePaymentClick = (method: 'QRIS' | 'Cash' | 'Bayar Nanti') => {
    if (cart.length === 0) return;
    if (method === 'Bayar Nanti' && !customerName) {
      setIsHutangNameDialogOpen(true);
      return;
    }
    finalizeStandalonePayment(method);
  };

  const finalizeStandalonePayment = async (method: 'QRIS' | 'Cash' | 'Bayar Nanti', cashAmount?: number) => {
    setIsProcessingCheckout(true);
    try {
      const today = new Date();
      const datePrefix = `order_${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}_`;
      let newOrderId = `${datePrefix}0001`;
      try {
        const { data } = await supabase
          .from('transactions')
          .select('id')
          .like('id', `${datePrefix}%`)
          .order('id', { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          const lastSeq = parseInt(data[0].id.split('_').pop() || '0', 10);
          newOrderId = `${datePrefix}${(lastSeq + 1).toString().padStart(4, '0')}`;
        }
      } catch {}

      const hasCooked = cart.some(item => !item.product.is_quick);
      const isEdit = Boolean(hybridSession?.isEditMode);
      const transactionId = (isEdit && orderNumber) ? orderNumber : newOrderId;
      const finalCashReceived = method === 'Cash' ? (cashAmount ?? total) : null;
      const transaction = {
        id: transactionId,
        method,
        total,
        cashier_name: userName || 'Unknown',
        status: (method === 'Bayar Nanti') ? 'preparing' : (hasCooked ? 'preparing' : `completed|${new Date().toISOString()}`),
        cash_received: finalCashReceived,
        customer_name: customerName || null,
        payment_status: method === 'QRIS' ? 'PENDING_VERIFICATION' : (method === 'Bayar Nanti' ? 'UNPAID' : 'PAID')
      };

      const itemsToInsert = cart.map(item => ({
        transaction_id: transactionId,
        product_name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        notes: item.notes || null,
        supplier_price: item.product.supplier_price || 0
      }));

      try {
        const { error: rpcError } = await supabase.rpc('process_checkout_v2', {
          p_is_edit: false,
          p_transaction: transaction,
          p_transaction_items: itemsToInsert,
          p_titipan_deductions: [],
          p_stock_deductions: []
        });
        if (rpcError) throw rpcError;
      } catch {
        await supabase.from('transactions').insert([transaction]);
        await supabase.from('transaction_items').insert(itemsToInsert);
      }

      const changeAmount = (finalCashReceived !== null && finalCashReceived > total) ? (finalCashReceived - total) : 0;
      if (changeAmount > 0) {
        alert(`Kembalian: Rp ${changeAmount.toLocaleString('id-ID')}\nOrder #${transactionId} selesai.`);
      }

      localStorage.removeItem('samba_hybrid_session');
      localStorage.removeItem('samba_pos_cart');
      localStorage.removeItem('samba_pos_customer');
      localStorage.removeItem('samba_pos_order_number');
      localStorage.removeItem('samba_pos_edit_mode');
      localStorage.removeItem('samba_pos_old_items');
      localStorage.setItem('samba_cart_cleared_at', Date.now().toString());

      setCart([]);
      setCustomerName('');
      setPaymentMethod(null);
      setCashReceived('');
      setOrderNumber('');
      setHybridSession(null);

      try {
        const bc = new BroadcastChannel('samba_pos_cart_channel');
        bc.postMessage({ type: 'CART_CLEARED', timestamp: Date.now() });
        bc.close();
      } catch (e) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('samba-pos-cart-sync', { detail: { action: 'cleared' } }));
        window.dispatchEvent(new Event('cart-cleared'));
        window.dispatchEvent(new Event('storage'));
      }

      setTimeout(() => {
        window.location.href = '/pos';
      }, 300);
    } catch (err: any) {
      alert('Gagal memproses transaksi: ' + (err.message || 'Error'));
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Filter products by category and search
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = searchQuery.trim() !== '' ? true : (activeCategory === '1' || p.category_id === activeCategory);
    return matchesCategory && matchesSearch;
  });

  // Filter categories to only those with quick items
  const visibleCategories = categories.filter(cat => {
    if (cat.id === '1') return true;
    return products.some(p => p.category_id === cat.id);
  });

  // Cart content rendered in exact same style and markup as /pos/page.tsx
  const renderCartContent = () => (
    <>
      <div className="p-4 xl:p-6 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-xl xl:text-2xl font-bold">Current Order</h2>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
            <span>Order #{orderNumber || 'Cepat Saji'}</span>
            {isCheckingShift ? (
              <>
                <span>•</span>
                <span className="text-muted-foreground italic flex items-center gap-1 text-xs">
                  Checking status...
                </span>
              </>
            ) : userName && role ? (
              <>
                <span>•</span>
                <span className="text-foreground font-semibold">Kasir: {userName}</span>
              </>
            ) : (
              <>
                <span>•</span>
                <span className="text-amber-500 font-semibold flex items-center gap-1">
                  <LockKeyhole size={14} /> Belum Login
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
        {isCheckingShift ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground mt-12 gap-3">
            <p className="text-xs">Checking shift status...</p>
          </div>
        ) : isLocked ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-muted-foreground mt-8">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
              <LockKeyhole size={32} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">Fitur POS Terkunci</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {role ? `Kasir (${userName}) belum membuka shift.` : 'Silakan Log In kasir untuk mulai transaksi.'}
              </p>
            </div>
          </div>
        ) : cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground mt-20">
            <p>Your cart is empty</p>
          </div>
        ) : (
          <div className="space-y-4 pb-32 lg:pb-0">
            {cart.map(item => (
              <div key={item.id} className="flex flex-col gap-2 p-3 bg-background rounded-xl border border-border">
                <div className="flex justify-between">
                  <span className="font-medium line-clamp-1">{item.product.name}</span>
                  <span className="font-medium whitespace-nowrap ml-2">Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}</span>
                </div>

                {item.notes && (
                  <p className="text-xs text-primary bg-primary/10 p-1.5 rounded-md italic">
                    Note: {item.notes}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={() => openNoteDialog(item)}
                    className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-xs"
                  >
                    <FileEdit size={14} /> Add Note
                  </button>

                  <div className="flex items-center gap-3 bg-muted rounded-lg p-1">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-background transition-colors text-foreground"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-4 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-background transition-colors text-foreground"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div ref={cartEndRef} />
          </div>
        )}
      </div>

      <div className="p-4 xl:p-6 bg-zinc-950 border-t border-white/5 mt-auto relative shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]">
        <div className="space-y-4 mb-6 relative z-10">
          <div className="bg-zinc-900/40 rounded-xl p-4 border border-white/5 space-y-3">
            <div className="flex justify-between text-zinc-400 text-sm">
              <span>Subtotal</span>
              <span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-zinc-400 text-sm">
              <span>Tax & Service</span>
              <span>Rp 0</span>
            </div>
            <Separator className="bg-white/10" />
            <div className="flex justify-between text-2xl font-bold text-zinc-100 items-center pt-1">
              <span>Total</span>
              <span className="text-primary tracking-tight">Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Action buttons inside drawer */}
          {!isLocked && cart.length > 0 && (
            <button
              onClick={handleReturnToPOSWithItems}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-zinc-950 hover:border-amber-500 transition-all text-xs font-bold shadow-sm active:scale-98 cursor-pointer"
            >
              <Utensils size={15} className="text-amber-400" />
              Menu POS Utama (Masakan)
            </button>
          )}

          {/* Mobile Payment Options inside drawer */}
          <div className="space-y-4 md:hidden">
            <Input 
              id="customer-name-input-mobile"
              placeholder="Nama Customer (Opsional)" 
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="bg-zinc-900/50 border-white/10 h-11 focus-visible:ring-primary placeholder:text-zinc-500 transition-all"
            />

            {paymentMethod === 'Cash' ? (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-bold text-zinc-300">Pilih Nominal Tunai</span>
                  <button onClick={() => setPaymentMethod(null)} className="text-xs text-rose-400 hover:text-rose-300 font-bold px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer">Batal</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {getQuickCashSuggestions(total).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setCashReceived(val.toString());
                        finalizeStandalonePayment('Cash', val);
                      }}
                      className={`p-3 rounded-2xl text-sm font-bold transition-all duration-300 border shadow-sm cursor-pointer ${
                        parseInt(cashReceived.replace(/\./g, '') || '0') === val
                          ? 'bg-primary text-primary-foreground border-primary scale-95'
                          : 'bg-zinc-900 text-zinc-200 border-white/10 hover:bg-zinc-800 hover:border-primary/50'
                      }`}
                    >
                      {val === total ? 'Uang Pas' : `Rp ${val.toLocaleString('id-ID')}`}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => finalizeStandalonePayment('QRIS')}
                    className="bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white border border-blue-500/20 p-3 rounded-2xl font-bold flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer"
                  >
                    <QrCode size={22} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs">QRIS</span>
                  </button>

                  <button 
                    onClick={() => setPaymentMethod('Cash')}
                    className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 p-3 rounded-2xl font-bold flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer"
                  >
                    <Banknote size={22} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs">Tunai</span>
                  </button>

                  <button 
                    onClick={() => {
                      if (!customerName) {
                        setIsHutangNameDialogOpen(true);
                        return;
                      }
                      finalizeStandalonePayment('Bayar Nanti');
                    }}
                    className="bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20 p-3 rounded-2xl font-bold flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer"
                  >
                    <Clock size={22} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs">Hutang</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderCheckoutFAB = () => {
    if (isCheckingShift || isLocked || cart.length === 0) return null;

    return (
      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/90 backdrop-blur-xl p-3 rounded-[2rem] border border-white/10 shadow-2xl items-center gap-3 animate-in slide-in-from-bottom-8">
        <div className="bg-zinc-950/50 rounded-2xl p-1.5 flex items-center gap-2 pr-4 shrink-0 border border-white/5">
          <div className="bg-primary/20 text-primary w-10 h-10 rounded-xl flex items-center justify-center font-bold">
            {cartItemCount}
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-zinc-400">Total</span>
            <span className="text-sm font-bold text-primary">Rp {total.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <Input 
          id="customer-name-input-desktop"
          placeholder="Nama Cust..." 
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          className="w-32 bg-zinc-900 border-white/10 h-11 focus-visible:ring-primary placeholder:text-zinc-500 rounded-xl transition-all"
        />

        {/* Tombol Menu POS Utama pada Floating Bar */}
        <button
          onClick={handleReturnToPOSWithItems}
          className="h-11 px-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-zinc-950 transition-all font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shadow-sm active:scale-95 cursor-pointer"
          title="Kembali ke POS Utama (Menu Masakan)"
        >
          <Utensils size={15} className="text-amber-400" />
          <span>Menu POS Utama</span>
        </button>

        <div className="h-8 w-px bg-white/10 mx-1" />

        {paymentMethod === 'Cash' ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setPaymentMethod(null)} className="h-11 px-3 text-xs text-rose-400 hover:bg-rose-500/10 rounded-xl font-bold transition-colors cursor-pointer">Batal</button>
            <div className="flex items-center gap-2 overflow-x-auto max-w-[400px] scrollbar-hide">
              {getQuickCashSuggestions(total).map((val) => (
                <button
                  key={val}
                  onClick={() => {
                    setCashReceived(val.toString());
                    finalizeStandalonePayment('Cash', val);
                  }}
                  className={`h-11 px-4 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300 border cursor-pointer ${
                    parseInt(cashReceived.replace(/\./g, '') || '0') === val
                      ? 'bg-primary text-primary-foreground border-primary scale-95'
                      : 'bg-zinc-800 text-zinc-200 border-white/5 hover:bg-zinc-700'
                  }`}
                >
                  {val === total ? 'Pas' : (val >= 1000 ? `${val/1000}k` : val)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => finalizeStandalonePayment('QRIS')}
              className="bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white border border-blue-500/20 h-11 px-5 rounded-xl font-bold flex items-center gap-2 transition-all group cursor-pointer"
            >
              <QrCode size={18} className="group-hover:scale-110 transition-transform" />
              <span>QRIS</span>
            </button>
            <button 
              onClick={() => setPaymentMethod('Cash')}
              className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 h-11 px-5 rounded-xl font-bold flex items-center gap-2 transition-all group cursor-pointer"
            >
              <Banknote size={18} className="group-hover:scale-110 transition-transform" />
              <span>Tunai</span>
            </button>
            <button 
              onClick={() => {
                if (!customerName) {
                  setIsHutangNameDialogOpen(true);
                  return;
                }
                finalizeStandalonePayment('Bayar Nanti');
              }}
              className="bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20 h-11 px-4 rounded-xl font-bold flex items-center gap-2 transition-all group cursor-pointer"
            >
              <Clock size={18} className="group-hover:scale-110 transition-transform" />
              <span className="hidden xl:inline">Hutang</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <MainLayout title="Point of Sale">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Search Header, Categories, and Products Grid */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
          {/* Header */}
          <header className="px-4 md:px-6 py-3.5 sticky top-0 z-30 bg-[#0b0a08]/85 backdrop-blur-xl border-b border-white/10">
            <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[180px] group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" size={18} />
                <Input
                  className="pl-10 h-11 bg-zinc-900/60 border-white/10 text-sm focus-visible:ring-1 focus-visible:ring-primary rounded-2xl transition-all shadow-inner hover:bg-zinc-900/80"
                  placeholder="Cari menu cepat saji..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Order Queue Header Chips */}
              <OrderQueueContainer className="max-w-full md:max-w-[48%]" />

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleReturnToPOSWithItems}
                  className="h-11 px-4 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-zinc-950 transition-all duration-300 gap-2 rounded-2xl text-sm font-bold bg-amber-500/10 shadow-sm flex items-center justify-center cursor-pointer"
                  title="Kembali ke POS Utama (Menu Masakan)"
                >
                  <Utensils size={16} />
                  <span className="hidden sm:inline">Menu POS Utama</span>
                </button>

                {/* Desktop Cart Toggle (identical to /pos) */}
                <Button
                  variant="outline"
                  className={`flex items-center gap-2 h-11 px-4 rounded-2xl border-white/10 bg-zinc-900/50 hover:bg-zinc-800 hover:border-primary/50 transition-all duration-300 ${cart.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (cart.length > 0) {
                      setIsCartOpen(!isCartOpen);
                    }
                  }}
                  disabled={cart.length === 0}
                  title={cart.length === 0 ? "Keranjang masih kosong" : (isCartOpen ? "Sembunyikan Keranjang" : "Buka Keranjang")}
                >
                  <ShoppingCart size={18} className={cartItemCount > 0 ? 'text-primary' : ''} />
                  <span className="hidden lg:inline">{isCartOpen && cart.length > 0 ? 'Tutup Keranjang' : 'Keranjang'}</span>
                  {cartItemCount > 0 && (
                    <div className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg shadow-primary/20">
                      {cartItemCount}
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </header>

          {/* Category Tabs & Active Orders Horizontal Queue */}
          <div className="px-4 md:px-6 pt-4 pb-2 w-full max-w-[100vw] overflow-hidden shrink-0">
            {/* Active Orders Horizontal Queue & QR Notification */}
            {pendingQrOrders.length > 0 && (
              <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                    <Clock className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-500 text-sm md:text-base">Pesanan Mandiri (QR) Valid Masuk!</h3>
                    <p className="text-xs md:text-sm text-zinc-400">Ada {pendingQrOrders.length} pesanan terverifikasi AI yang siap dikonfirmasi kasir.</p>
                  </div>
                </div>
                <Link href="/orders" className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-bold h-10 px-6 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 transition-transform active:scale-95">
                  Cek Pesanan
                </Link>
              </div>
            )}

            <div className="flex w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide bg-zinc-900/40 p-1.5 rounded-2xl border border-white/5 shadow-inner gap-1">
              {visibleCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300 snap-start shrink-0 ${
                    activeCategory === cat.id
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid (identical card layout to /pos) */}
          <div className="p-4 md:p-6 shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5 pb-32">
              {filteredProducts.map(product => {
                const cartItem = cart.find(c => c.product.id === product.id);
                const qtyInCart = cartItem ? cartItem.quantity : 0;
                const isUnavailable = !product.is_available;

                return (
                  <div
                    key={product.id}
                    onClick={() => {
                      if (isUnavailable) return;
                      handleProductClick(product);
                    }}
                    className={`group relative border rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between h-[120px] select-none ${
                      isUnavailable
                        ? 'bg-zinc-900/40 border-zinc-700/50 opacity-70 cursor-not-allowed shadow-none'
                        : isLocked
                        ? 'bg-zinc-900/40 border-white/5 opacity-90 cursor-pointer hover:border-amber-500/50'
                        : `bg-zinc-900/40 cursor-pointer ${qtyInCart > 0 ? 'border-primary/50 bg-primary/10' : 'border-white/5 hover:border-white/20 hover:bg-zinc-800/60'} hover:-translate-y-1`
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate pr-2">
                          {categories.find(c => c.id === product.category_id)?.name || 'CEPAT SAJI'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {qtyInCart > 0 && !isUnavailable && (
                            <div className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {qtyInCart}x
                            </div>
                          )}
                        </div>
                      </div>
                      <h3 className={`text-[13px] md:text-sm font-bold line-clamp-2 leading-tight ${isUnavailable ? 'text-zinc-400' : qtyInCart > 0 ? 'text-primary' : 'text-zinc-200 group-hover:text-white'}`}>
                        {product.name}
                      </h3>
                    </div>

                    <div className="flex justify-between items-end mt-2">
                      <p className={`text-sm font-bold ${isUnavailable ? 'text-zinc-500' : qtyInCart > 0 ? 'text-zinc-200' : 'text-zinc-400'}`}>
                        Rp {product.price.toLocaleString('id-ID')}
                      </p>
                      <span className={`text-[11px] font-bold ${!isUnavailable ? 'text-emerald-500' : 'text-rose-400/90 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider'}`}>
                        {getStockString(product)}
                      </span>
                    </div>

                    {isLocked && !isUnavailable && (
                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-amber-400 p-1.5 rounded-lg border border-amber-500/30 z-20">
                        <LockKeyhole size={14} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {renderCheckoutFAB()}
        </div>

        {/* Mobile Floating Cart Bar (matches /pos) */}
        <div className={`lg:hidden fixed bottom-[80px] left-4 right-4 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300 ${cartItemCount > 0 ? 'block' : 'hidden'}`}>
          <Sheet open={isMobileCartSheetOpen} onOpenChange={setIsMobileCartSheetOpen}>
            <SheetTrigger className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl p-4 flex items-center justify-between shadow-[0_10px_40px_-10px_rgba(234,179,8,0.5)] border border-primary/20 transition-transform active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="bg-primary-foreground/20 px-3 py-1.5 rounded-xl font-bold text-sm">
                  {cartItemCount} Item
                </div>
                <span className="font-bold text-sm">{isHybrid ? 'Hybrid Order' : 'My Orders'}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-bold text-lg">
                  Rp {total.toLocaleString('id-ID')}
                </div>
                <ShoppingCart size={20} />
              </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] p-0 bg-card border-t border-border rounded-t-3xl flex flex-col z-[100] outline-none">
              <SheetHeader className="p-0 border-b border-border sr-only">
                <SheetTitle>Current Order</SheetTitle>
              </SheetHeader>
              <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-3 shrink-0" />
              {renderCartContent()}
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Cart Sidebar (exact width w-72 xl:w-80 and styling matching /pos) */}
        {(isCartOpen && cart.length > 0) && (
          <div className="hidden lg:flex w-72 xl:w-80 border-l border-border bg-card flex-col h-full shrink-0 transition-all duration-300">
            {renderCartContent()}
          </div>
        )}
      </div>

      {/* Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Catatan Pesanan</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Tambahkan catatan khusus untuk menu ini.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Contoh: Dingin, jangan terlalu manis..."
              value={tempNote}
              onChange={(e) => setTempNote(e.target.value)}
              className="bg-zinc-900 border-white/10 focus-visible:ring-primary min-h-[100px]"
            />
          </div>
          <DialogFooter className="flex sm:justify-between items-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTempNote('');
                if (activeNoteItem) {
                  setCart(prev => prev.map(item => item.id === activeNoteItem ? { ...item, notes: '' } : item));
                }
                setIsNoteDialogOpen(false);
              }}
              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
            >
              Hapus Catatan
            </Button>
            <Button type="button" onClick={handleSaveNote} className="bg-primary text-primary-foreground font-bold">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Input Nama Hutang Dialog */}
      <Dialog open={isHutangNameDialogOpen} onOpenChange={setIsHutangNameDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nama Customer (Kasbon)</DialogTitle>
            <DialogDescription>
              Silakan masukkan nama customer untuk melanjutkan transaksi kasbon.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              autoFocus
              placeholder="Masukkan nama customer..." 
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="bg-background border-border h-12 text-lg focus-visible:ring-primary"
              onKeyDown={e => {
                if (e.key === 'Enter' && customerName.trim() !== '') {
                  setIsHutangNameDialogOpen(false);
                  finalizeStandalonePayment('Bayar Nanti');
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsHutangNameDialogOpen(false)}>Batal</Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold" 
              onClick={() => {
                if (!customerName) return;
                setIsHutangNameDialogOpen(false);
                finalizeStandalonePayment('Bayar Nanti');
              }}
              disabled={!customerName}
            >
              Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active Order Details Dialog */}
      <Dialog open={!!selectedActiveOrder} onOpenChange={() => setSelectedActiveOrder(null)}>
        <DialogContent className="bg-zinc-950 border-white/10 text-zinc-100 sm:max-w-4xl md:max-w-5xl w-[95vw] rounded-2xl max-h-[85vh] overflow-y-auto">
          {selectedActiveOrder && (
            <>
              <DialogHeader className="flex flex-row items-start justify-between pr-8">
                <div>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    {selectedActiveOrder.customer_name ? selectedActiveOrder.customer_name : `Order #${selectedActiveOrder.id.split('_').pop()}`}
                  </DialogTitle>
                  {selectedActiveOrder.customer_name && (
                    <DialogDescription className="font-mono text-zinc-400 text-sm mt-1">
                      #{selectedActiveOrder.id.startsWith('order_') ? selectedActiveOrder.id.split('_').pop() : selectedActiveOrder.id}
                    </DialogDescription>
                  )}
                </div>
                
                <button 
                  onClick={() => loadOrderForEdit(selectedActiveOrder)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <Plus size={16} strokeWidth={3} /> Tambah Menu
                </button>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="flex justify-between text-base text-zinc-400 pb-3 border-b border-white/5">
                  <span>{new Date(selectedActiveOrder.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="font-bold text-emerald-400">{selectedActiveOrder.method}</span>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-bold text-sm text-zinc-300 uppercase tracking-wider">Daftar Pesanan</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedActiveOrder.items?.map((item: any, i: number) => {
                      const p = (allProducts.length > 0 ? allProducts : products).find(prod => prod.name === item.product_name);
                      const isQuick = p?.is_quick;
                      return (
                        <button 
                          key={i} 
                          onClick={() => toggleCheckItem(i)}
                          className={`flex justify-between items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                            checkedItems[i] 
                              ? 'bg-emerald-500/10 border-emerald-500/30' 
                              : 'bg-white/5 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex flex-col gap-1.5 flex-1">
                            <span className={`font-bold text-lg flex items-center gap-2 ${checkedItems[i] ? 'text-emerald-400 line-through opacity-70' : 'text-zinc-100'}`}>
                              {checkedItems[i] ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : <div className="w-[18px] h-[18px] rounded-full border-2 border-zinc-600 shrink-0" />}
                              {item.quantity}x {item.product_name}
                            </span>
                            {item.notes && <span className={`text-sm font-medium whitespace-pre-wrap ${checkedItems[i] ? 'text-emerald-500/50 line-through' : 'text-amber-500'}`}>{item.notes}</span>}
                          </div>
                          {isQuick ? (
                            <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md border ${checkedItems[i] ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>Siap Saji</span>
                          ) : (
                            <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md border ${checkedItems[i] ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>Dimasak</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <Button
                    onClick={() => {
                      const order = selectedActiveOrder;
                      setSelectedActiveOrder(null);
                      if (order.method === 'Bayar Nanti') {
                        setPaymentModalOrder(order);
                      } else {
                        setConfirmCompleteOrder(order);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    <CheckCircle2 size={16} className="mr-1.5" />
                    {selectedActiveOrder.method === 'Bayar Nanti' ? 'Lunasi & Selesaikan' : 'Selesaikan Pesanan'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Payment Modal */}
      <Dialog open={!!paymentModalOrder} onOpenChange={() => setPaymentModalOrder(null)}>
        <DialogContent className="bg-zinc-950 border-white/10 text-zinc-100 max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Pilih Pembayaran</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Selesaikan pesanan <span className="font-mono text-white">#{paymentModalOrder?.id.split('_').pop()}</span> dengan:
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <button 
              onClick={() => {
                updateOrderStatus(paymentModalOrder.id, 'completed', 'Cash (Lunas)');
                setPaymentModalOrder(null);
              }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 flex flex-col items-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <Banknote size={24} />
              CASH
            </button>
            <button 
              onClick={() => {
                updateOrderStatus(paymentModalOrder.id, 'completed', 'QRIS');
                setPaymentModalOrder(null);
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 flex flex-col items-center gap-2 transition-transform active:scale-95 cursor-pointer"
            >
              <QrCode size={24} />
              QRIS
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Selesai Dialog (1-click confirmation) */}
      <Dialog open={!!confirmCompleteOrder} onOpenChange={() => setConfirmCompleteOrder(null)}>
        <DialogContent className="bg-zinc-950 border-white/10 text-zinc-100 max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={22} />
              Selesaikan Pesanan?
            </DialogTitle>
            <DialogDescription className="text-zinc-400 pt-2 text-sm">
              Pesanan <span className="font-mono text-white font-bold">#{confirmCompleteOrder?.id.split('_').pop()}</span>
              {confirmCompleteOrder?.customer_name && <span> atas nama <span className="text-amber-400 font-semibold">{confirmCompleteOrder.customer_name}</span></span>} akan ditandai selesai dan dikeluarkan dari antrean.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex sm:justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmCompleteOrder(null)} className="border-white/10 hover:bg-white/5">
              Batal
            </Button>
            <Button 
              onClick={() => {
                if (confirmCompleteOrder) {
                  updateOrderStatus(confirmCompleteOrder.id, 'completed');
                  setConfirmCompleteOrder(null);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Ya, Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

export default function QuickPOSPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <QuickPOSContent />
    </Suspense>
  );
}
