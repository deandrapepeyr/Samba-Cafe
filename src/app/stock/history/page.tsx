'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Package, ArrowLeft, Loader2, ArrowUpRight, ArrowDownRight, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Movement = {
  id: string;
  stock_id: string;
  movement_type: string;
  quantity_delta: number;
  usage_delta: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  stocks: {
    name: string;
    unit: string;
    tracking_method: string;
  };
  restockData?: {
    price: number;
    unit_cost: number;
  };
};

export default function StockHistoryPage() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && role !== 'manager') {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);

  useEffect(() => {
    if (role === 'manager') {
      fetchMovements();
    }
  }, [role]);

  const fetchMovements = async () => {
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          id,
          stock_id,
          movement_type,
          quantity_delta,
          usage_delta,
          reference_type,
          reference_id,
          created_at,
          stocks (name, unit, tracking_method)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      let moves = data as any || [];
      const restockIds = moves.filter((m: any) => m.reference_type === 'restock_id' && m.reference_id).map((m: any) => m.reference_id);

      if (restockIds.length > 0) {
        const { data: restockData } = await supabase.from('restocks').select('id, price, unit_cost').in('id', restockIds);
        if (restockData) {
          const restockMap = restockData.reduce((acc, r) => ({...acc, [r.id]: r}), {} as any);
          moves = moves.map((m: any) => m.reference_type === 'restock_id' ? { ...m, restockData: restockMap[m.reference_id] } : m);
        }
      }

      setMovements(moves);
    } catch (e: any) {
      console.error('Failed to fetch movements', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };

  if (isLoading || !role) {
    return (
      <MainLayout title="Riwayat Stok">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary w-8 h-8" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Riwayat Stok">
      <div className="max-w-4xl mx-auto p-4 md:p-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/stock">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-border bg-card">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Riwayat Pergerakan Stok</h1>
            <p className="text-sm text-muted-foreground">Catatan restock, pemakaian, dan penyesuaian</p>
          </div>
        </div>

        <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            {isLoadingData ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                <Loader2 className="animate-spin w-8 h-8 text-primary" />
                <p>Memuat riwayat...</p>
              </div>
            ) : movements.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                <RefreshCcw className="w-12 h-12 opacity-20" />
                <p>Belum ada riwayat pergerakan stok.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {movements.map((mov) => {
                  const isRestock = mov.movement_type === 'RESTOCK';
                  const isManual = mov.movement_type === 'MANUAL_UPDATE';
                  const isSale = mov.movement_type === 'SALE';
                  
                  return (
                    <div key={mov.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isRestock ? 'bg-emerald-500/10 text-emerald-500' :
                          isSale ? 'bg-amber-500/10 text-amber-500' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {isRestock ? <ArrowDownRight size={20} /> : isSale ? <ArrowUpRight size={20} /> : <RefreshCcw size={20} />}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{mov.stocks?.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{mov.movement_type}</span>
                            <span className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-xs text-muted-foreground">{formatDate(mov.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {mov.stocks?.tracking_method === 'EXACT' ? (
                          <div className="flex items-end gap-1">
                            <span className={`font-bold text-lg ${
                              mov.quantity_delta > 0 ? 'text-emerald-500' : mov.quantity_delta < 0 ? 'text-amber-500' : 'text-foreground'
                            }`}>
                              {mov.quantity_delta > 0 ? '+' : ''}{mov.quantity_delta}
                            </span>
                            <span className="text-xs text-muted-foreground mb-1">{mov.stocks?.unit.replace(/[\d.,\s]/g, '') || 'pcs'}</span>
                          </div>
                        ) : (
                          <div className="flex items-end gap-1">
                            <span className={`font-bold text-lg ${
                              mov.usage_delta > 0 ? 'text-amber-500' : mov.usage_delta < 0 ? 'text-emerald-500' : 'text-foreground'
                            }`}>
                              {mov.usage_delta > 0 ? '+' : ''}{mov.usage_delta}
                            </span>
                            <span className="text-xs text-muted-foreground mb-1">Pakai</span>
                          </div>
                        )}
                        {isRestock && mov.stocks?.tracking_method === 'CHECKPOINT' && (
                          <p className="text-[10px] text-emerald-500 font-medium">Siklus Direset (0)</p>
                        )}
                        {isRestock && mov.restockData && (
                          <div className="flex flex-col items-end border-t border-border/10 pt-1 mt-1">
                            <span className="text-[11px] font-semibold text-emerald-500">Rp {mov.restockData.price.toLocaleString('id-ID')}</span>
                            <span className="text-[9px] text-muted-foreground uppercase">Rp {mov.restockData.unit_cost.toLocaleString('id-ID', {maximumFractionDigits:0})}/unit</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
