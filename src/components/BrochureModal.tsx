'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Printer, Palette, Utensils } from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

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

  const heroProduct = products.find(p => p.name.toLowerCase().includes('katsu') && p.image_url) || products.find(p => p.image_url);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        // A5 Landscape width is approx 794px, height is approx 559px
        const containerWidth = containerRef.current.clientWidth - 32; // subtract padding
        const containerHeight = containerRef.current.clientHeight - 32;
        const targetWidth = 794;
        const targetHeight = 559;
        
        const scaleWidth = containerWidth / targetWidth;
        const scaleHeight = containerHeight / targetHeight;
        
        // Take the smaller scale to ensure both width and height fit completely
        let newScale = Math.min(scaleWidth, scaleHeight);
        if (newScale > 1.2) newScale = 1.2; // don't scale up too much on large screens
        
        setScale(newScale);
      }
    };
    
    // Slight delay to ensure DOM layout is complete before measuring
    setTimeout(updateScale, 50);
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[100vw] sm:max-w-[100vw] md:max-w-[100vw] lg:max-w-[100vw] h-[100vh] w-full p-0 bg-zinc-950 border-none flex flex-col m-0 rounded-none overflow-hidden print:bg-transparent">
        <DialogTitle className="sr-only">Cetak Brosur Menu</DialogTitle>
        
        {/* Top Action Bar */}
        <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-white/10 print:hidden z-50 shadow-xl shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Printer className="text-primary" size={20} />
              Brochure Generator (A5)
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
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden p-4 sm:p-8 bg-zinc-950 flex items-center justify-center print:p-0 print:bg-transparent print:block print:overflow-visible relative"
        >
          
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body { background: none !important; background-color: transparent !important; }
              body > * { display: none !important; }
              body > [data-radix-portal] { display: block !important; }
              .print-wrapper { position: absolute; left: 0; top: 0; transform: none !important; width: 100%; height: 100%; }
              @page { size: A5 landscape; margin: 0mm; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            .menu-leader {
              flex: 1;
              border-bottom: 1.5px dotted ${theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
              margin: 0 8px;
              position: relative;
              top: -5px;
            }
            .a5-canvas {
              width: 210mm;
              height: 148mm;
              transform-origin: center center;
            }
          `}} />

          {/* The A5 Canvas with dynamic scaling */}
          <div 
            className="print-wrapper w-full flex justify-center items-center transition-transform duration-300 ease-out" 
            style={{ transform: `scale(${scale})` }}
          >
            <div 
              ref={printRef}
              className={`a5-canvas relative shadow-2xl shrink-0 overflow-hidden print:shadow-none ${
                theme === 'dark' 
                  ? 'bg-[#151515] text-zinc-200' 
                  : 'bg-[#f4ebd0] text-[#3e2723]'
              }`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                fontFamily: "'Inter', sans-serif"
              }}
            >
              
              {/* === COLUMN 1: COVER & BRANDING === */}
              <div className={`p-6 flex flex-col justify-between border-r ${theme === 'dark' ? 'border-[#ffb300]/20 bg-[#0d0d0d]' : 'border-[#4e342e]/10 bg-[#fff8e1]'} relative overflow-hidden`}>
                
                {/* Decorative border top/bottom */}
                <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'dark' ? 'bg-[#ffb300]' : 'bg-[#e65100]'}`}></div>
                <div className={`absolute bottom-0 left-0 w-full h-2 ${theme === 'dark' ? 'bg-[#ffb300]' : 'bg-[#e65100]'}`}></div>

                <div className="text-center mt-6 relative z-10">
                  <div className={`inline-block p-3 rounded-full mb-4 shadow-xl border-2 ${theme === 'dark' ? 'bg-[#1a1a1a] border-[#ffb300]/20' : 'bg-white border-[#e65100]/20'}`}>
                    <Utensils size={40} className={theme === 'dark' ? 'text-[#ffb300]' : 'text-[#e65100]'} />
                  </div>
                  <h1 className="text-4xl font-black tracking-tighter mb-2 leading-none">
                    SAMBA <br/><span className={theme === 'dark' ? 'text-[#ffb300] italic font-serif' : 'text-[#e65100] italic font-serif'}>CAFE</span>
                  </h1>
                  <p className={`text-xs uppercase tracking-[0.25em] font-bold ${theme === 'dark' ? 'text-zinc-500' : 'text-[#5d4037]'}`}>
                    Premium Taste
                  </p>
                </div>

                {heroProduct?.image_url && (
                  <div className={`w-32 h-32 mx-auto rounded-full overflow-hidden border-4 relative shadow-2xl z-10 ${theme === 'dark' ? 'border-[#ffb300]' : 'border-[#e65100]'}`}>
                    <img src={heroProduct.image_url} alt="Signature" className="w-full h-full object-cover scale-110" />
                  </div>
                )}

                <div className="text-center mb-4 relative z-10">
                  <h3 className={`font-black mb-2 text-sm uppercase tracking-widest ${theme === 'dark' ? 'text-[#ffb300]' : 'text-[#e65100]'}`}>Lokasi Kami</h3>
                  <p className={`text-[10px] leading-relaxed font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-[#5d4037]'}`}>
                    Jl. Samba No. 123, Kota Bahagia<br/>
                    Telp. 0812-3456-7890<br/>
                    @sambacafe_id
                  </p>
                </div>
              </div>

              {/* === COLUMN 2: FOOD & SNACKS === */}
              <div className={`p-6 border-r ${theme === 'dark' ? 'border-[#ffb300]/20' : 'border-[#4e342e]/10'} relative flex flex-col`}>
                <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'dark' ? 'bg-[#222]' : 'bg-[#d7ccc8]'}`}></div>
                <div className={`absolute bottom-0 left-0 w-full h-2 ${theme === 'dark' ? 'bg-[#222]' : 'bg-[#d7ccc8]'}`}></div>

                <div className={`inline-block py-1.5 px-4 rounded-full mb-5 self-start border ${theme === 'dark' ? 'border-[#ffb300] text-[#ffb300]' : 'border-[#e65100] text-[#e65100] bg-white'}`}>
                  <h2 className="text-[13px] font-black uppercase tracking-widest">
                    Makanan & Snack
                  </h2>
                </div>
                
                <div className="space-y-3 flex-1 text-[11px]">
                  {foodAndSnacks.map((product, idx) => (
                    // Hide products beyond a certain limit to prevent overflow
                    idx < 9 && (
                      <div key={product.id} className="flex flex-col">
                        <div className="flex items-end justify-between font-bold">
                          <span className={`whitespace-nowrap max-w-[130px] overflow-hidden text-ellipsis ${theme === 'dark' ? 'text-zinc-100' : 'text-[#3e2723]'}`}>{product.name}</span>
                          <div className="menu-leader"></div>
                          <span className={`${theme === 'dark' ? 'text-[#ffb300]' : 'text-[#e65100]'}`}>
                            {product.price / 1000}K
                          </span>
                        </div>
                      </div>
                    )
                  ))}
                  {foodAndSnacks.length > 9 && (
                    <div className="text-[10px] text-center italic text-zinc-500 pt-1">...and more in store!</div>
                  )}
                </div>

                <div className="mt-4 flex gap-4 justify-center">
                  {foodAndSnacks.filter(p => p.image_url).slice(0, 2).map((p, i) => (
                    <div key={p.id} className={`w-16 h-16 rounded-full overflow-hidden shadow-2xl border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-white'}`}>
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              {/* === COLUMN 3: DRINKS & DESSERT === */}
              <div className="p-6 relative flex flex-col">
                <div className={`absolute top-0 left-0 w-full h-2 ${theme === 'dark' ? 'bg-[#222]' : 'bg-[#d7ccc8]'}`}></div>
                <div className={`absolute bottom-0 left-0 w-full h-2 ${theme === 'dark' ? 'bg-[#222]' : 'bg-[#d7ccc8]'}`}></div>

                <div className={`inline-block py-1.5 px-4 rounded-full mb-5 self-start border ${theme === 'dark' ? 'border-[#ffb300] text-[#ffb300]' : 'border-[#e65100] text-[#e65100] bg-white'}`}>
                  <h2 className="text-[13px] font-black uppercase tracking-widest">
                    Minuman & Dessert
                  </h2>
                </div>
                
                <div className="space-y-3 flex-1 text-[11px]">
                  {drinksAndDesserts.map((product, idx) => (
                    idx < 9 && (
                      <div key={product.id} className="flex flex-col">
                        <div className="flex items-end justify-between font-bold">
                          <span className={`whitespace-nowrap max-w-[130px] overflow-hidden text-ellipsis ${theme === 'dark' ? 'text-zinc-100' : 'text-[#3e2723]'}`}>{product.name}</span>
                          <div className="menu-leader"></div>
                          <span className={`${theme === 'dark' ? 'text-[#ffb300]' : 'text-[#e65100]'}`}>
                            {product.price / 1000}K
                          </span>
                        </div>
                      </div>
                    )
                  ))}
                  {drinksAndDesserts.length > 9 && (
                    <div className="text-[10px] text-center italic text-zinc-500 pt-1">...and more in store!</div>
                  )}
                </div>

                <div className="mt-4 flex gap-4 justify-center">
                  {drinksAndDesserts.filter(p => p.image_url).slice(0, 2).map((p, i) => (
                    <div key={p.id} className={`w-16 h-16 rounded-full overflow-hidden shadow-2xl border-2 ${theme === 'dark' ? 'border-[#333]' : 'border-white'}`}>
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>

                <div className={`mt-auto pt-6 text-center text-[9px] font-bold tracking-widest uppercase ${theme === 'dark' ? 'text-zinc-600' : 'text-[#8d6e63]'}`}>
                  Terima Kasih Atas Kunjungan Anda!
                </div>
              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
