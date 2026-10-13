'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function RedirectToTrack() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/order/track');
  }, [router]);

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
      <p className="text-zinc-400 text-sm font-medium">Mengalihkan ke halaman pesanan...</p>
    </div>
  );
}

export default function OrderPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-zinc-400 text-sm font-medium">Memuat...</p>
      </div>
    }>
      <RedirectToTrack />
    </Suspense>
  );
}

