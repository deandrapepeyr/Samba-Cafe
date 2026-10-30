'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { QrCode, Banknote, Clock, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface PaymentSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  totalOrderAmount?: number;
  previouslyPaidAmount?: number;
  orderNumber: string;
  customerName: string;
  setCustomerName: (name: string) => void;
  finalizeTransaction: (
    methodOverride?: 'QRIS' | 'Cash' | 'Bayar Nanti' | null,
    isBackground?: boolean,
    cashOverride?: number
  ) => void;
  isProcessingCheckout: boolean;
}

export function PaymentSheet({
  isOpen,
  onOpenChange,
  total,
  totalOrderAmount,
  previouslyPaidAmount = 0,
  orderNumber,
  customerName,
  setCustomerName,
  finalizeTransaction,
  isProcessingCheckout,
}: PaymentSheetProps) {
  const [activeTab, setActiveTab] = useState<'Cash' | 'QRIS' | 'Bayar Nanti'>('Cash');
  const [cashInput, setCashInput] = useState<string>('');
  const [qrisUrl, setQrisUrl] = useState<string>('/qris-static.jpg');

  useEffect(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem('samba_qris_image') : null;
    if (cached) setQrisUrl(cached);

    const fetchQris = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'qris_image_url')
          .maybeSingle();
        if (data?.value) {
          setQrisUrl(data.value);
          if (typeof window !== 'undefined') {
            localStorage.setItem('samba_qris_image', data.value);
          }
        }
      } catch {}
    };
    fetchQris();
  }, [isOpen]);
  const [customerNameError, setCustomerNameError] = useState(false);

  // Reset or initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('Cash');
      setCashInput(total.toString());
      setCustomerNameError(false);
    }
  }, [isOpen, total]);

  const parsedCash = parseInt(cashInput.replace(/\D/g, '') || '0', 10);
  const changeAmount = parsedCash >= total ? parsedCash - total : 0;
  const isCashInsufficient = parsedCash < total;

  // Generate clean quick cash suggestions based on total
  const quickCashSuggestions = React.useMemo(() => {
    const list: number[] = [total];
    const steps = [10000, 20000, 50000, 100000];

    steps.forEach(step => {
      const rounded = Math.ceil(total / step) * step;
      if (rounded > total && !list.includes(rounded)) {
        list.push(rounded);
      }
    });

    if (total > 50000) {
      const next100k = Math.ceil(total / 100000) * 100000;
      if (!list.includes(next100k)) list.push(next100k);
    }

    return Array.from(new Set(list)).slice(0, 5);
  }, [total]);

  const handleConfirmPayment = () => {
    if (activeTab === 'Cash') {
      if (isCashInsufficient) {
        alert('Nominal uang tunai yang diterima kurang dari total pesanan.');
        return;
      }
      finalizeTransaction('Cash', true, parsedCash);
      onOpenChange(false);
    } else if (activeTab === 'QRIS') {
      finalizeTransaction('QRIS', true);
      onOpenChange(false);
    } else if (activeTab === 'Bayar Nanti') {
      if (!customerName.trim()) {
        setCustomerNameError(true);
        return;
      }
      finalizeTransaction('Bayar Nanti', true);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="z-[150] bg-zinc-950 border-white/10 text-zinc-100 max-w-lg w-[95vw] rounded-3xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400">Pesanan #{orderNumber || '-'}</span>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Pembayaran
            </span>
          </div>

          <div className="pt-2 text-center">
            <p className="text-xs text-amber-400/90 uppercase tracking-wider font-bold">
              {previouslyPaidAmount > 0 ? 'Tagihan Menu Tambahan' : 'Total Tagihan'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight font-sans mt-0.5">
              Rp {total.toLocaleString('id-ID')}
            </h2>
            {previouslyPaidAmount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span>✓ Sudah Lunas: Rp {previouslyPaidAmount.toLocaleString('id-ID')}</span>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-400">Total Pesanan: Rp {(totalOrderAmount || (total + previouslyPaidAmount)).toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Customer Name Input (Inline) */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span>
              Nama Pelanggan {activeTab === 'Bayar Nanti' ? <span className="text-rose-500">*</span> : <span className="text-zinc-500">(Opsional)</span>}
            </span>
            {customerNameError && activeTab === 'Bayar Nanti' && (
              <span className="text-[11px] text-rose-400 flex items-center gap-1 font-bold">
                <AlertCircle size={12} /> Wajib diisi untuk kasbon / hutang
              </span>
            )}
          </label>
          <Input
            placeholder="Masukkan nama pelanggan..."
            value={customerName}
            onChange={e => {
              setCustomerName(e.target.value);
              if (e.target.value.trim()) setCustomerNameError(false);
            }}
            className={`bg-zinc-900 border text-sm h-11 rounded-xl focus-visible:ring-amber-500 ${
              customerNameError && activeTab === 'Bayar Nanti'
                ? 'border-rose-500 ring-1 ring-rose-500/50'
                : 'border-white/10'
            }`}
          />
        </div>

        {/* 3 Payment Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-zinc-900/80 rounded-2xl border border-white/5 my-2">
          <button
            type="button"
            onClick={() => setActiveTab('Cash')}
            className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'Cash'
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20 font-black'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
            }`}
          >
            <Banknote size={18} />
            <span>Tunai</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('QRIS')}
            className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'QRIS'
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20 font-black'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
            }`}
          >
            <QrCode size={18} />
            <span>QRIS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('Bayar Nanti')}
            className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'Bayar Nanti'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
            }`}
          >
            <Clock size={18} />
            <span>Hutang</span>
          </button>
        </div>

        {/* Tab 1: Tunai Content */}
        {activeTab === 'Cash' && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Quick Suggestions Buttons */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Pilihan Nominal Cepat</label>
              <div className="grid grid-cols-3 gap-2">
                {quickCashSuggestions.map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCashInput(val.toString())}
                    className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold border transition-all active:scale-95 ${
                      parsedCash === val
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-sm'
                        : 'bg-zinc-900 border-white/10 text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {val === total ? 'Uang Pas' : `Rp ${val.toLocaleString('id-ID')}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Nominal Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">Nominal Tunai Lain (Rp)</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={cashInput ? parsedCash.toLocaleString('id-ID') : ''}
                onChange={e => setCashInput(e.target.value.replace(/\D/g, ''))}
                className="bg-zinc-900 border-white/10 h-12 text-lg font-bold text-zinc-100 rounded-xl focus-visible:ring-emerald-500"
              />
            </div>

            {/* Live Kembalian Card */}
            {parsedCash >= total ? (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-emerald-400/90 uppercase tracking-wider">Kembalian</p>
                  <p className="text-2xl font-black text-emerald-400 font-sans">
                    Rp {changeAmount.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 size={24} />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>Kurang Rp {(total - parsedCash).toLocaleString('id-ID')} lagi</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: QRIS Content */}
        {activeTab === 'QRIS' && (
          <div className="space-y-4 text-center py-2 animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto w-[240px] h-[240px] relative bg-white p-3 rounded-2xl border-4 border-blue-500/30 shadow-2xl overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrisUrl}
                alt="QRIS Samba Cafe"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/qris-static.jpg';
                }}
              />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-200">Scan QRIS Samba Cafe</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Mendukung GoPay, OVO, Dana, BCA, Mandiri & semua aplikasi perbankan.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Hutang Content */}
        {activeTab === 'Bayar Nanti' && (
          <div className="space-y-4 py-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Clock size={18} />
                <span>Catat Hutang / Kasbon</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Pesanan akan masuk ke antrean dengan status <strong className="text-amber-400">Belum Lunas (UNPAID)</strong>. Kasir dapat melunasi pesanan ini kapan saja melalui kartu antrean pesanan.
              </p>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <DialogFooter className="flex gap-2 sm:gap-3 pt-3 border-t border-white/5">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800 rounded-xl h-12 text-sm font-bold"
          >
            Batal
          </Button>

          <Button
            onClick={handleConfirmPayment}
            disabled={
              isProcessingCheckout ||
              (activeTab === 'Cash' && isCashInsufficient) ||
              (activeTab === 'Bayar Nanti' && !customerName.trim())
            }
            className={`flex-1 rounded-xl h-12 text-sm font-black transition-all active:scale-[0.98] ${
              activeTab === 'Cash'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/20'
                : activeTab === 'QRIS'
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20'
            }`}
          >
            {isProcessingCheckout
              ? 'Memproses...'
              : activeTab === 'Cash'
              ? 'Konfirmasi Bayar Tunai'
              : activeTab === 'QRIS'
              ? 'Konfirmasi Lunas QRIS'
              : 'Simpan Sebagai Hutang'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
