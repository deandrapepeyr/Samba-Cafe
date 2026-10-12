"use client";

import * as React from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/* ---------- Tipe ---------- */
export type OrderStatus = "baru" | "diproses" | "siap";

export type QueueOrder = {
  id: string;
  number: number;      // nomor antrean: 1, 2, 3
  code: string;        // "order_261012_0001"
  createdAt: string;   // ISO dari SERVER
  payment: string;     // "QRIS" | "Cash" | "Bayar Nanti"
  status: OrderStatus;
  items: { name: string; qty: number }[];
};

/* ---------- Konfigurasi ---------- */
const SLA_MS = 10 * 60 * 1000;      // target 10 menit
const WARN_MIN = 5;                 // < 5 mnt hijau, 5-10 kuning/amber, > 10 merah
const DENSE_AFTER = 6;              // lebih dari ini, chip hanya cincin
const COLOR = { ok: "#34d399", warn: "#f59e0b", late: "#f87171" } as const;

const ACTION: Record<OrderStatus, string> = {
  baru: "Mulai buat",
  diproses: "Tandai siap",
  siap: "Selesaikan",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  baru: "Baru masuk",
  diproses: "Sedang dibuat",
  siap: "Siap diantar",
};

/* ---------- Helper ---------- */
function urgency(elapsedMs: number): keyof typeof COLOR {
  const m = elapsedMs / 60000;
  return m < WARN_MIN ? "ok" : m < SLA_MS / 60000 ? "warn" : "late";
}

function clock(elapsedMs: number) {
  const s = Math.max(0, Math.floor(elapsedMs / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Satu ticker untuk semua timer. null di render pertama supaya tidak hydration mismatch. */
function useNow(intervalMs = 1000) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* ---------- Cincin progres ---------- */
function Ring({ n, progress, color, size = 36 }: { n: number; progress: number; color: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${Math.min(1, progress) * 100}%, rgba(255,255,255,.09) 0)`,
      }}
    >
      <b
        className="grid place-items-center rounded-full bg-[#15130f] font-extrabold text-white"
        style={{ width: size - 7, height: size - 7, fontSize: size * 0.36 }}
      >
        {n}
      </b>
    </span>
  );
}

/* ---------- Komponen utama ---------- */
type Props = {
  orders: QueueOrder[];
  /** Dipanggil saat tombol aksi ditekan. */
  onAdvance: (order: QueueOrder) => Promise<void> | void;
  className?: string;
};

export function OrderQueueHeader({ orders, onAdvance, className }: Props) {
  const now = useNow();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  // Urut terlama dulu. Urutan TIDAK berubah saat status berganti.
  const sorted = React.useMemo(
    () => [...orders].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [orders],
  );
  const current = sorted.find((o) => o.id === selectedId) ?? null;
  const dense = sorted.length > DENSE_AFTER;

  const elapsed = (o: QueueOrder) => (now === null ? 0 : now - +new Date(o.createdAt));

  async function handleAdvance(o: QueueOrder) {
    if (pendingId) return; // cegah klik ganda
    let nextId: string | null = selectedId;
    if (o.status === "siap") {
      const i = sorted.findIndex((x) => x.id === o.id);
      nextId = sorted[i + 1]?.id ?? sorted[i - 1]?.id ?? null;
    }
    setPendingId(o.id);
    try {
      await onAdvance(o);
      setSelectedId(nextId);
    } finally {
      setPendingId(null);
    }
  }

  if (sorted.length === 0) {
    return (
      <div className={cn("hidden sm:flex items-center whitespace-nowrap px-3 py-1.5 rounded-xl border border-white/5 bg-zinc-900/30 text-xs text-white/40", className)}>
        Antrean kosong
      </div>
    );
  }

  return (
    <Popover open={!!current} onOpenChange={(o) => !o && setSelectedId(null)}>
      <PopoverAnchor asChild>
        <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
          <div className="hidden lg:flex shrink-0 flex-col leading-tight pr-1">
            <b className="text-[13px] text-zinc-100">Antrean</b>
            <small className="text-[11px] text-zinc-400 font-medium">{sorted.length} pesanan</small>
          </div>

          <div className="flex gap-2 overflow-x-auto p-0.5 [scrollbar-width:none]" role="list">
            {sorted.map((o) => {
              const el = elapsed(o);
              const u = urgency(el);
              const color = COLOR[u];
              const selected = o.id === selectedId;
              const isNew = now !== null && now - +new Date(o.createdAt) < 5000;
              return (
                <button
                  key={o.id}
                  role="listitem"
                  type="button"
                  data-queue-chip
                  aria-expanded={selected}
                  aria-label={`Pesanan ${o.number}, menunggu ${Math.floor(el / 60000)} menit, ${STATUS_LABEL[o.status]}`}
                  onClick={() => setSelectedId(selected ? null : o.id)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2 rounded-2xl border bg-[#14120e] pl-1 transition active:scale-[.97] cursor-pointer shadow-sm",
                    dense ? "pr-1" : "pr-3",
                    selected ? "" : "border-white/10 hover:border-amber-400/40",
                    isNew && "animate-in fade-in zoom-in-75 duration-300",
                  )}
                  style={{
                    ...(selected && { borderColor: color, background: `color-mix(in srgb, ${color} 11%, #14120e)` }),
                    ...(u === "late" && { boxShadow: `0 0 16px color-mix(in srgb, ${color} 25%, transparent)` }),
                  }}
                >
                  <Ring n={o.number} progress={el / SLA_MS} color={color} />
                  {!dense && (
                    <span className="text-sm font-extrabold tabular-nums tracking-wide" style={{ color }}>
                      {now === null ? "--:--" : clock(el)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-[min(420px,calc(100vw-24px))] rounded-3xl border-white/10 bg-[#1a160f]/95 p-3.5 text-[#f3efe6] shadow-2xl backdrop-blur-2xl z-50"
        onInteractOutside={(e) => {
          if ((e.target as HTMLElement).closest("[data-queue-chip]")) e.preventDefault();
        }}
      >
        {current && (
          <Detail 
            order={current} 
            allOrders={sorted}
            elapsed={elapsed(current)} 
            pending={pendingId === current.id} 
            onSelectOrder={(id) => setSelectedId(id)}
            onAdvance={() => handleAdvance(current)} 
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Kartu detail di dalam popover ---------- */
function Detail({ 
  order, 
  allOrders,
  elapsed, 
  pending, 
  onSelectOrder,
  onAdvance 
}: { 
  order: QueueOrder; 
  allOrders: QueueOrder[];
  elapsed: number; 
  pending: boolean; 
  onSelectOrder: (id: string) => void;
  onAdvance: () => void; 
}) {
  const color = COLOR[urgency(elapsed)];
  const time = new Date(order.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const done = order.status === "siap";

  return (
    <div className="relative grid gap-3.5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1d1a14] to-[#15130f] p-4 shadow-xl">
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} />

      {/* Mini Chips Selector Bar inside Popover for fast switching */}
      {allOrders.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1.5 border-b border-white/5 [scrollbar-width:none]">
          {allOrders.map((o) => {
            const el = Date.now() - +new Date(o.createdAt);
            const u = urgency(el);
            const col = COLOR[u];
            const isSel = o.id === order.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelectOrder(o.id)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-xl border bg-[#14120e] px-2 text-xs transition cursor-pointer",
                  isSel ? "border-amber-400 font-bold" : "border-white/10 opacity-70 hover:opacity-100"
                )}
                style={isSel ? { borderColor: col, background: `color-mix(in srgb, ${col} 15%, #14120e)` } : {}}
              >
                <Ring n={o.number} progress={el / SLA_MS} color={col} size={22} />
                <span style={{ color: col }} className="font-extrabold tabular-nums">{clock(el)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Header card info */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-4xl font-extrabold leading-none tracking-tight text-white">#{order.number}</div>
          <div className="mt-1.5 text-xs text-white/50 font-mono truncate max-w-[200px]">{order.code}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold leading-none tabular-nums" style={{ color }}>{clock(elapsed)}</div>
          <small className="mt-1.5 block text-[11.5px] text-white/45">target {SLA_MS / 60000} mnt</small>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-[5px] overflow-hidden rounded-full bg-white/10">
        <i className="block h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (elapsed / SLA_MS) * 100)}%`, background: color }} />
      </div>

      {/* Items List */}
      <ul className="grid gap-2 text-[14px] font-medium max-h-[140px] overflow-y-auto scrollbar-thin pr-1">
        {order.items.map((it, i) => (
          <li key={i} className="flex gap-2.5 items-baseline">
            <span className="w-6 shrink-0 font-bold text-[#e8b84b]">{it.qty}×</span>
            <span className="text-zinc-200">{it.name}</span>
          </li>
        ))}
      </ul>

      {/* Status info */}
      <p className="text-xs text-white/60 pt-1 border-t border-white/5">
        {STATUS_LABEL[order.status]} · {order.payment} · masuk {time}
      </p>

      {/* Action button */}
      <button
        type="button"
        disabled={pending}
        onClick={onAdvance}
        className={cn(
          "h-11 rounded-xl text-[15px] font-extrabold transition hover:brightness-110 active:scale-[.98] disabled:opacity-60 cursor-pointer shadow-lg",
          done 
            ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20" 
            : "bg-[#e8b84b] hover:bg-amber-400 text-[#2a1d00] shadow-amber-500/20",
        )}
      >
        {pending ? "Menyimpan..." : (order.payment === 'Bayar Nanti' && done ? "Lunasi & Selesaikan" : ACTION[order.status])}
      </button>
    </div>
  );
}
