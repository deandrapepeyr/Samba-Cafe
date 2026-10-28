'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StockHistoryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/stock');
  }, [router]);

  return null;
}
