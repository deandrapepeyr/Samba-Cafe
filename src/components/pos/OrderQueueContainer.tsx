"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";
import { OrderQueueHeader, type OrderStatus, type QueueOrder } from "./OrderQueueHeader";

export type OrderQueueContainerProps = {
  className?: string;
  onAdvanceOrder?: (order: QueueOrder) => Promise<void> | void;
  orders?: QueueOrder[];
};

const NEXT_STATUS: Record<OrderStatus, OrderStatus | "selesai"> = {
  baru: "diproses",
  diproses: "siap",
  siap: "selesai",
};

const POLL_MS = 5000;

export function OrderQueueContainer({ className, onAdvanceOrder, orders: propsOrders }: OrderQueueContainerProps) {
  const [orders, setOrders] = React.useState<QueueOrder[]>([]);
  const busy = React.useRef(false); // jangan timpa data optimistik saat mutasi berjalan

  const loadFromSupabase = React.useCallback(async () => {
    if (busy.current) return;
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .in("status", ["pending", "preparing", "ready"])
        .order("created_at", { ascending: true });

      if (error || !data) return;

      const txIds = data.map((t: any) => t.id);
      let itemsData: any[] = [];
      if (txIds.length > 0) {
        const { data: itData } = await supabase
          .from("transaction_items")
          .select("*")
          .in("transaction_id", txIds);
        if (itData) itemsData = itData;
      }

      const mapped: QueueOrder[] = data.map((tx: any, idx: number) => {
        let s: OrderStatus = "diproses";
        if (tx.status === "pending") s = "baru";
        else if (tx.status === "ready") s = "siap";
        else s = "diproses";

        // Ambil nomor antrean dari id misal order_261012_0001 -> 1
        const suffix = tx.id.startsWith("order_") ? tx.id.split("_").pop() : "";
        const parsedNum = suffix ? parseInt(suffix, 10) : NaN;
        const orderNum = !isNaN(parsedNum) ? parsedNum : idx + 1;

        const orderItems = itemsData
          .filter((i: any) => i.transaction_id === tx.id)
          .map((i: any) => ({ name: i.product_name, qty: i.quantity }));

        return {
          id: tx.id,
          number: orderNum,
          code: tx.customer_name ? `${tx.customer_name} (${tx.id})` : tx.id,
          createdAt: tx.created_at,
          payment: tx.method || "Cash",
          status: s,
          items: orderItems,
        };
      });

      setOrders(mapped);
    } catch {
      /* offline / error: biarkan data terakhir tetap tampil */
    }
  }, []);

  React.useEffect(() => {
    if (propsOrders) {
      setOrders(propsOrders);
      return;
    }

    loadFromSupabase();

    const channelId = `order_queue_hdr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const channel = supabase
      .channel(channelId)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        loadFromSupabase();
      })
      .subscribe();

    const timer = setInterval(loadFromSupabase, POLL_MS);
    const onFocus = () => loadFromSupabase();
    window.addEventListener("focus", onFocus);
    window.addEventListener("samba-order-status-updated", onFocus);
    window.addEventListener("samba-refresh-active-orders", onFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("samba-order-status-updated", onFocus);
      window.removeEventListener("samba-refresh-active-orders", onFocus);
    };
  }, [loadFromSupabase, propsOrders]);

  async function advance(order: QueueOrder) {
    if (onAdvanceOrder) {
      await onAdvanceOrder(order);
      return;
    }

    const next = NEXT_STATUS[order.status];
    busy.current = true;

    // 1) Update tampilan dulu (optimistik) supaya terasa instan
    setOrders((cur) =>
      next === "selesai"
        ? cur.filter((o) => o.id !== order.id)
        : cur.map((o) => (o.id === order.id ? { ...o, status: next } : o)),
    );

    // 2) Simpan ke database Supabase
    try {
      let nextDbStatus: string = "preparing";
      if (next === "diproses") nextDbStatus = "preparing";
      else if (next === "siap") nextDbStatus = "ready";
      else if (next === "selesai") nextDbStatus = `completed|${new Date().toISOString()}`;

      const { error } = await supabase
        .from("transactions")
        .update({ status: nextDbStatus })
        .eq("id", order.id);

      if (error) throw error;

      // Beritahu bagian lain di POS jika ada yang mendengarkan event
      window.dispatchEvent(
        new CustomEvent("samba-order-status-updated", {
          detail: { id: order.id, status: nextDbStatus },
        }),
      );
      window.dispatchEvent(new Event("samba-refresh-active-orders"));
    } catch (err) {
      busy.current = false;
      await loadFromSupabase();
      throw err;
    } finally {
      busy.current = false;
    }
  }

  return <OrderQueueHeader orders={orders} onAdvance={advance} className={className} />;
}
