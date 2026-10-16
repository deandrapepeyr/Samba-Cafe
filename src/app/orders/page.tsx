'use client';

import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Clock, 
  CheckCircle2, 
  ChefHat, 
  Bell, 
  Search, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Receipt, 
  RotateCcw,
  Utensils,
  PackageCheck,
  Printer,
  FileEdit,
  Banknote,
  Trash2,
  Scan,
  AlertTriangle,
  Sparkles,
  X,
  XCircle,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type OrderItem = {
  name: string;
  price: number;
  qty: number;
  notes?: string;
};

type Order = {
  id: string;
  date: string;
  rawDate: string;
  createdAt: Date;
  method: string;
  total: number;
  cashier_name: string;
  customer_name: string | null;
  order_source?: string;
  payment_status?: string;
  payment_proof_url?: string;
  status: string;
  customer_session_id?: string | null;
  completedAt?: Date;
  items: OrderItem[];
};

export default function OrdersPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'kanban' | 'list'>('kanban');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'pos' | 'customer_qr'>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editedItems, setEditedItems] = useState<OrderItem[]>([]);
  const [now, setNow] = useState(new Date());

  // --- AI Verification State ---
  type AiChecklistItem = {
    passed: boolean;
    label: string;
    detail: string;
  };

  type AiVerificationData = {
    is_valid: boolean;
    detected_amount: number | null;
    amount_matches?: boolean;
    is_time_valid?: boolean;
    provider?: string;
    status_text?: string;
    transaction_date?: string;
    transaction_time?: string;
    reason: string;
    confidence?: string;
    issues?: string[];
    checklist?: {
      amount_check?: AiChecklistItem;
      time_check?: AiChecklistItem;
      status_check?: AiChecklistItem;
      fraud_check?: AiChecklistItem;
    };
    _proof_url?: string;
    _expected_amount?: number;
  };
  const [aiVerifications, setAiVerifications] = useState<Record<string, AiVerificationData>>({});
  const [analyzingOrderIds, setAnalyzingOrderIds] = useState<Record<string, boolean>>({});
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});

  const prevOrderCountRef = useRef<number>(0);
  const localUpdatesRef = useRef<Record<string, number>>({});
  const aiVerifiedIdsRef = useRef<Set<string>>(new Set());
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !role) {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  // AI Verification trigger for order detail
  const verifyProofWithAi = async (order: Order, force = false) => {
    if (!order.payment_proof_url) return;
    if (!force && (aiVerifications[order.id] || analyzingOrderIds[order.id])) return;

    setAnalyzingOrderIds(prev => ({ ...prev, [order.id]: true }));
    setAiErrors(prev => {
      const copy = { ...prev };
      delete copy[order.id];
      return copy;
    });

    try {
      const res = await fetch('/api/verify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          imageUrl: order.payment_proof_url,
          expectedAmount: order.total,
          force
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Gagal memverifikasi bukti transfer dengan AI');
      }

      const resultWithMeta = {
        ...data.result,
        _proof_url: order.payment_proof_url,
        _expected_amount: order.total
      };

      setAiVerifications(prev => ({
        ...prev,
        [order.id]: resultWithMeta
      }));

      try {
        if (data.result) {
          localStorage.setItem(`samba_ai_res_${order.id}`, JSON.stringify(resultWithMeta));
        }
      } catch (e) {}

      // Track that this specific proof URL and amount has been AI-verified
      aiVerifiedIdsRef.current.add(`${order.id}_${order.payment_proof_url}_${order.total}`);

      // Guard: prevent polling (3s interval) from overwriting this AI-verified status
      localUpdatesRef.current[order.id] = Date.now();

      // Immediately sync local order state to reflect the new AI verification status
      const newStatus = data.result?.is_valid ? (data.status || 'preparing') : 'pending';
      const newPaymentStatus = data.result?.is_valid ? (data.payment_status || 'PAID') : (data.payment_status || 'AI_INVALID');

      setOrders(prev => prev.map(o => o.id === order.id ? {
        ...o,
        status: newStatus,
        payment_status: newPaymentStatus
      } : o));

      setSelectedOrder(prev => prev && prev.id === order.id ? {
        ...prev,
        status: newStatus,
        payment_status: newPaymentStatus
      } : prev);

    } catch (err: any) {
      console.error('AI verification failed:', err);
      aiVerifiedIdsRef.current.add(order.id);
      setAiErrors(prev => ({
        ...prev,
        [order.id]: err.message || 'Server AI sedang sibuk'
      }));
    } finally {
      setAnalyzingOrderIds(prev => ({ ...prev, [order.id]: false }));
    }
  };

  // Auto-scan any pending QR orders with proof so they NEVER stay in yellow "Memeriksa Bukti..."
  useEffect(() => {
    const unverifiedPending = orders.find(
      o => o.status === 'pending' && 
           o.order_source === 'CUSTOMER_QR' && 
           o.payment_proof_url && 
           (
             o.payment_status === 'PENDING_VERIFICATION' || 
             o.payment_status === 'WAITING_CONFIRMATION' ||
             !o.payment_status
           ) &&
           !analyzingOrderIds[o.id] &&
           !aiVerifiedIdsRef.current.has(`${o.id}_${o.payment_proof_url}_${o.total}`)  // skip jika foto bukti & nominal sama persis sudah pernah diverifikasi AI
    );

    if (unverifiedPending) {
      verifyProofWithAi(unverifiedPending, false);
    }
  }, [orders, analyzingOrderIds]);

  // Reset scroll to top when selectedOrder changes
  useEffect(() => {
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTop = 0;
    }
  }, [selectedOrder?.id, selectedOrder?.payment_proof_url]);

  // Load AI verification result when opening order detail (instant from cache/localStorage if fresh, re-verify if proof changed)
  useEffect(() => {
    if (!selectedOrder || !selectedOrder.payment_proof_url) return;

    // 1. If already in React state and matches current proof URL and total, do not trigger anything
    const existing = aiVerifications[selectedOrder.id];
    if (existing && existing._proof_url === selectedOrder.payment_proof_url && existing._expected_amount === selectedOrder.total) {
      return;
    }

    // 2. Try loading from localStorage immediately if URL & amount match
    try {
      const cached = localStorage.getItem(`samba_ai_res_${selectedOrder.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const isUrlMatch = !parsed._proof_url || parsed._proof_url === selectedOrder.payment_proof_url;
        const isAmountMatch = !parsed._expected_amount || parsed._expected_amount === selectedOrder.total;
        if (isUrlMatch && isAmountMatch && (parsed.reason || parsed.checklist)) {
          setAiVerifications(prev => ({ ...prev, [selectedOrder.id]: parsed }));
          return;
        } else {
          localStorage.removeItem(`samba_ai_res_${selectedOrder.id}`);
        }
      }
    } catch (e) {}

    // 3. If not in state or localStorage (or stale due to new proof/amount), trigger fresh AI verification
    if (!analyzingOrderIds[selectedOrder.id]) {
      verifyProofWithAi(selectedOrder, true);
    }
  }, [selectedOrder?.id, selectedOrder?.payment_proof_url, selectedOrder?.total]);

  const confirmPaymentAndAcceptOrder = async (order: Order) => {
    setUpdatingId(order.id);
    const nowIso = new Date().toISOString();
    const userName = localStorage.getItem('samba_admin_name') || 'Cashier';
    
    // Update payment status in Supabase
    await supabase.from('transactions').update({ 
      payment_status: 'PAID',
      payment_confirmed_at: nowIso,
      payment_confirmed_by: userName
    }).eq('id', order.id);

    // Transition order to 'preparing' & handle session merging
    await updateOrderStatus(order.id, 'preparing');

    setSelectedOrder(prev => prev && prev.id === order.id ? {
      ...prev,
      payment_status: 'PAID',
      status: 'preparing'
    } : null);
  };

  const rejectPayment = async (order: Order) => {
    if (!confirm("Apakah Anda yakin ingin menolak pembayaran pesanan ini?")) return;
    setUpdatingId(order.id);
    await updatePaymentStatus(order.id, 'PAYMENT_REJECTED');
  };

  // Update timer every 15s for dynamic elapsed time calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const playNotificationSound = () => {
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

  const fetchOrders = async (isInitial = false) => {
    if (isInitial) setIsLoadingData(true);
    
    // Get transactions from today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .or(`created_at.gte.${startOfDay.toISOString()},status.eq.pending,status.eq.preparing,status.eq.ready,status.eq.Paid,status.eq.paid,status.is.null`)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true });

    if (txData && txData.length > 0) {
      // Hide customer QR orders that are still awaiting payment during the 5-minute window
      const validTxData = txData.filter(tx => {
        if (tx.order_source === 'CUSTOMER_QR' && tx.status === 'pending') {
          // Only show on POS if payment has been confirmed/uploaded for verification
          if (tx.payment_status === 'AWAITING_PAYMENT' || !tx.payment_proof_url) {
            return false;
          }
        }
        return true;
      });

      const txIds = validTxData.map(t => t.id);
      
      const { data: itemsData } = await supabase
        .from('transaction_items')
        .select('*')
        .in('transaction_id', txIds);

      const formattedOrders: Order[] = validTxData.map(tx => {
        const items = itemsData ? itemsData.filter(i => i.transaction_id === tx.id) : [];
        const dateObj = new Date(tx.created_at);
        
        let normStatus = (tx.status || 'preparing');
        let completedAt = undefined;
        
        if (normStatus.startsWith('completed|')) {
          const parts = normStatus.split('|');
          normStatus = 'completed';
          if (parts[1]) completedAt = new Date(parts[1]);
        }
        
        normStatus = normStatus.toLowerCase();
        if (normStatus === 'paid') normStatus = 'preparing';

        return {
          id: tx.id,
          date: dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          rawDate: tx.created_at,
          createdAt: dateObj,
          method: tx.method,
          total: tx.total,
          cashier_name: tx.cashier_name,
          customer_name: tx.customer_name,
          status: normStatus,
          order_source: tx.order_source || 'POS',
          payment_status: tx.payment_status,
          payment_proof_url: tx.payment_proof_url,
          customer_session_id: tx.customer_session_id,
          completedAt,
          items: items.map(item => ({
            name: item.product_name,
            price: item.price,
            qty: item.quantity,
            notes: item.notes
          }))
        };
      });

      // Hydrate aiVerifications from localStorage for instant display (only if proof URL & amount match)
      formattedOrders.forEach(o => {
        if (o.payment_proof_url) {
          try {
            const cached = localStorage.getItem(`samba_ai_res_${o.id}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              const isUrlMatch = !parsed._proof_url || parsed._proof_url === o.payment_proof_url;
              const isAmountMatch = !parsed._expected_amount || parsed._expected_amount === o.total;
              if (isUrlMatch && isAmountMatch && (parsed.reason || parsed.checklist)) {
                setAiVerifications(prev => ({ ...prev, [o.id]: parsed }));
              } else {
                localStorage.removeItem(`samba_ai_res_${o.id}`);
              }
            }
          } catch (e) {}
        }
      });

      // Sound notification if new pending or preparing order came in
      const activePreparingCount = formattedOrders.filter(o => o.status === 'preparing' || o.status === 'pending').length;
      if (!isInitial && activePreparingCount > prevOrderCountRef.current) {
        playNotificationSound();
      }
      prevOrderCountRef.current = activePreparingCount;

      // Guard: don't overwrite recently locally-updated orders (fixes race condition)
      setOrders(prev => {
        const now = Date.now();
        const updated = formattedOrders.map(order => {
          const localUpdateTime = localUpdatesRef.current[order.id];
          if (localUpdateTime && now - localUpdateTime < 10000) {
            const existingOrder = prev.find(o => o.id === order.id);
            if (existingOrder) return existingOrder;
          }
          if (localUpdateTime && now - localUpdateTime >= 10000) {
            delete localUpdatesRef.current[order.id];
          }
          return order;
        });
        
        try {
          localStorage.setItem('samba_admin_orders_cache', JSON.stringify(updated));
        } catch(e) {}
        
        return updated;
      });
    } else {
      setOrders([]);
      try {
        localStorage.setItem('samba_admin_orders_cache', '[]');
      } catch(e) {}
    }
    
    setIsLoadingData(false);
  };

  useEffect(() => {
    if (role) {
      try {
        const cached = localStorage.getItem('samba_admin_orders_cache');
        if (cached) {
          const parsed = JSON.parse(cached).map((o: any) => ({
            ...o,
            createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
            completedAt: o.completedAt ? new Date(o.completedAt) : undefined,
          }));
          setOrders(parsed);
          setIsLoadingData(false);
        }
      } catch (e) {}
      
      fetchOrders(true);

      // Realtime listener for transactions
      const channelId = `orders_page_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions' },
          () => {
            fetchOrders(false);
          }
        )
        .subscribe();

      // Fallback polling every 3s
      const pollInterval = setInterval(() => {
        fetchOrders(false);
      }, 3000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollInterval);
      };
    }
  }, [role]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    localUpdatesRef.current[orderId] = Date.now();
    
    // Find the order being updated
    const targetOrder = orders.find(o => o.id === orderId);

    // If accepting a CUSTOMER_QR order, check if we need to merge
    if (newStatus === 'preparing' && targetOrder && targetOrder.order_source === 'CUSTOMER_QR' && targetOrder.customer_session_id) {
      // Find an existing ACTIVE order for this same customer session
      const existingOrder = orders.find(o => 
        o.id !== orderId && 
        o.customer_session_id === targetOrder.customer_session_id && 
        (o.status === 'preparing' || o.status === 'ready' || o.status === 'pending')
      );

      if (existingOrder) {
        // Merge! Move items to existingOrder
        await supabase.from('transaction_items').update({ transaction_id: existingOrder.id }).eq('transaction_id', orderId);
        
        // Update total
        const newTotal = existingOrder.total + targetOrder.total;
        await supabase.from('transactions').update({ total: newTotal }).eq('id', existingOrder.id);
        
        // Delete the new merged order
        await supabase.from('transactions').delete().eq('id', orderId);
        
        fetchOrders(false);
        setUpdatingId(null);
        return;
      }
    }

    if (newStatus === 'completed' && targetOrder && targetOrder.method === 'Bayar Nanti') {
      alert("Pesanan belum dibayar! Silakan tandai lunas atau ubah metode pembayaran terlebih dahulu sebelum menyelesaikan pesanan.");
      setUpdatingId(null);
      return;
    }

    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === orderId ? { 
      ...o, 
      status: newStatus,
      completedAt: newStatus === 'completed' ? new Date() : undefined 
    } : o));

    let dbStatus = newStatus;
    if (newStatus === 'completed') {
      dbStatus = `completed|${new Date().toISOString()}`;
    }

    const { error } = await supabase
      .from('transactions')
      .update({ status: dbStatus })
      .eq('id', orderId);

    if (error) {
      alert("Gagal mengupdate status: " + error.message);
      fetchOrders(false);
    } else {
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    }
    setUpdatingId(null);
  };

  const updatePaymentStatus = async (orderId: string, newPaymentStatus: string, newOrderStatus?: string) => {
    setUpdatingId(orderId);
    localUpdatesRef.current[orderId] = Date.now();
    
    setOrders(prev => prev.map(o => o.id === orderId ? { 
      ...o, 
      payment_status: newPaymentStatus,
      ...(newOrderStatus ? { status: newOrderStatus } : {})
    } : o));

    const updates: any = { payment_status: newPaymentStatus };
    if (newOrderStatus) updates.status = newOrderStatus;

    const { error } = await supabase.from('transactions').update(updates).eq('id', orderId);
    
    if (error) {
      alert("Gagal mengupdate status pembayaran: " + error.message);
      fetchOrders(false);
    } else {
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, payment_status: newPaymentStatus, ...(newOrderStatus ? {status: newOrderStatus}:{}) } : null);
      }
    }
    setUpdatingId(null);
  };

  const startEditOrder = () => {
    if (selectedOrder) {
      setEditedItems([...selectedOrder.items]);
      setIsEditingOrder(true);
    }
  };

  const handleDeleteOrder = () => {
    if (!selectedOrder) return;
    setIsDeleteDialogOpen(true);
  };

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

  const confirmDeleteOrder = async () => {
    if (!selectedOrder) return;
    setUpdatingId(selectedOrder.id);
    await restoreOrderStock(selectedOrder);
    await supabase.from('transactions').delete().eq('id', selectedOrder.id);
    fetchOrders(false);
    setSelectedOrder(null);
    setUpdatingId(null);
    setIsDeleteDialogOpen(false);
  };

  const saveEditedOrder = async () => {
    if (!selectedOrder) return;
    setUpdatingId(selectedOrder.id);
    const finalItems = editedItems.filter(i => i.qty > 0);
    if (finalItems.length === 0) {
      alert('Pesanan harus punya minimal 1 item.');
      setUpdatingId(null);
      return;
    }
    const newTotal = finalItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
    await supabase.from('transactions').update({ total: newTotal }).eq('id', selectedOrder.id);
    await supabase.from('transaction_items').delete().eq('transaction_id', selectedOrder.id);
    await supabase.from('transaction_items').insert(
      finalItems.map(item => ({
        transaction_id: selectedOrder.id,
        product_name: item.name,
        price: item.price,
        quantity: item.qty,
        notes: item.notes || null
      }))
    );
    setSelectedOrder(prev => prev ? { ...prev, items: finalItems, total: newTotal } : null);
    setIsEditingOrder(false);
    setUpdatingId(null);
    localUpdatesRef.current[selectedOrder.id] = Date.now();
    fetchOrders(false);
  };

  const getElapsedTimeText = (order: Order) => {
    let diffMs;
    if (order.status === 'completed') {
      if (order.completedAt) {
        diffMs = order.completedAt.getTime() - order.createdAt.getTime();
      } else {
        return "Selesai"; // For old legacy orders without timestamp
      }
    } else {
      diffMs = now.getTime() - order.createdAt.getTime();
    }

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (order.status === 'completed') {
      if (diffHours > 0) {
        return `${diffHours}j ${diffMins % 60}m`;
      }
      return `${diffMins} mnt`;
    }

    if (diffHours > 0) {
      return `${diffHours}j ${diffMins % 60}m lalu`;
    }
    return `${diffMins} mnt lalu`;
  };

  const getTimerBadgeStyle = (order: Order) => {
    if (order.status === 'completed') {
      return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
    
    const diffMins = Math.floor((now.getTime() - order.createdAt.getTime()) / 60000);
    
    if (diffMins > 30) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (diffMins > 15) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  };

  if (!role) return null;

  // Filter helper
  const matchesSourceFilter = (o: Order) => sourceFilter === 'all' || (sourceFilter === 'pos' && o.order_source === 'POS') || (sourceFilter === 'customer_qr' && o.order_source === 'CUSTOMER_QR');

  // Filtered lists
  const pendingOrders = orders.filter(o => {
    if (o.status !== 'pending') return false;
    if (o.order_source === 'CUSTOMER_QR' && (!o.payment_proof_url || o.payment_status === 'AWAITING_PAYMENT')) return false;
    return matchesSourceFilter(o) && (o.id.includes(searchQuery) || o.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())));
  });
  const preparingOrders = orders.filter(o => o.status === 'preparing' && matchesSourceFilter(o) && (o.id.includes(searchQuery) || o.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))));
  const readyOrders = orders.filter(o => o.status === 'ready' && matchesSourceFilter(o) && (o.id.includes(searchQuery) || o.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))));
  const completedOrders = orders
    .filter(o => o.status === 'completed' && matchesSourceFilter(o) && (o.id.includes(searchQuery) || o.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))))
    .sort((a, b) => {
      const timeA = a.completedAt ? a.completedAt.getTime() : a.createdAt.getTime();
      const timeB = b.completedAt ? b.completedAt.getTime() : b.createdAt.getTime();
      return timeB - timeA; // Descending: Newest completed at the top
    });

  const filteredAllOrders = orders.filter(o => {
    const matchesSearch = o.id.includes(searchQuery) || o.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus && matchesSourceFilter(o);
  });

  const renderOrderCard = (order: Order, customNumber?: number) => {

    return (
      <div 
        key={order.id} 
        className={`group relative rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${
          order.status === 'preparing' ? 'bg-zinc-900/60 backdrop-blur-md border border-white/10 hover:border-amber-500/50 hover:shadow-amber-500/10' :
          order.status === 'ready' ? 'bg-emerald-950/20 backdrop-blur-md border border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-emerald-500/10' :
          'bg-zinc-900/30 backdrop-blur-md border border-white/5 opacity-70 hover:opacity-100'
        }`}
      >
        {/* Glow accent */}
        <div className={`absolute top-0 left-0 right-0 h-0.5 ${
          order.status === 'preparing' ? 'bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0 opacity-50' :
          order.status === 'ready' ? 'bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-emerald-500/0 opacity-50' : 'hidden'
        }`} />

        <div className="p-3.5 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {customNumber !== undefined && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white/10 text-white font-bold text-xs shrink-0 mr-1">
                    {customNumber}
                  </span>
                )}
                <span className="font-mono font-bold text-sm text-zinc-100">{order.id.startsWith('order_') ? order.id : `order_${order.id}`}</span>
                {order.order_source === 'CUSTOMER_QR' && (
                  <span className="shrink-0 whitespace-nowrap text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-purple-500/10 text-purple-400 border-purple-500/20">
                    📱 CUSTOMER QR
                  </span>
                )}
                <span className={`shrink-0 whitespace-nowrap text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                  order.method === 'QRIS' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                  order.method === 'Bayar Nanti' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse' :
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {order.method}
                </span>
                {order.payment_status === 'AI_VERIFIED' && (
                  <span className="shrink-0 whitespace-nowrap text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    ✅ Valid AI
                  </span>
                )}
                {/* PAID via QR with proof = AI verified */}
                {order.payment_status === 'PAID' && order.order_source === 'CUSTOMER_QR' && order.payment_proof_url && (
                  <span className="shrink-0 whitespace-nowrap text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    ✅ Terverifikasi AI
                  </span>
                )}
                {order.payment_status === 'PAYMENT_REJECTED' && order.order_source === 'CUSTOMER_QR' && (
                  <span className="shrink-0 whitespace-nowrap text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-red-500/10 text-red-400 border-red-500/20">
                    ❌ Ditolak AI
                  </span>
                )}
                {order.payment_status === 'AI_INVALID' && (
                  <span className="shrink-0 whitespace-nowrap text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-red-500/10 text-red-400 border-red-500/20">
                    ❌ Ditolak AI
                  </span>
                )}
                {(!order.payment_status || order.payment_status === 'WAITING_CONFIRMATION' || order.payment_status === 'PENDING_VERIFICATION') && order.method === 'QRIS' && order.status === 'pending' && (
                  <span className="shrink-0 whitespace-nowrap text-[9px] font-bold px-1.5 py-0.5 rounded-md border bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse">
                    🔍 Memeriksa Bukti...
                  </span>
                )}
              </div>
              {order.customer_name && (
                <p className="text-[11px] font-medium text-zinc-300 truncate">
                  Pelanggan: <span className="text-primary font-bold">{order.customer_name}</span>
                </p>
              )}
            </div>
            <span className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md border ${getTimerBadgeStyle(order)}`}>
              <Clock size={10} className="shrink-0" />
              {getElapsedTimeText(order)}
            </span>
          </div>

          {/* Items Summary */}
          <div className="space-y-1 bg-black/20 p-2 rounded-lg border border-white/5">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-start text-[11px] leading-tight">
                <span className="text-primary font-bold mr-1.5 shrink-0">{item.qty}x</span>
                <span className="text-zinc-300 truncate">{item.name}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-white/5" />

          {/* Total + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="shrink-0">
              <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Total</p>
              <p className="text-sm font-bold text-primary leading-none mt-1">Rp {order.total.toLocaleString('id-ID')}</p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setSelectedOrder(order)}
                className="h-7 px-2.5 text-[10px] font-medium text-zinc-400 bg-zinc-900/50 hover:bg-zinc-800 hover:text-zinc-100 rounded-lg border border-white/10 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <Receipt size={12} />
                Detail
              </button>

              {order.status === 'pending' && (
                <>
                  {order.payment_proof_url ? (
                    <button 
                      onClick={() => setSelectedOrder(order)} 
                      className={`h-7 px-2.5 text-[10px] font-bold text-white rounded-lg transition-all shrink-0 flex items-center gap-1 shadow-md ${
                        order.payment_status === 'AI_VERIFIED'
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 shadow-emerald-500/10'
                          : order.payment_status === 'AI_INVALID' || order.payment_status === 'PAYMENT_REJECTED'
                          ? 'bg-gradient-to-r from-red-600 to-red-500 hover:brightness-110 shadow-red-500/10'
                          : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 shadow-amber-500/10'
                      }`}
                    >
                      <Sparkles size={11} /> {order.payment_status === 'AI_VERIFIED' ? 'Bukti Valid & Terima' : (order.payment_status === 'AI_INVALID' || order.payment_status === 'PAYMENT_REJECTED') ? 'Cek Bukti Ditolak' : 'Cek Bukti AI & Terima'}
                    </button>
                  ) : order.payment_status === 'WAITING_CONFIRMATION' ? (
                    <>
                      <button onClick={() => updatePaymentStatus(order.id, 'PAID', 'preparing')} className="h-7 px-2.5 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-all shrink-0">
                        Konfirmasi Bayar
                      </button>
                      <button onClick={() => updatePaymentStatus(order.id, 'PAYMENT_REJECTED')} className="h-7 px-2.5 text-[10px] font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all shrink-0">
                        Tolak
                      </button>
                    </>
                  ) : null}
                </>
              )}

              {order.status === 'pending' && order.method === 'Bayar Nanti' && order.order_source === 'CUSTOMER_QR' && (
                <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="h-7 px-2.5 text-[10px] font-bold text-black bg-amber-500 hover:bg-amber-400 rounded-lg transition-all shrink-0">
                  Terima Pesanan
                </button>
              )}

              {order.status === 'preparing' && (
                <button
                  disabled={updatingId === order.id}
                  onClick={() => {
                    // Kasir double check saat pesanan selesai: jika Customer QR dengan bukti transfer, buka detail modal untuk validasi kasir!
                    if (order.order_source === 'CUSTOMER_QR' && order.payment_proof_url) {
                      setSelectedOrder(order);
                    } else {
                      updateOrderStatus(order.id, 'ready');
                    }
                  }}
                  className="h-7 px-2.5 text-[10px] font-extrabold text-black bg-gradient-to-r from-[#E3B24C] to-[#B98A2E] shadow-md hover:brightness-110 disabled:opacity-50 rounded-lg transition-all flex items-center gap-1 shrink-0 whitespace-nowrap border-none"
                  title={order.order_source === 'CUSTOMER_QR' ? 'Klik untuk double check bukti pembayaran & selesaikan pesanan' : 'Selesai dimasak'}
                >
                  {updatingId === order.id ? <RefreshCw size={12} className="animate-spin" /> : (
                    <>
                      <CheckCircle2 size={12} strokeWidth={2.5} />
                      Done
                    </>
                  )}
                </button>
              )}

              {order.status === 'ready' && (
                <button
                  disabled={updatingId === order.id || order.method === 'Bayar Nanti'}
                  onClick={() => {
                    if (order.method === 'Bayar Nanti') {
                      alert("Tandai lunas terlebih dahulu sebelum menyelesaikan pesanan.");
                      return;
                    }
                    updateOrderStatus(order.id, 'completed');
                  }}
                  className={`h-7 px-2.5 text-[10px] font-bold text-white transition-all flex items-center gap-1 shrink-0 whitespace-nowrap rounded-lg ${
                    order.method === 'Bayar Nanti'
                      ? 'bg-zinc-700 opacity-50 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50'
                  }`}
                  title={order.method === 'Bayar Nanti' ? "Belum lunas" : "Selesaikan Pesanan"}
                >
                  {updatingId === order.id ? <RefreshCw size={12} className="animate-spin" /> : (
                    <>
                      <CheckCircle2 size={12} />
                      Pesanan Selesai
                    </>
                  )}
                </button>
              )}

              {order.status === 'completed' && (
                <button
                  disabled={updatingId === order.id}
                  onClick={() => updateOrderStatus(order.id, 'preparing')}
                  className="h-7 px-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 bg-transparent hover:bg-zinc-900 rounded-lg transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                  <RotateCcw size={10} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout title="Order List & Status Pesanan">
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full flex flex-col space-y-5">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Pesanan</h1>
            <p className="text-xs text-[#666] mt-0.5">Pantau dan kelola status pesanan hari ini</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`h-8 px-3 text-[11px] font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                soundEnabled 
                  ? 'border-primary/30 text-primary bg-primary/5 hover:bg-primary/10' 
                  : 'border-[#333] text-[#666] bg-transparent hover:text-[#999]'
              }`}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {soundEnabled ? 'Suara On' : 'Suara Off'}
            </button>

            <button
              onClick={() => fetchOrders(false)}
              className="h-8 px-3 text-[11px] font-medium text-[#888] bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-lg transition-all flex items-center gap-1.5"
            >
              <RefreshCw size={13} className={isLoadingData ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Status Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
          <button 
            className={`group text-left p-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${
              sourceFilter === 'pos' 
                ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20 shadow-lg shadow-blue-500/5' 
                : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60 hover:border-white/10'
            } border backdrop-blur-md`}
            onClick={() => setSourceFilter(sourceFilter === 'pos' ? 'all' : 'pos')}
          >
            <p className="relative text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-blue-500/70 transition-colors">POS</p>
            <div className="relative mt-2 text-xl font-black text-zinc-100 group-hover:text-blue-500 transition-colors">Kasir</div>
          </button>

          <button 
            className={`group text-left p-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${
              sourceFilter === 'customer_qr' 
                ? 'bg-purple-500/10 border-purple-500/30 ring-1 ring-purple-500/20 shadow-lg shadow-purple-500/5' 
                : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60 hover:border-white/10'
            } border backdrop-blur-md`}
            onClick={() => setSourceFilter(sourceFilter === 'customer_qr' ? 'all' : 'customer_qr')}
          >
            <p className="relative text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-purple-500/70 transition-colors">Customer QR</p>
            <div className="relative mt-2 text-xl font-black text-zinc-100 group-hover:text-purple-500 transition-colors">Mandiri</div>
          </button>

          <button 
            className={`group text-left p-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${
              statusFilter === 'preparing' 
                ? 'bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20 shadow-lg shadow-amber-500/5' 
                : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60 hover:border-white/10'
            } border backdrop-blur-md`}
            onClick={() => setStatusFilter(statusFilter === 'preparing' ? 'all' : 'preparing')}
          >
            {statusFilter === 'preparing' && <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent" />}
            <p className="relative text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-amber-500/70 transition-colors">Pesanan Aktif</p>
            <div className="relative flex items-center justify-between mt-2">
              <span className={`text-xl font-black tracking-tighter ${statusFilter === 'preparing' ? 'text-amber-500' : 'text-zinc-100 group-hover:text-amber-500 transition-colors'}`}>{pendingOrders.length + preparingOrders.length + readyOrders.length}</span>
              <Utensils size={24} className={statusFilter === 'preparing' ? 'text-amber-500' : 'text-zinc-600 group-hover:text-amber-500/50 transition-colors'} strokeWidth={1.5} />
            </div>
          </button>

          <button 
            className={`group text-left p-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${
              statusFilter === 'completed' 
                ? 'bg-zinc-800 border-zinc-600 ring-1 ring-zinc-500 shadow-lg' 
                : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60 hover:border-white/10'
            } border backdrop-blur-md`}
            onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          >
            {statusFilter === 'completed' && <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />}
            <p className="relative text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-zinc-300 transition-colors">Selesai</p>
            <div className="relative flex items-center justify-between mt-2">
              <span className={`text-xl font-black tracking-tighter ${statusFilter === 'completed' ? 'text-zinc-300' : 'text-zinc-100 group-hover:text-zinc-300 transition-colors'}`}>{completedOrders.length}</span>
              <PackageCheck size={24} className={statusFilter === 'completed' ? 'text-zinc-400' : 'text-zinc-600 group-hover:text-zinc-400 transition-colors'} strokeWidth={1.5} />
            </div>
          </button>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0">
          <div className="relative flex-1 max-w-xl group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" size={18} />
            <input
              placeholder="Cari Order ID atau item..."
              className="w-full h-12 pl-12 pr-4 bg-zinc-900/50 border border-white/10 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner hover:bg-zinc-900/80"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1 bg-zinc-900/50 border border-white/5 rounded-xl p-1 shadow-inner h-12">
            <button 
              onClick={() => setActiveTab('kanban')}
              className={`px-6 h-full text-[13px] font-semibold rounded-lg transition-all duration-300 ${
                activeTab === 'kanban' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Board Mode
            </button>
            <button 
              onClick={() => setActiveTab('list')}
              className={`px-6 h-full text-[13px] font-semibold rounded-lg transition-all duration-300 ${
                activeTab === 'list' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              List Mode
            </button>
          </div>
        </div>

        {/* Antrian Masak Section */}
        {orders.filter(o => o.status === 'preparing').length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 shrink-0 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-primary">
              <ChefHat size={16} />
              <h3 className="font-bold text-sm">Antrian Masak (Sedang Disiapkan)</h3>
              <span className="text-xs text-primary/70 ml-2">— Klik pesanan untuk Edit (Belum Lunas) atau Selesai (Lunas)</span>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
              {orders.filter(o => o.status === 'preparing').map(order => (
                <button
                  key={`cook-${order.id}`}
                  onClick={() => {
                    if (order.method === 'Bayar Nanti') {
                      router.push(`/pos?edit=${order.id}`);
                    } else {
                      updateOrderStatus(order.id, 'completed');
                    }
                  }}
                  className={`snap-start shrink-0 bg-zinc-950 border ${order.method === 'Bayar Nanti' ? 'border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10' : 'border-primary/30 hover:border-primary hover:bg-primary/10'} cursor-pointer hover:-translate-y-0.5 rounded-xl p-3 flex flex-col min-w-[200px] max-w-[250px] text-left transition-all`}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="text-xs font-mono text-zinc-400">{order.id.startsWith('order_') ? order.id : `order_${order.id}`}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${order.method === 'Bayar Nanti' ? 'bg-amber-500/20 text-amber-500' : 'bg-primary/20 text-primary'}`}>
                      {order.method === 'Bayar Nanti' ? 'Belum Lunas' : 'Lunas'}
                    </span>
                  </div>
                  <span className="font-bold text-zinc-100 truncate w-full mb-1">
                    {order.customer_name || 'Tanpa Nama'}
                  </span>
                  <div className="text-xs text-zinc-400 mt-1 space-y-1">
                    {order.items.map((i, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="font-bold text-zinc-300">{i.qty}x</span>
                        <span className="line-clamp-1">{i.name}</span>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Content View */}
        {isLoadingData ? (
          <div className="py-20 text-center space-y-4">
            <RefreshCw size={28} className="animate-spin text-primary mx-auto" />
            <p className="text-sm text-zinc-500 font-medium">Sinkronisasi data pesanan...</p>
          </div>
        ) : activeTab === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            
            {/* Column 1: Pesanan Aktif (Preparing + Ready) */}
            <div className="flex flex-col bg-zinc-950/50 rounded-3xl p-5 lg:p-6 border border-white/5 shadow-2xl min-h-[500px]">
              <div className="flex items-center justify-between px-2 pb-5 mb-5 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-3 h-3">
                    <span className="absolute w-full h-full rounded-full bg-amber-500 animate-ping opacity-75" />
                    <span className="relative w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <h2 className="font-bold text-base text-zinc-200 tracking-wide">Pesanan Aktif</h2>
                </div>
                <span className="text-sm font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full">{pendingOrders.length + preparingOrders.length + readyOrders.length}</span>
              </div>

              <div className="space-y-4 pb-4">
                {pendingOrders.length === 0 && preparingOrders.length === 0 && readyOrders.length === 0 ? (
                  <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center text-zinc-500 text-sm font-medium">
                    Belum ada pesanan aktif
                  </div>
                ) : (
                  <>
                    {pendingOrders.map((order, idx) => renderOrderCard(order, idx + 1))}
                    {preparingOrders.map((order, idx) => renderOrderCard(order, pendingOrders.length + idx + 1))}
                    {readyOrders.map((order, idx) => renderOrderCard(order, pendingOrders.length + preparingOrders.length + idx + 1))}
                  </>
                )}
              </div>
            </div>

            {/* Column 2: Selesai */}
            <div className="flex flex-col bg-zinc-950/50 rounded-3xl p-5 lg:p-6 border border-white/5 shadow-2xl min-h-[500px]">
              <div className="flex items-center justify-between px-2 pb-5 mb-5 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                  <h2 className="font-bold text-base text-zinc-400 tracking-wide">Selesai</h2>
                </div>
                <span className="text-xs font-bold text-zinc-400 bg-zinc-800 border border-zinc-700 px-3 py-1 rounded-full">{completedOrders.length}</span>
              </div>

              <div className="space-y-4 pb-4">
                {completedOrders.length === 0 ? (
                  <div className="border border-dashed border-white/10 rounded-2xl p-10 text-center text-zinc-500 text-sm font-medium">
                    Belum ada pesanan selesai
                  </div>
                ) : (
                  completedOrders.slice(0, 15).map((order, idx) => renderOrderCard(order, completedOrders.length - idx))
                )}
              </div>
            </div>

          </div>
        ) : (
          /* List Mode View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-4">
            {filteredAllOrders.length === 0 ? (
              <div className="col-span-full border border-dashed border-white/10 rounded-2xl p-16 text-center text-zinc-500 text-sm font-medium">
                Tidak ada pesanan yang sesuai filter
              </div>
            ) : (
              filteredAllOrders.map((order, idx) => renderOrderCard(order, idx + 1))
            )}
          </div>
        )}

      </div>

      {/* Order Detail & Receipt Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => { setSelectedOrder(null); setIsEditingOrder(false); }}>
        {selectedOrder && (
          <DialogContent className="sm:max-w-[380px] md:max-w-[750px] lg:max-w-[850px] p-0 bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 print:border-none print:shadow-none print:bg-white print:rounded-none print:max-w-none print:w-full">
            <div className="relative flex flex-col md:flex-row max-h-[90vh]">
              {/* Top accent — hidden on print */}
              <div className={`absolute top-0 left-0 right-0 h-[2px] w-full bg-gradient-to-r print:hidden ${
                selectedOrder.status === 'preparing' ? 'from-transparent via-amber-500 to-transparent' :
                selectedOrder.status === 'ready' ? 'from-transparent via-emerald-500 to-transparent' :
                'from-transparent via-[#444] to-transparent'
              }`} />
              
              {/* Left Column: Details & Receipt */}
              <div className="flex-1 px-6 pt-6 pb-6 overflow-y-auto print:px-0 print:pt-0 print:pb-0 print:overflow-visible">
                {/* Header — hidden on print */}
                <div className="flex items-center justify-between mb-1 print:hidden">
                  <DialogHeader className="space-y-0 p-0">
                    <DialogTitle className="font-mono text-lg font-bold text-white">
                      {selectedOrder.id.startsWith('order_') ? selectedOrder.id : `order_${selectedOrder.id}`}
                    </DialogTitle>
                  </DialogHeader>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                    selectedOrder.status === 'preparing' ? 'bg-amber-500/10 text-amber-500' :
                    selectedOrder.status === 'ready' ? 'bg-emerald-500/10 text-emerald-500' :
                    selectedOrder.status === 'pending' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-[#222] text-[#888]'
                  }`}>
                    {selectedOrder.status === 'preparing' ? 'Antrean' : selectedOrder.status === 'ready' ? 'Siap' : selectedOrder.status === 'pending' ? 'Menunggu' : 'Selesai'}
                  </span>
                </div>
                <DialogDescription className="text-[11px] text-[#555] mt-0.5 print:hidden">
                  {selectedOrder.cashier_name} · {selectedOrder.date} · {selectedOrder.method}
                  {selectedOrder.customer_name && ` · Pelanggan: ${selectedOrder.customer_name}`}
                </DialogDescription>

                {/* Receipt — this is what gets printed */}
                <div id="print-receipt" className="mt-5 bg-[#0a0a0a] rounded-xl border border-[#222] overflow-hidden print:mt-0 print:bg-white print:border-none print:rounded-none">
                  <div className="px-4 py-3 border-b border-dashed border-[#222] text-center print:border-black print:py-4">
                    <p className="font-bold text-sm text-white tracking-wide print:text-black print:text-lg">SAMBA CAFE</p>
                    <p className="text-[10px] text-[#555] mt-0.5 print:text-black print:text-xs print:mt-1">Order Slip {selectedOrder.id.startsWith('order_') ? selectedOrder.id : `order_${selectedOrder.id}`}</p>
                    {selectedOrder.customer_name && (
                      <p className="text-[12px] font-bold text-white mt-1 print:text-black print:text-sm">
                        Pelanggan: {selectedOrder.customer_name}
                      </p>
                    )}
                    <p className="hidden print:block text-xs text-gray-600 mt-1">
                      {selectedOrder.date} · Kasir: {selectedOrder.cashier_name} · {selectedOrder.method}
                    </p>
                  </div>

                  <div className="px-4 py-3 space-y-2 print:py-4 print:space-y-3">
                    {(isEditingOrder ? editedItems : selectedOrder.items).map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between items-center text-[12px] print:text-sm gap-2">
                          {isEditingOrder ? (
                            <>
                              <span className={`flex-1 truncate ${item.qty === 0 ? 'text-zinc-600 line-through' : 'text-[#ccc]'}`}>{item.name}</span>
                              <div className="flex items-center gap-2 shrink-0 bg-zinc-900 rounded-lg p-1 border border-white/5">
                                <button 
                                  onClick={() => setEditedItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: Math.max(0, it.qty - 1) } : it))} 
                                  className="w-7 h-7 rounded-md bg-black text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center text-sm font-bold shadow-sm"
                                >
                                  −
                                </button>
                                <span className={`w-5 text-center font-bold text-xs ${item.qty === 0 ? 'text-zinc-600' : 'text-white'}`}>{item.qty}</span>
                                <button 
                                  onClick={() => setEditedItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: it.qty + 1 } : it))} 
                                  className="w-7 h-7 rounded-md bg-black text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center text-sm font-bold shadow-sm"
                                >
                                  +
                                </button>
                              </div>
                              <span className={`w-[60px] text-right font-mono text-[11px] ${item.qty === 0 ? 'text-zinc-600' : 'text-[#666]'}`}>
                                Rp {(item.price * item.qty).toLocaleString('id-ID')}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-[#ccc] print:text-black">{item.qty}× {item.name}</span>
                              <span className="text-[#666] font-mono print:text-black">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                            </>
                          )}
                        </div>
                        {item.notes && !isEditingOrder && (
                          <p className="text-[11px] text-amber-500/80 italic pl-4 mt-0.5 print:text-gray-600 print:text-xs print:not-italic print:pl-5">
                            Catatan: {item.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-3 border-t border-dashed border-[#222] flex justify-between items-center print:border-black print:py-4">
                    <span className="text-[11px] font-semibold text-[#888] uppercase tracking-wider print:text-black print:text-sm">Total</span>
                    <span className="font-bold text-primary print:text-black print:text-base">Rp {(isEditingOrder ? editedItems.filter(i => i.qty > 0).reduce((s, i) => s + i.price * i.qty, 0) : selectedOrder.total).toLocaleString('id-ID')}</span>
                  </div>

                  {/* Print-only footer */}
                  <div className="hidden print:block px-4 py-3 border-t border-dashed border-black text-center">
                    <p className="text-xs text-gray-500">Terima kasih atas kunjungan Anda!</p>
                    <p className="text-[10px] text-gray-400 mt-1">Dicetak: {new Date().toLocaleString('id-ID')}</p>
                  </div>
                </div>

                {/* Actions — hidden on print, MOVED to left column */}
                <div className="mt-6 print:hidden">
                  {isEditingOrder ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditingOrder(false)}
                        className="flex-1 h-11 text-[12px] font-medium text-[#888] bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        Batal
                      </button>
                      <button
                        onClick={saveEditedOrder}
                        disabled={updatingId === selectedOrder.id}
                        className="flex-1 h-11 text-[12px] font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                      >
                        {updatingId === selectedOrder.id ? 'Menyimpan...' : '✓ Simpan Perubahan'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Secondary Actions (Row) */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.print()}
                          className="flex-1 flex items-center justify-center gap-2 h-10 text-[11px] font-semibold text-zinc-300 bg-zinc-900 border border-white/10 hover:bg-zinc-800 rounded-xl transition-all"
                        >
                          <Printer size={14} /> Cetak Struk
                        </button>

                        {(selectedOrder.status === 'preparing' || selectedOrder.status === 'pending') && (
                          <>
                            <button
                              onClick={startEditOrder}
                              className="flex-1 flex items-center justify-center gap-2 h-10 text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 rounded-xl transition-all"
                            >
                              <FileEdit size={14} /> Edit
                            </button>
                            <button
                              onClick={handleDeleteOrder}
                              disabled={updatingId === selectedOrder.id}
                              className="flex-1 flex items-center justify-center gap-2 h-10 text-[11px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl transition-all"
                            >
                              <Trash2 size={14} /> Hapus
                            </button>
                          </>
                        )}
                      </div>

                      {/* Primary Actions */}
                      <div className="flex flex-col gap-2 mt-2">
                        {selectedOrder.method === 'Bayar Nanti' && (
                          <button
                            onClick={async () => {
                              setUpdatingId(selectedOrder.id);
                              await supabase.from('transactions').update({ method: 'Cash (Lunas)' }).eq('id', selectedOrder.id);
                              localUpdatesRef.current[selectedOrder.id] = Date.now();
                              fetchOrders(false);
                              setUpdatingId(null);
                              setSelectedOrder({...selectedOrder, method: 'Cash (Lunas)'});
                            }}
                            className="w-full h-12 text-[13px] font-bold text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                          >
                            <Banknote size={16} /> Tandai Lunas
                          </button>
                        )}

                        {selectedOrder.status === 'pending' && !selectedOrder.payment_proof_url && selectedOrder.method !== 'Bayar Nanti' && (
                          <button
                            onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')}
                            className="w-full h-12 text-[13px] font-extrabold text-black bg-gradient-to-r from-blue-500 to-blue-600 hover:brightness-110 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 border-none"
                          >
                            <CheckCircle2 size={16} strokeWidth={2.5} /> Terima Pesanan
                          </button>
                        )}

                            {selectedOrder.status === 'pending' && selectedOrder.payment_proof_url && (
                          <div className="pt-2 mt-2 border-t border-white/10 space-y-3">
                            {aiVerifications[selectedOrder.id]?.is_valid || selectedOrder.payment_status === 'PAID' ? (
                              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-400 text-xs flex items-start gap-2.5">
                                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                                <div>
                                  <p className="font-bold">AI Menandai: Bukti Pembayaran Valid ✅</p>
                                  <p className="text-[11px] text-zinc-300 mt-0.5">Nominal sesuai (Rp {selectedOrder.total.toLocaleString('id-ID')}). Silakan konfirmasi untuk memasukkan pesanan ke antrean dapur.</p>
                                </div>
                              </div>
                            ) : (aiVerifications[selectedOrder.id]?.is_valid === false || selectedOrder.payment_status === 'PAYMENT_REJECTED' || selectedOrder.payment_status === 'AI_INVALID') ? (
                              <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs flex items-start gap-2.5">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
                                <div className="space-y-1 w-full">
                                  <p className="font-bold text-red-300">AI Menolak Otomatis: Bukti Tidak Valid 🚫</p>
                                  {aiVerifications[selectedOrder.id]?.issues && aiVerifications[selectedOrder.id].issues!.length > 0 ? (
                                    <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside mt-1 leading-relaxed">
                                      {aiVerifications[selectedOrder.id].issues!.map((iss, idx) => (
                                        <li key={idx} className="text-red-200/90">{iss}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed">
                                      {aiVerifications[selectedOrder.id]?.reason && !aiVerifications[selectedOrder.id]?.reason.includes('12.000')
                                        ? aiVerifications[selectedOrder.id].reason
                                        : 'Bukti transfer ditolak (waktu pembayaran lewat dari batas 5 menit atau bukti duplikat). Pelanggan diminta upload ulang bukti yang benar.'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : analyzingOrderIds[selectedOrder.id] ? (
                              <div className="p-3 bg-blue-500/10 border border-blue-500/25 rounded-xl text-blue-400 text-xs flex items-start gap-2.5 animate-pulse">
                                <RefreshCw size={16} className="shrink-0 mt-0.5 animate-spin text-blue-400" />
                                <div>
                                  <p className="font-bold">AI sedang memeriksa bukti pembayaran...</p>
                                  <p className="text-[11px] text-zinc-300 mt-0.5">Sistem sedang menganalisis struk transfer di samping.</p>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-400 text-xs flex items-start gap-2.5">
                                <Scan size={16} className="shrink-0 mt-0.5 text-amber-400" />
                                <div>
                                  <p className="font-bold">Konfirmasi Pembayaran Kasir</p>
                                  <p className="text-[11px] text-zinc-300 mt-0.5">Periksa bukti pembayaran di samping lalu klik konfirmasi untuk menerima pesanan.</p>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                disabled={updatingId === selectedOrder.id}
                                onClick={() => confirmPaymentAndAcceptOrder(selectedOrder)}
                                className="flex-1 h-12 text-[13px] font-extrabold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                              >
                                <CheckCircle2 size={16} /> {updatingId === selectedOrder.id ? 'Memproses...' : 'Konfirmasi Pembayaran & Terima'}
                              </button>
                              
                              {/* Tombol Tolak hanya muncul jika belum ditolak AI dan belum ada hasil AI */}
                              {selectedOrder.payment_status !== 'PAYMENT_REJECTED' && selectedOrder.payment_status !== 'AI_INVALID' && !aiVerifications[selectedOrder.id] && !analyzingOrderIds[selectedOrder.id] && (
                                <button
                                  disabled={updatingId === selectedOrder.id}
                                  onClick={() => rejectPayment(selectedOrder)}
                                  className="h-12 px-4 text-[12px] font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/20 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-1.5"
                                >
                                  <X size={15} /> Tolak
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedOrder.status === 'preparing' && (
                          <div className="space-y-3">
                            {selectedOrder.order_source === 'CUSTOMER_QR' && selectedOrder.payment_proof_url && (
                              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                                <ShieldCheck size={16} className="shrink-0 mt-0.5 text-amber-400" />
                                <div>
                                  <p className="font-bold">Double Check Pembayaran Kasir</p>
                                  <p className="text-[11px] text-zinc-300 mt-0.5">Pesanan sudah selesai dimasak. Silakan periksa bukti transfer di samping lalu konfirmasi untuk menyerahkan pesanan.</p>
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                disabled={updatingId === selectedOrder.id}
                                onClick={async () => {
                                  await updateOrderStatus(selectedOrder.id, 'ready');
                                  setSelectedOrder(null);
                                }}
                                className="flex-1 h-12 text-[13px] font-extrabold text-black bg-gradient-to-r from-[#E3B24C] to-[#B98A2E] hover:brightness-110 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#B98A2E]/20 border-none"
                              >
                                <CheckCircle2 size={16} strokeWidth={2.5} /> {updatingId === selectedOrder.id ? 'Memproses...' : 'Bukti Valid & Selesai Dimasak (Done)'}
                              </button>
                              {selectedOrder.order_source === 'CUSTOMER_QR' && selectedOrder.payment_proof_url && (
                                <button
                                  disabled={updatingId === selectedOrder.id}
                                  onClick={async () => {
                                    await rejectPayment(selectedOrder);
                                  }}
                                  className="h-12 px-4 text-[12px] font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/20 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-1.5"
                                >
                                  <X size={15} /> Tolak Bukti
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedOrder.status === 'ready' && (
                          <button
                            disabled={selectedOrder.method === 'Bayar Nanti'}
                            onClick={() => {
                              if (selectedOrder.method === 'Bayar Nanti') {
                                alert("Tandai lunas terlebih dahulu sebelum menyelesaikan pesanan.");
                                return;
                              }
                              updateOrderStatus(selectedOrder.id, 'completed');
                            }}
                            className={`w-full h-12 text-[13px] font-bold text-white rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${
                              selectedOrder.method === 'Bayar Nanti'
                                ? 'bg-zinc-700 opacity-50 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                            }`}
                          >
                            <CheckCircle2 size={16} /> Pesanan Selesai
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: AI Verification & Proof (Only shown if proof exists) */}
              {selectedOrder.payment_proof_url && (() => {
                const isAnalyzing = !!analyzingOrderIds[selectedOrder.id];
                const rawAiResult = aiVerifications[selectedOrder.id];
                const aiErr = aiErrors[selectedOrder.id];

                const activeRaw = rawAiResult;

                // Fallback: If activeRaw is not yet loaded in React state, derive from order's status so it renders immediately
                const aiResult = activeRaw || (
                  selectedOrder.payment_status === 'PAID' ? {
                    is_valid: true,
                    detected_amount: selectedOrder.total,
                    amount_matches: true,
                    provider: selectedOrder.method || 'QRIS',
                    status_text: 'BERHASIL',
                    reason: 'Bukti transfer valid dan pembayaran telah terkonfirmasi.'
                  } : (selectedOrder.payment_status === 'PAYMENT_REJECTED' || selectedOrder.payment_status === 'AI_INVALID') ? {
                    is_valid: false,
                    detected_amount: null,
                    amount_matches: false,
                    provider: selectedOrder.method || 'QRIS',
                    status_text: 'DITOLAK',
                    reason: 'Bukti transfer tidak sesuai (melebihi batas waktu 5 menit atau duplikat).'
                  } : null
                );

                return (
                  <div ref={rightPanelRef} className="w-full md:w-[340px] lg:w-[440px] shrink-0 px-6 py-6 bg-[#0c0c0c] md:border-l border-white/5 print:hidden overflow-y-auto flex flex-col gap-4">
                    
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-400" /> Verifikasi AI Pembayaran
                      </h4>
                      {isAnalyzing && !aiResult ? (
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/20 font-bold flex items-center gap-1.5 animate-pulse">
                          <RefreshCw size={10} className="animate-spin" /> Menganalisis...
                        </span>
                      ) : aiResult ? (
                        aiResult.is_valid ? (
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold flex items-center gap-1 shadow-sm shadow-emerald-500/10">
                            <CheckCircle2 size={11} /> Bukti Valid
                          </span>
                        ) : (
                          <span className="text-[10px] bg-red-500/15 text-red-400 px-2.5 py-0.5 rounded-full border border-red-500/30 font-bold flex items-center gap-1 shadow-sm shadow-red-500/10">
                            <AlertTriangle size={11} /> Meragukan / Tidak Cocok
                          </span>
                        )
                      ) : aiErr ? (
                        <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold">
                          AI Sedang Sibuk
                        </span>
                      ) : null}
                    </div>

                    {/* Image Preview Box */}
                    <div className="relative w-full rounded-2xl border border-white/10 overflow-hidden bg-black flex flex-col group shadow-2xl">
                      <a href={selectedOrder.payment_proof_url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10 cursor-zoom-in" title="Klik untuk memperbesar gambar di tab baru" />
                      
                      <div className="w-full h-[240px] p-2 relative overflow-hidden flex items-center justify-center bg-zinc-950/80">
                        <img 
                          src={selectedOrder.payment_proof_url} 
                          alt="Bukti Pembayaran" 
                          className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" 
                        />
                        
                        {/* Laser Scan Animation Line when analyzing */}
                        {isAnalyzing && (
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_rgba(251,191,36,0.8)] animate-scan pointer-events-none" />
                        )}
                      </div>

                      <div className="px-3 py-2 bg-black/70 backdrop-blur border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400 z-20">
                        <span className="text-zinc-500">Klik untuk zoom foto</span>
                        <button 
                          type="button" 
                          onClick={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation(); 
                            verifyProofWithAi(selectedOrder, true); 
                          }}
                          disabled={isAnalyzing}
                          className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw size={11} className={isAnalyzing ? 'animate-spin' : ''} /> Pindai Ulang AI
                        </button>
                      </div>
                    </div>

                    {/* AI Analysis Breakdown Box */}
                    {isAnalyzing && !aiResult ? (
                      <div className="rounded-2xl border border-blue-500/20 bg-blue-950/15 p-4 space-y-2.5 animate-pulse">
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                          <RefreshCw size={14} className="animate-spin text-blue-400" />
                          <span>Gemini AI sedang membaca struk pembayaran...</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Menganalisis nominal transfer, status transaksi, nama bank/e-wallet, serta mendeteksi keaslian gambar.
                        </p>
                      </div>
                    ) : aiResult ? (
                      <div className={`rounded-2xl border p-4 space-y-3.5 transition-all ${
                        aiResult.is_valid 
                          ? 'border-emerald-500/30 bg-emerald-950/20 shadow-lg shadow-emerald-500/5' 
                          : 'border-red-500/30 bg-red-950/20 shadow-lg shadow-red-500/5'
                      }`}>
                        {/* Header Status */}
                        <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
                          <span className="text-xs font-bold text-zinc-300">Hasil Analisis AI:</span>
                          <span className={`text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                            aiResult.is_valid ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {aiResult.is_valid ? (
                              <><CheckCircle2 size={13} /> Status: Aman & Valid</>
                            ) : (
                              <><XCircle size={13} /> Status: Tidak Valid</>
                            )}
                          </span>
                        </div>

                        {/* Parameter Checklist / Poin Evaluasi */}
                        {aiResult.checklist && (
                          <div className="space-y-2 py-1">
                            <p className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">Poin Pemeriksaan Bukti:</p>
                            <div className="space-y-1.5 text-xs">
                              {/* 1. Nominal Check */}
                              <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-black/40 border border-white/5">
                                <div className="flex items-center gap-2">
                                  {aiResult.checklist.amount_check?.passed ? (
                                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                  ) : (
                                    <XCircle size={14} className="text-red-400 shrink-0" />
                                  )}
                                  <span className="text-zinc-300 font-medium">Nominal:</span>
                                </div>
                                <span className={`text-[11px] font-mono text-right font-bold ${
                                  aiResult.checklist.amount_check?.passed ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {aiResult.checklist.amount_check?.detail || (aiResult.detected_amount ? `Rp ${aiResult.detected_amount.toLocaleString('id-ID')}` : '-')}
                                </span>
                              </div>

                              {/* 2. 5-Minute Window Check */}
                              <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-black/40 border border-white/5">
                                <div className="flex items-center gap-2">
                                  {aiResult.checklist.time_check?.passed ? (
                                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                  ) : (
                                    <XCircle size={14} className="text-red-400 shrink-0" />
                                  )}
                                  <span className="text-zinc-300 font-medium">Batas Waktu (5 Mnt):</span>
                                </div>
                                <span className={`text-[11px] font-mono text-right font-bold ${
                                  aiResult.checklist.time_check?.passed ? 'text-emerald-400' : 'text-amber-400'
                                }`}>
                                  {aiResult.checklist.time_check?.detail || ([aiResult.transaction_date, aiResult.transaction_time].filter(Boolean).join(' ') || '-')}
                                </span>
                              </div>

                              {/* 3. Status Transaksi */}
                              <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-black/40 border border-white/5">
                                <div className="flex items-center gap-2">
                                  {aiResult.checklist.status_check?.passed ? (
                                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                  ) : (
                                    <XCircle size={14} className="text-red-400 shrink-0" />
                                  )}
                                  <span className="text-zinc-300 font-medium">Status Struk:</span>
                                </div>
                                <span className={`text-[11px] font-mono text-right font-bold ${
                                  aiResult.checklist.status_check?.passed ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {aiResult.checklist.status_check?.detail || aiResult.status_text || '-'}
                                </span>
                              </div>

                              {/* 4. Keaslian / Fraud Check */}
                              <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-black/40 border border-white/5">
                                <div className="flex items-center gap-2">
                                  {aiResult.checklist.fraud_check?.passed ? (
                                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                  ) : (
                                    <XCircle size={14} className="text-red-400 shrink-0" />
                                  )}
                                  <span className="text-zinc-300 font-medium">Keaslian Bukti:</span>
                                </div>
                                <span className={`text-[11px] font-mono text-right font-bold ${
                                  aiResult.checklist.fraud_check?.passed ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {aiResult.checklist.fraud_check?.detail || 'Bukan duplikat'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* List of issues if not valid */}
                        {!aiResult.is_valid && aiResult.issues && aiResult.issues.length > 0 ? (
                          <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl space-y-1.5">
                            <p className="text-[11px] font-extrabold text-red-300 flex items-center gap-1.5">
                              <AlertTriangle size={13} className="text-red-400" /> Penyebab Bukti Tidak Valid:
                            </p>
                            <ul className="text-[11px] text-red-200/90 space-y-1 list-disc list-inside leading-relaxed font-sans">
                              {aiResult.issues.map((iss, idx) => (
                                <li key={idx}>{iss}</li>
                              ))}
                            </ul>
                          </div>
                        ) : !aiResult.is_valid ? (
                          <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl">
                            <p className="text-[11px] text-red-200/90 leading-relaxed font-sans">
                              {aiResult.reason && !aiResult.reason.includes('12.000')
                                ? aiResult.reason
                                : 'Bukti transfer tidak valid (melebihi batas waktu pembayaran 5 menit atau bukti duplikat).'}
                            </p>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-300 text-[11px]">
                            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                            <span>Semua parameter valid. Pembayaran aman dan terkonfirmasi.</span>
                          </div>
                        )}
                      </div>
                    ) : aiErr ? (
                      <div className="rounded-2xl border border-amber-500/25 bg-amber-950/20 p-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-amber-400 font-bold">
                          <span className="flex items-center gap-1.5"><AlertTriangle size={14} /> AI Belum Merespons</span>
                          <button 
                            onClick={() => verifyProofWithAi(selectedOrder, true)} 
                            className="underline hover:text-amber-300 text-[11px]"
                          >
                            Coba Lagi
                          </button>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          {aiErr}. Kasir dapat memverifikasi foto bukti secara visual atau menekan &apos;Pindai Ulang AI&apos;.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-4 space-y-2 text-xs text-zinc-400">
                        <p>Memuat verifikasi AI...</p>
                      </div>
                    )}

                    <div className="text-[10px] text-zinc-500 leading-tight border-t border-white/5 pt-2">
                      💡 Kasir bertanggung jawab melakukan verifikasi akhir. Jika data cocok, tekan tombol konfirmasi di panel sebelah kiri.
                    </div>

                  </div>
                );
              })()}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-md rounded-2xl z-[200]">
          <DialogHeader>
            <DialogTitle className="text-xl text-red-500 flex items-center gap-2">
              <Trash2 size={24} /> Hapus Pesanan
            </DialogTitle>
            <DialogDescription className="text-zinc-400 mt-2">
              Apakah Anda yakin ingin menghapus pesanan <span className="text-zinc-100 font-bold">{selectedOrder?.id?.startsWith('order_') ? selectedOrder.id : `order_${selectedOrder?.id}`}</span> secara permanen?
              <br/><br/>
              <span className="text-emerald-500 font-medium">Perhatian:</span> Stok bahan yang sudah terpotong akan dikembalikan secara otomatis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 mt-2 border-t border-white/5 gap-2 sm:gap-0">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl text-zinc-300" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
            <Button 
              className="bg-red-500 text-white hover:bg-red-600 rounded-xl shadow-lg shadow-red-500/20"
              onClick={confirmDeleteOrder}
              disabled={updatingId === selectedOrder?.id}
            >
              {updatingId === selectedOrder?.id ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
