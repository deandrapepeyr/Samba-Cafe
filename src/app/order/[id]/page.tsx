'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCustomerSession } from '@/lib/customerSession';
import { CheckCircle2, Circle, QrCode, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OrderTrackingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentSession = getCustomerSession();
    if (!currentSession) {
      router.replace('/order');
      return;
    }
    setSession(currentSession);

    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .eq('id', id)
        .single();
        
      if (data && data.customer_session_id === currentSession.sessionId) {
        setOrder(data);
      } else {
        router.replace('/order');
      }
      setIsLoading(false);
    };

    fetchOrder();

    // Listen to real-time updates for this order
    const channel = supabase
      .channel(`order_tracking_${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `id=eq.${id}` },
        (payload) => {
          setOrder((prev: any) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, router]);



  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCw className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (!order) return null;

  // Derive logical stepper state
  const isPaid = order.payment_status === 'PAID';
  const isWaitingPayment = order.payment_status === 'WAITING_CONFIRMATION';
  const isRejected = order.payment_status === 'PAYMENT_REJECTED';
  const isPreparing = order.status === 'preparing';
  const isReady = order.status === 'ready';
  const isCompleted = order.status.startsWith('completed');
  
  // Status logic mapping to steps
  // 1. Order Received (Always true if we have the order)
  // 2. Payment Confirmed (True if PAID, or skipped if Open Bill?)
  // Wait, open bill can be tracked without payment. 
  // Let's adapt based on method.

  const steps = [
    { label: 'Order Diterima', active: true, completed: true },
    { 
      label: 'Pembayaran Dikonfirmasi', 
      active: true, 
      completed: isPaid || (order.method === 'Bayar Nanti' && isPaid) || isPreparing || isReady || isCompleted 
      // Note: for Bayar Nanti, it might go straight to preparing without payment confirmation
    },
    { label: 'Sedang Disiapkan', active: isPreparing || isReady || isCompleted, completed: isReady || isCompleted },
    { label: 'Pesanan Siap', active: isReady || isCompleted, completed: isCompleted },
    { label: 'Selesai', active: isCompleted, completed: isCompleted }
  ];

  const isPending = order.status === 'pending';
  
  const currentStatusLabel = 
    isCompleted ? 'Pesanan Selesai' :
    isReady ? 'Pesanan Siap Diambil' :
    isPreparing ? 'Pesanan Sedang Disiapkan' :
    isPending ? 'Menunggu Konfirmasi Kasir' :
    isPaid ? 'Pembayaran Berhasil' :
    isRejected ? 'Pembayaran Ditolak' :
    'Pesanan Diproses';

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white flex flex-col pb-12">
      {/* Header */}
      <div className="bg-zinc-900/50 border-b border-white/5 px-6 pt-12 pb-6">
        <h1 className="text-xl font-black mb-1">Detail Pesanan</h1>
        <p className="text-sm font-medium text-zinc-400">ID: {order.id.replace('order_', '')}</p>
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 max-w-md mx-auto w-full">
        {/* Real-time Status Banner */}
        <div className={`p-4 rounded-2xl border flex items-start gap-4 shadow-xl ${
          isReady ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-emerald-500/10' :
          isPreparing ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-amber-500/10' :
          isRejected ? 'bg-red-500/10 border-red-500 text-red-400 shadow-red-500/10' :
          'bg-zinc-900/50 border-white/10 text-zinc-100'
        }`}>
          {isReady ? <CheckCircle2 size={24} className="mt-1 shrink-0" /> : 
           isRejected ? <AlertCircle size={24} className="mt-1 shrink-0" /> :
           <RefreshCw size={24} className="animate-spin mt-1 shrink-0" />}
          <div>
            <h2 className="font-bold text-lg leading-tight mb-1">{currentStatusLabel}</h2>
            <p className="text-xs opacity-80">
              {isReady && 'Silakan ambil pesanan Anda di kasir.'}
              {isPreparing && 'Koki kami sedang membuat pesanan Anda dengan penuh cinta.'}
              {isPending && 'Pesanan Anda sudah masuk dan sedang menunggu kasir untuk menerimanya.'}
              {isWaitingPayment && 'Kasir sedang mengecek pembayaran Anda.'}
              {isRejected && 'Pembayaran tidak dapat diverifikasi. Silakan hubungi kasir atau coba lagi.'}
              {order.payment_status === 'UNPAID' && order.method === 'Bayar Nanti' && !isPending && 'Silakan lakukan pembayaran tunai di kasir.'}
            </p>
          </div>
        </div>


        {/* Order Tracking Stepper */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-sm text-zinc-400 mb-6">Status Perjalanan Pesanan</h3>
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-3 top-2 bottom-2 w-[2px] bg-white/10" />
            
            <div className="space-y-6">
              {steps.map((step, idx) => {
                const isPast = step.completed;
                const isCurrent = step.active && !step.completed;
                const isFuture = !step.active && !step.completed;

                return (
                  <div key={idx} className="flex items-center gap-4 relative">
                    <div className="relative z-10 shrink-0 bg-[#121212]">
                      {isPast ? (
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center">
                          <CheckCircle2 size={14} strokeWidth={3} />
                        </div>
                      ) : isCurrent ? (
                        <div className="w-6 h-6 rounded-full border-2 border-amber-500 bg-amber-500/20 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-white/10 bg-zinc-900 flex items-center justify-center">
                          <Circle size={10} className="text-transparent" />
                        </div>
                      )}
                    </div>
                    <div className={`font-semibold text-sm ${isPast || isCurrent ? 'text-zinc-100' : 'text-zinc-600'}`}>
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Items Summary */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-zinc-400 border-b border-white/5 pb-3">Daftar Item</h3>
          {order.transaction_items?.map((item: any) => (
            <div key={item.id} className="flex items-start justify-between text-sm">
              <div>
                <div className="font-bold text-zinc-200">
                  <span className="text-amber-500 mr-2">{item.quantity}x</span>
                  {item.product_name}
                </div>
                {item.notes && <p className="text-[11px] text-zinc-500 ml-6">{item.notes}</p>}
              </div>
              <span className="font-medium text-zinc-400">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-3 border-t border-white/5 text-base font-black">
            <span>Total</span>
            <span className="text-amber-500">Rp {order.total.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
