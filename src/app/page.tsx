'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function Home() {
  const { role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (role === 'manager') {
        router.replace('/dashboard');
      } else {
        router.replace('/pos');
      }
    }
  }, [role, isLoading, router]);

  return <div className="h-screen bg-background" />;
}
