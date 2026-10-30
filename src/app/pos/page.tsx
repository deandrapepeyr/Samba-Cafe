'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/lib/supabase';
import { Search, QrCode, CheckCircle2, ShoppingCart, LockKeyhole, Flame, ShoppingBag, X, Calculator } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth, Role } from '@/lib/AuthContext';
import { KitchenQueueStrip } from '@/components/pos/KitchenQueueStrip';
import { useKitchenQueue } from '@/hooks/useKitchenQueue';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CategoryRail, type CategoryRailTab } from '@/components/pos/CategoryRail';
import { useFavorites } from '@/hooks/useFavorites';
import { matchCategoryToGroup } from '@/config/categoryGroups';
import { CartPanel } from '@/components/pos/CartPanel';
import { VariantModal } from '@/components/pos/VariantModal';
import { PaymentSheet } from '@/components/pos/PaymentSheet';
import { ShiftFlow } from '@/components/pos/ShiftFlow';
import { ActiveOrderModals } from '@/components/pos/ActiveOrderModals';
import { NoteModal } from '@/components/pos/NoteModal';
import { FreeItemModal } from '@/components/pos/FreeItemModal';
import { CalculatorPanel } from '@/components/pos/CalculatorPanel';
import type { ProductVariantChoice, ProductVariant, Product, Category, CartItem } from '@/types/pos';
export type { ProductVariantChoice, ProductVariant, Product, Category, CartItem };

export default function POSPage() {
  const pathname = usePathname();
  const [cashierProfiles, setCashierProfiles] = useState<{ name: string; role: Role; label: string; initial: string }[]>([
    { name: 'deandra pepe yongker', role: 'cashier', label: 'Kasir', initial: 'D' },
    { name: 'sheera', role: 'cashier', label: 'Kasir', initial: 'S' },
  ]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocksData, setStocksData] = useState<{id: string, quantity: number, name: string, sell_price: number, is_topping: boolean, tracking_method?: string}[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { favoriteIds, refreshFavorites } = useFavorites(products);
  const { orders: kitchenOrders, advanceOrder } = useKitchenQueue();
  const [isKitchenStripCollapsed, setIsKitchenStripCollapsed] = useState(false);

  // Instantly render products, categories, and last category from cache on client mount
  useEffect(() => {
    try {
      const cachedProds = localStorage.getItem('samba_products_cache');
      if (cachedProds) {
        const parsed = JSON.parse(cachedProds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
          setIsLoadingData(false);
        }
      }
      const cachedCats = localStorage.getItem('samba_categories_cache');
      if (cachedCats) {
        const parsed = JSON.parse(cachedCats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
        }
      }
      const saved = sessionStorage.getItem('samba_pos_last_category');
      if (saved) {
        setActiveCategory(saved);
      }
    } catch (e) {}
  }, []);
  const [menuTypeFilter, setMenuTypeFilter] = useState<'all' | 'quick' | 'cooked'>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isFreeItemModalOpen, setIsFreeItemModalOpen] = useState(false);
  const [lastRemovedItem, setLastRemovedItem] = useState<CartItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Options Modal State
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [selectedProductForOptions, setSelectedProductForOptions] = useState<Product | null>(null);
  const [selectedVariantChoices, setSelectedVariantChoices] = useState<Record<string, string[]>>({});

  // Note dialog state
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [activeNoteItem, setActiveNoteItem] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  // Checkout flow state
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'none' | 'method' | 'confirm' | 'success'>('none');
  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'Cash' | 'Bayar Nanti' | null>(null);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [toastMessage, setToastMessage] = useState<{title: string, desc: string, variant?: 'success' | 'alert'} | null>(null);

  // QRIS State
  const [isQRISModalOpen, setIsQRISModalOpen] = useState(false);

  // Auth & Shift Management
  const { userName, role, isLoading, login, logout } = useAuth();
  const router = useRouter();
  
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isCheckingShift, setIsCheckingShift] = useState(true);
  const [isSelectCashierOpen, setIsSelectCashierOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{ name: string; role: Role } | null>(null);
  
  // Profile Password Verification State
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [profilePasswordInput, setProfilePasswordInput] = useState('');
  const [profilePasswordError, setProfilePasswordError] = useState('');
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  const [isStartShiftDialogOpen, setIsStartShiftDialogOpen] = useState(false);
  const [isEndShiftDialogOpen, setIsEndShiftDialogOpen] = useState(false);
  const [startingCashInput, setStartingCashInput] = useState('');
  const [endingCashInput, setEndingCashInput] = useState('');
  const [expectedCash, setExpectedCash] = useState(0);
  const [shiftSummary, setShiftSummary] = useState<any>(null);

  const [isShiftSummaryOpen, setIsShiftSummaryOpen] = useState(false);
  const [isHutangNameDialogOpen, setIsHutangNameDialogOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileCartSheetOpen, setIsMobileCartSheetOpen] = useState(false);

  // Automatically open cart when item is added, automatically close when cart is empty
  useEffect(() => {
    if (cart.length > 0) {
      setIsCartOpen(true);
    } else {
      setIsCartOpen(false);
      setIsMobileCartSheetOpen(false);
    }
  }, [cart.length]);
  const [pendingQrOrders, setPendingQrOrders] = useState<any[]>([]);
  const [preparingOrders, setPreparingOrders] = useState<any[]>([]);
  const [refreshActiveOrdersTrigger, setRefreshActiveOrdersTrigger] = useState(0);
  const [selectedActiveOrder, setSelectedActiveOrder] = useState<any | null>(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState<any | null>(null);
  const [confirmCompleteOrder, setConfirmCompleteOrder] = useState<any | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [oldCartItems, setOldCartItems] = useState<any[]>([]);
  const [previouslyPaidAmount, setPreviouslyPaidAmount] = useState<number>(0);
  const [isOriginalOrderPaid, setIsOriginalOrderPaid] = useState<boolean>(false);
  
  const cartEndRef = useRef<HTMLDivElement>(null);

  const [isStateRestored, setIsStateRestored] = useState(false);

  // Screen Wake Lock API (Fase 5c) to keep tablet display awake
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (e) {}
      }
    };
    requestWakeLock();
    const handleVisChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisChange);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

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

  const generateNextOrderId = async () => {
    const today = new Date();
    const datePrefix = `order_${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}_`;
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .like('id', `${datePrefix}%`)
        .order('id', { ascending: false })
        .limit(1);
        
      if (!error && data && data.length > 0) {
        const lastId = data[0].id;
        const lastSequence = parseInt(lastId.split('_').pop() || '0', 10);
        return `${datePrefix}${(lastSequence + 1).toString().padStart(4, '0')}`;
      }
    } catch (e) {
      console.error(e);
    }
    return `${datePrefix}0001`;
  };

  // Save state to localStorage whenever it changes, but only after initial restore
  useEffect(() => {
    if (isStateRestored) {
      if (cart.length > 0) {
        localStorage.setItem('samba_pos_cart', JSON.stringify(cart));
        localStorage.setItem('samba_pos_customer', customerName);
        localStorage.setItem('samba_pos_edit_mode', isEditMode.toString());
        localStorage.setItem('samba_pos_old_items', JSON.stringify(oldCartItems));
        localStorage.setItem('samba_pos_order_number', orderNumber);
        localStorage.setItem('samba_pos_previously_paid', previouslyPaidAmount.toString());
        localStorage.setItem('samba_pos_is_orig_paid', isOriginalOrderPaid.toString());
      } else {
        localStorage.removeItem('samba_pos_cart');
        localStorage.removeItem('samba_pos_customer');
        localStorage.removeItem('samba_pos_edit_mode');
        localStorage.removeItem('samba_pos_old_items');
        localStorage.removeItem('samba_pos_order_number');
        localStorage.removeItem('samba_pos_previously_paid');
        localStorage.removeItem('samba_pos_is_orig_paid');
        localStorage.removeItem('samba_hybrid_session');
      }
    }
  }, [cart, customerName, isEditMode, oldCartItems, orderNumber, previouslyPaidAmount, isOriginalOrderPaid, isStateRestored]);

  // Sync cart when returning to /pos from /pos/quick or when storage/route updates
  useEffect(() => {
    const handleCartSync = (e: any) => {
      if (e.detail?.action === 'cleared') {
        setCart([]);
        setCustomerName('');
        setOldCartItems([]);
        setIsEditMode(false);
        setPreviouslyPaidAmount(0);
        setIsOriginalOrderPaid(false);
        generateNextOrderId().then(setOrderNumber);
        return;
      }
      syncCartFromStorage();
    };

    const syncCartFromStorage = () => {
      try {
        const saved = localStorage.getItem('samba_pos_cart');
        if (saved) {
          const parsed = JSON.parse(saved);
          setCart(Array.isArray(parsed) ? parsed : []);
        } else {
          setCart([]);
        }

        const savedCustomer = localStorage.getItem('samba_pos_customer');
        setCustomerName(savedCustomer || '');

        const savedOrderNum = localStorage.getItem('samba_pos_order_number');
        if (savedOrderNum && saved) {
          setOrderNumber(savedOrderNum);
        } else if (!saved) {
          generateNextOrderId().then(setOrderNumber);
        }

        const savedEdit = localStorage.getItem('samba_pos_edit_mode');
        if (savedEdit === 'true') setIsEditMode(true);
        else if (savedEdit === 'false') setIsEditMode(false);

        const savedOld = localStorage.getItem('samba_pos_old_items');
        if (savedOld) {
          try { setOldCartItems(JSON.parse(savedOld)); } catch(e) {}
        }

        const savedPrevPaid = localStorage.getItem('samba_pos_previously_paid');
        const savedIsPaid = localStorage.getItem('samba_pos_is_orig_paid');
        if (savedPrevPaid !== null && savedPrevPaid !== '') {
          setPreviouslyPaidAmount(Number(savedPrevPaid) || 0);
          setIsOriginalOrderPaid(savedIsPaid === 'true');
        } else if (savedEdit === 'true' && savedOrderNum) {
          supabase.from('transactions').select('*').eq('id', savedOrderNum).maybeSingle().then(({ data: tx }) => {
            if (tx) {
              const isPaid = tx.method !== 'Bayar Nanti' && tx.payment_status !== 'UNPAID';
              setIsOriginalOrderPaid(isPaid);
              const paidAmt = isPaid ? (Number(tx.total) || 0) : 0;
              setPreviouslyPaidAmount(paidAmt);
              try {
                localStorage.setItem('samba_pos_previously_paid', paidAmt.toString());
                localStorage.setItem('samba_pos_is_orig_paid', isPaid.toString());
              } catch (e) {}
            }
          });
        } else {
          setPreviouslyPaidAmount(0);
          setIsOriginalOrderPaid(false);
        }
      } catch (e) {
        setCart([]);
      }
    };

    syncCartFromStorage();

    // Cross-tab broadcast channel
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('samba_pos_cart_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'CART_CLEARED') {
          setCart([]);
          setCustomerName('');
          setOldCartItems([]);
          setIsEditMode(false);
          setPreviouslyPaidAmount(0);
          setIsOriginalOrderPaid(false);
          generateNextOrderId().then(setOrderNumber);
        }
      };
    } catch (e) {}

    window.addEventListener('samba-pos-cart-sync', handleCartSync);
    window.addEventListener('cart-cleared', syncCartFromStorage);
    window.addEventListener('focus', syncCartFromStorage);
    window.addEventListener('storage', syncCartFromStorage);
    return () => {
      if (bc) bc.close();
      window.removeEventListener('samba-pos-cart-sync', handleCartSync);
      window.removeEventListener('cart-cleared', syncCartFromStorage);
      window.removeEventListener('focus', syncCartFromStorage);
      window.removeEventListener('storage', syncCartFromStorage);
    };
  }, [pathname]);


  const updateOrderStatus = async (orderId: string, newStatus: string, overrideMethod?: string) => {
    const order = selectedActiveOrder?.id === orderId ? selectedActiveOrder : (pendingQrOrders.find(o => o.id === orderId) || preparingOrders.find(o => o.id === orderId));
    
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
      // Close modal if the currently open modal's order is completed
      if (selectedActiveOrder?.id === orderId && newStatus === 'completed') {
        setSelectedActiveOrder(null);
      } else if (selectedActiveOrder?.id === orderId) {
        setSelectedActiveOrder((prev: any) => ({ ...prev, status: newStatus, ...(updateData.method ? { method: updateData.method } : {}) }));
      }
    }
  };

  const loadOrderForEdit = (order: any) => {
    setIsEditMode(true);
    setOrderNumber(order.id);
    const cName = order.customer_name || order.customerName || '';
    setCustomerName(cName.startsWith('Pelanggan ') ? '' : cName);
    setPaymentMethod(order.method);

    const isPaid = order.method !== 'Bayar Nanti' && order.payment_status !== 'UNPAID' && order.paymentStatus !== 'UNPAID';
    setIsOriginalOrderPaid(isPaid);

    const items = order.items || [];
    const itemsTotal = items.reduce((sum: number, it: any) => sum + ((Number(it.price) || 0) * (Number(it.quantity) || 1)), 0);
    const origTotal = Number(order.total) || itemsTotal;
    const paidAmt = isPaid ? origTotal : 0;
    setPreviouslyPaidAmount(paidAmt);

    let mappedCart: CartItem[] = [];
    if (items && products) {
      setOldCartItems(items);
      mappedCart = items.map((it: any) => {
        const p = products.find(prod => prod.name === it.product_name);
        return {
          id: p ? p.id : Math.random().toString(),
          product: p || { id: '', name: it.product_name, price: it.price, category_id: '', image_url: '', is_available: true, is_titipan: false, titipan_name: null },
          quantity: it.quantity,
          notes: it.notes || '',
          isExistingPaid: isPaid
        };
      });
      setCart(mappedCart);
    }

    try {
      localStorage.setItem('samba_pos_cart', JSON.stringify(mappedCart));
      localStorage.setItem('samba_pos_customer', cName.startsWith('Pelanggan ') ? '' : cName);
      localStorage.setItem('samba_pos_edit_mode', 'true');
      localStorage.setItem('samba_pos_old_items', JSON.stringify(items));
      localStorage.setItem('samba_pos_order_number', order.id);
      localStorage.setItem('samba_pos_previously_paid', paidAmt.toString());
      localStorage.setItem('samba_pos_is_orig_paid', isPaid.toString());
    } catch (e) {}

    setSelectedActiveOrder(null);
    setIsCartOpen(true);
  };

  const cancelEdit = async () => {
    setIsEditMode(false);
    setCart([]);
    setOldCartItems([]);
    setCustomerName('');
    setPaymentMethod(null);
    setPreviouslyPaidAmount(0);
    setIsOriginalOrderPaid(false);
    localStorage.removeItem('samba_pos_previously_paid');
    localStorage.removeItem('samba_pos_is_orig_paid');
    const newId = await generateNextOrderId();
    setOrderNumber(newId);
  };

  const handleEditOrderFromQueue = (order: any) => {
    loadOrderForEdit(order);
  };

  const handleSelectOrderFromQueue = (order: any) => {
    setSelectedActiveOrder({
      id: order.id,
      customer_name: order.customerName,
      created_at: order.createdAt,
      method: order.method,
      total: order.total,
      status: order.status,
      items: order.items,
    });
  };

  useEffect(() => {
    if (!role) return;

    const fetchActiveOrders = async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

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

    const channelId = `pos_active_orders_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchActiveOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, refreshActiveOrdersTrigger]);

  useEffect(() => {
    if (isLoading) return; // Tunggu AuthContext selesai memuat dan sinkronisasi nama

    async function initPageData() {
      setIsCheckingShift(true);

      // Instant render from cache
      try {
        const cached = localStorage.getItem('samba_products_cache');
        if (cached) { setProducts(JSON.parse(cached)); setIsLoadingData(false); }
        
        const cachedCats = localStorage.getItem('samba_categories_cache');
        if (cachedCats) { setCategories(JSON.parse(cachedCats)); }

        const cachedPending = localStorage.getItem('samba_pending_orders_cache');
        if (cachedPending) setPendingQrOrders(JSON.parse(cachedPending));
        
        const cachedPreparing = localStorage.getItem('samba_preparing_orders_cache');
        if (cachedPreparing) setPreparingOrders(JSON.parse(cachedPreparing));
      } catch(e) {}

      const [categoriesRes, productsRes] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('products').select('*')
      ]);

      if (categoriesRes.data) {
        setCategories(categoriesRes.data);
        try { localStorage.setItem('samba_categories_cache', JSON.stringify(categoriesRes.data)); } catch(e) {}
      }
      if (productsRes.data) {
        const sorted = productsRes.data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setProducts(sorted);
        try { localStorage.setItem('samba_products_cache', JSON.stringify(sorted)); } catch(e) {}
      }

      // Fetch cashier profiles from database (Fase 3e)
      try {
        const { data: dbUsers } = await supabase.from('users').select('name, role');
        if (dbUsers && dbUsers.length > 0) {
          const profiles = dbUsers.map(u => ({
            name: u.name,
            role: (u.role as Role) || 'cashier',
            label: u.role === 'manager' ? 'Manajer' : 'Kasir',
            initial: (u.name || 'K').charAt(0).toUpperCase()
          }));
          setCashierProfiles(profiles);
        }
      } catch (e) {}

      setIsLoadingData(false);

      if (userName) {
        const { data } = await supabase
          .from('shifts')
          .select('*')
          .eq('cashier_name', userName)
          .eq('status', 'active')
          .order('start_time', { ascending: false })
          .limit(1);
          
        if (data && data.length > 0) {
          setActiveShift(data[0]);
        } else {
          setActiveShift(null);
        }
      } else {
        setActiveShift(null);
      }
      setIsCheckingShift(false);

      // Load edit context if present
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('edit');
        if (editId) {
          setIsEditMode(true);
          setOrderNumber(editId);
          const { data: tx } = await supabase.from('transactions').select('*').eq('id', editId).single();
          if (tx) {
            setCustomerName(tx.customer_name || '');
            setPaymentMethod(tx.method);
            const isPaid = tx.method !== 'Bayar Nanti' && tx.payment_status !== 'UNPAID';
            setIsOriginalOrderPaid(isPaid);
            const paidAmt = isPaid ? (Number(tx.total) || 0) : 0;
            setPreviouslyPaidAmount(paidAmt);

            const { data: items } = await supabase.from('transaction_items').select('*').eq('transaction_id', editId);
            if (items && productsRes.data) {
              setOldCartItems(items);
              const mappedCart: CartItem[] = items.map(it => {
                const p = productsRes.data.find(prod => prod.name === it.product_name);
                return {
                  id: p ? p.id : Math.random().toString(),
                  product: p || { id: '', name: it.product_name, price: it.price, category_id: '', image_url: '', is_available: true, is_titipan: false, titipan_name: null },
                  quantity: it.quantity,
                  notes: it.notes || '',
                  isExistingPaid: isPaid
                };
              });
              setCart(mappedCart);
            }
          }
          setIsStateRestored(true);
        } else if (!isStateRestored) {
          try {
            const savedCart = localStorage.getItem('samba_pos_cart');
            if (savedCart) {
              setCart(JSON.parse(savedCart));
            } else {
              setCart([]);
            }
            
            const savedCustomer = localStorage.getItem('samba_pos_customer');
            if (savedCustomer) setCustomerName(savedCustomer);
            
            const savedEditMode = localStorage.getItem('samba_pos_edit_mode');
            const isEdit = savedEditMode === 'true';
            if (isEdit) setIsEditMode(true);
            
            const savedOldItems = localStorage.getItem('samba_pos_old_items');
            if (savedOldItems) setOldCartItems(JSON.parse(savedOldItems));
            
            const savedOrderNum = localStorage.getItem('samba_pos_order_number');
            if (savedOrderNum && savedCart) {
              setOrderNumber(savedOrderNum);
              if (isEdit) {
                const { data: tx } = await supabase.from('transactions').select('*').eq('id', savedOrderNum).maybeSingle();
                if (tx) {
                  const isPaid = tx.method !== 'Bayar Nanti' && tx.payment_status !== 'UNPAID';
                  setIsOriginalOrderPaid(isPaid);
                  const paidAmt = isPaid ? (Number(tx.total) || 0) : 0;
                  setPreviouslyPaidAmount(paidAmt);
                }
              }
            } else {
              generateNextOrderId().then(setOrderNumber);
            }
          } catch (e) {
            console.error('Failed to restore POS state from local storage', e);
            generateNextOrderId().then(setOrderNumber);
          }
          setIsStateRestored(true);
        }
      }
    }

    initPageData();

    const handleRefreshProducts = async () => {
      const productsRes = await supabase.from('products').select('*');
      if (productsRes.data) {
        const data = productsRes.data;
        // Find newly added products or updated products and ensure state is fresh
        setProducts(data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
      }
    };
    
    window.addEventListener('refresh-products', handleRefreshProducts);
    
    // Auto-refresh via Supabase Realtime with Debounce to prevent lag
    let refreshTimeout: NodeJS.Timeout | null = null;
    const debouncedRefresh = () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        handleRefreshProducts();
      }, 500);
    };

    const catalogChannel = supabase
      .channel(`pos_catalog_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, debouncedRefresh)
      .subscribe();

    return () => {
      window.removeEventListener('refresh-products', handleRefreshProducts);
      if (refreshTimeout) clearTimeout(refreshTimeout);
      supabase.removeChannel(catalogChannel);
    };
  }, [userName, isLoading]);

  // Lock action handler
  const handleLockActionClick = () => {
    if (!role || !userName) {
      window.dispatchEvent(new CustomEvent('shake-sidebar-profiles'));
    } else {
      setSelectedProfile({ name: userName, role: role });
      setStartingCashInput('100000');
      setIsStartShiftDialogOpen(true);
    }
  };

  const handleSelectProfile = (profile: { name: string; role: Role }) => {
    setSelectedProfile(profile);
    setIsSelectCashierOpen(false);
    setProfilePasswordInput('');
    setProfilePasswordError('');
    setShowProfilePassword(false);
    setIsPasswordDialogOpen(true);
  };

  const handleVerifyPassword = async () => {
    if (!selectedProfile) return;
    setProfilePasswordError('');

    if (!profilePasswordInput.trim()) {
      setProfilePasswordError('Password tidak boleh kosong.');
      return;
    }

    setIsVerifyingPassword(true);

    try {
      // Query user in database
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .or(`name.ilike."${selectedProfile.name}",username.ilike."${selectedProfile.name}"`)
        .maybeSingle();

      // Fetch manager account from database to ensure exact name sync
      let isCorrect = false;
      let finalRole: Role = selectedProfile.role;
      let finalName: string = selectedProfile.name;

      // TODO (Security): Replace plain text password verification with hashed PINs (e.g. bcrypt / Argon2) and Supabase Auth session
      if (userData && userData.password && userData.password.trim() === profilePasswordInput.trim()) {
        isCorrect = true;
        finalRole = (userData.role as Role) || selectedProfile.role;
        finalName = userData.name || selectedProfile.name;
      }

      setIsVerifyingPassword(false);

      if (isCorrect) {
        setSelectedProfile({ name: finalName, role: finalRole });
        login(finalRole, finalName);
        setIsPasswordDialogOpen(false);
        setStartingCashInput('100000');
        setIsStartShiftDialogOpen(true);
      } else {
        setProfilePasswordError('Password yang Anda masukkan salah. Silakan coba lagi.');
      }
    } catch (err) {
      setIsVerifyingPassword(false);
      setProfilePasswordError('Gagal memverifikasi password.');
    }
  };

  const handleStartShift = async (cashAmount?: number) => {
    const targetName = selectedProfile?.name || userName;
    const targetRole = selectedProfile?.role || role || 'cashier';
    if (!targetName) return;
    
    let cash = 0;
    if (cashAmount !== undefined) {
      cash = cashAmount;
    } else {
      cash = parseInt(startingCashInput.replace(/\./g, ''));
      if (isNaN(cash)) cash = 0;
    }

    // Auto-close any previous unclosed active shifts for this cashier
    await supabase
      .from('shifts')
      .update({ status: 'closed', end_time: new Date().toISOString() })
      .eq('cashier_name', targetName)
      .eq('status', 'active');

    const newShift = {
      cashier_name: targetName,
      starting_cash: cash,
      status: 'active'
    };

    const { data, error } = await supabase.from('shifts').insert([newShift]).select().single();
    if (!error && data) {
      login(targetRole, targetName);
      setActiveShift(data);
      setIsStartShiftDialogOpen(false);
      setStartingCashInput('');
      setActiveCategory('favorit');
      try {
        sessionStorage.setItem('samba_pos_last_category', 'favorit');
      } catch (e) {}
      refreshFavorites();
    } else {
      alert("Failed to start shift: " + error?.message);
    }
  };

  const getStockString = (product: Product) => {
    return product.is_available ? 'Tersedia' : 'Habis';
  };

  const isStockEmpty = (product: Product) => {
    return !product.is_available;
  };

  const handleCheckoutClick = () => {
    if (cart.length === 0) {
      alert('Keranjang masih kosong!');
      return;
    }
    setCheckoutStep('method');
  };

  const handleCalculateEndShift = async () => {
    if (!activeShift) {
      logout();
      return;
    }
    
    // Calculate total cash transactions during this shift
    const { data: txData } = await supabase
      .from('transactions')
      .select('total')
      .eq('cashier_name', userName)
      .eq('method', 'Cash')
      .gte('created_at', activeShift.start_time);
      
    let cashSales = 0;
    if (txData) {
      cashSales = txData.reduce((sum, tx) => sum + tx.total, 0);
    }
    
    setExpectedCash(activeShift.starting_cash + cashSales);
    setIsEndShiftDialogOpen(true);
  };

  const handleEndShift = async () => {
    if (!activeShift || !endingCashInput) return;
    
    const inputRevenue = parseInt(endingCashInput.replace(/\./g, ''));
    if (isNaN(inputRevenue)) return;

    // Total uang di laci (Modal + Hasil)
    const endCash = inputRevenue + activeShift.starting_cash;
    const expectedRevenue = expectedCash - activeShift.starting_cash;

    const { error } = await supabase
      .from('shifts')
      .update({
        end_time: new Date().toISOString(),
        ending_cash: endCash,
        expected_cash: expectedCash,
        status: 'closed'
      })
      .eq('id', activeShift.id);

    if (!error) {
      setShiftSummary({
        starting: activeShift.starting_cash,
        expectedRevenue: expectedRevenue,
        actualRevenue: inputRevenue,
        difference: inputRevenue - expectedRevenue
      });
      setIsEndShiftDialogOpen(false);
      setActiveShift(null);
      setEndingCashInput('');
      setIsShiftSummaryOpen(true);
    } else {
      alert("Failed to end shift: " + error.message);
    }
  };

  const isPageLoading = isLoading || isCheckingShift;
  const isLocked = !isPageLoading && (!role || !activeShift);

  const railTabs = useMemo<CategoryRailTab[]>(() => {
    const tabs: CategoryRailTab[] = [];

    const matchesFilter = (p: Product) => {
      if (menuTypeFilter === 'quick') return Boolean(p.is_quick);
      if (menuTypeFilter === 'cooked') return !p.is_quick;
      return true;
    };

    // 1. Tab Semua Menu (All Menu)
    const totalMatching = products.filter(matchesFilter).length;
    tabs.push({
      id: 'all',
      label: 'Semua Menu',
      count: totalMatching,
    });

    // 2. Tab Favorit
    const favoriteCount = products.filter(p => favoriteIds.includes(p.id) && matchesFilter(p)).length;
    if (favoriteIds.length > 0) {
      tabs.push({
        id: 'favorit',
        label: 'Favorit',
        count: favoriteCount,
      });
    }

    // Urutan kategori terstruktur: makanan terlebih dahulu, kemudian minuman, camilan & dessert
    const preferredOrder = [
      'cat_food',      // Food
      'cat_snack',     // Snack
      'yea8kgefo',     // Pop mie
      '5v2cqlisz',     // Roti
      '897p3xwtf',     // Ciki snack
      'dj8dix8v4',     // coffee
      '8fe2l22ge',     // Es teh & other
      'cat_minuman',   // Minuman
      'cat_dessert',   // Dessert
    ];

    const sortedCategories = [...categories].sort((a, b) => {
      const idxA = preferredOrder.indexOf(a.id);
      const idxB = preferredOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    // 3. Kategori dari database dengan hitungan produk
    sortedCategories.forEach(cat => {
      if (cat.id === '1' || cat.id === 'all' || cat.id === 'favorit') return;
      const count = products.filter(p => p.category_id === cat.id && matchesFilter(p)).length;
      const trimmed = cat.name.trim();
      const formattedLabel = trimmed.toLowerCase() === 'coffee' ? 'Coffee' : trimmed;
      tabs.push({
        id: cat.id,
        label: formattedLabel,
        count: count,
      });
    });

    return tabs;
  }, [categories, products, favoriteIds, menuTypeFilter]);

  const filteredProducts = useMemo(() => {
    const result = products.filter(p => {
      // 1. Search Query: jika search aktif, cari di semua menu dan abaikan kategori
      if (searchQuery.trim() !== '') {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
        let matchesType = true;
        if (menuTypeFilter === 'quick') matchesType = Boolean(p.is_quick);
        else if (menuTypeFilter === 'cooked') matchesType = !p.is_quick;
        return matchesSearch && matchesType;
      }

      // 2. Filter Tipe Menu (Semua | Siap Ambil | Dimasak)
      let matchesType = true;
      if (menuTypeFilter === 'quick') matchesType = Boolean(p.is_quick);
      else if (menuTypeFilter === 'cooked') matchesType = !p.is_quick;
      if (!matchesType) return false;

      // 3. Filter Kategori Rail
      if (activeCategory === 'all' || activeCategory === '1') {
        return true;
      }
      if (activeCategory === 'favorit') {
        return favoriteIds.includes(p.id);
      }

      return p.category_id === activeCategory;
    });

    // Urutkan favorit berdasarkan rank penjualan (30 hari terakhir) jika tab favorit aktif
    if (activeCategory === 'favorit' && searchQuery.trim() === '') {
      result.sort((a, b) => favoriteIds.indexOf(a.id) - favoriteIds.indexOf(b.id));
    }

    return result;
  }, [products, searchQuery, menuTypeFilter, activeCategory, favoriteIds]);

  const handleSelectCategory = (tabId: string) => {
    // Fleksibel: jika tab yang diklik sudah aktif (selain 'all'), klik lagi akan toggle kembali ke 'all'
    const targetId = activeCategory === tabId && tabId !== 'all' ? 'all' : tabId;

    // Jika kategori yang dipilih belum punya produk pada filter tipe menu saat ini,
    // otomatis ubah filter tipe menu ke 'all' agar kasir tidak terkunci di tampilan kosong
    if (targetId !== 'all' && targetId !== 'favorit') {
      const hasUnderCurrentFilter = products.some(p => {
        if (p.category_id !== targetId) return false;
        if (menuTypeFilter === 'quick') return Boolean(p.is_quick);
        if (menuTypeFilter === 'cooked') return !p.is_quick;
        return true;
      });
      if (!hasUnderCurrentFilter) {
        setMenuTypeFilter('all');
      }
    }

    setActiveCategory(targetId);
    try {
      sessionStorage.setItem('samba_pos_last_category', targetId);
    } catch (e) {}
    gridContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleSelectMenuType = (type: 'all' | 'quick' | 'cooked') => {
    setMenuTypeFilter(type);
    gridContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleResetFilter = () => {
    setMenuTypeFilter('all');
    setSearchQuery('');
    setActiveCategory('all');
    try {
      sessionStorage.setItem('samba_pos_last_category', 'all');
    } catch (e) {}
    gridContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleRepeatLastOrder = async () => {
    try {
      const { data: lastTx, error: txError } = await supabase
        .from('transactions')
        .select('id, customer_name')
        .order('created_at', { ascending: false })
        .limit(1);

      if (txError || !lastTx || lastTx.length === 0) {
        alert("Belum ada riwayat pesanan sebelumnya.");
        return;
      }

      const { data: items, error: itemsError } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('transaction_id', lastTx[0].id);

      if (itemsError || !items || items.length === 0) {
        alert("Pesanan sebelumnya tidak memiliki item.");
        return;
      }

      const repeatedCart: CartItem[] = items.map((it: any) => {
        const matched = products.find(p => p.name === it.product_name);
        return {
          id: matched ? matched.id : `repeat_${it.id}`,
          product: matched || {
            id: `repeat_${it.id}`,
            category_id: '',
            name: it.product_name,
            price: it.price,
            image_url: '',
            is_available: true,
            is_titipan: false,
            titipan_name: null,
            is_quick: false,
          },
          quantity: it.quantity,
          notes: it.notes || '',
        };
      });

      setCart(repeatedCart);
      if (lastTx[0].customer_name) {
        setCustomerName(lastTx[0].customer_name);
      }
      setToastMessage({
        title: "Pesanan Terakhir Dimuat",
        desc: `${items.length} item berhasil ditambahkan ke keranjang`,
        variant: 'success'
      });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert("Gagal memuat pesanan terakhir: " + (err.message || ''));
    }
  };

  const handleAddFreeItem = (name: string, price: number, isQuick: boolean, notes: string) => {
    const freeProduct: Product = {
      id: `custom_${Date.now()}`,
      category_id: 'custom',
      name: name,
      price: price,
      image_url: '',
      is_available: true,
      is_titipan: false,
      titipan_name: null,
      is_quick: isQuick,
    };
    addToCart(freeProduct, notes, 0, {});
  };

  const handleProductClick = (product: Product) => {
    if (isLocked) {
      handleLockActionClick();
      return;
    }
    if (isStockEmpty(product)) {
      return;
    }

    if (product.variants && product.variants.length > 0) {
      setSelectedProductForOptions(product);
      const initialChoices: Record<string, string[]> = {};
      product.variants.forEach(v => {
        if (v.is_required && v.choices.length > 0) {
          const firstChoice = v.choices[0];
          const stock = firstChoice.stock_id ? stocksData.find(s => s.id === firstChoice.stock_id) : null;
          const displayName = stock ? (stock.name || firstChoice.name) : firstChoice.name;
          initialChoices[v.name] = [displayName];
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
      return [...prev, { id: cartItemId, product: productWithAddonPrice, quantity: 1, notes, variantChoices, isExistingPaid: false }];
    });
    setIsCartOpen(true);
    setIsOptionsModalOpen(false);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const target = prev.find(item => item.id === id);
      if (target && target.quantity + delta <= 0) {
        setLastRemovedItem(target);
        setToastMessage({
          title: `Item Dihapus`,
          desc: `${target.product.name} dihapus. Klik untuk batalkan (Urungkan).`,
          variant: 'alert'
        });
        setTimeout(() => setToastMessage(null), 5000);
      }
      return prev.map(item => {
        if (item.id === id) {
          const newQuantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const openNoteDialog = (item: CartItem) => {
    setActiveNoteItem(item.id);
    setTempNote(item.notes || '');
    setIsNoteDialogOpen(true);
  };

  const saveNote = () => {
    if (activeNoteItem) {
      setCart(prev => prev.map(item => 
        item.id === activeNoteItem 
          ? { ...item, notes: tempNote } 
          : item
      ));
    }
    setIsNoteDialogOpen(false);
  };

  const handleCheckoutProcess = async () => {
    await finalizeTransaction();
  };

  const handleQRISPaymentSuccess = async () => {
    setIsQRISModalOpen(false);
    await finalizeTransaction();
  };

  const finalizeTransaction = async (methodOverride?: 'QRIS' | 'Cash' | 'Bayar Nanti' | null, isBackground: boolean = true, cashOverride?: number) => {
    const actualMethod = methodOverride !== undefined ? methodOverride : paymentMethod;
    const finalCashReceived = cashOverride !== undefined ? cashOverride : (cashReceived ? parseInt(cashReceived.replace(/\./g, '')) : null);
    
    // Tagihan yang harus dibayar saat ini (jika order sebelumnya sudah lunas, hanya hitung menu tambahan baru)
    const effectiveAmountDue = (isEditMode && previouslyPaidAmount > 0)
      ? Math.max(0, total - previouslyPaidAmount)
      : total;

    const changeAmount = (actualMethod === 'Cash' && finalCashReceived)
      ? Math.max(0, finalCashReceived - effectiveAmountDue)
      : 0;
    
    setIsProcessingCheckout(true);
    
    let transactionId = orderNumber;
    if (!isEditMode) {
      transactionId = await generateNextOrderId();
      setOrderNumber(transactionId);
    }

    let totalCashReceived: number | null = null;
    if (actualMethod === 'Cash') {
      if (isEditMode && previouslyPaidAmount > 0) {
        totalCashReceived = previouslyPaidAmount + (finalCashReceived || effectiveAmountDue);
      } else {
        totalCashReceived = finalCashReceived;
      }
    }

    const transaction = {
      id: transactionId,
      method: actualMethod,
      total: total,
      cashier_name: userName || 'Unknown',
      status: isEditMode ? 'preparing' : ((actualMethod === 'Bayar Nanti') ? 'preparing' : (isAllQuickFood ? 'completed' : 'preparing')),
      cash_received: totalCashReceived,
      customer_name: customerName || null,
      payment_status: actualMethod === 'QRIS' ? 'PENDING_VERIFICATION' : (actualMethod === 'Bayar Nanti' ? 'UNPAID' : 'PAID')
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
      if (navigator.onLine) {
        const rpcPromise = supabase.rpc('process_checkout_v2', {
          p_is_edit: isEditMode,
          p_transaction: transaction,
          p_transaction_items: itemsToInsert,
          p_titipan_deductions: [],
          p_stock_deductions: []
        });

        const { data, error } = await Promise.race([
          rpcPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout: Jaringan lambat")), 8000))
        ]) as any;

        if (error) throw error;
      } else {
        if (isEditMode) {
          throw new Error("⚠️ Tidak bisa mengedit pesanan dalam Offline Mode. Harap tunggu koneksi kembali.");
        }
        throw new Error("Offline Mode");
      }
    } catch (error: any) {
      console.warn("Checkout Failed:", error);
      setIsProcessingCheckout(false);
      
      const errMsg = error.message || '';

      if (errMsg.includes('Offline') || errMsg.includes('Failed to fetch') || errMsg.includes('Timeout')) {
        const offlineQueue = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
        offlineQueue.push({ transaction, itemsToInsert });
        localStorage.setItem('offline_transactions', JSON.stringify(offlineQueue));
        alert("⚠️ Mode Offline / Gangguan Jaringan: Transaksi disimpan secara lokal dan akan disinkronisasi ketika koneksi kembali.");
      } else {
        alert("⚠️ Terjadi kesalahan sistem: " + errMsg);
        return;
      }
    }

    setCheckoutStep('none');
    setIsQRISModalOpen(false);
    setIsProcessingCheckout(false);
    
    if (changeAmount > 0) {
      setToastMessage({
        title: `Kembalian: Rp ${changeAmount.toLocaleString('id-ID')}`,
        desc: `Order #${orderNumber} lunas. Berikan kembalian!`,
        variant: 'alert'
      });
      setTimeout(() => setToastMessage(null), 8000);
    } else {
      setToastMessage({
        title: isEditMode && previouslyPaidAmount > 0 ? 'Menu Tambahan Berhasil Ditambahkan! ✅' : 'Pembayaran Berhasil! ✅',
        desc: `Order #${orderNumber} (${actualMethod}) telah dicatat.`,
        variant: 'success'
      });
      setTimeout(() => setToastMessage(null), 3000);
    }
    
    completeAndNewOrder();
  };

  const completeAndNewOrder = async () => {
    setCart([]);
    setIsPaymentSheetOpen(false);
    setCheckoutStep('none');
    setPaymentMethod(null);
    setCashReceived('');
    setCustomerName('');
    setIsEditMode(false);
    setOldCartItems([]);
    setPreviouslyPaidAmount(0);
    setIsOriginalOrderPaid(false);
    setIsMobileCartSheetOpen(false);

    try {
      localStorage.removeItem('samba_pos_cart');
      localStorage.removeItem('samba_pos_customer');
      localStorage.removeItem('samba_pos_edit_mode');
      localStorage.removeItem('samba_pos_old_items');
      localStorage.removeItem('samba_pos_order_number');
      localStorage.removeItem('samba_pos_previously_paid');
      localStorage.removeItem('samba_pos_is_orig_paid');
      localStorage.removeItem('samba_hybrid_session');
      localStorage.setItem('samba_cart_cleared_at', Date.now().toString());

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
    } catch (e) {}

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('edit')) {
        url.searchParams.delete('edit');
        window.history.replaceState({}, '', url.toString());
      }
    }

    setRefreshActiveOrdersTrigger(prev => prev + 1);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('samba-refresh-active-orders'));
    }

    const newId = await generateNextOrderId();
    setOrderNumber(newId);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const total = subtotal;
  const amountDue = (isEditMode && previouslyPaidAmount > 0)
    ? Math.max(0, total - previouslyPaidAmount)
    : total;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const isAllQuickFood = cart.length > 0 && cart.every(item => item.product.is_quick === true);

  const getQuickCashSuggestions = (totalAmount: number) => {
    console.log("Computing quick cash suggestions for:", totalAmount);
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

  const handleGoToHybridQuick = () => {
    if (cart.length > 0) {
      localStorage.setItem('samba_hybrid_session', JSON.stringify({
        orderNumber,
        cart,
        customerName,
        isEditMode,
        oldCartItems
      }));
      router.push('/pos/quick?hybrid=1');
    } else {
      router.push('/pos/quick');
    }
  };

  const renderCartContent = () => (
    <CartPanel
      orderNumber={orderNumber}
      isPageLoading={isPageLoading}
      userName={userName}
      role={role}
      isLocked={isLocked}
      cart={cart}
      subtotal={subtotal}
      total={total}
      amountDue={amountDue}
      previouslyPaidAmount={previouslyPaidAmount}
      isOriginalOrderPaid={isOriginalOrderPaid}
      cartEndRef={cartEndRef}
      customerName={customerName}
      setCustomerName={setCustomerName}
      paymentMethod={paymentMethod}
      setPaymentMethod={setPaymentMethod}
      cashReceived={cashReceived}
      setCashReceived={setCashReceived}
      openNoteDialog={openNoteDialog}
      updateQuantity={updateQuantity}
      handleGoToHybridQuick={handleGoToHybridQuick}
      handleLockActionClick={handleLockActionClick}
      finalizeTransaction={finalizeTransaction}
      getQuickCashSuggestions={getQuickCashSuggestions}
      setIsHutangNameDialogOpen={setIsHutangNameDialogOpen}
      onOpenPaymentSheet={() => {
        setIsMobileCartSheetOpen(false);
        setIsPaymentSheetOpen(true);
      }}
      onDirectSave={() => finalizeTransaction(paymentMethod || 'Cash')}
      isEditMode={isEditMode}
      onCancelEdit={cancelEdit}
    />
  );



  return (
    <MainLayout 
      onLogoutClick={handleCalculateEndShift} 
      onLoginClick={() => window.dispatchEvent(new CustomEvent('shake-sidebar-profiles'))}
      title="Point of Sale"
      headerAction={
        <Sheet>
          <SheetTrigger className="md:hidden relative p-2 h-10 w-10 flex items-center justify-center bg-background border border-border rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ShoppingCart size={18} />
            {cartItemCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-background">
                {cartItemCount}
              </div>
            )}
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] max-h-[85vh] p-0 bg-card border-t border-border rounded-t-2xl flex flex-col z-[100] overflow-hidden">
            <SheetHeader className="p-4 border-b border-border sr-only">
              <SheetTitle>Current Order</SheetTitle>
            </SheetHeader>
            {renderCartContent()}
          </SheetContent>
        </Sheet>
      }
    >
      <div className="flex h-full w-full">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/50 h-full overflow-hidden">
          <header className="px-4 md:px-6 py-3 sticky top-0 z-30 bg-[#0b0a08]/90 backdrop-blur-xl border-b border-white/10 shrink-0">
            <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-3 w-full">
              {/* Left group: Search Pill & Segmented Filter */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {/* Search Pill Button */}
                {isSearchOpen ? (
                  <div className="relative flex items-center min-w-[180px] max-w-xs flex-1 animate-in fade-in zoom-in-95 duration-150">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={16} />
                    <Input
                      autoFocus
                      className="pl-9 pr-8 h-10 bg-zinc-900 border-amber-500/40 text-xs text-zinc-100 focus-visible:ring-1 focus-visible:ring-amber-500 rounded-xl"
                      placeholder="Ketik nama menu..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setIsSearchOpen(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-100 p-0.5 rounded-md"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(true)}
                    className="flex items-center gap-2 h-10 px-3.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 hover:border-amber-500/30 text-xs text-zinc-400 hover:text-zinc-200 transition-all active:scale-95 shadow-sm shrink-0"
                  >
                    <Search size={15} className="text-zinc-400" />
                    <span>{searchQuery ? `"${searchQuery}"` : "Cari menu..."}</span>
                  </button>
                )}

                {/* Calculator Button (Fase 4a) */}
                <button
                  type="button"
                  onClick={() => setIsCalculatorOpen(true)}
                  className="h-10 w-10 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 border border-white/10 hover:border-amber-500/30 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0"
                  title="Kalkulator Kasir"
                >
                  <Calculator size={16} />
                </button>

                {/* Segmented Filter Pills: Semua / Siap Ambil / Dimasak */}
                <div className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-white/10 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectMenuType('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      menuTypeFilter === 'all'
                        ? 'bg-amber-500 text-zinc-950 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectMenuType('quick')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      menuTypeFilter === 'quick'
                        ? 'bg-amber-500 text-zinc-950 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <ShoppingBag size={12} />
                    <span>Siap Ambil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectMenuType('cooked')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      menuTypeFilter === 'cooked'
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Flame size={12} />
                    <span>Dimasak</span>
                  </button>
                </div>
              </div>

              {/* Kitchen Queue Counter Badge (Direct Link to /orders) */}
              {kitchenOrders.length > 0 && (
                <Link
                  href="/orders"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/25 active:scale-95 text-amber-400 font-mono text-xs font-bold shrink-0 transition-all cursor-pointer"
                  title={`Buka halaman Pesanan (${kitchenOrders.length} antrean aktif)`}
                >
                  <Flame size={13} className="fill-amber-400 text-amber-400 animate-pulse" />
                  <span>{kitchenOrders.length} Dapur</span>
                </Link>
              )}
            </div>
          </header>

          {/* Antrean Dapur Strip (Horizontal Queue Cards) */}
          <KitchenQueueStrip
            orders={kitchenOrders}
            products={products}
            onAdvance={advanceOrder}
            onEditOrder={handleEditOrderFromQueue}
            onSelectOrder={handleSelectOrderFromQueue}
            isCollapsed={isKitchenStripCollapsed}
            onToggleCollapse={() => setIsKitchenStripCollapsed(prev => !prev)}
          />

          {pendingQrOrders.length > 0 && (
            <div className="px-4 md:px-6 pt-4 pb-2 w-full max-w-[100vw] overflow-hidden shrink-0">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 shadow-lg shadow-amber-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center animate-pulse shrink-0">
                    <QrCode size={20} />
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
            </div>
          )}

          <ActiveOrderModals
            selectedActiveOrder={selectedActiveOrder}
            setSelectedActiveOrder={setSelectedActiveOrder}
            loadOrderForEdit={loadOrderForEdit}
            products={products}
            checkedItems={checkedItems}
            toggleCheckItem={toggleCheckItem}
            paymentModalOrder={paymentModalOrder}
            setPaymentModalOrder={setPaymentModalOrder}
            confirmCompleteOrder={confirmCompleteOrder}
            setConfirmCompleteOrder={setConfirmCompleteOrder}
            updateOrderStatus={updateOrderStatus}
          />

          {/* Rail + Grid Layout */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <CategoryRail
              activeTab={searchQuery.trim() !== '' ? null : activeCategory}
              onSelectTab={handleSelectCategory}
              tabs={railTabs}
              isLoading={isLoadingData || (isPageLoading && products.length === 0)}
            />

            <div ref={gridContainerRef} className="flex-1 overflow-y-auto min-w-0">
              {isLocked ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[480px]">
                  <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-5 shadow-2xl shadow-amber-500/10 animate-in zoom-in-95">
                    <LockKeyhole size={36} />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-zinc-100 font-serif tracking-tight">
                    Sistem Kasir Terkunci
                  </h2>
                  <p className="text-zinc-400 text-sm max-w-sm mt-2 leading-relaxed">
                    {role
                      ? `Shift aktif belum dibuka untuk ${userName}. Buka shift dan masukkan modal awal untuk mulai transaksi.`
                      : 'Silakan masuk dengan profil kasir Anda untuk membuka shift dan mulai menginput pesanan.'}
                  </p>
                  <Button
                    onClick={handleLockActionClick}
                    className="mt-6 h-13 px-8 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-base shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                  >
                    <LockKeyhole size={18} className="mr-2" />
                    {role ? 'Buka Shift Kasir' : 'Pilih Profil & Buka Shift'}
                  </Button>
                </div>
              ) : (
                <ProductGrid
                  products={filteredProducts}
                  categories={categories}
                  cart={cart}
                  isLocked={isLocked}
                  onProductClick={handleProductClick}
                  getStockString={getStockString}
                  isStockEmpty={isStockEmpty}
                  onRepeatLastOrder={handleRepeatLastOrder}
                  onOpenFreeItem={() => setIsFreeItemModalOpen(true)}
                  onResetFilter={handleResetFilter}
                  isLoading={isLoadingData || (isPageLoading && products.length === 0)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Permanent Desktop/Tablet Landscape Cart */}
        <div className="hidden lg:flex w-[360px] xl:w-[380px] border-l border-white/10 bg-zinc-950 flex-col h-full shrink-0 min-h-0 overflow-hidden">
          {renderCartContent()}
        </div>
      </div>
        
        <PaymentSheet
          isOpen={isPaymentSheetOpen}
          onOpenChange={setIsPaymentSheetOpen}
          total={amountDue}
          totalOrderAmount={total}
          previouslyPaidAmount={isEditMode ? previouslyPaidAmount : 0}
          orderNumber={orderNumber}
          customerName={customerName}
          setCustomerName={setCustomerName}
          finalizeTransaction={finalizeTransaction}
          isProcessingCheckout={isProcessingCheckout}
        />

      {/* Mobile Floating Cart Bar */}
      <div className={`lg:hidden fixed bottom-[80px] left-4 right-4 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300 ${cartItemCount > 0 ? 'block' : 'hidden'}`}>
        <Sheet open={isMobileCartSheetOpen} onOpenChange={setIsMobileCartSheetOpen}>
            <SheetTrigger className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl p-4 flex items-center justify-between shadow-[0_10px_40px_-10px_rgba(234,179,8,0.5)] border border-primary/20 transition-transform active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="bg-primary-foreground/20 px-3 py-1.5 rounded-xl font-bold text-sm">
                  {cartItemCount} Item
                </div>
                <span className="font-bold text-sm">Pesanan Saya</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-bold text-lg">
                  Rp {(isEditMode && previouslyPaidAmount > 0 ? amountDue : total).toLocaleString('id-ID')}
                </div>
                <ShoppingCart size={20} />
              </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] max-h-[85vh] p-0 bg-card border-t border-border rounded-t-3xl flex flex-col z-[100] outline-none overflow-hidden">
              <SheetHeader className="p-0 border-b border-border sr-only">
                <SheetTitle>Pesanan Aktif</SheetTitle>
              </SheetHeader>
              <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-3 shrink-0" />
              {renderCartContent()}
            </SheetContent>
        </Sheet>
      </div>

      {/* Free Item Modal */}
      <FreeItemModal
        isOpen={isFreeItemModalOpen}
        onOpenChange={setIsFreeItemModalOpen}
        onAddFreeItem={handleAddFreeItem}
      />

      {/* Product Options Modal */}
      <VariantModal
        isOpen={isOptionsModalOpen}
        onOpenChange={setIsOptionsModalOpen}
        product={selectedProductForOptions}
        stocksData={stocksData}
        selectedVariantChoices={selectedVariantChoices}
        setSelectedVariantChoices={setSelectedVariantChoices}
        onAddToCart={addToCart}
      />

      {/* Add Note Dialog */}
      <NoteModal
        isOpen={isNoteDialogOpen}
        onOpenChange={setIsNoteDialogOpen}
        tempNote={tempNote}
        setTempNote={setTempNote}
        onSaveNote={saveNote}
      />

      <ShiftFlow
        cashierProfiles={cashierProfiles}
        isSelectCashierOpen={isSelectCashierOpen}
        setIsSelectCashierOpen={setIsSelectCashierOpen}
        handleSelectProfile={handleSelectProfile}
        isPasswordDialogOpen={isPasswordDialogOpen}
        setIsPasswordDialogOpen={setIsPasswordDialogOpen}
        selectedProfile={selectedProfile}
        profilePasswordError={profilePasswordError}
        showProfilePassword={showProfilePassword}
        setShowProfilePassword={setShowProfilePassword}
        profilePasswordInput={profilePasswordInput}
        setProfilePasswordInput={setProfilePasswordInput}
        handleVerifyPassword={handleVerifyPassword}
        isVerifyingPassword={isVerifyingPassword}
        isStartShiftDialogOpen={isStartShiftDialogOpen}
        setIsStartShiftDialogOpen={setIsStartShiftDialogOpen}
        userName={userName}
        startingCashInput={startingCashInput}
        setStartingCashInput={setStartingCashInput}
        handleStartShift={handleStartShift}
        isEndShiftDialogOpen={isEndShiftDialogOpen}
        setIsEndShiftDialogOpen={setIsEndShiftDialogOpen}
        activeShift={activeShift}
        expectedCash={expectedCash}
        endingCashInput={endingCashInput}
        setEndingCashInput={setEndingCashInput}
        handleEndShift={handleEndShift}
        isShiftSummaryOpen={isShiftSummaryOpen}
        setIsShiftSummaryOpen={setIsShiftSummaryOpen}
        shiftSummary={shiftSummary}
        logout={logout}
      />

      {/* Calculator Panel (Fase 4) */}
      <CalculatorPanel
        isOpen={isCalculatorOpen}
        onOpenChange={setIsCalculatorOpen}
        onUseAsFreeItem={amt => {
          handleAddFreeItem('Item Tambahan', amt, true, '');
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[300] animate-in slide-in-from-top-10 fade-in duration-300">
          <div 
            className={`${toastMessage.variant === 'alert' ? 'bg-primary border-primary shadow-[0_10px_40px_rgba(234,179,8,0.4)] text-primary-foreground' : 'bg-emerald-500 border-emerald-400 shadow-[0_10px_40px_rgba(16,185,129,0.3)] text-zinc-950'} px-4 py-3 sm:px-6 sm:py-4 rounded-2xl border flex items-center gap-3 sm:gap-4 cursor-pointer w-full sm:w-auto sm:min-w-[320px]`} 
            onClick={() => {
              if (lastRemovedItem && toastMessage.title.includes('Dihapus')) {
                setCart(prev => [...prev, lastRemovedItem]);
                setLastRemovedItem(null);
                setToastMessage({
                  title: 'Dibatalkan',
                  desc: 'Item dikembalikan ke keranjang.',
                  variant: 'success'
                });
                setTimeout(() => setToastMessage(null), 2000);
              } else {
                setToastMessage(null);
              }
            }}
          >
            <div className={`${toastMessage.variant === 'alert' ? 'bg-primary-foreground/10' : 'bg-zinc-950/10'} p-2 rounded-full shrink-0`}>
              <CheckCircle2 size={24} className={toastMessage.variant === 'alert' ? 'text-primary-foreground' : 'text-zinc-950'} />
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-base sm:text-lg leading-tight truncate">{toastMessage.title}</h4>
              <p className="text-xs sm:text-sm font-medium opacity-90 truncate">{toastMessage.desc}</p>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
