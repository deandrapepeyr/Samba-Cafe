'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface KitchenOrderItem {
  product_name: string;
  price: number;
  quantity: number;
  notes?: string | null;
  is_quick?: boolean;
}

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  status: 'baru' | 'diproses' | 'siap';
  method: string;
  total: number;
  paymentStatus: string | null;
  itemsSummary: string;
  itemsCount: number;
  items: KitchenOrderItem[];
}

const POLL_INTERVAL = 3000;
const CACHE_KEY = 'samba_kitchen_queue_cache';

export function useKitchenQueue() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const busyRef = useRef(false);

  // Instantly hydrate from local cache on mount to eliminate delays
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrders(parsed);
        }
      }
    } catch (e) {}
  }, []);

  const fetchOrders = useCallback(async () => {
    if (busyRef.current) return;
    try {
      const { data: txs, error: txError } = await supabase
        .from('transactions')
        .select('id, customer_name, created_at, status, order_source, method, total, payment_status')
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: true });

      if (txError) {
        console.warn('Failed to fetch kitchen orders:', txError);
        return;
      }
      if (!txs) return;

      const activeTxs = txs.filter((tx: any) => {
        // Abaikan pesanan Customer QR yang pending sebelum divalidasi kasir
        if (tx.order_source === 'CUSTOMER_QR' && tx.status === 'pending') {
          return false;
        }
        return true;
      });

      const txIds = activeTxs.map((t: any) => t.id);
      let itemsMap = new Map<string, KitchenOrderItem[]>();

      if (txIds.length > 0) {
        const [itemsRes, prodsRes] = await Promise.all([
          supabase
            .from('transaction_items')
            .select('transaction_id, product_name, price, quantity, notes')
            .in('transaction_id', txIds),
          supabase
            .from('products')
            .select('name, is_quick')
        ]);

        const items = itemsRes.data;
        const quickMap = new Map<string, boolean>();
        if (prodsRes.data) {
          prodsRes.data.forEach((p: any) => {
            if (p.name) quickMap.set(p.name.trim().toLowerCase(), Boolean(p.is_quick));
          });
        }

        if (items) {
          items.forEach((it: any) => {
            const list = itemsMap.get(it.transaction_id) || [];
            const isQuick = quickMap.get(it.product_name?.trim().toLowerCase()) ?? false;
            list.push({
              product_name: it.product_name,
              price: Number(it.price) || 0,
              quantity: Number(it.quantity) || 1,
              notes: it.notes || null,
              is_quick: isQuick,
            });
            itemsMap.set(it.transaction_id, list);
          });
        }
      }

      const mapped: KitchenOrder[] = activeTxs.map((tx: any, idx: number) => {
        let s: 'baru' | 'diproses' | 'siap' = 'diproses';
        if (tx.status === 'pending') s = 'baru';
        else if (tx.status === 'ready') s = 'siap';
        else s = 'diproses';

        // Format nomor antrean misal order_261019_0003 -> "003"
        const suffix = tx.id.startsWith('order_') ? tx.id.split('_').pop() : '';
        const parsedNum = suffix ? parseInt(suffix, 10) : NaN;
        const numVal = !isNaN(parsedNum) ? parsedNum : idx + 1;
        const formattedNum = String(numVal).padStart(3, '0');

        // Customer name
        let name = tx.customer_name?.trim();
        if (!name) {
          name = `Pelanggan ${numVal}`;
        }

        const items = itemsMap.get(tx.id) || [];
        const cookedItems = items.filter(i => !i.is_quick);
        const displayItems = cookedItems.length > 0 ? cookedItems : items;
        const itemsSummary = displayItems.length > 0
          ? displayItems.map(i => `${i.quantity}× ${i.product_name}`).join(' · ')
          : '1× Pesanan';

        const totalItemsCount = items.reduce((acc, i) => acc + (i.quantity || 1), 0);

        return {
          id: tx.id,
          orderNumber: formattedNum,
          customerName: name,
          createdAt: tx.created_at,
          status: s,
          method: tx.method || 'Cash',
          total: Number(tx.total) || 0,
          paymentStatus: tx.payment_status || null,
          itemsSummary,
          itemsCount: totalItemsCount,
          items,
        };
      });

      setOrders(mapped);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
      } catch (e) {}
    } catch (e) {
      // offline fallback
    }
  }, []);

  const advanceOrder = useCallback(async (order: KitchenOrder) => {
    busyRef.current = true;
    const nextStatus = order.status === 'siap' ? 'selesai' : 'siap';

    // Optimistic UI update
    setOrders(prev => {
      const updated = nextStatus === 'selesai'
        ? prev.filter(o => o.id !== order.id)
        : prev.map(o => (o.id === order.id ? { ...o, status: 'siap' as const } : o));
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      const nextDbStatus = nextStatus === 'siap'
        ? 'ready'
        : `completed|${new Date().toISOString()}`;

      const { error } = await supabase
        .from('transactions')
        .update({ status: nextDbStatus })
        .eq('id', order.id);

      if (error) throw error;

      window.dispatchEvent(
        new CustomEvent('samba-order-status-updated', {
          detail: { id: order.id, status: nextDbStatus },
        })
      );
      window.dispatchEvent(new Event('samba-refresh-active-orders'));
    } catch (err) {
      busyRef.current = false;
      await fetchOrders();
      throw err;
    } finally {
      busyRef.current = false;
    }
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();

    const channelId = `kitchen_queue_sub_${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchOrders();
      })
      .subscribe();

    const timer = setInterval(fetchOrders, POLL_INTERVAL);
    const onTrigger = () => fetchOrders();
    window.addEventListener('focus', onTrigger);
    window.addEventListener('samba-order-status-updated', onTrigger);
    window.addEventListener('samba-refresh-active-orders', onTrigger);
    window.addEventListener('samba-pos-cart-sync', onTrigger);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
      window.removeEventListener('focus', onTrigger);
      window.removeEventListener('samba-order-status-updated', onTrigger);
      window.removeEventListener('samba-refresh-active-orders', onTrigger);
      window.removeEventListener('samba-pos-cart-sync', onTrigger);
    };
  }, [fetchOrders]);

  return {
    orders,
    advanceOrder,
    refreshOrders: fetchOrders,
  };
}
