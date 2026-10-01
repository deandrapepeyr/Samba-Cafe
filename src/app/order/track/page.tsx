'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCustomerSession } from '@/lib/customerSession';
import { CheckCircle2, Circle, QrCode, Clock, RefreshCw, AlertCircle, ChevronLeft, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function OrderTrackingPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNotifiedReady, setHasNotifiedReady] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [queueCount, setQueueCount] = useState<number | null>(null);

  useEffect(() => {
    const currentSession = getCustomerSession();
    if (!currentSession) {
      router.replace('/order');
      return;
    }
    setSession(currentSession);

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .eq('customer_session_id', currentSession.sessionId)
        .order('created_at', { ascending: true });
        
      if (data && data.length > 0) {
        setOrders(data);
        
        // Count active queue ahead of this order
        const firstOrder = data[0];
        const { count } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'preparing'])
          .lt('created_at', firstOrder.created_at);
          
        setQueueCount(count);
      } else {
        setOrders([]);
      }
      setIsLoading(false);
    };

    fetchOrders();

    const channel = supabase
      .channel(`order_tracking_${currentSession.sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          setOrders(prev => {
            const exists = prev.some(o => o.id === (payload.new as any)?.id || o.id === (payload.old as any)?.id);
            if (
              exists || 
              (payload.new && (payload.new as any).customer_session_id === currentSession.sessionId) ||
              (payload.old && ['pending', 'preparing'].includes((payload.old as any).status)) ||
              (payload.new && ['pending', 'preparing'].includes((payload.new as any).status))
            ) {
              fetchOrders();
            }
            return prev;
          });
        }
      )
      .subscribe();

    const pollInterval = setInterval(() => {
      fetchOrders();
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [router]);

  const isReady = orders.some(o => o.status === 'ready');

  useEffect(() => {
    if (isReady && !hasNotifiedReady) {
      setHasNotifiedReady(true);
      setShowReadyModal(true);
      
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
        osc.frequency.setValueAtTime(1174.66, audioCtx.currentTime + 0.3); // D6
        
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
      } catch (e) {
        console.log('Audio playback error', e);
      }
    }
  }, [isReady, hasNotifiedReady]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCw className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="h-[100dvh] bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
        <div className="bg-zinc-900/50 border-b border-white/5 px-6 pt-12 pb-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-black mb-1">Status Pesanan</h1>
            <p className="text-sm font-medium text-zinc-400">Meja/Nama: {session.customerName}</p>
          </div>
          <button onClick={() => router.push('/order')} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft size={24} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
          <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-600 mb-2">
            <Clock size={40} />
          </div>
          <h2 className="text-xl font-bold">Belum Ada Pesanan Aktif</h2>
          <p className="text-zinc-500 text-sm max-w-[250px] mx-auto">
            Kamu belum membuat pesanan atau semua pesananmu sudah selesai.
          </p>
          <Button 
            onClick={() => router.push('/order')}
            className="mt-6 h-12 px-8 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-bold"
          >
            Pesan Sekarang
          </Button>
        </div>
      </div>
    );
  }

  // Synthesize state from all orders
  const allItems = orders.flatMap(o => o.transaction_items || []);
  const grandTotal = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  const isPaid = orders.some(o => o.payment_status === 'PAID');
  const isWaitingPayment = orders.some(o => o.payment_status === 'WAITING_CONFIRMATION');
  const isRejected = orders.some(o => o.payment_status === 'PAYMENT_REJECTED');
  
  const isPending = orders.some(o => o.status === 'pending');
  const isCompleted = orders.every(o => o.status.startsWith('completed'));
  // isReady is defined above
  const isPreparing = orders.some(o => o.status === 'preparing');

  let queueNumber = '-';
  if (orders.length > 0) {
    const idParts = orders[0].id.split('_');
    const seq = parseInt(idParts[idParts.length - 1], 10);
    if (!isNaN(seq)) {
      queueNumber = seq.toString();
    }
  }

  const steps = [
    { label: 'Pesanan Diterima', active: true, completed: true },
    { label: 'Sedang Disiapkan', active: isPreparing || isReady || isCompleted, completed: isReady || isCompleted },
    { label: 'Pesanan Siap', active: isReady || isCompleted, completed: isCompleted },
    { label: 'Selesai', active: isCompleted, completed: isCompleted }
  ];

  let currentStatusLabel = 'Pesanan Diproses';
  if (isCompleted) currentStatusLabel = 'Pesanan Selesai';
  else if (isReady) currentStatusLabel = 'Pesanan Siap Diambil';
  else if (isPending) currentStatusLabel = 'Menunggu Konfirmasi Kasir';
  else if (isPreparing) currentStatusLabel = 'Pesanan Sedang Disiapkan';
  else if (isPaid) currentStatusLabel = 'Pembayaran Berhasil';
  else if (isRejected) currentStatusLabel = 'Pembayaran Ditolak';

  return (
    <div className="h-[100dvh] bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-900/50 border-b border-white/5 px-6 pt-12 pb-6 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-black mb-1">Tagihan & Pesanan</h1>
          <p className="text-sm font-medium text-zinc-400">Meja/Nama: {session.customerName}</p>
        </div>
        <button onClick={() => router.push('/order')} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
          <ChevronLeft size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 w-full max-w-md mx-auto pb-24">
        
        {/* Queue Info Card */}
        {(!isReady && !isCompleted && !isRejected) && (
          <div className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl"></div>
            <div className="flex justify-between items-center relative z-10">
              <div>
                <p className="text-sm font-bold text-zinc-400 mb-1">Nomor Antrean</p>
                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                  {queueNumber}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-zinc-500 mb-1">Ada di depanmu</p>
                <div className="text-3xl font-bold text-white">
                  {queueCount !== null ? queueCount : '-'} <span className="text-lg text-zinc-400 font-medium">antrean</span>
                </div>
              </div>
            </div>
          </div>
        )}

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
              {orders[0]?.method === 'Bayar Nanti' && !isPending && 'Silakan lakukan pembayaran tunai di kasir.'}
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
          {allItems.map((item: any) => (
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
            <span>Total Tagihan</span>
            <span className="text-amber-500">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <Button 
          onClick={() => router.push('/order')}
          className="w-full h-14 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white font-bold rounded-2xl shadow-lg mt-4"
        >
          Pesan Menu Lain
        </Button>
      </div>
      {/* Ready Notification Modal */}
      <Dialog open={showReadyModal} onOpenChange={setShowReadyModal}>
        <DialogContent className="sm:max-w-sm bg-zinc-900 border-white/10 text-white rounded-[32px] p-6 text-center shadow-2xl">
          <div className="w-24 h-24 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce shadow-[0_0_40px_rgba(16,185,129,0.3)] border-4 border-emerald-500/30">
            <BellRing size={48} />
          </div>
          <DialogTitle className="text-2xl font-black mb-3 leading-tight">Yeay!<br/>Pesanan Siap 🎉</DialogTitle>
          <DialogDescription className="text-zinc-400 text-[15px] mb-8 leading-relaxed">
            Makanan & minuman kamu sudah siap nih. Silakan ambil langsung di meja kasir ya!
          </DialogDescription>
          <Button 
            onClick={() => setShowReadyModal(false)}
            className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Oke, Otw Ambil! 🏃
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
