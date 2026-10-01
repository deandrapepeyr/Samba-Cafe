'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Printer, Download, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export default function QRGeneratorPage() {
  const [url, setUrl] = useState('');
  const { role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && role !== 'manager') {
      router.replace('/pos');
    }
  }, [role, isLoading, router]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(`${window.location.protocol}//${window.location.host}/order`);
    }
  }, []);

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(url)}`;

  if (role !== 'manager') return null;

  return (
    <MainLayout title="Cetak QR Menu">
      <div className="flex flex-col items-center p-8 min-h-[80vh]">
        <div className="text-center mb-10 print:hidden">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-amber-500/10 items-center justify-center text-amber-500 mb-4">
            <QrCode size={32} />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">QR Code Meja</h1>
          <p className="text-zinc-400 max-w-md mx-auto text-sm">
            Cetak (Print) barcode ini dan tempel di meja pelanggan atau kasir. Pelanggan cukup scan untuk langsung bisa memesan menu tanpa mengantre.
          </p>
        </div>

        <div id="print-section" className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl mb-10 flex flex-col items-center print:shadow-none print:w-full print:h-screen print:justify-center">
          <h2 className="text-black font-black text-3xl md:text-5xl tracking-tighter mb-2">SAMBA CAFE</h2>
          <p className="text-zinc-500 font-medium mb-8 text-sm md:text-base">Pesan & Bayar Tanpa Antre</p>
          
          <div className="border-8 border-black p-4 rounded-3xl mb-8 shadow-2xl shadow-black/20">
            {url ? (
               <img src={qrImageUrl} alt="QR Code" className="w-64 h-64 md:w-80 md:h-80 object-contain" />
            ) : (
               <div className="w-64 h-64 md:w-80 md:h-80 bg-zinc-200 animate-pulse rounded-2xl" />
            )}
          </div>
          
          <div className="flex items-center gap-4 bg-amber-500 text-black px-6 py-3 rounded-full font-black tracking-widest uppercase shadow-lg shadow-amber-500/30">
            <QrCode size={24} />
            <span>Scan Untuk Pesan</span>
          </div>
        </div>

        <div className="flex gap-4 print:hidden">
          <Button onClick={() => window.print()} className="h-14 px-8 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-lg shadow-amber-500/20">
            <Printer className="mr-2" size={20} /> Cetak (Print)
          </Button>
          <Button onClick={() => window.open(qrImageUrl, '_blank')} variant="outline" className="h-14 px-8 rounded-2xl border-white/10 text-white hover:bg-white/5 font-bold">
            <Download className="mr-2" size={20} /> Download Resolusi Tinggi
          </Button>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}} />
    </MainLayout>
  );
}
