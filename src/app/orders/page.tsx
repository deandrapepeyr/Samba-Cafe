'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Printer, 
  X, 
  CheckCircle2, 
  CreditCard,
  Banknote,
  Eye,
  FileEdit,
  RotateCcw,
  Sparkles,
  Search,
  Plus
} from 'lucide-react';
import './orders.css';

interface OrderItem {
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

interface Order {
  id: string;
  date: string;
  rawDate: string;
  createdAt: Date;
  completedAt?: Date;
  method: string;
  total: number;
  cashier_name: string;
  customer_name: string;
  order_source?: string;
  payment_status?: string;
  payment_proof_url?: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  items: OrderItem[];
  paid: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

export default function OrdersPage() {
  const { role, isLoading, userName } = useAuth();
  const router = useRouter();

  // Navigation & filter tab: 'queue' | 'unpaid' | 'history'
  const [activeTab, setActiveTab] = useState<'queue' | 'unpaid' | 'history'>('queue');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  // Data state
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuProducts, setMenuProducts] = useState<ProductOption[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [now, setNow] = useState(new Date());

  // Modals state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [draftCustomerName, setDraftCustomerName] = useState('');
  const [draftItems, setDraftItems] = useState<OrderItem[]>([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  // Payment modal state
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  
  // Proof viewer modal state
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastUndoAction, setToastUndoAction] = useState<(() => void) | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // References for optimistic updates & audio
  const prevActiveCountRef = useRef<number>(0);
  const localUpdatesRef = useRef<Record<string, number>>({});
  const lastDeletedOrderRef = useRef<Order | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !role) {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  // Audio Notifications
  const playNewOrderSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log('Audio playback error', e);
    }
  };

  const playSuccessSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
  };

  // Toast helper
  const showToast = (message: string, undoAction: (() => void) | null = null, duration: number = 3000) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    setToastUndoAction(() => undoAction);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      setToastUndoAction(null);
    }, undoAction ? 6500 : duration);
  };

  // Dynamic timer updater every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Fetch products for "Tambah menu" dropdown
  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, is_available')
        .eq('is_available', true)
        .order('name', { ascending: true });
      if (data) {
        setMenuProducts(data.map(p => ({ id: p.id, name: p.name, price: p.price })));
      }
    }
    loadProducts();
  }, []);

  // Check paid status consistent with POS
  const isTxPaid = (tx: any): boolean => {
    if (tx.method === 'Bayar Nanti') return false;
    if (tx.payment_status === 'UNPAID') return false;
    if (tx.payment_status === 'PENDING_VERIFICATION') return false;
    if (tx.payment_status === 'WAITING_CONFIRMATION') return false;
    if (tx.payment_status === 'PAYMENT_REJECTED') return false;
    if (tx.payment_status === 'AI_INVALID') return false;
    return true;
  };

  // Fetch orders
  const fetchOrders = async (isInitial = false) => {
    if (isInitial) setIsLoadingData(true);
    setIsRefreshing(true);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .or(`created_at.gte.${sevenDaysAgo.toISOString()},status.eq.pending,status.eq.preparing,status.eq.ready,status.eq.Paid,status.eq.paid,status.is.null`)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true });

    if (txData && txData.length > 0) {
      // Hide Customer QR orders that are awaiting payment without proof
      const validTx = txData.filter(tx => {
        if (tx.order_source === 'CUSTOMER_QR' && tx.status === 'pending') {
          if (tx.payment_status === 'AWAITING_PAYMENT' || !tx.payment_proof_url) {
            return false;
          }
        }
        return true;
      });

      const txIds = validTx.map(t => t.id);
      const { data: itemsData } = await supabase
        .from('transaction_items')
        .select('*')
        .in('transaction_id', txIds);

      const parsedOrders: Order[] = validTx.map(tx => {
        const items = itemsData ? itemsData.filter(i => i.transaction_id === tx.id) : [];
        const dateObj = new Date(tx.created_at);

        let normStatus = (tx.status || 'preparing');
        let completedAt: Date | undefined = undefined;

        if (normStatus.startsWith('completed|')) {
          const parts = normStatus.split('|');
          normStatus = 'completed';
          if (parts[1]) completedAt = new Date(parts[1]);
        }
        normStatus = normStatus.toLowerCase();
        if (normStatus === 'paid') normStatus = 'preparing';
        if (normStatus === 'done') normStatus = 'completed';

        const paid = isTxPaid(tx);

        return {
          id: tx.id,
          date: dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          rawDate: tx.created_at,
          createdAt: dateObj,
          completedAt,
          method: tx.method,
          total: tx.total,
          cashier_name: tx.cashier_name,
          customer_name: tx.customer_name?.trim() || (tx.id.startsWith('order_') ? tx.id : `Order #${tx.id.slice(-4)}`),
          status: normStatus as any,
          order_source: tx.order_source || 'POS',
          payment_status: tx.payment_status,
          payment_proof_url: tx.payment_proof_url,
          paid,
          items: items.map(item => ({
            name: item.product_name,
            price: item.price,
            qty: item.quantity,
            notes: item.notes
          }))
        };
      });

      // Sound notification for new active order
      const activeCount = parsedOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
      if (!isInitial && activeCount > prevActiveCountRef.current) {
        playNewOrderSound();
      }
      prevActiveCountRef.current = activeCount;

      // Optimistic update guard against rapid polling overwriting
      setOrders(prev => {
        const currentTime = Date.now();
        const updated = parsedOrders.map(order => {
          const localUpdate = localUpdatesRef.current[order.id];
          if (localUpdate && currentTime - localUpdate < 8000) {
            const existing = prev.find(o => o.id === order.id);
            if (existing) return existing;
          }
          if (localUpdate && currentTime - localUpdate >= 8000) {
            delete localUpdatesRef.current[order.id];
          }
          return order;
        });
        return updated;
      });
    } else {
      setOrders([]);
    }

    setIsLoadingData(false);
    setIsRefreshing(false);
  };

  // Real-time Supabase subscription & polling
  useEffect(() => {
    if (role) {
      fetchOrders(true);

      const channelId = `orders_glass_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions' },
          () => fetchOrders(false)
        )
        .subscribe();

      const pollInterval = setInterval(() => {
        fetchOrders(false);
      }, 4000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    }
  }, [role]);

  // Derived order lists
  const activeOrders = useMemo(() => {
    return orders
      .filter(o => o.status === 'preparing' || o.status === 'pending' || o.status === 'ready')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [orders]);

  const unpaidActiveOrders = useMemo(() => {
    return activeOrders.filter(o => !o.paid);
  }, [activeOrders]);

  const completedOrders = useMemo(() => {
    return orders
      .filter(o => o.status === 'completed')
      .sort((a, b) => {
        const tA = a.completedAt ? a.completedAt.getTime() : a.createdAt.getTime();
        const tB = b.completedAt ? b.completedAt.getTime() : b.createdAt.getTime();
        return tB - tA; // Newest completed first
      });
  }, [orders]);

  // Filtered list depending on selected tab
  const visibleList = useMemo(() => {
    if (activeTab === 'queue') return activeOrders;
    if (activeTab === 'unpaid') return unpaidActiveOrders;
    return [];
  }, [activeTab, activeOrders, unpaidActiveOrders]);

  // Auto-select first order if current selected is invalid or none
  useEffect(() => {
    if (activeTab === 'history') return;
    if (visibleList.length > 0) {
      if (!selectedOrderId || !visibleList.some(o => o.id === selectedOrderId)) {
        setSelectedOrderId(visibleList[0].id);
      }
    } else {
      setSelectedOrderId(null);
    }
  }, [activeTab, visibleList, selectedOrderId]);

  // Selected Order object
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find(o => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Queue number of selected order in active queue
  const selectedQueueIndex = useMemo(() => {
    if (!selectedOrder) return 1;
    const idx = activeOrders.findIndex(o => o.id === selectedOrder.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [activeOrders, selectedOrder]);

  // Formatting helpers
  const formatMins = (createdAt: Date) => Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60000));
  
  const formatWaitText = (m: number, short = false) => {
    if (m < 1) return 'baru saja';
    if (m < 60) return short ? `${m} mnt` : `${m} menit`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return short ? `${h} jam ${rem} mnt` : `${h} jam ${rem} menit`;
  };

  const formatSummary = (order: Order) => {
    return order.items.map(i => `${i.qty}× ${i.name}`).join(', ');
  };

  const getOrderTotalQty = (order: Order) => {
    return order.items.reduce((sum, i) => sum + i.qty, 0);
  };

  const isBigOrder = (order: Order) => {
    return order.items.length >= 4 || getOrderTotalQty(order) >= 8;
  };

  // Complete Order ("Selesai")
  const handleCompleteOrder = async (order: Order) => {
    if (!order.paid) {
      // Need payment first!
      setPaymentModalOrder(order);
      return;
    }

    localUpdatesRef.current[order.id] = Date.now();
    const completedTimestamp = new Date();

    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === order.id ? {
      ...o,
      status: 'completed',
      completedAt: completedTimestamp
    } : o));

    // Next order to select
    const currIdx = visibleList.findIndex(o => o.id === order.id);
    const nextOrder = visibleList[currIdx + 1] || visibleList[currIdx - 1];
    setSelectedOrderId(nextOrder ? nextOrder.id : null);

    playSuccessSound();
    showToast('Selesai. Pesanan pindah ke Riwayat');

    const { error } = await supabase
      .from('transactions')
      .update({ status: `completed|${completedTimestamp.toISOString()}` })
      .eq('id', order.id);

    if (error) {
      console.error('Failed to complete order:', error);
      fetchOrders(false);
    }
  };

  // Open Payment Modal
  const handleOpenPayment = (order: Order) => {
    setPaymentModalOrder(order);
  };

  // Confirm payment in modal
  const handleConfirmPayment = async (order: Order, method: 'Cash' | 'QRIS') => {
    localUpdatesRef.current[order.id] = Date.now();
    setPaymentModalOrder(null);

    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === order.id ? {
      ...o,
      paid: true,
      method,
      payment_status: 'PAID'
    } : o));

    showToast(`Pembayaran Rp ${order.total.toLocaleString('id-ID')} diterima`);

    const { error } = await supabase
      .from('transactions')
      .update({
        method,
        payment_status: 'PAID',
        payment_confirmed_at: new Date().toISOString(),
        payment_confirmed_by: userName || 'Kasir'
      })
      .eq('id', order.id);

    if (error) {
      console.error('Failed to update payment status:', error);
      fetchOrders(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (order: Order) => {
    setEditingOrder(order);
    setDraftCustomerName(order.customer_name);
    setDraftItems(order.items.map(i => ({ ...i })));
  };

  // Adjust draft quantity
  const handleAdjustDraftQty = (idx: number, delta: number) => {
    setDraftItems(prev => {
      const next = [...prev];
      next[idx].qty += delta;
      if (next[idx].qty < 1) {
        next.splice(idx, 1);
      }
      return next;
    });
  };

  // Open and edit this order directly in the full POS interface
  const handleAddMenuInPos = (order: Order, customItems?: OrderItem[], customName?: string) => {
    const isPaid = order.paid || (order.method !== 'Bayar Nanti' && order.payment_status !== 'UNPAID');
    const items = customItems || order.items || [];
    const itemsTotal = items.reduce((sum, it) => sum + (it.price * it.qty), 0);
    const origTotal = order.total || itemsTotal;
    const paidAmt = isPaid ? origTotal : 0;
    const customerName = (customName !== undefined ? customName : order.customer_name) || '';

    const mappedCart = items.map(it => {
      const p = menuProducts.find(prod => prod.name.trim().toLowerCase() === it.name.trim().toLowerCase());
      return {
        id: p ? p.id : Math.random().toString(),
        product: {
          id: p ? p.id : '',
          name: it.name,
          price: it.price,
          category_id: '',
          image_url: '',
          is_available: true,
          is_titipan: false,
          titipan_name: null,
        },
        quantity: it.qty,
        notes: it.notes || '',
        isExistingPaid: isPaid,
      };
    });

    const rawOldItems = items.map(it => ({
      product_name: it.name,
      price: it.price,
      quantity: it.qty,
      notes: it.notes || '',
    }));

    try {
      localStorage.setItem('samba_pos_cart', JSON.stringify(mappedCart));
      localStorage.setItem('samba_pos_customer', customerName.startsWith('Pelanggan ') ? '' : customerName);
      localStorage.setItem('samba_pos_edit_mode', 'true');
      localStorage.setItem('samba_pos_old_items', JSON.stringify(rawOldItems));
      localStorage.setItem('samba_pos_order_number', order.id);
      localStorage.setItem('samba_pos_previously_paid', paidAmt.toString());
      localStorage.setItem('samba_pos_is_orig_paid', isPaid.toString());
      
      // Dispatch sync event so /pos updates if already mounted
      window.dispatchEvent(new CustomEvent('samba-pos-cart-sync', { detail: { action: 'loaded' } }));
    } catch (e) {
      console.error('Failed to set localStorage for POS edit:', e);
    }

    setEditingOrder(null);
    router.push('/pos');
  };

  // Save edited order
  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    if (draftItems.length === 0) {
      showToast('Pesanan harus memiliki minimal 1 item');
      return;
    }

    const newTotal = draftItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const newCustomerName = draftCustomerName.trim() || editingOrder.customer_name;

    localUpdatesRef.current[editingOrder.id] = Date.now();

    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === editingOrder.id ? {
      ...o,
      customer_name: newCustomerName,
      items: draftItems,
      total: newTotal
    } : o));

    setEditingOrder(null);
    showToast('Perubahan disimpan');

    try {
      await supabase
        .from('transactions')
        .update({
          customer_name: newCustomerName,
          total: newTotal
        })
        .eq('id', editingOrder.id);

      await supabase
        .from('transaction_items')
        .delete()
        .eq('transaction_id', editingOrder.id);

      await supabase
        .from('transaction_items')
        .insert(
          draftItems.map(item => ({
            transaction_id: editingOrder.id,
            product_name: item.name,
            price: item.price,
            quantity: item.qty,
            notes: item.notes || null
          }))
        );

      fetchOrders(false);
    } catch (e) {
      console.error('Error saving edited order:', e);
      fetchOrders(false);
    }
  };

  // Inventory restore logic on deletion
  const restoreOrderStock = async (order: Order) => {
    const itemNames = order.items.map(i => i.name);
    const { data: products } = await supabase.from('products').select('*').in('name', itemNames);
    if (!products) return;

    for (const item of order.items) {
      const p = products.find(prod => prod.name === item.name);
      if (p && p.is_titipan) {
        const newStock = (p.stock || 0) + item.qty;
        await supabase.from('products').update({ stock: newStock }).eq('id', p.id);
      }
    }

    const productIds = products.map(p => p.id);
    const { data: recipes } = await supabase.from('product_ingredients').select('*').in('product_id', productIds);

    if (recipes && recipes.length > 0) {
      const stockToRestore: Record<string, number> = {};

      for (const item of order.items) {
        const p = products.find(prod => prod.name === item.name);
        if (!p) continue;
        const itemRecipes = recipes.filter(r => r.product_id === p.id);

        for (const recipe of itemRecipes) {
          const isBaseRecipe = !recipe.variant_name;
          let noteMatches = false;
          if (!isBaseRecipe && item.notes && recipe.choice_name) {
            noteMatches = item.notes.includes(recipe.choice_name);
          }
          if (isBaseRecipe || noteMatches) {
            if (!stockToRestore[recipe.stock_id]) stockToRestore[recipe.stock_id] = 0;
            stockToRestore[recipe.stock_id] += (recipe.quantity_required * item.qty);
          }
        }
      }

      const stockIds = Object.keys(stockToRestore);
      if (stockIds.length > 0) {
        const { data: currentStocks } = await supabase.from('stocks').select('id, quantity').in('id', stockIds);
        if (currentStocks) {
          for (const stock of currentStocks) {
            const amountToRestore = stockToRestore[stock.id];
            if (amountToRestore) {
              const newQuantity = stock.quantity + amountToRestore;
              await supabase.from('stocks').update({
                quantity: newQuantity,
                last_updated: new Date().toISOString()
              }).eq('id', stock.id);
            }
          }
        }
      }
    }
  };

  // Delete Order with Undo
  const handleConfirmDelete = async () => {
    if (!editingOrder) return;
    const orderToDelete = editingOrder;
    lastDeletedOrderRef.current = orderToDelete;

    setIsDeleteConfirmOpen(false);
    setEditingOrder(null);

    // Optimistically remove
    setOrders(prev => prev.filter(o => o.id !== orderToDelete.id));

    // Next order to select
    const currIdx = visibleList.findIndex(o => o.id === orderToDelete.id);
    const nextOrder = visibleList[currIdx + 1] || visibleList[currIdx - 1];
    setSelectedOrderId(nextOrder ? nextOrder.id : null);

    // Show toast with Undo action
    showToast('Pesanan dihapus', async () => {
      // UNDO HANDLER
      if (!lastDeletedOrderRef.current) return;
      const restored = lastDeletedOrderRef.current;
      lastDeletedOrderRef.current = null;

      // Optimistic restore
      setOrders(prev => [...prev, restored]);
      setSelectedOrderId(restored.id);

      await supabase.from('transactions').insert([{
        id: restored.id,
        created_at: restored.rawDate,
        method: restored.method,
        total: restored.total,
        cashier_name: restored.cashier_name,
        customer_name: restored.customer_name,
        status: restored.status,
        order_source: restored.order_source,
        payment_status: restored.payment_status,
        payment_proof_url: restored.payment_proof_url
      }]);

      if (restored.items && restored.items.length > 0) {
        await supabase.from('transaction_items').insert(
          restored.items.map(item => ({
            transaction_id: restored.id,
            product_name: item.name,
            price: item.price,
            quantity: item.qty,
            notes: item.notes || null
          }))
        );
      }

      showToast('Pesanan dikembalikan');
      fetchOrders(false);
    });

    try {
      await restoreOrderStock(orderToDelete);
      await supabase.from('transactions').delete().eq('id', orderToDelete.id);
      fetchOrders(false);
    } catch (e) {
      console.error('Failed to delete order:', e);
      fetchOrders(false);
    }
  };

  // Print Slip
  const handlePrintSlip = (order: Order) => {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) {
      window.print();
      return;
    }
    const itemsHtml = order.items.map(i => `
      <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
        <span>${i.qty}× ${i.name}</span>
        <span>Rp ${(i.qty * i.price).toLocaleString('id-ID')}</span>
      </div>
      ${i.notes ? `<div style="font-size: 11px; color: #555; margin-bottom: 4px;">- ${i.notes}</div>` : ''}
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Slip #${order.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; padding: 12px; margin: 0; color: #000; }
            .center { text-align: center; }
            .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center border-bottom">
            <div class="bold" style="font-size: 16px;">SAMBA CAFE</div>
            <div style="font-size: 11px;">Order Slip: ${order.id.startsWith('order_') ? order.id : `order_${order.id}`}</div>
            <div class="bold" style="font-size: 14px; margin-top: 4px;">Pelanggan: ${order.customer_name}</div>
            <div style="font-size: 11px; color: #555;">${order.date} · Kasir: ${order.cashier_name}</div>
          </div>
          <div class="border-bottom">
            ${itemsHtml}
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 8px;">
            <span>TOTAL (${order.items.reduce((s, i) => s + i.qty, 0)} item)</span>
            <span>Rp ${order.total.toLocaleString('id-ID')}</span>
          </div>
          <div style="font-size: 11px; margin-top: 6px; text-align: right;">Status: ${order.paid ? 'Lunas' : 'Belum Lunas'}</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Grouped history by day
  const historyGrouped = useMemo(() => {
    const q = searchHistory.toLowerCase().trim();
    const filtered = completedOrders.filter(o => {
      if (!q) return true;
      const matchCust = o.customer_name.toLowerCase().includes(q);
      const matchItems = o.items.some(i => i.name.toLowerCase().includes(q));
      return matchCust || matchItems;
    });

    const groups: Record<string, { label: string; orders: Order[]; totalSum: number }> = {};
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    filtered.forEach(o => {
      const orderDate = o.completedAt || o.createdAt;
      const orderDateStr = orderDate.toDateString();

      let label = '';
      if (orderDateStr === todayStr) {
        label = 'Hari ini';
      } else if (orderDateStr === yesterdayStr) {
        label = 'Kemarin';
      } else {
        label = orderDate.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        });
      }

      if (!groups[label]) {
        groups[label] = { label, orders: [], totalSum: 0 };
      }
      groups[label].orders.push(o);
      groups[label].totalSum += o.total;
    });

    return Object.values(groups);
  }, [completedOrders, searchHistory]);

  if (!role) return null;

  return (
    <MainLayout title="Pesanan">
      <div className="orders-page-root orders-scope">
        <div className="orders-wrap">
          {/* Header Row */}
          <div className="orders-top-row">
            <div>
              <h1 className="orders-title">Pesanan</h1>
              <p className="orders-sub">
                {activeOrders.length > 0 ? (
                  <>
                    {activeOrders.length} pesanan menunggu
                    {unpaidActiveOrders.length > 0 && (
                      <>
                        , <b>{unpaidActiveOrders.length} belum dibayar</b>
                      </>
                    )}
                  </>
                ) : (
                  'Tidak ada pesanan yang menunggu'
                )}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="orders-actions-top">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="orders-action-btn"
                title={soundEnabled ? 'Matikan Suara' : 'Nyalakan Suara'}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span>{soundEnabled ? 'Suara On' : 'Suara Off'}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchOrders(false)}
                className="orders-action-btn"
                title="Perbarui data"
              >
                <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Navigation Pill Tabs */}
          <div className="orders-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'queue'}
              className={`orders-tab ${activeTab === 'queue' ? 'active' : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Antrean <span>{activeOrders.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'unpaid'}
              className={`orders-tab ${activeTab === 'unpaid' ? 'active' : ''}`}
              onClick={() => setActiveTab('unpaid')}
            >
              Belum bayar <span>{unpaidActiveOrders.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              className={`orders-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Riwayat
            </button>
          </div>

          {/* Main Content Sections */}
          {activeTab === 'history' ? (
            /* ================= RIWAYAT (HISTORY) VIEW ================= */
            <div className="mt-4">
              <input
                type="text"
                className="orders-search"
                placeholder="Cari nama atau menu..."
                value={searchHistory}
                onChange={e => setSearchHistory(e.target.value)}
                aria-label="Cari pesanan"
              />

              {historyGrouped.length === 0 ? (
                <div className="orders-empty">
                  {searchHistory.trim() ? 'Tidak ada pesanan yang cocok.' : 'Belum ada riwayat pesanan selesai.'}
                </div>
              ) : (
                historyGrouped.map(group => (
                  <div key={group.label}>
                    <div className="orders-day">
                      <span>{group.label}</span>
                      <span>Rp {group.totalSum.toLocaleString('id-ID')}</span>
                    </div>

                    {group.orders.map(order => (
                      <button
                        key={order.id}
                        type="button"
                        className="orders-hrow"
                        onClick={() => handleOpenEdit(order)}
                      >
                        <span className="t">{order.date}</span>
                        <span>
                          <b>{order.customer_name}</b>
                          <br />
                          <span className="i">{formatSummary(order)}</span>
                        </span>
                        <b>Rp {order.total.toLocaleString('id-ID')}</b>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          ) : (
            /* ================= QUEUE / UNPAID GRID VIEW ================= */
            visibleList.length === 0 ? (
              <div className="orders-empty">
                {activeTab === 'queue'
                  ? 'Belum ada pesanan. Pesanan baru dari kasir akan muncul di sini.'
                  : 'Semua pesanan sudah dibayar.'}
              </div>
            ) : (
              <div className="orders-grid">
                {/* Left Column: Order Cards List */}
                <div className="orders-list">
                  {visibleList.map((order, idx) => {
                    const queueNumber = activeOrders.findIndex(o => o.id === order.id) + 1;
                    const mins = formatMins(order.createdAt);
                    const isLate = mins >= 20;
                    const isSelected = selectedOrderId === order.id;

                    return (
                      <button
                        key={order.id}
                        type="button"
                        className={`orders-row ${isSelected ? 'sel' : ''}`}
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          if (window.innerWidth <= 900) {
                            const el = document.getElementById('ticket-detail');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                      >
                        {/* Queue Number */}
                        <span className="orders-n">{queueNumber}</span>

                        {/* Customer Name */}
                        <span className="orders-nm">{order.customer_name}</span>

                        {/* Wait Time */}
                        <span className={`orders-w ${isLate ? 'late' : ''}`}>
                          {formatWaitText(mins, true)}
                        </span>

                        {/* Items Summary */}
                        <span className="orders-sm">
                          {isBigOrder(order) && <b>{getOrderTotalQty(order)} item · </b>}
                          {formatSummary(order)}
                        </span>

                        {/* Payment Status */}
                        <span className={`orders-ps ${order.paid ? '' : 'n0'}`}>
                          {order.paid ? 'Lunas' : 'Belum bayar'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Column: Ticket Card */}
                {selectedOrder && (
                  <section id="ticket-detail" className="orders-tk" aria-live="polite">
                    {/* Top Bar: Antrean index & Ubah / Print actions */}
                    <div className="orders-tt">
                      <span>Antrean {selectedQueueIndex}</span>
                      <div className="orders-tt-actions">
                        <button
                          type="button"
                          className="orders-link"
                          onClick={() => handlePrintSlip(selectedOrder)}
                          title="Cetak slip pesanan"
                        >
                          Cetak Slip
                        </button>
                        <button
                          type="button"
                          className="orders-link orders-link-accent"
                          onClick={() => handleAddMenuInPos(selectedOrder)}
                          title="Buka pesanan ini di halaman POS untuk menambah menu"
                        >
                          + Tambah Menu (POS)
                        </button>
                        <button
                          type="button"
                          className="orders-link"
                          onClick={() => handleOpenEdit(selectedOrder)}
                        >
                          Ubah
                        </button>
                      </div>
                    </div>

                    {/* Customer Name */}
                    <h2>{selectedOrder.customer_name}</h2>

                    {/* Meta: Order time & Elapsed wait */}
                    <div className="orders-meta">
                      Dipesan {selectedOrder.date}, menunggu{' '}
                      <b className={formatMins(selectedOrder.createdAt) >= 20 ? 'late' : ''}>
                        {formatWaitText(formatMins(selectedOrder.createdAt))}
                      </b>
                    </div>

                    {/* Customer QR / Proof Badges if available */}
                    {selectedOrder.order_source === 'CUSTOMER_QR' && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          📱 Customer QR
                        </span>
                        {selectedOrder.payment_proof_url && (
                          <button
                            type="button"
                            onClick={() => setViewProofUrl(selectedOrder.payment_proof_url || null)}
                            className="text-xs px-2.5 py-1 rounded-full font-semibold bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye size={13} />
                            Lihat Bukti Transfer
                          </button>
                        )}
                        {selectedOrder.payment_status === 'PAID' && (
                          <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <Sparkles size={12} />
                            Valid AI
                          </span>
                        )}
                      </div>
                    )}

                    {/* Line Items List */}
                    <ul className={`orders-ti ${selectedOrder.items.length >= 4 ? 'two' : ''}`}>
                      {selectedOrder.items.map((item, idx) => (
                        <li key={idx}>
                          <b>{item.qty}×</b>
                          <span>
                            {item.name}
                            {item.notes && (
                              <small className="block text-xs text-white/50 font-normal">
                                {item.notes}
                              </small>
                            )}
                          </span>
                          <em>Rp {(item.qty * item.price).toLocaleString('id-ID')}</em>
                        </li>
                      ))}
                    </ul>

                    {/* Total Summary */}
                    <div className="orders-tot">
                      <span>Total · {getOrderTotalQty(selectedOrder)} item</span>
                      <b>Rp {selectedOrder.total.toLocaleString('id-ID')}</b>
                    </div>

                    {/* Payment Status Label */}
                    <div className={`orders-pay ${selectedOrder.paid ? '' : 'no'}`}>
                      <span>{selectedOrder.paid ? 'Sudah dibayar' : 'Belum dibayar'}</span>
                      {selectedOrder.method && (
                        <span className="text-xs font-normal opacity-70">
                          Metode: {selectedOrder.method}
                        </span>
                      )}
                    </div>

                    {/* Big Action CTA */}
                    <button
                      type="button"
                      className={`orders-cta ${selectedOrder.paid ? 'ok' : ''}`}
                      onClick={() => {
                        if (selectedOrder.paid) {
                          handleCompleteOrder(selectedOrder);
                        } else {
                          handleOpenPayment(selectedOrder);
                        }
                      }}
                    >
                      {selectedOrder.paid ? (
                        <>
                          <CheckCircle2 size={20} />
                          <span>Selesai</span>
                        </>
                      ) : (
                        <>
                          <Banknote size={20} />
                          <span>Terima pembayaran</span>
                        </>
                      )}
                    </button>
                  </section>
                )}
              </div>
            )
          )}
        </div>

        {/* ================= EDIT MODAL ("UBAH PESANAN") ================= */}
        {editingOrder && (
          <div
            className="orders-mask"
            onClick={e => {
              if (e.target === e.currentTarget) setEditingOrder(null);
            }}
          >
            <div className="orders-modal" role="dialog" aria-modal="true">
              <div className="orders-mh">
                <h2>Ubah pesanan</h2>
                <button
                  type="button"
                  className="orders-x"
                  onClick={() => setEditingOrder(null)}
                  aria-label="Tutup"
                >
                  ×
                </button>
              </div>

              {/* Customer Name Field */}
              <label htmlFor="edit-cust-name">Nama pelanggan</label>
              <input
                id="edit-cust-name"
                className="orders-in"
                value={draftCustomerName}
                onChange={e => setDraftCustomerName(e.target.value)}
                placeholder="Nama pelanggan..."
              />

              {/* Items List */}
              <label>Pesanan</label>
              {draftItems.length === 0 ? (
                <p className="text-sm text-zinc-400 py-3">Tidak ada item di pesanan.</p>
              ) : (
                draftItems.map((item, idx) => (
                  <div key={idx} className="orders-line">
                    <span>
                      {item.name}
                      <br />
                      <small style={{ color: 'var(--mu)' }}>
                        Rp {item.price.toLocaleString('id-ID')}
                      </small>
                    </span>

                    <div className="orders-qty">
                      <button
                        type="button"
                        onClick={() => handleAdjustDraftQty(idx, -1)}
                        aria-label="Kurangi"
                      >
                        −
                      </button>
                      <b>{item.qty}</b>
                      <button
                        type="button"
                        onClick={() => handleAdjustDraftQty(idx, 1)}
                        aria-label="Tambah"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Add Menu Action - Navigate directly to POS */}
              <label>Tambah menu</label>
              <button
                type="button"
                onClick={() => handleAddMenuInPos(editingOrder, draftItems, draftCustomerName)}
                className="orders-btn-add-pos"
                title="Buka pesanan ini di halaman Kasir (POS) untuk menambah menu"
              >
                <Plus size={16} className="stroke-[2.5]" />
                <span>Tambah Menu di Halaman Kasir (POS) →</span>
              </button>
              <span className="orders-add-pos-hint">
                Pilih menu tambahan langsung dari katalog POS lengkap dengan foto, kategori & varian.
              </span>

              {/* Modal Footer Actions */}
              <div className="orders-mf">
                <button
                  type="button"
                  className="orders-del"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                >
                  Hapus pesanan
                </button>

                <button
                  type="button"
                  className="orders-btn"
                  onClick={handleSaveEdit}
                  disabled={draftItems.length === 0}
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= CONFIRM DELETE MODAL ================= */}
        {isDeleteConfirmOpen && editingOrder && (
          <div
            className="orders-mask"
            onClick={e => {
              if (e.target === e.currentTarget) setIsDeleteConfirmOpen(false);
            }}
          >
            <div className="orders-modal" role="dialog" aria-modal="true">
              <div className="orders-mh">
                <h2>Hapus pesanan ini?</h2>
              </div>
              <p style={{ color: 'var(--mu)', margin: '6px 0 16px' }}>
                {editingOrder.customer_name} · Rp {editingOrder.total.toLocaleString('id-ID')}. Kamu masih bisa membatalkannya sesaat setelah dihapus.
              </p>

              <div className="orders-mf">
                <button
                  type="button"
                  className="orders-link"
                  style={{ color: 'var(--mu)' }}
                  onClick={() => setIsDeleteConfirmOpen(false)}
                >
                  Tidak jadi
                </button>

                <button
                  type="button"
                  className="orders-btn"
                  style={{ background: 'var(--coral)', color: '#fff' }}
                  onClick={handleConfirmDelete}
                >
                  Ya, hapus
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAYMENT MODAL ("TERIMA PEMBAYARAN") ================= */}
        {paymentModalOrder && (
          <div
            className="orders-mask"
            onClick={e => {
              if (e.target === e.currentTarget) setPaymentModalOrder(null);
            }}
          >
            <div className="orders-modal" role="dialog" aria-modal="true">
              <div className="orders-mh">
                <h2>Terima Pembayaran</h2>
                <button
                  type="button"
                  className="orders-x"
                  onClick={() => setPaymentModalOrder(null)}
                  aria-label="Tutup"
                >
                  ×
                </button>
              </div>

              <div className="py-2">
                <p className="text-sm text-zinc-400">Pelanggan</p>
                <p className="text-xl font-bold text-white">{paymentModalOrder.customer_name}</p>

                <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center">
                  <span className="text-sm font-semibold text-zinc-400">Total Tagihan</span>
                  <span className="text-2xl font-black text-amber-400">
                    Rp {paymentModalOrder.total.toLocaleString('id-ID')}
                  </span>
                </div>

                <p className="text-sm text-zinc-400 mt-6 mb-3 font-semibold">Pilih Metode Pembayaran</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleConfirmPayment(paymentModalOrder, 'Cash')}
                    className="p-4 rounded-xl bg-gradient-to-b from-white/15 to-white/5 border border-white/20 hover:border-amber-400 text-white font-bold flex flex-col items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
                  >
                    <Banknote size={28} className="text-emerald-400" />
                    <span>Tunai (Cash)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfirmPayment(paymentModalOrder, 'QRIS')}
                    className="p-4 rounded-xl bg-gradient-to-b from-white/15 to-white/5 border border-white/20 hover:border-amber-400 text-white font-bold flex flex-col items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
                  >
                    <CreditCard size={28} className="text-blue-400" />
                    <span>QRIS</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAYMENT PROOF LIGHTBOX MODAL ================= */}
        {viewProofUrl && (
          <div
            className="orders-mask"
            onClick={() => setViewProofUrl(null)}
          >
            <div
              className="orders-modal max-w-lg text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="orders-mh">
                <h2>Bukti Transfer</h2>
                <button
                  type="button"
                  className="orders-x"
                  onClick={() => setViewProofUrl(null)}
                >
                  ×
                </button>
              </div>
              <div className="mt-3 rounded-xl overflow-hidden border border-white/20 max-h-[70vh] flex items-center justify-center bg-black">
                <img
                  src={viewProofUrl}
                  alt="Bukti Transfer"
                  className="max-h-[65vh] w-auto object-contain"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= FLOATING TOAST ================= */}
        {toastMessage && (
          <div className="orders-toast">
            <span>{toastMessage}</span>
            {toastUndoAction && (
              <button
                type="button"
                onClick={() => {
                  toastUndoAction();
                  setToastMessage(null);
                  setToastUndoAction(null);
                }}
              >
                Batalkan
              </button>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
