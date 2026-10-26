'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types/pos';

const STORAGE_KEY = 'samba_pos_favorites';

export function useFavorites(products: Product[]) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // Muat dari localStorage setelah client mounting untuk mencegah hydration mismatch
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFavoriteIds(parsed);
        }
      }
    } catch (e) {}
  }, []);

  const productsRef = useRef(products);
  productsRef.current = products;

  const refreshFavorites = useCallback(async () => {
    try {
      const prods = productsRef.current;
      if (!prods || prods.length === 0) return;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Ambil transaksi 30 hari terakhir (limit 300 transaksi) beserta item transaksinya
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('created_at, transaction_items(product_name, quantity)')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(300);

      const salesCounts = new Map<string, number>();
      const recentOrderNames: string[] = [];

      if (!error && txs && txs.length > 0) {
        txs.forEach(tx => {
          (tx.transaction_items || []).forEach((item: any) => {
            const name = (item.product_name || '').trim().toLowerCase();
            if (name) {
              salesCounts.set(name, (salesCounts.get(name) || 0) + (item.quantity || 1));
              if (!recentOrderNames.includes(name)) {
                recentOrderNames.push(name);
              }
            }
          });
        });
      }

      // Buat map nama produk ke id produk
      const nameToProduct = new Map<string, Product>();
      prods.forEach(p => {
        nameToProduct.set(p.name.trim().toLowerCase(), p);
      });

      // 1. Urutkan berdasarkan kuantitas penjualan 30 hari terakhir
      const sortedBySales = Array.from(salesCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => nameToProduct.get(name)?.id)
        .filter((id): id is string => Boolean(id));

      const resultSet = new Set<string>(sortedBySales);

      // 2. Fallback 1: Jika belum cukup 8 item, masukkan menu paling baru dipesan
      if (resultSet.size < 8) {
        for (const recentName of recentOrderNames) {
          const p = nameToProduct.get(recentName);
          if (p && !resultSet.has(p.id)) {
            resultSet.add(p.id);
            if (resultSet.size >= 12) break;
          }
        }
      }

      // 3. Fallback 2: Jika masih belum cukup, lengkapi dengan urutan default produk
      if (resultSet.size < 8) {
        for (const p of prods) {
          if (!resultSet.has(p.id)) {
            resultSet.add(p.id);
            if (resultSet.size >= 12) break;
          }
        }
      }

      // Ambil 8 - 12 item teratas
      const finalFavorites = Array.from(resultSet).slice(0, 12);

      if (finalFavorites.length > 0) {
        setFavoriteIds(finalFavorites);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalFavorites));
        } catch (e) {}
      }
    } catch (e) {
      console.error('Failed to refresh favorites in background:', e);
    }
  }, []);

  // Hitung di latar belakang saat daftar produk pertama kali dimuat
  useEffect(() => {
    if (products.length > 0) {
      refreshFavorites();
    }
  }, [products.length, refreshFavorites]);

  return {
    favoriteIds,
    refreshFavorites,
  };
}
