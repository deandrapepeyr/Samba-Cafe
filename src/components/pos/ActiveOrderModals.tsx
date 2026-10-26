'use client';

import React from 'react';
import { Plus, Check, CheckCircle2, Banknote, QrCode, Clock, Flame, X, ShoppingBag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Product } from '@/types/pos';

interface ActiveOrderModalsProps {
  selectedActiveOrder: any;
  setSelectedActiveOrder: (order: any) => void;
  loadOrderForEdit: (order: any) => void;
  products: Product[];
  checkedItems: Record<number, boolean>;
  toggleCheckItem: (index: number) => void;
  paymentModalOrder: any;
  setPaymentModalOrder: (order: any) => void;
  confirmCompleteOrder: any;
  setConfirmCompleteOrder: (order: any) => void;
  updateOrderStatus: (orderId: string, status: string, method?: string) => void;
}

export function ActiveOrderModals({
  selectedActiveOrder,
  setSelectedActiveOrder,
  loadOrderForEdit,
  products,
  checkedItems,
  toggleCheckItem,
  paymentModalOrder,
  setPaymentModalOrder,
  confirmCompleteOrder,
  setConfirmCompleteOrder,
  updateOrderStatus,
}: ActiveOrderModalsProps) {
  const isBayarNanti = selectedActiveOrder?.method === 'Bayar Nanti';
  const orderNumber = selectedActiveOrder?.id?.startsWith('order_')
    ? selectedActiveOrder.id.split('_').pop()
    : selectedActiveOrder?.id;

  const items = selectedActiveOrder?.items || [];
  const totalQty = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
  const totalAmount = selectedActiveOrder?.total || 
    items.reduce((sum: number, it: any) => sum + ((Number(it.price) || 0) * (Number(it.quantity) || 1)), 0);

  const orderTimeStr = selectedActiveOrder?.created_at
    ? new Date(selectedActiveOrder.created_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const elapsedMins = selectedActiveOrder?.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(selectedActiveOrder.created_at).getTime()) / 60000))
    : 0;

  const formatWaitTime = (mins: number) => {
    if (mins <= 0) return 'Baru saja';
    if (mins < 60) return `${mins} menit`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}j ${remMins}m` : `${hours} jam`;
  };

  return (
    <>
      {/* Active Order Details Dialog (Modern Minimalist Luxury Cafe Ticket) */}
      <Dialog open={!!selectedActiveOrder} onOpenChange={(open) => { if (!open) setSelectedActiveOrder(null); }}>
        <DialogContent 
          showCloseButton={false}
          className="bg-[#121214]/95 border border-white/10 text-zinc-100 sm:max-w-lg w-[95vw] rounded-3xl p-6 shadow-2xl backdrop-blur-2xl overflow-hidden font-sans"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Detail Pesanan #{orderNumber}</DialogTitle>
            <DialogDescription>Rincian pesanan dan status pembayaran</DialogDescription>
          </DialogHeader>

          {selectedActiveOrder && (
            <div className="space-y-4">
              {/* Header: Antrean ID + Dipesan Time + Actions */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <span className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 font-bold text-xs tracking-wider shrink-0 tabular-nums">
                    Antrean #{orderNumber}
                  </span>
                  {orderTimeStr && (
                    <span className="text-xs text-zinc-400 font-medium flex items-center gap-1.5 shrink-0">
                      <Clock size={13} className="text-zinc-500" />
                      <span>{orderTimeStr} WIB</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      loadOrderForEdit(selectedActiveOrder);
                      setSelectedActiveOrder(null);
                    }}
                    className="h-8 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    title="Tambah menu ke pesanan ini"
                  >
                    <Plus size={14} className="stroke-[2.5]" />
                    <span>Tambah Menu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedActiveOrder(null)}
                    className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                    title="Tutup"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Customer Name & Status Badges */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                  {selectedActiveOrder.customer_name || `Pelanggan #${orderNumber}`}
                </h2>

                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {/* Payment Status Pill */}
                  {isBayarNanti ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
                      <Clock size={12} className="shrink-0" />
                      <span>Belum Bayar (Bayar Nanti)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                      <CheckCircle2 size={12} className="shrink-0" />
                      <span>Sudah Dibayar ({selectedActiveOrder.method || 'Cash'})</span>
                    </span>
                  )}

                  {/* Cooking / Process Status */}
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 px-3 py-1 rounded-full bg-white/5 border border-white/10 tabular-nums">
                    <Flame size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                    <span>Menunggu {formatWaitTime(elapsedMins)}</span>
                  </span>
                </div>
              </div>

              {/* Line Items List */}
              <div className="border-t border-white/10 pt-3.5 pb-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
                  <span>Pesanan ({items.length} menu · {totalQty} item)</span>
                  <span className="text-[10px] text-zinc-500 lowercase">klik item untuk centang siap</span>
                </div>

                <div className="space-y-2 max-h-[36vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700/60">
                  {items.map((item: any, idx: number) => {
                    const itemPrice = Number(item.price) || 0;
                    const itemQty = Number(item.quantity) || 1;
                    const subtotal = itemPrice * itemQty;
                    const isChecked = Boolean(checkedItems[idx]);

                    const prod = products.find(
                      p => p.name.trim().toLowerCase() === item.product_name?.trim().toLowerCase()
                    );
                    const isQuick = typeof item.is_quick === 'boolean' ? item.is_quick : (prod?.is_quick ?? false);

                    return (
                      <div
                        key={idx}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleCheckItem(idx)}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                          isChecked
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Circular Checkbox */}
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                              isChecked
                                ? 'bg-emerald-500 border-emerald-400 text-zinc-950 shadow-sm shadow-emerald-500/40'
                                : 'border-zinc-700 bg-zinc-800/80 text-transparent'
                            }`}
                          >
                            <Check size={12} className="stroke-[3]" />
                          </div>

                          {/* Quantity Badge */}
                          <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 tabular-nums">
                            {itemQty}×
                          </span>

                          {/* Menu Name & Notes */}
                          <div className="min-w-0">
                            <span className={`text-sm font-semibold block leading-snug ${
                              isChecked ? 'line-through text-zinc-500' : 'text-zinc-100'
                            }`}>
                              {item.product_name}
                            </span>
                            {item.notes && (
                              <span className="text-xs text-amber-400/90 italic block mt-0.5">
                                Catatan: {item.notes}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: Badge & Subtotal */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          {isQuick ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center gap-1">
                              <ShoppingBag size={10} />
                              <span>Siap Saji</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-1">
                              <Flame size={10} className="fill-amber-400 text-amber-400" />
                              <span>Dimasak</span>
                            </span>
                          )}

                          <span className="text-sm font-bold text-zinc-200 text-right min-w-[75px] tabular-nums">
                            Rp {subtotal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Card */}
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Total Tagihan</span>
                  <span className="text-xs text-zinc-500">
                    {isBayarNanti ? 'Menunggu pelunasan' : 'Sudah lunas'}
                  </span>
                </div>
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight tabular-nums">
                  Rp {totalAmount.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Action Buttons (Footer) */}
              <div className="pt-1 flex items-center gap-2.5">
                {isBayarNanti ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        updateOrderStatus(selectedActiveOrder.id, 'completed', 'Cash (Lunas)');
                        setSelectedActiveOrder(null);
                      }}
                      className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Banknote size={18} />
                      <span>Tunai & Selesai</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateOrderStatus(selectedActiveOrder.id, 'completed', 'QRIS');
                        setSelectedActiveOrder(null);
                      }}
                      className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <QrCode size={18} />
                      <span>QRIS & Selesai</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      updateOrderStatus(selectedActiveOrder.id, 'completed');
                      setSelectedActiveOrder(null);
                    }}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckCircle2 size={18} />
                    <span>Selesaikan Pesanan</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Payment Modal */}
      {paymentModalOrder && (
        <Dialog open={!!paymentModalOrder} onOpenChange={() => setPaymentModalOrder(null)}>
          <DialogContent className="bg-zinc-950 border border-white/10 text-zinc-100 max-w-sm rounded-3xl p-6 font-sans">
            <DialogHeader className="sr-only">
              <DialogTitle>Pilih Pembayaran</DialogTitle>
              <DialogDescription>Pilih metode pembayaran untuk menyelesaikan pesanan</DialogDescription>
            </DialogHeader>

            <h3 className="text-xl font-bold text-white mb-1">Pilih Pembayaran</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Selesaikan pesanan #{paymentModalOrder?.id?.startsWith('order_') ? paymentModalOrder.id.split('_').pop() : paymentModalOrder?.id}
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  updateOrderStatus(paymentModalOrder.id, 'completed', 'Cash (Lunas)');
                  setPaymentModalOrder(null);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Banknote size={18} />
                <span>Tunai / Cash (Lunas)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  updateOrderStatus(paymentModalOrder.id, 'completed', 'QRIS');
                  setPaymentModalOrder(null);
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <QrCode size={18} />
                <span>QRIS (Lunas)</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
