'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Flame, ShoppingBag, Plus } from 'lucide-react';

interface FreeItemModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddFreeItem: (name: string, price: number, isQuick: boolean, notes: string) => void;
}

export function FreeItemModal({
  isOpen,
  onOpenChange,
  onAddFreeItem,
}: FreeItemModalProps) {
  const [name, setName] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [isQuick, setIsQuick] = useState(true);
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    const cleanPrice = parseInt(priceInput.replace(/\D/g, '') || '0', 10);
    if (cleanPrice <= 0) {
      alert('Masukkan harga yang valid (lebih dari 0).');
      return;
    }
    const cleanName = name.trim() || 'Item Bebas';
    onAddFreeItem(cleanName, cleanPrice, isQuick, notes.trim());
    setName('');
    setPriceInput('');
    setNotes('');
    setIsQuick(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-white/10 text-zinc-100 max-w-sm rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold font-serif text-amber-400">
            Tambah Menu Bebas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Nama Menu / Keterangan</label>
            <Input
              placeholder="Contoh: Es Batu Extra, Box Catering..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-zinc-900 border-white/10 h-11 text-sm text-zinc-100 rounded-xl focus-visible:ring-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Harga Satuan (Rp) *</label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={
                priceInput
                  ? parseInt(priceInput.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID')
                  : ''
              }
              onChange={e => setPriceInput(e.target.value.replace(/\D/g, ''))}
              className="bg-zinc-900 border-white/10 h-11 text-base font-bold text-amber-400 rounded-xl focus-visible:ring-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Tipe Penyajian</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsQuick(true)}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  isQuick
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-white/5 hover:bg-zinc-850'
                }`}
              >
                <ShoppingBag size={14} />
                Siap Ambil
              </button>
              <button
                type="button"
                onClick={() => setIsQuick(false)}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  !isQuick
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-white/5 hover:bg-zinc-850'
                }`}
              >
                <Flame size={14} />
                Dimasak
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Catatan Khusus (Opsional)</label>
            <Input
              placeholder="Contoh: jangan terlalu manis, bungkus terpisah..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="bg-zinc-900 border-white/10 h-10 text-xs text-zinc-200 rounded-xl focus-visible:ring-amber-500"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800 rounded-xl h-11 text-xs font-bold"
          >
            Batal
          </Button>
          <Button
            onClick={handleAdd}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl h-11 text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
          >
            <Plus size={16} />
            Tambahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
