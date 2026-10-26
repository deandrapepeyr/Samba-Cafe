'use client';

import React from 'react';
import { ListPlus, Flame, ShoppingBag } from 'lucide-react';
import { Product } from '@/types/pos';

interface ProductCardProps {
  product: Product;
  categoryName?: string;
  qtyInCart: number;
  isUnavailable: boolean;
  isLocked: boolean;
  stockString: string;
  onClick: (product: Product) => void;
}

export function ProductCard({
  product,
  categoryName = 'MENU',
  qtyInCart,
  isUnavailable,
  isLocked,
  stockString,
  onClick,
}: ProductCardProps) {
  const isQuick = Boolean(product.is_quick);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isUnavailable) return;
        onClick(product);
      }}
      className={`group relative border rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between min-h-[140px] md:min-h-[150px] select-none touch-manipulation active:scale-[0.98] ${
        isUnavailable
          ? 'bg-zinc-900/40 border-zinc-700/50 opacity-60 cursor-not-allowed shadow-none'
          : isLocked
          ? 'bg-zinc-900/40 border-white/5 opacity-80 cursor-pointer hover:border-amber-500/50'
          : `bg-zinc-900/50 cursor-pointer ${
              qtyInCart > 0
                ? 'border-amber-500/50 bg-amber-500/10 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                : 'border-white/5 hover:border-white/20 hover:bg-zinc-800/60'
            } hover:-translate-y-0.5`
      }`}
    >
      <div>
        <div className="flex justify-between items-start mb-2 gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isQuick ? (
              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                <ShoppingBag size={10} className="shrink-0" />
                Siap Ambil
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/25 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                <Flame size={10} className="shrink-0" />
                Dimasak
              </span>
            )}
            <span className="text-[9px] font-medium text-zinc-500 truncate max-w-[80px]">
              {categoryName}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {product.variants && product.variants.length > 0 && !isUnavailable && (
              <div className="text-[9px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md flex items-center gap-1 font-bold">
                <ListPlus size={10} />
                OPSI
              </div>
            )}
            {qtyInCart > 0 && (
              <div className="bg-amber-500 text-zinc-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                {qtyInCart}x
              </div>
            )}
          </div>
        </div>

        <h3
          className={`text-[13px] md:text-sm font-bold line-clamp-2 leading-tight ${
            isUnavailable
              ? 'text-zinc-500'
              : qtyInCart > 0
              ? 'text-amber-400'
              : 'text-zinc-200 group-hover:text-white'
          }`}
        >
          {product.name}
        </h3>
      </div>

      <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/5">
        <p
          className={`text-sm font-bold tracking-tight ${
            isUnavailable ? 'text-zinc-600' : qtyInCart > 0 ? 'text-zinc-100 font-extrabold' : 'text-zinc-300'
          }`}
        >
          Rp {product.price.toLocaleString('id-ID')}
        </p>
        <span
          className={`text-[10px] font-bold ${
            !isUnavailable
              ? 'text-emerald-500'
              : 'text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider'
          }`}
        >
          {stockString}
        </span>
      </div>
    </div>
  );
}
