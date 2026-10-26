'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Flame, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import type { KitchenOrder, KitchenOrderItem } from '@/hooks/useKitchenQueue';
import type { Product } from '@/types/pos';

interface KitchenQueueStripProps {
  orders: KitchenOrder[];
  products?: Product[];
  onAdvance?: (order: KitchenOrder) => Promise<void> | void;
  onEditOrder?: (order: KitchenOrder) => void;
  onSelectOrder?: (order: KitchenOrder) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

const SLA_MS = 10 * 60 * 1000; // 10 minutes target SLA

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return now;
}

export function KitchenQueueStrip({
  orders,
  products = [],
  onAdvance,
  onEditOrder,
  onSelectOrder,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  className = '',
}: KitchenQueueStripProps) {
  const now = useNow();
  const queueRef = useRef<HTMLDivElement>(null);
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const handleQueueWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && queueRef.current) {
      queueRef.current.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('samba_kitchen_strip_collapsed');
      if (saved === 'true') {
        setInternalCollapsed(true);
      }
    } catch (e) {}
  }, []);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(prev => {
        const next = !prev;
        try {
          localStorage.setItem('samba_kitchen_strip_collapsed', String(next));
        } catch (e) {}
        return next;
      });
    }
  };

  if (!orders || orders.length === 0) {
    return null;
  }

  // Jika sedang di-minimize/collapse: bar mini tipis
  if (isCollapsed) {
    return (
      <div
        className={`px-4 md:px-6 py-1.5 border-b border-white/5 bg-[#0e0c0a]/90 hover:bg-zinc-900/80 transition-colors flex items-center justify-between select-none shrink-0 ${className}`}
      >
        <div
          onClick={toggleCollapse}
          role="button"
          tabIndex={0}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse" />
          <span className="text-xs font-bold text-amber-400 font-mono tracking-wide">
            Antrean Dapur: {orders.length} pesanan aktif
          </span>
          <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
            (Klik untuk tampilkan)
          </span>
        </div>

        <button
          type="button"
          onClick={toggleCollapse}
          className="text-zinc-500 hover:text-zinc-300 cursor-pointer p-1"
        >
          <ChevronDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className={`px-4 md:px-6 py-2 border-b border-white/5 bg-[#0e0c0a]/80 shrink-0 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        {/* Pills Row (Horizontal Scroll) */}
        <div
          ref={queueRef}
          onWheel={handleQueueWheel}
          className="flex items-center gap-2.5 overflow-x-auto scrollbar-none py-0.5 flex-1 min-w-0"
          role="list"
        >
          {orders.map((order, idx) => {
            const createdAtMs = new Date(order.createdAt).getTime();
            const elapsedMs = Math.max(0, now - createdAtMs);
            const totalSec = Math.floor(elapsedMs / 1000);
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            const timerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

            // Urgency: < 5m (ok/green), 5-10m (warn/amber), >= 10m (late/red)
            let colorHex = '#34d399';
            let isLate = false;
            let isWarn = false;

            if (m >= 10) {
              colorHex = '#f87171';
              isLate = true;
            } else if (m >= 5) {
              colorHex = '#f59e0b';
              isWarn = true;
            }

            const progressPercent = Math.min(100, Math.floor((elapsedMs / SLA_MS) * 100));

            // Summary text: first cooked item or customer name
            const firstItemName = order.items && order.items.length > 0 ? order.items[0].product_name : 'Pesanan';
            const extraCount = order.items && order.items.length > 1 ? ` +${order.items.length - 1}` : '';
            const titleText = order.customerName || `${firstItemName}${extraCount}`;

            return (
              <button
                key={order.id}
                type="button"
                role="listitem"
                onClick={() => onSelectOrder?.(order)}
                className={`group shrink-0 flex items-center gap-2.5 pl-1.5 pr-3.5 py-1 rounded-full transition-all cursor-pointer select-none text-left ${
                  isLate
                    ? 'bg-red-500/10 border border-red-500/50 hover:border-red-400 hover:bg-red-500/15'
                    : isWarn
                    ? 'bg-amber-500/10 border border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/15'
                    : 'bg-zinc-900/90 border border-white/10 hover:border-emerald-500/40 hover:bg-zinc-850'
                }`}
                style={{
                  boxShadow: isLate ? '0 0 10px rgba(248, 113, 113, 0.2)' : undefined,
                }}
                title={`Order #${order.orderNumber} - ${order.customerName || firstItemName} (${m} menit) - Klik untuk aksi`}
              >
                {/* Circular Progress Ring with Order Number */}
                <span
                  className="relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                  style={{
                    background: `conic-gradient(${colorHex} ${progressPercent}%, rgba(255, 255, 255, 0.08) 0)`,
                  }}
                >
                  <b className="w-7 h-7 rounded-full bg-zinc-950 flex items-center justify-center text-[11px] font-black text-white">
                    {order.orderNumber || idx + 1}
                  </b>
                </span>

                {/* Text: Name / First Item & Realtime Highlighted Timer */}
                <span className="flex flex-col min-w-0">
                  <span className="text-[12.5px] font-semibold text-zinc-100 max-w-[130px] sm:max-w-[160px] truncate leading-tight group-hover:text-amber-300 transition-colors">
                    {titleText}
                  </span>
                  <span
                    className="text-[11.5px] font-mono font-bold tracking-tight leading-tight mt-0.5 tabular-nums"
                    style={{ color: colorHex }}
                  >
                    {timerText}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleCollapse}
            title="Sembunyikan antrean"
            className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ChevronUp size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
