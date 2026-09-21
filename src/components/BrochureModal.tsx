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

  const displayCategories = categories.filter(c => 
    c.id !== '1' && 
    !c.name.toLowerCase().includes('ciki') && 
    products.some(p => p.category_id === c.id)
  );

  const heroProduct = products.find(p => p.name.toLowerCase().includes('katsu') && p.image_url) || products.find(p => p.image_url);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        // A5 Landscape width is approx 794px, height is approx 559px
        const containerWidth = containerRef.current.clientWidth - 32; // subtract padding
        
        // Since we now stack 2 pages vertically, we just want to scale to fit width mainly,
        // or ensure it fits height if window is super wide and short. 
        // We'll scale to fit width since user can scroll vertically.
        const targetWidth = 794;
        
        let newScale = containerWidth / targetWidth;
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
              Brochure Generator (A5 - 2 Pages)
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
          className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-950 flex flex-col items-center print:p-0 print:bg-transparent print:block print:overflow-visible relative"
        >
          
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * { visibility: hidden; }
              .print-wrapper, .print-wrapper * { visibility: visible; }
              .print-wrapper { position: absolute; left: 0; top: 0; width: 100%; transform: none !important; }
              @page { size: A5 landscape; margin: 0; }
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
            }
          `}} />

          {/* The Wrapper containing both A5 canvases */}
          <div 
            className="print-wrapper w-full max-w-[210mm] flex flex-col gap-10 items-center transition-transform duration-300 ease-out pb-20 print:pb-0" 
            style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
          >
            
            {/* PAGE 1: COVER & BRANDING */}
            <div 
              className={`a5-canvas relative shadow-2xl shrink-0 overflow-hidden print:shadow-none ${
                theme === 'dark' 
                  ? 'bg-[#151515] text-zinc-200' 
                  : 'bg-[#f4ebd0] text-[#3e2723]'
              }`}
              style={{
                fontFamily: "'Inter', sans-serif",
                pageBreakAfter: 'always',
                breakAfter: 'page'
              }}
            >
              <div className={`w-full h-full p-8 flex flex-col justify-center items-center border-x-[12px] ${theme === 'dark' ? 'border-[#ffb300]/20 bg-[#0d0d0d]' : 'border-[#4e342e]/10 bg-[#fff8e1]'} relative overflow-hidden`}>
                
                {/* Decorative border top/bottom */}
                <div className={`absolute top-0 left-0 w-full h-3 ${theme === 'dark' ? 'bg-[#ffb300]' : 'bg-[#e65100]'}`}></div>
                <div className={`absolute bottom-0 left-0 w-full h-3 ${theme === 'dark' ? 'bg-[#ffb300]' : 'bg-[#e65100]'}`}></div>

                <div className="text-center mt-6 relative z-10">
                  <div className={`inline-flex p-4 rounded-full mb-6 shadow-xl border-4 ${theme === 'dark' ? 'bg-[#1a1a1a] border-[#ffb300]/20' : 'bg-white border-[#e65100]/20'}`}>
                    <Utensils size={56} className={theme === 'dark' ? 'text-[#ffb300]' : 'text-[#e65100]'} />
                  </div>
                  <h1 className="text-6xl font-black tracking-tighter mb-4 leading-none">
                    SAMBA <br/><span className={theme === 'dark' ? 'text-[#ffb300] italic font-serif' : 'text-[#e65100] italic font-serif'}>CAFE</span>
                  </h1>
                  <p className={`text-sm uppercase tracking-[0.4em] font-bold ${theme === 'dark' ? 'text-zinc-500' : 'text-[#5d4037]'}`}>
                    Premium Taste
                  </p>
                </div>

                {heroProduct?.image_url && (
                  <div className={`w-40 h-40 mx-auto rounded-full overflow-hidden border-[6px] relative shadow-2xl z-10 my-6 ${theme === 'dark' ? 'border-[#ffb300]' : 'border-[#e65100]'}`}>
                    <img src={heroProduct.image_url} alt="Signature" className="w-full h-full object-cover scale-110" />
                  </div>
                )}

                {(() => {
                  const galleryItems = products.filter(p => displayCategories.some(c => c.id === p.category_id) && p.image_url).slice(0, 8);
                  if (galleryItems.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-3 justify-center items-center my-4 z-10 w-full max-w-xl">
                      {galleryItems.map(p => (
                        <div key={p.id} className={`shrink-0 w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 ${theme === 'dark' ? 'border-[#2a2a2a] shadow-black/50' : 'border-white shadow-[#4e342e]/10'}`}>
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="text-center mt-auto mb-2 relative z-10">
                  <h3 className={`font-black mb-3 text-base uppercase tracking-widest ${theme === 'dark' ? 'text-[#ffb300]' : 'text-[#e65100]'}`}>Lokasi Kami</h3>
                  <p className={`text-xs leading-relaxed font-bold ${theme === 'dark' ? 'text-zinc-400' : 'text-[#5d4037]'}`}>
                    Jl. Samba No. 123, Kota Bahagia<br/>
                    Telp. 0812-3456-7890 &nbsp; | &nbsp; @sambacafe_id
                  </p>
                </div>
              </div>
            </div>

            {/* PAGE 2: MENU LIST */}
            <div 
              className={`a5-canvas relative shadow-2xl shrink-0 overflow-hidden print:shadow-none ${
                theme === 'dark' 
                  ? 'bg-[#151515] text-zinc-200' 
                  : 'bg-[#f4ebd0] text-[#3e2723]'
              }`}
              style={{
                fontFamily: "'Inter', sans-serif"
              }}
            >
              <div className="w-full h-full p-6 sm:p-8 relative flex flex-col overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-3 ${theme === 'dark' ? 'bg-[#222]' : 'bg-[#d7ccc8]'}`}></div>
                <div className={`absolute bottom-0 left-0 w-full h-3 ${theme === 'dark' ? 'bg-[#222]' : 'bg-[#d7ccc8]'}`}></div>

                <div className="text-center mb-6 mt-1">
                   <h2 className={`text-2xl font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-[#ffb300]' : 'text-[#e65100]'}`}>Daftar Menu</h2>
                </div>

                <div 
                  className="flex-1 w-full" 
                  style={{ 
                    columnCount: 3, 
                    columnGap: '2.5rem',
                    columnRule: `1px solid ${theme === 'dark' ? 'rgba(255, 179, 0, 0.2)' : 'rgba(78, 52, 46, 0.1)'}`
                  }}
                >
                  {displayCategories.map(cat => {
                    const catProducts = products.filter(p => p.category_id === cat.id).slice(0, 25);
                    return (
                      <div key={cat.id} className="flex flex-col mb-5" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <div className={`inline-block py-1 px-3 rounded-full mb-2 self-start border ${theme === 'dark' ? 'border-[#ffb300] text-[#ffb300]' : 'border-[#e65100] text-[#e65100] bg-white'}`}>
                          <h2 className="text-[11px] font-black uppercase tracking-widest">
                            {cat.name}
                          </h2>
                        </div>
                        <div className="space-y-1.5 text-[11px]">
                          {catProducts.map((product) => (
                            <div key={product.id} className="flex flex-col">
                              <div className="flex items-end justify-between font-bold">
                                <span className={`whitespace-nowrap max-w-[150px] overflow-hidden text-ellipsis ${theme === 'dark' ? 'text-zinc-100' : 'text-[#3e2723]'}`}>{product.name}</span>
                                <div className="menu-leader"></div>
                                <span className={`${theme === 'dark' ? 'text-[#ffb300]' : 'text-[#e65100]'}`}>
                                  {product.price / 1000}K
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={`mt-4 mb-0 text-center text-[10px] font-bold tracking-widest uppercase ${theme === 'dark' ? 'text-zinc-600' : 'text-[#8d6e63]'}`}>
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
