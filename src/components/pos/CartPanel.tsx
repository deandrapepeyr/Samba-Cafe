'use client';

import React from 'react';
import { LockKeyhole, FileEdit, Minus, Plus, QrCode, Banknote, Clock, Flame, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CartItem } from '@/types/pos';
import { Role } from '@/lib/AuthContext';

interface CartPanelProps {
  orderNumber: string;
  isPageLoading: boolean;
  userName: string | null;
  role: Role | null;
  isLocked: boolean;
  cart: CartItem[];
  subtotal: number;
  total: number;
  amountDue?: number;
  previouslyPaidAmount?: number;
  isOriginalOrderPaid?: boolean;
  cartEndRef?: React.RefObject<HTMLDivElement | null>;
  customerName: string;
  setCustomerName: (name: string) => void;
  paymentMethod: 'QRIS' | 'Cash' | 'Bayar Nanti' | null;
  setPaymentMethod: (method: 'QRIS' | 'Cash' | 'Bayar Nanti' | null) => void;
  cashReceived: string;
  setCashReceived: (cash: string) => void;
  openNoteDialog: (item: CartItem) => void;
  updateQuantity: (id: string, delta: number) => void;
  handleGoToHybridQuick?: () => void;
  handleLockActionClick: () => void;
  finalizeTransaction: (
    method: 'QRIS' | 'Cash' | 'Bayar Nanti',
    isMobile?: boolean,
    overrideCashReceived?: number
  ) => void;
  getQuickCashSuggestions?: (amount: number) => number[];
  setIsHutangNameDialogOpen?: (open: boolean) => void;
  onOpenPaymentSheet?: () => void;
  onDirectSave?: () => void;
  isEditMode?: boolean;
  onCancelEdit?: () => void;
}

export function CartPanel({
  orderNumber,
  isPageLoading,
  userName,
  role,
  isLocked,
  cart,
  subtotal,
  total,
  amountDue,
  previouslyPaidAmount = 0,
  isOriginalOrderPaid = false,
  cartEndRef,
  customerName,
  setCustomerName,
  paymentMethod,
  setPaymentMethod,
  cashReceived,
  setCashReceived,
  openNoteDialog,
  updateQuantity,
  handleLockActionClick,
  finalizeTransaction,
  getQuickCashSuggestions,
  setIsHutangNameDialogOpen,
  onOpenPaymentSheet,
  onDirectSave,
  isEditMode = false,
  onCancelEdit,
}: CartPanelProps) {
  const cookedItems = React.useMemo(() => cart.filter(item => !item.product.is_quick), [cart]);
  const quickItems = React.useMemo(() => cart.filter(item => Boolean(item.product.is_quick)), [cart]);

  const effectiveDue = amountDue !== undefined
    ? amountDue
    : (isEditMode && previouslyPaidAmount > 0 ? Math.max(0, total - previouslyPaidAmount) : total);

  const renderItemCard = (item: CartItem) => (
    <div
      key={item.id}
      className="flex flex-col gap-2 p-3 bg-zinc-900/60 rounded-2xl border border-white/5 hover:border-white/10 transition-colors"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-sm text-zinc-100 line-clamp-2 leading-snug">
            {item.product.name}
          </span>
          {isEditMode && previouslyPaidAmount > 0 && (
            <div className="mt-1">
              {item.isExistingPaid ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  ✓ Sudah Lunas
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                  ✨ Menu Tambahan
                </span>
              )}
            </div>
          )}
        </div>
        <span className="font-bold text-sm whitespace-nowrap text-amber-400">
          Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}
        </span>
      </div>

      {item.notes && (
        <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl italic">
          Catatan: {item.notes}
        </p>
      )}

      <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
        <button
          onClick={() => openNoteDialog(item)}
          className="text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1.5 text-xs py-1 px-2 rounded-lg hover:bg-white/5 touch-manipulation"
        >
          <FileEdit size={13} /> Catatan
        </button>

        <div className="flex items-center gap-2 bg-zinc-800/80 rounded-xl p-1 border border-white/5">
          <button
            onClick={() => updateQuantity(item.id, -1)}
            aria-label="Kurangi jumlah"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-700/80 active:scale-95 transition-all text-zinc-200"
          >
            <Minus size={14} />
          </button>
          <span className="w-5 text-center font-bold text-sm text-zinc-100">{item.quantity}</span>
          <button
            onClick={() => updateQuantity(item.id, 1)}
            aria-label="Tambah jumlah"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-700/80 active:scale-95 transition-all text-zinc-200"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Header Pesanan */}
      <div className="p-4 xl:p-5 border-b border-white/10 flex items-center justify-between bg-zinc-950">
        <div>
          <h2 className="text-lg xl:text-xl font-bold tracking-tight text-zinc-100 font-serif">
            Pesanan Aktif
          </h2>
          <div className="flex items-center gap-2 mt-1 text-zinc-400 text-xs">
            <span className="font-mono">#{orderNumber || '-'}</span>
            <span>•</span>
            {isPageLoading ? (
              <span className="text-zinc-500 italic">Memuat status...</span>
            ) : userName && role ? (
              <span className="text-zinc-300 font-semibold">Kasir: {userName}</span>
            ) : (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <LockKeyhole size={12} /> Belum Masuk
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Edit Mode Banner jika kasir sedang menambah menu ke pesanan Bayar Nanti / Aktif */}
      {isEditMode && (
        <div className="mx-4 mt-3 p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <FileEdit size={15} className="text-amber-400 shrink-0" />
            <div>
              <p className="leading-tight">
                Mode Tambah Menu {previouslyPaidAmount > 0 ? '· Sudah Lunas' : ''}
              </p>
              <p className="text-[11px] font-mono font-normal text-amber-200/80">
                #{orderNumber} {paymentMethod ? `· ${paymentMethod}` : ''}
                {previouslyPaidAmount > 0 && ` (Lunas Rp ${previouslyPaidAmount.toLocaleString('id-ID')})`}
              </p>
            </div>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-2.5 py-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[11px] font-semibold border border-white/10 transition cursor-pointer"
            >
              Batal Edit
            </button>
          )}
        </div>
      )}

      {/* Konten Daftar Item Keranjang */}
      <div className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 bg-zinc-950">
        {isPageLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 mt-12 gap-3">
            <p className="text-xs">Memeriksa status shift...</p>
          </div>
        ) : isLocked ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-zinc-400 mt-8">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
              <LockKeyhole size={30} />
            </div>
            <div>
              <h3 className="font-bold text-zinc-100 text-base">Fitur Kasir Terkunci</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                {role
                  ? `Kasir (${userName}) belum membuka shift. Silakan masukkan uang modal awal untuk mulai.`
                  : 'Silakan masuk sebagai kasir untuk mulai menginput pesanan.'}
              </p>
            </div>
          </div>
        ) : cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 mt-20">
            <p className="text-sm font-medium">Keranjang masih kosong</p>
            <p className="text-xs text-zinc-600 mt-1">Pilih menu dari daftar di samping</p>
          </div>
        ) : (
          <div className="space-y-5 pb-6">
            {/* Bagian 1: Pesanan Dimasak (Ke Dapur) */}
            {cookedItems.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-orange-400 uppercase tracking-wider">
                    <Flame size={13} /> Ke Dapur ({cookedItems.length})
                  </span>
                </div>
                <div className="space-y-2.5">{cookedItems.map(renderItemCard)}</div>
              </div>
            )}

            {/* Pemisah jika ada kedua jenis item */}
            {cookedItems.length > 0 && quickItems.length > 0 && (
              <Separator className="bg-white/5 my-2" />
            )}

            {/* Bagian 2: Pesanan Siap Ambil (Langsung Ambil) */}
            {quickItems.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <ShoppingBag size={13} /> Langsung Ambil ({quickItems.length})
                  </span>
                </div>
                <div className="space-y-2.5">{quickItems.map(renderItemCard)}</div>
              </div>
            )}

            <div ref={cartEndRef} />
          </div>
        )}
      </div>

      {/* Ringkasan & Pembayaran Footer */}
      <div className="p-4 xl:p-5 bg-zinc-950 border-t border-white/10 mt-auto relative shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.5)]">
        <div className="space-y-3 mb-4">
          <div className="bg-zinc-900/60 rounded-2xl p-4 border border-white/5 space-y-2">
            <div className="flex justify-between text-zinc-400 text-xs">
              <span>Total Pesanan ({cart.reduce((sum, item) => sum + item.quantity, 0)} item)</span>
              <span className="text-zinc-200 font-medium">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>

            {isEditMode && previouslyPaidAmount > 0 ? (
              <>
                <div className="flex justify-between text-emerald-400 text-xs font-semibold">
                  <span>Sudah Dibayar (Lunas)</span>
                  <span>- Rp {previouslyPaidAmount.toLocaleString('id-ID')}</span>
                </div>
                <Separator className="bg-white/5" />
                <div className="flex justify-between items-center pt-0.5">
                  <div className="flex flex-col">
                    <span className="text-amber-300 text-xs font-bold uppercase tracking-wider">
                      Tagihan Menu Tambahan
                    </span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      Hanya item yang belum lunas
                    </span>
                  </div>
                  <span className="text-amber-400 tracking-tight font-sans text-xl font-black">
                    Rp {effectiveDue.toLocaleString('id-ID')}
                  </span>
                </div>
              </>
            ) : (
              <>
                <Separator className="bg-white/5" />
                <div className="flex justify-between text-xl font-black text-zinc-100 items-center pt-0.5">
                  <span>Total</span>
                  <span className="text-amber-400 tracking-tight font-sans">
                    Rp {total.toLocaleString('id-ID')}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {isPageLoading ? (
          <Button
            className="w-full h-13 rounded-xl text-base font-bold bg-zinc-800 text-zinc-500 border border-white/5"
            disabled
          >
            Memuat Status...
          </Button>
        ) : isLocked ? (
          <Button
            className="w-full h-13 rounded-xl text-base font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-zinc-950 border border-amber-500/30 hover:border-amber-500 transition-all duration-200 shadow-lg shadow-amber-500/10"
            onClick={handleLockActionClick}
          >
            <LockKeyhole size={18} className="mr-2" />
            {role ? 'Buka Shift Kasir' : 'Masuk Kasir'}
          </Button>
        ) : cart.length > 0 ? (
          <div className="space-y-3">
            <Input
              id="customer-name-input-cart"
              placeholder="Nama Pelanggan (Opsional)"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="bg-zinc-900/60 border-white/10 h-10 text-sm focus-visible:ring-amber-500 placeholder:text-zinc-500 rounded-xl transition-all"
            />

            <button
              type="button"
              onClick={() => {
                if (isEditMode && previouslyPaidAmount > 0 && effectiveDue === 0) {
                  if (onDirectSave) onDirectSave();
                  else if (onOpenPaymentSheet) onOpenPaymentSheet();
                } else {
                  if (onOpenPaymentSheet) onOpenPaymentSheet();
                }
              }}
              className="w-full h-16 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-lg flex items-center justify-between px-6 shadow-xl shadow-amber-500/25 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Banknote size={22} className="stroke-[2.5]" />
                <span>
                  {isEditMode && previouslyPaidAmount > 0
                    ? (effectiveDue > 0 ? 'Bayar Menu Tambahan' : 'Simpan Perubahan')
                    : (isEditMode ? 'Simpan / Bayar' : 'Bayar')}
                </span>
              </div>
              <span className="font-sans text-xl tracking-tight">
                Rp {(isEditMode && previouslyPaidAmount > 0 ? effectiveDue : total).toLocaleString('id-ID')}
              </span>
            </button>
          </div>
        ) : (
          <Button
            className="w-full h-12 rounded-xl text-sm font-bold bg-zinc-900 text-zinc-600 border border-white/5"
            disabled
          >
            Pilih Menu Dahulu
          </Button>
        )}
      </div>
    </>
  );
}
