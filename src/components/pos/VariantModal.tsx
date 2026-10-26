'use client';

import React from 'react';
import { CheckCircle2, ShoppingCart } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Product } from '@/types/pos';

interface StockItem {
  id: string;
  quantity: number;
  name: string;
  sell_price: number;
  is_topping: boolean;
  tracking_method?: string;
}

interface VariantModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  stocksData: StockItem[];
  selectedVariantChoices: Record<string, string[]>;
  setSelectedVariantChoices: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  onAddToCart: (
    product: Product,
    notes: string,
    addonPrice: number,
    selectedChoices: Record<string, string[]>
  ) => void;
}

export function VariantModal({
  isOpen,
  onOpenChange,
  product,
  stocksData,
  selectedVariantChoices,
  setSelectedVariantChoices,
  onAddToCart,
}: VariantModalProps) {
  if (!product) return null;

  const handleConfirm = () => {
    const missingRequired = product.variants?.find(
      v => v.is_required && (!selectedVariantChoices[v.name] || selectedVariantChoices[v.name].length === 0)
    );
    if (missingRequired) {
      alert(`Harap pilih opsi pada grup: ${missingRequired.name}`);
      return;
    }

    let addonPrice = 0;
    const notesArr: string[] = [];
    const selectedChoices: Record<string, string[]> = {};

    product.variants?.forEach(v => {
      const choices = selectedVariantChoices[v.name] || [];
      if (choices.length > 0) {
        notesArr.push(`${v.name}: ${choices.join(', ')}`);
        selectedChoices[v.name] = choices;
        choices.forEach(cName => {
          const cObj = v.choices.find(c => {
            const stock = c.stock_id ? stocksData.find(s => s.id === c.stock_id) : null;
            const displayName = stock ? stock.name || c.name : c.name;
            return displayName === cName;
          });
          if (cObj) {
            const stock = cObj.stock_id ? stocksData.find(s => s.id === cObj.stock_id) : null;
            const displayPrice = stock ? stock.sell_price || 0 : cObj.price || 0;
            addonPrice += displayPrice;
          }
        });
      }
    });

    onAddToCart(product, notesArr.join(' | '), addonPrice, selectedChoices);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl shadow-2xl">
        <div className="px-6 pt-6 pb-4 border-b border-white/5 bg-zinc-900/40 relative">
          <h2 className="text-2xl font-bold text-zinc-100 pr-8">{product.name}</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Sesuaikan pesanan dengan pilihan varian dan topping di bawah ini.
          </p>
        </div>

        <ScrollArea className="flex-1 px-6 py-4 bg-zinc-950">
          {product.variants?.map((variant, idx) => {
            const isRequired = variant.is_required;
            return (
              <div
                key={idx}
                className="mb-8 last:mb-2 animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-5 rounded-full ${isRequired ? 'bg-primary' : 'bg-amber-500'}`} />
                    <h4 className="font-bold text-zinc-100 uppercase tracking-wider text-sm">{variant.name}</h4>
                  </div>
                  {isRequired ? (
                    <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      Wajib Pilih 1
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      Opsional
                    </span>
                  )}
                </div>

                <div className={`grid gap-3 ${variant.choices.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {variant.choices.map((choice, cIdx) => {
                    const stock = choice.stock_id ? stocksData.find(s => s.id === choice.stock_id) : null;
                    const displayPrice = stock ? stock.sell_price || 0 : choice.price || 0;
                    const displayName = stock ? stock.name || choice.name : choice.name;
                    const isSelected = selectedVariantChoices[variant.name]?.includes(displayName);
                    return (
                      <div
                        key={cIdx}
                        onClick={() => {
                          setSelectedVariantChoices(prev => {
                            const current = prev[variant.name] || [];
                            if (variant.is_required || !variant.is_multiple) {
                              if (!variant.is_required && current.includes(displayName)) {
                                return { ...prev, [variant.name]: [] };
                              }
                              return { ...prev, [variant.name]: [displayName] };
                            } else {
                              if (current.includes(displayName)) {
                                return { ...prev, [variant.name]: current.filter(c => c !== displayName) };
                              } else {
                                return { ...prev, [variant.name]: [...current, displayName] };
                              }
                            }
                          });
                        }}
                        className={`relative flex flex-col justify-center p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer select-none overflow-hidden group min-h-[80px]
                          ${
                            isSelected
                              ? isRequired
                                ? 'bg-primary/10 border-primary text-primary'
                                : 'bg-amber-500/10 border-amber-500 text-amber-500'
                              : 'bg-zinc-900/60 border-transparent hover:border-white/10 hover:bg-zinc-800 text-zinc-300'
                          }`}
                      >
                        {isSelected && (
                          <div
                            className={`absolute top-0 right-0 w-8 h-8 rounded-bl-2xl flex items-center justify-center
                            ${isRequired ? 'bg-primary text-zinc-950' : 'bg-amber-500 text-zinc-950'}
                          `}
                          >
                            <CheckCircle2 size={16} className="text-current" />
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-2 z-10">
                          <span
                            className={`font-bold leading-tight ${
                              isSelected
                                ? isRequired
                                  ? 'text-primary'
                                  : 'text-amber-500'
                                : 'text-zinc-200 group-hover:text-white'
                            }`}
                          >
                            {displayName}
                          </span>

                          <div
                            className={`shrink-0 w-5 h-5 flex items-center justify-center border-2 transition-colors mt-0.5
                            ${!variant.is_multiple ? 'rounded-full' : 'rounded-md'}
                            ${
                              isSelected
                                ? isRequired
                                  ? 'border-primary'
                                  : 'border-amber-500'
                                : 'border-zinc-600 group-hover:border-zinc-400'
                            }
                          `}
                          >
                            {isSelected && (
                              <div
                                className={`w-2.5 h-2.5 ${
                                  !variant.is_multiple
                                    ? (isRequired ? 'bg-primary' : 'bg-amber-500') + ' rounded-full'
                                    : 'bg-amber-500 rounded-sm'
                                }`}
                              />
                            )}
                          </div>
                        </div>

                        {displayPrice > 0 && (
                          <div
                            className={`text-sm font-bold mt-2 z-10 ${
                              isSelected
                                ? isRequired
                                  ? 'text-primary/80'
                                  : 'text-amber-500/80'
                                : 'text-zinc-500'
                            }`}
                          >
                            +Rp {displayPrice.toLocaleString('id-ID')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </ScrollArea>

        <div className="px-6 py-5 border-t border-white/5 bg-zinc-900/80 flex items-center justify-between gap-4">
          <Button
            variant="outline"
            className="h-14 px-8 rounded-2xl border-white/10 hover:bg-white/5 text-zinc-300 font-bold transition-all hover:scale-[1.02]"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            className="flex-1 h-14 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2 font-bold shadow-lg shadow-primary/20 text-base transition-all hover:scale-[1.02]"
            onClick={handleConfirm}
          >
            <ShoppingCart size={20} />
            Tambahkan ke Pesanan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
