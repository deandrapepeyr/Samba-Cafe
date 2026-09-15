'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Printer, Palette, Image as ImageIcon, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  image_url?: string;
}

interface Category {
  id: string;
  name: string;
}

interface BrochureModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
}

export function BrochureModal({ isOpen, onClose, products, categories }: BrochureModalProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const getProductsByCatName = (names: string[]) => {
    const matchedCategories = categories.filter(c => names.some(n => c.name.toLowerCase().includes(n.toLowerCase())));
    const catIds = matchedCategories.map(c => c.id);
    return products.filter(p => catIds.includes(p.category_id));
  };

  const foodAndSnacks = getProductsByCatName(['food', 'snack']);
  const drinksAndDesserts = getProductsByCatName(['minuman', 'drink', 'dessert']);

  // Extract a hero image for the cover
  const heroProduct = products.find(p => p.name.toLowerCase().includes('katsu') && p.image_url) || products.find(p => p.image_url);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[100vw] h-[100vh] w-full p-0 bg-zinc-950 border-none flex flex-col m-0 rounded-none overflow-hidden print:bg-transparent" onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Cetak Brosur Menu</DialogTitle>
        
        {/* Top Action Bar (Hidden in Print) */}
        <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-white/10 print:hidden z-50 shadow-xl">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Printer className="text-primary" size={20} />
              Brochure Generator (A4)
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="border-white/10 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
            >
              <Palette size={16} className="mr-2 text-primary" />
              Theme: {theme === 'dark' ? 'Dark Premium' : 'Light Classic'}
            </Button>
            <Button 
              onClick={handlePrint}
              className="bg-primary text-black hover:bg-primary/90 font-bold"
            >
              <Printer size={16} className="mr-2" />
              Print / Save PDF
            </Button>
            <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white rounded-full w-10 h-10 p-0">
              <X size={24} />
            </Button>
          </div>
        </div>

        {/* Canvas Container */}
        <div className="flex-1 overflow-auto p-8 bg-zinc-950 flex items-center justify-center print:p-0 print:bg-transparent print:block print:overflow-visible relative">
          
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body {
                background: none !important;
                background-color: transparent !important;
              }
              body > *:not([role="dialog"]) {
                display: none !important;
              }
              .print-wrapper {
                position: absolute;
                left: 0;
                top: 0;
                width: 297mm;
                height: 210mm;
              }
              @page {
                size: A4 landscape;
                margin: 0mm;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            .menu-leader {
              flex: 1;
              border-bottom: 2px dotted ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
              margin: 0 10px;
              position: relative;
              top: -6px;
            }
          `}} />

          {/* The A4 Canvas */}
          <div className="print-wrapper w-full flex justify-center">
            <div 
              ref={printRef}
              className={`brochure-canvas relative shadow-2xl shrink-0 overflow-hidden print:shadow-none ${
                theme === 'dark' 
                  ? 'bg-[#0f0f0f] text-zinc-200' 
                  : 'bg-[#fdfbf6] text-[#2c3e2d]'
              }`}
              style={{
                width: '297mm',
                height: '210mm',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                fontFamily: "'Inter', sans-serif"
              }}
            >
              
              {/* === COLUMN 1: COVER & BRANDING === */}
              <div className={`p-10 flex flex-col justify-between border-r ${theme === 'dark' ? 'border-white/5' : 'border-[#2c3e2d]/10'} relative overflow-hidden`}>
                {/* Decorative background element */}
                <div className={`absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none ${theme === 'dark' ? '' : 'bg-[url("https://www.transparenttextures.com/patterns/rice-paper.png")]'}`} style={{ backgroundImage: theme === 'dark' ? 'radial-gradient(circle at 0% 0%, currentColor 1px, transparent 1px)' : '', backgroundSize: '20px 20px' }}></div>
                
                <div className="text-center mt-12 relative z-10">
                  <div className={`inline-block p-5 rounded-full mb-6 shadow-xl ${theme === 'dark' ? 'bg-[#1a1a1a] border border-primary/20' : 'bg-white border border-[#2c3e2d]/10'}`}>
                    <Utensils size={56} className={theme === 'dark' ? 'text-primary' : 'text-[#d97706]'} />
                  </div>
                  <h1 className="text-6xl font-black tracking-tighter mb-3 leading-none">
                    SAMBA <span className={theme === 'dark' ? 'text-primary italic font-serif' : 'text-[#d97706] italic font-serif'}>CAFE</span>
                  </h1>
                  <p className={`text-xl uppercase tracking-[0.2em] font-medium ${theme === 'dark' ? 'text-zinc-500' : 'text-[#5a6b5a]'}`}>
                    Mari Makan Enak!
                  </p>
                </div>

                {heroProduct?.image_url && (
                  <div className="w-56 h-56 mx-auto rounded-full overflow-hidden border-8 border-transparent relative shadow-2xl z-10" style={{ borderColor: theme === 'dark' ? '#eab308' : '#d97706' }}>
                    <img src={heroProduct.image_url} alt="Signature" className="w-full h-full object-cover scale-110" />
                  </div>
                )}

                <div className="text-center mb-8 relative z-10">
                  <h3 className={`font-bold mb-3 text-lg ${theme === 'dark' ? 'text-primary' : 'text-[#d97706]'}`}>📍 Lokasi Kami</h3>
                  <p className={`text-base leading-relaxed ${theme === 'dark' ? 'text-zinc-400' : 'text-[#5a6b5a]'}`}>
                    Jl. Samba No. 123, Kota Bahagia<br/>
                    Telp. 0812-3456-7890<br/>
                    @sambacafe_id
                  </p>
                </div>
              </div>

              {/* === COLUMN 2: FOOD & SNACKS === */}
              <div className={`p-10 border-r ${theme === 'dark' ? 'border-white/5' : 'border-[#2c3e2d]/10'} relative`}>
                <h2 className={`text-4xl font-black mb-8 uppercase tracking-wider ${theme === 'dark' ? 'text-primary' : 'text-[#2c3e2d]'}`}>
                  Makanan
                </h2>
                
                <div className="space-y-6">
                  {foodAndSnacks.map(product => (
                    <div key={product.id} className="flex flex-col">
                      <div className="flex items-end justify-between font-medium">
                        <span className={`text-lg whitespace-nowrap ${theme === 'dark' ? 'text-zinc-100' : 'text-[#2c3e2d] font-bold'}`}>{product.name}</span>
                        <div className="menu-leader"></div>
                        <span className={`text-lg font-bold ${theme === 'dark' ? 'text-zinc-300' : 'text-[#d97706]'}`}>
                          {product.price / 1000}K
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Decorative Images inside Col 2 */}
                <div className="mt-16 flex gap-6 justify-center">
                  {foodAndSnacks.filter(p => p.image_url).slice(0, 2).map((p, i) => (
                    <div key={p.id} className="w-32 h-32 rounded-full overflow-hidden shadow-2xl border-4" style={{ borderColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#ffffff' }}>
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              {/* === COLUMN 3: DRINKS & DESSERT === */}
              <div className="p-10 relative">
                <h2 className={`text-4xl font-black mb-8 uppercase tracking-wider ${theme === 'dark' ? 'text-primary' : 'text-[#2c3e2d]'}`}>
                  Minuman
                </h2>
                
                <div className="space-y-6">
                  {drinksAndDesserts.map(product => (
                    <div key={product.id} className="flex flex-col">
                      <div className="flex items-end justify-between font-medium">
                        <span className={`text-lg whitespace-nowrap ${theme === 'dark' ? 'text-zinc-100' : 'text-[#2c3e2d] font-bold'}`}>{product.name}</span>
                        <div className="menu-leader"></div>
                        <span className={`text-lg font-bold ${theme === 'dark' ? 'text-zinc-300' : 'text-[#d97706]'}`}>
                          {product.price / 1000}K
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Decorative Images inside Col 3 */}
                <div className="mt-16 flex gap-6 justify-center">
                  {drinksAndDesserts.filter(p => p.image_url).slice(0, 2).map((p, i) => (
                    <div key={p.id} className="w-32 h-32 rounded-full overflow-hidden shadow-2xl border-4" style={{ borderColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#ffffff' }}>
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>

                {/* Footer note in Col 3 */}
                <div className={`mt-auto pt-16 text-center text-sm font-medium ${theme === 'dark' ? 'text-zinc-600' : 'text-[#5a6b5a]/60'}`}>
                  Harga dapat berubah sewaktu-waktu.<br/>
                  *Gambar hanya ilustrasi.
                </div>
              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
