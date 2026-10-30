'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCustomerSession } from '@/lib/customerSession';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  RefreshCw, 
  AlertCircle, 
  ChevronLeft, 
  BellRing,
  Upload,
  Download,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Loader2,
  FileText,
  History,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function TypewriterText({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    setDisplayText('');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className="flex items-center">
      {displayText}
    </span>
  );
}

export default function OrderTrackingPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNotifiedReady, setHasNotifiedReady] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [queueCount, setQueueCount] = useState<number | null>(null);

  // Payment & Upload States for Unpaid Order
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isReplacingProof, setIsReplacingProof] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrisUrl, setQrisUrl] = useState('/qris-static.jpg');

  // 1. Initial Fetch & Session
  useEffect(() => {
    const currentSession = getCustomerSession();
    if (!currentSession) {
      router.replace('/order');
      return;
    }
    setSession(currentSession);

    const fetchQrisSetting = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'qris_image_url')
          .maybeSingle();
        if (data?.value) setQrisUrl(data.value);
      } catch {}
    };
    fetchQrisSetting();

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .eq('customer_session_id', currentSession.sessionId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true });
        
      if (data && data.length > 0) {
        setOrders(data);
        
        // Count active queue ahead of this customer's earliest order
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

  // 1. Orders needing payment (truly unpaid - no proof submitted yet)
  const needsPaymentOrders = orders.filter(o => 
    o.status === 'pending' && (
      o.payment_status === 'AWAITING_PAYMENT' || 
      !o.payment_proof_url
    )
  );

  const hasNeedsPayment = needsPaymentOrders.length > 0;
  const unpaidOrder = hasNeedsPayment ? needsPaymentOrders[needsPaymentOrders.length - 1] : null;

  // Combine items and totals across all active unpaid orders in this session
  const allUnpaidItems = needsPaymentOrders.flatMap(o => o.transaction_items || []);
  const allUnpaidTotal = needsPaymentOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  // 2. Orders awaiting cashier confirmation (proof uploaded, waiting cashier)
  const waitingOrders = orders.filter(o =>
    o.status === 'pending' &&
    !!o.payment_proof_url &&
    !needsPaymentOrders.some(n => n.id === o.id)
  );
  const isWaitingCashier = !hasNeedsPayment && waitingOrders.length > 0;
  const latestWaitingOrder = isWaitingCashier ? waitingOrders[waitingOrders.length - 1] : null;
  const allWaitingItems = waitingOrders.flatMap(o => o.transaction_items || []);
  const allWaitingTotal = waitingOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const isStatusCompleted = (status: string) => typeof status === 'string' && status.startsWith('completed');

  // 3. Paid & Confirmed Orders
  const paidOrders = orders.filter(o => 
    !needsPaymentOrders.some(no => no.id === o.id) && 
    !waitingOrders.some(wo => wo.id === o.id) &&
    (o.payment_status === 'PAID' || ['preparing', 'ready'].includes(o.status) || isStatusCompleted(o.status))
  );

  // Active Cooking / Ready Orders (EXCLUDING completed)
  const activePaidOrders = paidOrders.filter(o => !isStatusCompleted(o.status));
  const isOrderConfirmed = activePaidOrders.length > 0 && !hasNeedsPayment && !isWaitingCashier;

  // 4. Completed Orders (Moved to History)
  const completedOrders = orders.filter(o => isStatusCompleted(o.status));

  // Overall check: whether there are active ongoing orders
  const hasActiveOrders = hasNeedsPayment || isWaitingCashier || isOrderConfirmed;

  // Tab State: 'active' | 'history'
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Automatically switch tab when all active orders are done
  useEffect(() => {
    if (!hasActiveOrders && completedOrders.length > 0) {
      setActiveTab('history');
    } else if (hasActiveOrders) {
      setActiveTab('active');
    }
  }, [hasActiveOrders, completedOrders.length]);

  // 2. Countdown timer for unpaid order
  useEffect(() => {
    if (!unpaidOrder) {
      setTimeLeft(null);
      return;
    }

    const createdAtMs = new Date(unpaidOrder.created_at).getTime();
    const expiresAtMs = createdAtMs + 5 * 60 * 1000;
    const initialRemaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
    setTimeLeft(initialRemaining);

    if (initialRemaining <= 0) {
      handleAutoExpire(needsPaymentOrders.map(o => o.id));
      router.replace('/order');
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        handleAutoExpire(needsPaymentOrders.map(o => o.id));
        router.replace('/order');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [unpaidOrder?.id, needsPaymentOrders.length, router]);

  // Handle auto expire
  const handleAutoExpire = async (targetIds: string | string[]) => {
    const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
    try {
      await Promise.all(ids.map(id =>
        fetch('/api/cancel-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: id, reason: 'EXPIRED' })
        })
      ));
    } catch (err) {
      console.error('Failed to notify auto-expire', err);
    }
  };

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1-Click Copy Nominal
  const handleCopyAmount = () => {
    const totalToCopy = hasNeedsPayment ? allUnpaidTotal : allWaitingTotal;
    if (totalToCopy <= 0) return;
    navigator.clipboard.writeText(totalToCopy.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Image compressor for fast network & quick AI inference
  const compressImage = async (imgFile: File, maxWidth = 1200, quality = 0.8): Promise<File> => {
    if (!imgFile.type.startsWith('image/')) return imgFile;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(imgFile);
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) return resolve(imgFile);
            const compressed = new File([blob], imgFile.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressed);
          }, 'image/jpeg', quality);
        };
        img.onerror = () => resolve(imgFile);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(imgFile);
      reader.readAsDataURL(imgFile);
    });
  };

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setErrorMessage(null);
    }
  };

  // Handle upload proof without AI check on customer side
  const handleUploadProof = async () => {
    const targetOrder = unpaidOrder || latestWaitingOrder;
    if (!file || !targetOrder) {
      setErrorMessage('Pilih gambar bukti pembayaran terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append('file', compressed);

      const uploadRes = await fetch('/api/upload-proof', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success || !uploadData.imageUrl) {
        throw new Error(uploadData.error || 'Gagal mengupload gambar bukti transfer');
      }

      const imageUrl = uploadData.imageUrl;

      const targetOrders = needsPaymentOrders.length > 0 ? needsPaymentOrders : (waitingOrders.length > 0 ? waitingOrders : [targetOrder]);
      const targetIds = targetOrders.map(o => o.id);

      // Update Supabase: status WAITING_CONFIRMATION & payment_proof_url
      await supabase
        .from('transactions')
        .update({
          payment_proof_url: imageUrl,
          payment_status: 'WAITING_CONFIRMATION'
        })
        .in('id', targetIds);

      // 🚀 Immediately fire AI verification for each order — no need to wait for cashier page
      // Fire-and-forget: don't await, customer doesn't need to wait for AI result
      for (const order of targetOrders) {
        fetch('/api/verify-proof', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            imageUrl,
            expectedAmount: order.total,
            force: true
          })
        }).catch(err => console.error('AI verify fire-and-forget error:', err));
      }

      setFile(null);
      setPreviewUrl(null);
      setIsReplacingProof(false);
    } catch (err: any) {
      console.error('Error during proof upload:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat mengunggah bukti transfer. Coba lagi.');
    } finally {
      setIsUploading(false);
    }
  };


  // Customer voluntary cancellation
  const handleCancelOrder = async () => {
    const targetOrders = needsPaymentOrders.length > 0 ? needsPaymentOrders : waitingOrders;
    if (targetOrders.length === 0) return;
    const confirmCancel = window.confirm('Apakah Anda yakin ingin membatalkan pesanan ini?');
    if (!confirmCancel) return;

    try {
      const ids = targetOrders.map(o => o.id);
      await Promise.all(ids.map(id =>
        fetch('/api/cancel-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: id, reason: 'CANCELLED_BY_USER' })
        })
      ));
      router.replace('/order');
    } catch (err) {
      console.error(err);
      router.replace('/order');
    }
  };

  // Ready Sound & Modal Notification
  const isReady = activePaidOrders.some(o => o.status === 'ready');

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

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <RefreshCw className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  // Empty Screen
  if (orders.length === 0) {
    return (
      <div className="h-[100dvh] bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
        <div className="bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5 px-4 pt-6 pb-4 flex items-center justify-between shrink-0 sticky top-0 z-40">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Samba Cafe</span>
            <h1 className="text-xl font-black leading-none text-white flex items-center">
              <TypewriterText text="Belum Ada Pesanan" />
            </h1>
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

  const isPreparing = activePaidOrders.some(o => o.status === 'preparing');
  const isRejected = orders.some(o => o.payment_status === 'PAYMENT_REJECTED');
  const isPending = activePaidOrders.some(o => o.status === 'pending');
  const isWaitingPayment = orders.some(o => o.payment_status === 'WAITING_CONFIRMATION' || o.payment_status === 'PENDING_VERIFICATION');

  let queueNumber = '-';
  if (activePaidOrders.length > 0) {
    const idParts = activePaidOrders[0].id.split('_');
    const seq = parseInt(idParts[idParts.length - 1], 10);
    if (!isNaN(seq)) {
      queueNumber = seq.toString();
    }
  }

  const steps = [
    { label: 'Pesanan Diterima', active: true, completed: true },
    { label: 'Sedang Disiapkan', active: isPreparing || isReady, completed: isReady },
    { label: 'Pesanan Siap', active: isReady, completed: false },
    { label: 'Selesai', active: false, completed: false }
  ];

  let currentStatusLabel = 'Pesanan Diproses';
  if (isReady) currentStatusLabel = 'Pesanan Siap Diambil';
  else if (hasNeedsPayment) currentStatusLabel = 'Menunggu Pembayaran QRIS';
  else if (isWaitingCashier) currentStatusLabel = 'Menunggu Konfirmasi Kasir';
  else if (isPreparing) currentStatusLabel = 'Pesanan Sedang Disiapkan';
  else if (isPending) currentStatusLabel = 'Menunggu Diproses';

  const isWarningTime = timeLeft !== null && timeLeft <= 60;

  return (
    <div className="h-[100dvh] bg-[#0a0a0a] text-white flex flex-col overflow-hidden selection:bg-amber-500/30">
      
      {/* Top Header */}
      <header className="bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-4 pt-5 pb-4 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/order')} 
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-zinc-300"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
              Samba Cafe
            </span>
            <h1 className="text-base font-black leading-none text-white">
              {activeTab === 'history'
                ? 'Riwayat Pesanan'
                : hasNeedsPayment || isReplacingProof 
                ? (needsPaymentOrders.some(o => o.payment_status === 'PAYMENT_REJECTED') ? 'Bukti Ditolak — Upload Ulang' : 'Pembayaran & Pesanan')
                : isWaitingCashier 
                ? 'Menunggu Kasir'
                : activePaidOrders.length > 0
                ? 'Pantau Pesanan Anda'
                : 'Status Pesanan'}
            </h1>
          </div>
        </div>

        {/* Live Countdown Badge if Unpaid */}
        {hasNeedsPayment && timeLeft !== null && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold text-xs tracking-wide transition-all shadow-md ${
            isWarningTime 
              ? 'bg-red-500/15 border-red-500/40 text-red-400 animate-pulse shadow-red-500/10' 
              : 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-amber-500/5'
          }`}>
            <Clock size={14} className={isWarningTime ? 'animate-bounce' : ''} />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 space-y-5 w-full max-w-md mx-auto pb-24 min-h-0">
        
        {/* Tab Switcher (Visible if customer has completed orders) */}
        {completedOrders.length > 0 && (
          <div className="flex bg-zinc-900/90 border border-white/10 rounded-2xl p-1 gap-1 sticky top-0 z-20 backdrop-blur-md shadow-lg">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock size={14} />
              <span>Pesanan Aktif</span>
              {hasActiveOrders && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <History size={14} />
              <span>Riwayat</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'history' ? 'bg-black/20 text-black' : 'bg-white/10 text-zinc-300'
              }`}>
                {completedOrders.length}
              </span>
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* CASE 1: UNPAID / NEEDS PAYMENT / RE-UPLOAD PROOF         */}
        {/* ======================================================== */}
        {activeTab === 'active' && (hasNeedsPayment || isReplacingProof) && (
          <>
            {/* If replacing proof while waiting cashier, allow canceling replacement */}
            {isReplacingProof && (
              <div className="flex items-center justify-between bg-zinc-900 border border-white/10 rounded-2xl p-3">
                <span className="text-xs text-zinc-300">Mode ganti foto bukti transfer</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setIsReplacingProof(false)}
                  className="h-7 text-xs text-zinc-400 hover:text-white"
                >
                  Batal Ganti
                </Button>
              </div>
            )}

            {/* 5-Minute Warning Bar (Only if active countdown) */}
            {timeLeft !== null && (
              <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-center gap-3 ${
                isWarningTime
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
              }`}>
                <AlertTriangle size={18} className="shrink-0 text-amber-400" />
                <span>
                  {isWarningTime 
                    ? 'Waktu hampir habis! Segera upload bukti transfer sebelum pesanan otomatis dibatalkan.'
                    : 'Selesaikan pembayaran & upload bukti transfer dalam 5 menit sebelum pesanan dibatalkan otomatis.'}
                </span>
              </div>
            )}


            {/* DETAIL PESANAN CARD */}
            <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-900/50 border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Tagihan Pesanan</span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {(hasNeedsPayment ? needsPaymentOrders : waitingOrders).map(o => '#' + o.id).join(' • ')}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">
                  Pemesan: <strong className="text-white">{session?.customerName || unpaidOrder?.customer_name || latestWaitingOrder?.customer_name}</strong>
                </span>
              </div>

              {/* Itemized List */}
              <div className="space-y-2.5 my-3">
                {(hasNeedsPayment ? allUnpaidItems : allWaitingItems).map((item: any) => (
                  <div key={item.id} className="flex items-start justify-between text-sm">
                    <div className="flex items-start gap-2.5">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-xs shrink-0 mt-0.5">
                        {item.quantity}x
                      </span>
                      <div>
                        <p className="font-bold text-zinc-100 leading-tight">{item.product_name}</p>
                        {item.notes && <p className="text-xs text-zinc-400 mt-0.5 italic">{item.notes}</p>}
                      </div>
                    </div>
                    <span className="font-semibold text-zinc-300 shrink-0 ml-3">
                      Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total Tagihan Bar */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Pembayaran</span>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
                    Rp {(hasNeedsPayment ? allUnpaidTotal : allWaitingTotal).toLocaleString('id-ID')}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAmount}
                  className="h-9 px-3 rounded-xl border-white/10 hover:border-amber-500/40 bg-white/5 hover:bg-amber-500/10 text-xs font-semibold gap-1.5 transition-all text-zinc-200"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Salin</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* QRIS CARD */}
            <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
              <div className="mb-3">
                <h2 className="text-base font-extrabold text-white">Scan QRIS Samba Cafe</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Bisa pakai GoPay, BCA, Mandiri, DANA, OVO, ShopeePay & Bank lain</p>
              </div>

              {/* QR Container */}
              <div className="bg-white p-2.5 rounded-2xl shadow-xl w-full max-w-[260px] aspect-[3/4.2] flex items-center justify-center overflow-hidden border border-zinc-200 group relative">
                <img 
                  src={qrisUrl} 
                  alt="QRIS Samba Cafe TN Sereal" 
                  className="w-full h-full object-contain rounded-xl"
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/300x420?text=QRIS+Samba+Cafe';
                  }}
                />
              </div>

              <a 
                href={qrisUrl} 
                download="QRIS-Samba-Cafe.jpg"
                className="mt-3 text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 py-1.5 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
              >
                <Download size={14} />
                <span>Download QRIS</span>
              </a>
            </div>

            {/* UPLOAD BUKTI PEMBAYARAN CARD */}
            <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Upload size={16} className="text-amber-400" />
                  Upload Bukti Pembayaran
                </h3>
              </div>

              <label className={`block relative border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                previewUrl 
                  ? 'border-amber-500/50 bg-amber-500/5' 
                  : 'border-white/15 hover:border-amber-500/40 bg-black/20 hover:bg-black/30'
              }`}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="hidden" 
                />

                {previewUrl ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-28 h-28 rounded-xl overflow-hidden border border-white/10 shadow-md">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-amber-400 font-semibold mt-1">Ganti Foto Bukti Transfer</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400">
                      <Upload size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-200">Klik untuk Pilih / Ambil Foto</p>
                      <p className="text-xs text-zinc-500 mt-0.5">JPG, PNG atau WebP (Maks 10MB)</p>
                    </div>
                  </div>
                )}
              </label>

              {/* Status Banner */}
              {isUploading && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3 animate-in fade-in">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
                  <div className="text-xs text-amber-200">
                    <p className="font-bold">Mengunggah bukti pembayaran...</p>
                    <p className="text-zinc-400 text-[11px]">Sedang mengirim bukti transfer</p>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="bg-red-500/15 border border-red-500/40 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in">
                  <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-200">
                    <p className="font-bold text-red-300">Gagal Mengunggah</p>
                    <p className="mt-0.5 leading-relaxed text-red-200">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <Button
                onClick={handleUploadProof}
                disabled={isUploading || !file}
                className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-base shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Mengunggah Bukti...</span>
                  </span>
                ) : (
                  'Kirim Bukti Pembayaran'
                )}
              </Button>

              {/* Voluntary cancel button */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={isUploading}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors font-medium underline"
                >
                  Batalkan Pesanan Ini
                </button>
              </div>
            </div>

            {/* PREVIOUS PAID ORDERS (IF ANY) */}
            {paidOrders.length > 0 && (
              <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pesanan Sebelumnya</span>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Sudah Lunas
                  </span>
                </div>
                {paidOrders.map(po => (
                  <div key={po.id} className="space-y-1 py-1">
                    {po.transaction_items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs text-zinc-300">
                        <span>{item.quantity}x {item.product_name}</span>
                        <span className="font-mono text-zinc-400">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ======================================================== */}
        {/* CASE 2: WAITING CASHIER CONFIRMATION (BUKTI TERKIRIM)     */}
        {/* ======================================================== */}
        {activeTab === 'active' && isWaitingCashier && !isReplacingProof && (
          <>
            {/* Status Card */}
            <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-900/50 border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/5">
                <CheckCircle2 size={28} className="text-amber-400" />
              </div>
              
              <div>
                <h2 className="text-lg font-black text-white">Bukti Pembayaran Terkirim</h2>
                <p className="text-xs text-zinc-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Bukti transfer Anda sudah diterima. Pesanan sedang menunggu konfirmasi kasir.
                </p>
              </div>

              {/* Uploaded proof preview */}
              {latestWaitingOrder?.payment_proof_url && (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-3 flex items-center gap-3 text-left">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-zinc-800">
                    <img 
                      src={latestWaitingOrder.payment_proof_url} 
                      alt="Bukti Transfer" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-zinc-200">Bukti Transfer Terlampir</p>
                    <p className="text-[11px] text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Menunggu konfirmasi kasir
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReplacingProof(true)}
                    className="h-8 px-2.5 text-xs rounded-xl border-white/10 hover:border-amber-500/40 bg-white/5 hover:bg-amber-500/10 text-zinc-300 font-semibold shrink-0"
                  >
                    Ganti Foto
                  </Button>
                </div>
              )}
            </div>

            {/* DETAIL PESANAN CARD */}
            <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Rincian Pesanan</span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {waitingOrders.map(o => '#' + o.id).join(' • ')}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">
                  Pemesan: <strong className="text-white">{session?.customerName || latestWaitingOrder?.customer_name}</strong>
                </span>
              </div>

              <div className="space-y-2.5 my-3">
                {allWaitingItems.map((item: any) => (
                  <div key={item.id} className="flex items-start justify-between text-sm">
                    <div className="flex items-start gap-2.5">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-xs shrink-0 mt-0.5">
                        {item.quantity}x
                      </span>
                      <div>
                        <p className="font-bold text-zinc-100 leading-tight">{item.product_name}</p>
                        {item.notes && <p className="text-xs text-zinc-400 mt-0.5 italic">{item.notes}</p>}
                      </div>
                    </div>
                    <span className="font-semibold text-zinc-300 shrink-0 ml-3">
                      Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Tagihan</span>
                  <div className="text-2xl font-black text-amber-400 tracking-tight">
                    Rp {allWaitingTotal.toLocaleString('id-ID')}
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Menunggu Kasir
                </span>
              </div>
            </div>

            {/* Voluntary cancel button */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleCancelOrder}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors font-medium underline"
              >
                Batalkan Pesanan Ini
              </button>
            </div>

            {/* PREVIOUS PAID ORDERS (IF ANY) */}
            {paidOrders.length > 0 && (
              <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pesanan Sebelumnya</span>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Sudah Lunas
                  </span>
                </div>
                {paidOrders.map(po => (
                  <div key={po.id} className="space-y-1 py-1">
                    {po.transaction_items?.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs text-zinc-300">
                        <span>{item.quantity}x {item.product_name}</span>
                        <span className="font-mono text-zinc-400">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ======================================================== */}
        {/* CASE 3: ALL ORDERS CONFIRMED / PAID (QUEUE & LIVE TRACK) */}
        {/* ======================================================== */}
        {activeTab === 'active' && isOrderConfirmed && (
          <>
            {/* Queue Info Card */}
            {(!isReady && !isRejected) && (
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
                  {isReady && 'Silakan ambil pesanan Anda di meja kasir.'}
                  {isPreparing && 'Koki kami sedang menyiapkan pesanan Anda dengan penuh cinta.'}
                  {isPending && !isWaitingPayment && 'Pesanan Anda sudah masuk dan sedang menunggu kasir.'}
                  {isWaitingPayment && 'Pesanan sedang diproses. Kasir sedang memeriksa bukti pembayaran.'}
                  {isRejected && 'Pembayaran tidak dapat diverifikasi. Silakan hubungi kasir.'}
                </p>
              </div>
            </div>

            {/* Order Tracking Stepper */}
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-sm text-zinc-400 mb-6">Status Perjalanan Pesanan</h3>
              <div className="relative">
                <div className="absolute left-3 top-2 bottom-2 w-[2px] bg-white/10" />
                
                <div className="space-y-6">
                  {steps.map((step, idx) => {
                    const isPast = step.completed;
                    const isCurrent = step.active && !step.completed;

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
              {activePaidOrders.flatMap(o => o.transaction_items || []).map((item: any) => (
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
                <span>Total Pembayaran (Lunas)</span>
                <span className="text-amber-500">
                  Rp {activePaidOrders.reduce((sum, o) => sum + (o.total || 0), 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <Button 
              onClick={() => router.push('/order')}
              className="w-full h-14 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white font-bold rounded-2xl shadow-lg mt-4"
            >
              Pesan Menu Lain (Tambahan)
            </Button>
          </>
        )}

        {/* CASE 4: EMPTY ACTIVE ORDERS (SEMUA SELESAI / BELUM ADA AKTIF) */}
        {activeTab === 'active' && !hasNeedsPayment && !isWaitingCashier && !isOrderConfirmed && !isReplacingProof && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 mb-2 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-xl font-black text-white">Tidak Ada Pesanan Aktif</h2>
            <p className="text-zinc-400 text-xs max-w-[280px] mx-auto leading-relaxed">
              {completedOrders.length > 0
                ? 'Semua pesanan Anda telah selesai disajikan. Ingin memesan menu lainnya?'
                : 'Anda belum memiliki pesanan aktif saat ini.'}
            </p>
            <div className="flex flex-col gap-2.5 w-full max-w-[260px] pt-2">
              <Button 
                onClick={() => router.push('/order')}
                className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Pesan Menu Baru
              </Button>
              {completedOrders.length > 0 && (
                <Button 
                  variant="outline"
                  onClick={() => setActiveTab('history')}
                  className="w-full h-11 rounded-2xl border-white/10 hover:bg-white/5 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <History size={14} /> Lihat Riwayat ({completedOrders.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CASE 5: RIWAYAT PESANAN (HISTORY)                        */}
        {/* ======================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <History size={16} className="text-amber-400" /> Riwayat Pesanan
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">Daftar pesanan yang sudah selesai di sesi ini</p>
              </div>
              <Button
                size="sm"
                onClick={() => router.push('/order')}
                className="h-8 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs gap-1 shadow-md"
              >
                <Plus size={13} /> Pesan Lagi
              </Button>
            </div>

            {completedOrders.length === 0 ? (
              <div className="text-center py-12 bg-zinc-900/40 border border-white/5 rounded-3xl p-6">
                <p className="text-xs text-zinc-500">Belum ada riwayat pesanan yang selesai</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...completedOrders].reverse().map((order) => {
                  const formattedDate = new Date(order.created_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'short'
                  });

                  return (
                    <div 
                      key={order.id} 
                      className="bg-gradient-to-b from-zinc-900/90 to-zinc-900/60 border border-white/10 rounded-3xl p-5 shadow-xl space-y-3"
                    >
                      {/* Order Header */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <div>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">ID Pesanan</span>
                          <span className="text-xs font-mono font-bold text-amber-400">#{order.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-400 font-medium">
                            {formattedDate} WIB
                          </span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1 shadow-sm shadow-emerald-500/10">
                            <CheckCircle2 size={11} /> Selesai
                          </span>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="space-y-2 py-1">
                        {order.transaction_items?.map((item: any) => (
                          <div key={item.id} className="flex items-start justify-between text-xs">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 font-bold text-[11px] shrink-0">
                                {item.quantity}x
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-zinc-200 truncate">{item.product_name}</p>
                                {item.notes && <p className="text-[10px] text-zinc-500 italic mt-0.5">{item.notes}</p>}
                              </div>
                            </div>
                            <span className="text-zinc-300 font-mono font-medium shrink-0 ml-3">
                              Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Total Row */}
                      <div className="pt-2.5 border-t border-white/5 flex items-center justify-between">
                        <span className="text-xs text-zinc-400 font-medium">Total Pembayaran</span>
                        <span className="font-bold text-sm text-amber-400 font-mono flex items-center gap-1.5">
                          Rp {order.total?.toLocaleString('id-ID')}
                          <span className="text-[10px] text-emerald-400 font-sans font-extrabold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Lunas
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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

