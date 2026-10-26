'use client';

import React from 'react';
import { RotateCcw, PlusCircle, SearchX } from 'lucide-react';
import { Product, Category, CartItem } from '@/types/pos';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  categories: Category[];
  cart: CartItem[];
  isLocked: boolean;
  onProductClick: (product: Product) => void;
  getStockString: (product: Product) => string;
  isStockEmpty: (product: Product) => boolean;
  onRepeatLastOrder?: () => void;
  onOpenFreeItem?: () => void;
  onResetFilter?: () => void;
  isLoading?: boolean;
}

export function ProductGrid({
  products,
  categories,
  cart,
  isLocked,
  onProductClick,
  getStockString,
  isStockEmpty,
  onRepeatLastOrder,
  onOpenFreeItem,
  onResetFilter,
  isLoading = false,
}: ProductGridProps) {
  const categoryMap = React.useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const cartQtyMap = React.useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach(c => {
      map.set(c.product.id, (map.get(c.product.id) || 0) + c.quantity);
    });
    return map;
  }, [cart]);

  return (
    <div className="p-4 md:p-6 shrink-0">
      {isLoading && products.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5 pb-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 flex flex-col justify-between h-[155px] animate-pulse select-none"
            >
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <div className="w-16 h-4.5 rounded-md bg-zinc-800/80" />
                  <div className="w-10 h-3.5 rounded-md bg-zinc-850" />
                </div>
                <div className="w-4/5 h-5 rounded-md bg-zinc-800/90 mt-2" />
                <div className="w-1/2 h-3.5 rounded-md bg-zinc-850/60" />
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-white/5">
                <div className="w-20 h-5 rounded-md bg-amber-500/10" />
                <div className="w-12 h-4 rounded-md bg-zinc-800/60" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-500 space-y-4">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600">
            <SearchX size={28} />
          </div>
          <p className="text-base font-semibold text-zinc-300">Tidak ada menu di sini</p>
          {onResetFilter && (
            <button
              type="button"
              onClick={onResetFilter}
              className="px-5 py-2.5 rounded-xl bg-[#e8b84b] text-zinc-950 font-bold text-sm shadow-md shadow-[#e8b84b]/15 active:scale-95 transition-transform cursor-pointer"
            >
              Reset filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5 pb-6">
          {products.map(product => {
            const qtyInCart = cartQtyMap.get(product.id) || 0;
            const isUnavailable = isStockEmpty(product);
            const categoryName = categoryMap.get(product.category_id) || 'MENU';

            return (
              <ProductCard
                key={product.id}
                product={product}
                categoryName={categoryName}
                qtyInCart={qtyInCart}
                isUnavailable={isUnavailable}
                isLocked={isLocked}
                stockString={getStockString(product)}
                onClick={onProductClick}
              />
            );
          })}
        </div>
      )}

      {/* Bottom Grid Quick Actions (Fase 1i) */}
      <div className="flex flex-wrap items-center gap-3 pt-4 pb-28 border-t border-white/5">
        {onRepeatLastOrder && (
          <button
            type="button"
            onClick={onRepeatLastOrder}
            className="flex items-center gap-2 h-11 px-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 border border-white/10 hover:border-amber-500/30 text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <RotateCcw size={15} className="text-amber-400" />
            <span>Ulangi Pesanan Terakhir</span>
          </button>
        )}

        {onOpenFreeItem && (
          <button
            type="button"
            onClick={onOpenFreeItem}
            className="flex items-center gap-2 h-11 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 hover:border-amber-500/50 text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <PlusCircle size={15} />
            <span>+ Item Bebas</span>
          </button>
        )}
      </div>
    </div>
  );
}
