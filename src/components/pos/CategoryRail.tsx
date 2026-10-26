'use client';

import React from 'react';

export interface CategoryRailTab {
  id: string;
  label: string;
  count?: number;
}

interface CategoryRailProps {
  activeTab: string | null;
  onSelectTab: (tabId: string) => void;
  tabs: CategoryRailTab[];
  isLoading?: boolean;
}

export function CategoryRail({
  activeTab,
  onSelectTab,
  tabs,
  isLoading = false,
}: CategoryRailProps) {
  return (
    <aside 
      className="w-[140px] md:w-[150px] min-w-[140px] max-w-[150px] shrink-0 h-full min-h-0 flex flex-col relative select-none z-20 pl-3 pr-1.5 py-3 border-r border-white/5"
      aria-label="Kategori Menu"
    >
      <div 
        role="tablist" 
        aria-orientation="vertical"
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-2 pr-1 pb-10 pt-0.5 scrollbar-thin scrollbar-thumb-zinc-700/60 hover:scrollbar-thumb-amber-500/40 scrollbar-track-transparent overscroll-contain touch-pan-y"
      >
        {isLoading && tabs.length <= 1 ? (
          <div className="flex flex-col gap-2 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[50px] h-[50px] w-full px-3 py-1.5 rounded-xl bg-zinc-900/50 border border-white/5 flex items-center justify-between"
              >
                <div className="w-16 h-3.5 bg-zinc-800/80 rounded-md" />
                <div className="w-5 h-3.5 bg-zinc-850 rounded-md" />
              </div>
            ))}
          </div>
        ) : (
          tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`category-rail-tab-${tab.id}`}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelectTab(tab.id)}
              className={`min-h-[50px] h-[50px] w-full px-3 py-1.5 rounded-xl text-left font-serif transition-all touch-manipulation select-none cursor-pointer flex items-center justify-between gap-1.5 border active:scale-[0.98] ${
                isActive
                  ? 'bg-gradient-to-r from-amber-400 to-[#e8b84b] text-zinc-950 font-bold border-amber-300/50 shadow-md shadow-amber-500/20'
                  : 'bg-zinc-900/70 hover:bg-zinc-850 text-zinc-300 font-medium border-white/5 hover:border-white/10'
              }`}
            >
              <span className="line-clamp-2 leading-[1.18] text-[13.5px] sm:text-[14px] font-semibold break-words flex-1">
                {tab.label}
              </span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10.5px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 tabular-nums ${
                    isActive
                      ? 'bg-black/15 text-zinc-950 font-bold'
                      : 'bg-white/5 text-zinc-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        }))}
      </div>

      {/* Gradient fade bawah jika item kategori panjang */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute bottom-0 left-3 right-1.5 h-8 bg-gradient-to-t from-[#0b0a08] to-transparent z-10" 
      />
    </aside>
  );
}
