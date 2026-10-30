'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Palette, 
  ZoomIn, 
  ZoomOut, 
  Sparkles, 
  Coffee, 
  Utensils, 
  Star, 
  Award, 
  Flame, 
  Maximize2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  image_url?: string;
  is_titipan?: boolean;
  titipan_name?: string | null;
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

// Urutan kategori yang diinginkan untuk layout menu restoran
const CATEGORY_ORDER = [
  'Food',
  'Snack',
  'coffee',
  'Es teh & other',
  'Minuman',
  'Pop mie ',
  'Dessert',
];

// Label display & icon untuk kategori
const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Utensils }> = {
  'Food': { label: 'MAKANAN UTAMA', icon: Utensils },
  'Snack': { label: 'SNACK & GORENGAN', icon: Flame },
  'coffee': { label: 'ANEKA KOPI SPESIAL', icon: Coffee },
  'Es teh & other': { label: 'TEH & LAINNYA', icon: Sparkles },
  'Minuman': { label: 'MINUMAN SEGAR', icon: Sparkles },
  'Pop mie ': { label: 'POP MIE', icon: Flame },
  'Dessert': { label: 'DESSERT & MANISAN', icon: Award },
};

// Daftar item favorit untuk diberi tanda bintang / highlight
const POPULAR_KEYWORDS = [
  'katsu', 'mix platter', 'dimsum', 'aren', 'cireng', 'cappuccino', 'kentang', 'piscok', 'mie'
];

// Deskripsi dinamis untuk menu unggulan Food
const getFoodDescription = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('katsu')) {
    return 'Ayam katsu renyah keemasan berpadu nasi hangat & saus khas Samba.';
  }
  if (lower.includes('egg roll') || lower.includes('nugget')) {
    return 'Rice bowl egg roll nugget lezat berpadu nasi hangat khas Samba.';
  }
  if (lower.includes('burger')) {
    return 'Burger beef patty juicy dengan racikan bumbu istimewa.';
  }
  if (lower.includes('mie') || lower.includes('indomie')) {
    return 'Indomie lezat hangat dengan telur dan racikan bumbu khas Samba.';
  }
  return 'Hidangan lezat istimewa favorit pilihan pelanggan Samba Cafe.';
};

// Deskripsi dinamis untuk menu unggulan Dessert
const getDessertDescription = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('mochi')) {
    return 'Mochi lembut & kenyal dengan isian manis spesial Samba.';
  }
  if (lower.includes('buko')) {
    return 'Kelapa muda buko & jelly pandan berpadu susu creamy keju.';
  }
  if (lower.includes('pudding') || lower.includes('puding')) {
    return 'Pudding manis lembut dengan tekstur lumer istimewa.';
  }
  if (lower.includes('ice cream') || lower.includes('es krim')) {
    return 'Es krim segar dan manis lembut pelepas dahaga.';
  }
  return 'Hidangan penutup manis dan segar khas Samba Cafe.';
};

export function BrochureModal({ isOpen, onClose, products, categories }: BrochureModalProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [zoomMode, setZoomMode] = useState<'fit' | '100%'>('fit');
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Permanen ukuran kertas & orientasi: A5 Landscape saja
  const paperSize = 'A5' as const;
  const orientation = 'landscape' as const;
  const isLandscape = true;
  const isA5 = true;

  // Hanya menu asli Samba Cafe (tidak termasuk menu titipan & ciki snack)
  const cafeProducts = products.filter(p => !p.is_titipan && !p.titipan_name);

  const displayCategories = categories
    .filter(c =>
      !c.name.toLowerCase().includes('ciki') &&
      cafeProducts.some(p => p.category_id === c.id)
    )
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.name);
      const ib = CATEGORY_ORDER.indexOf(b.name);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  // Split categories into 3 columns for balanced A5 Landscape restaurant layout
  const getColumnLayout = (colCount: number = 3) => {
    const blocks = displayCategories.map(cat => ({
      cat,
      items: cafeProducts.filter(p => p.category_id === cat.id),
    }));

    const cols: typeof blocks[] = Array.from({ length: colCount }, () => []);

    // Ideal grouping for 3-column A5 Landscape restaurant menu hierarchy:
    // Col 0: Food, Pop Mie, Es Teh
    // Col 1: Snack, Dessert
    // Col 2: Kopi, Minuman
    const PREFERRED_COL: Record<string, number> = {
      'Food': 0,
      'Pop mie ': 0,
      'Pop mie': 0,
      'Es teh & other': 0,
      'Snack': 1,
      'Dessert': 1,
      'coffee': 2,
      'Minuman': 2,
    };

    const unassigned: typeof blocks = [];

    blocks.forEach(block => {
      const preferred = PREFERRED_COL[block.cat.name];
      if (preferred !== undefined && preferred < colCount) {
        cols[preferred].push(block);
      } else {
        unassigned.push(block);
      }
    });

    if (unassigned.length > 0) {
      const colLengths = cols.map(c => c.reduce((sum, b) => sum + b.items.length, 0));
      unassigned.forEach(block => {
        const minIdx = colLengths.indexOf(Math.min(...colLengths));
        cols[minIdx].push(block);
        colLengths[minIdx] += block.items.length;
      });
    }

    return cols;
  };

  const columns = getColumnLayout(3);

  // Dimensi A5 Landscape (210mm × 148mm) pada 96 DPI
  const targetWidth = 794;
  const targetHeight = 559;

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;

      if (zoomMode === '100%') {
        setScale(1);
        return;
      }

      // Hitung dimensi target berdasarkan ukuran kertas dan orientasi
      const containerWidth = containerRef.current.clientWidth - 20;
      const containerHeight = containerRef.current.clientHeight - 20;

      const scaleW = containerWidth / targetWidth;
      const scaleH = containerHeight / targetHeight;
      let newScale = Math.min(scaleW, scaleH);

      if (newScale > 1.25) newScale = 1.25;
      if (newScale < 0.35) newScale = 0.35;
      setScale(newScale);
    };

    const timer = setTimeout(updateScale, 60);
    window.addEventListener('resize', updateScale);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateScale);
    };
  }, [isOpen, zoomMode, targetWidth, targetHeight]);

  const isDark = theme === 'dark';

  // Palette styling
  const accent = isDark ? '#e0aa3e' : '#b45309';
  const accentLight = isDark ? '#f6d887' : '#d97706';
  const bg = isDark ? '#0b0907' : '#fcfaf6';
  const cardBg = isDark ? 'rgba(26, 21, 16, 0.75)' : 'rgba(255, 255, 255, 0.85)';
  const heroCardBg = isDark ? 'rgba(18, 14, 11, 0.82)' : 'rgba(255, 255, 255, 0.9)';
  const textPrimary = isDark ? '#f8f4ec' : '#1a130e';
  const textSecondary = isDark ? '#ad9e8d' : '#73604f';
  const textMuted = isDark ? '#7a6e60' : '#9c8c7c';
  const borderColor = isDark ? 'rgba(224, 170, 62, 0.24)' : 'rgba(180, 83, 9, 0.2)';
  const leaderDot = isDark ? 'rgba(224, 170, 62, 0.32)' : 'rgba(180, 83, 9, 0.28)';

  const handlePrint = async () => {
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const images = Array.from(document.querySelectorAll<HTMLImageElement>('.poster-canvas img'));
      await Promise.all(
        images.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      );
    } catch {
      // Lanjut print bila preloading gagal
    }
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[100vw] sm:max-w-[100vw] md:max-w-[100vw] lg:max-w-[100vw] h-[100vh] w-full p-0 bg-zinc-950 border-none flex flex-col m-0 rounded-none overflow-hidden print:p-0 print:m-0 print:border-none print:shadow-none print:bg-transparent print:static print:transform-none print:translate-none print:top-auto print:left-auto print:overflow-visible">
        <DialogTitle className="sr-only">Brosur & Poster Menu Restoran Samba Cafe</DialogTitle>

        {/* Top Control Bar */}
        <div className="print-controls-bar flex flex-wrap items-center justify-between p-3 px-5 bg-zinc-900/95 backdrop-blur border-b border-white/10 print:hidden z-50 shadow-xl shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-black font-black text-sm shadow">
              S
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Brosur Restoran Samba Cafe</span>
              </h2>
              <p className="text-[11px] text-zinc-400 flex items-center gap-2 flex-wrap">
                <span>Ukuran Cetak: A5 Landscape (210 × 148 mm)</span>
                <span className="hidden md:inline-flex items-center text-[10px] text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full font-medium">
                  💡 Format otomatis A5 Landscape 1 Halaman Utuh (Tanpa Margin)
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
            {/* Format Badge Tetap (A5 Landscape) */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold shadow-inner">
              <Maximize2 size={13} className="rotate-90 text-amber-400" />
              <span>A5 Landscape</span>
            </div>

            {/* Fit / 100% Zoom */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoomMode(zoomMode === 'fit' ? '100%' : 'fit')}
              className="border-white/10 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 h-9 rounded-xl text-xs"
            >
              {zoomMode === 'fit' ? (
                <>
                  <ZoomIn size={14} className="mr-1.5 text-amber-400" />
                  100% Zoom
                </>
              ) : (
                <>
                  <ZoomOut size={14} className="mr-1.5 text-amber-400" />
                  Fit Layar
                </>
              )}
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="border-white/10 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 h-9 rounded-xl text-xs"
            >
              <Palette size={14} className="mr-1.5 text-amber-400" />
              {theme === 'dark' ? 'Dark Gold' : 'Light Cream'}
            </Button>

            {/* Print Button */}
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-amber-400 hover:bg-amber-500 text-black font-extrabold h-9 rounded-xl px-4 text-xs shadow-lg shadow-amber-500/20"
            >
              <Printer size={15} className="mr-1.5" />
              Cetak / Simpan PDF
            </Button>

            {/* Close Button */}
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-zinc-400 hover:text-white rounded-full w-9 h-9 p-0 ml-1"
            >
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Canvas Scroll Area */}
        <div
          ref={containerRef}
          className="canvas-scroll-container flex-1 overflow-auto p-2 sm:p-3 bg-zinc-950 flex flex-col items-center justify-start print:p-0 print:bg-transparent print:block print:overflow-visible relative"
        >
          <style dangerouslySetInnerHTML={{__html: `
            @page {
              size: 210mm 148mm;
              margin: 0;
            }
            @media print {
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: ${bg} !important;
                color: ${textPrimary} !important;
                overflow: hidden !important;
                width: 210mm !important;
                height: 148mm !important;
                max-width: 210mm !important;
                max-height: 148mm !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              /* Sembunyikan semua elemen di luar portal dialog brosur saat cetak */
              body > *:not([data-slot="dialog-portal"]) {
                display: none !important;
              }
              [data-slot="dialog-overlay"],
              .print-controls-bar,
              [data-slot="dialog-close"],
              button {
                display: none !important;
              }
              /* Pastikan pembungkus dialog Base UI mengisi 100% halaman cetak dari (0,0) */
              [data-slot="dialog-portal"] {
                display: block !important;
                position: static !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm !important;
                height: 148mm !important;
                max-width: 210mm !important;
                max-height: 148mm !important;
                overflow: hidden !important;
              }
              [data-slot="dialog-content"] {
                display: block !important;
                position: static !important;
                top: auto !important;
                left: auto !important;
                right: auto !important;
                bottom: auto !important;
                inset: auto !important;
                transform: none !important;
                translate: none !important;
                width: 210mm !important;
                max-width: 210mm !important;
                height: 148mm !important;
                max-height: 148mm !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                background: transparent !important;
                box-shadow: none !important;
                overflow: hidden !important;
              }
              .canvas-scroll-container {
                display: block !important;
                position: static !important;
                width: 210mm !important;
                height: 148mm !important;
                max-width: 210mm !important;
                max-height: 148mm !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                background: transparent !important;
              }
              .print-wrapper {
                display: block !important;
                position: static !important;
                width: 210mm !important;
                height: 148mm !important;
                max-width: 210mm !important;
                max-height: 148mm !important;
                margin: 0 !important;
                padding: 0 !important;
                transform: none !important;
                translate: none !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
              }
              .poster-canvas {
                display: flex !important;
                flex-direction: row !important;
                position: relative !important;
                width: 210mm !important;
                min-width: 210mm !important;
                max-width: 210mm !important;
                height: 148mm !important;
                min-height: 148mm !important;
                max-height: 148mm !important;
                margin: 0 !important;
                padding: 0 !important;
                transform: none !important;
                translate: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
                page-break-before: avoid !important;
                break-before: avoid !important;
                box-sizing: border-box !important;
                background: ${bg} !important;
                color: ${textPrimary} !important;
                overflow: hidden !important;
              }
              .menu-dot-leader {
                flex: 1;
                border-bottom: 1.5px dotted ${leaderDot};
                margin: 0 5px;
                position: relative;
                top: -3px;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box !important;
              }
            }
            .menu-dot-leader {
              flex: 1;
              border-bottom: 1.5px dotted ${leaderDot};
              margin: 0 5px;
              position: relative;
              top: -3px;
            }
          `}} />

          {/* Wrapper with interactive scale */}
          <div
            className="print-wrapper shrink-0 m-auto print:m-0"
            style={{ 
              width: `${Math.round(targetWidth * scale)}px`,
              height: `${Math.round(targetHeight * scale)}px`,
              position: 'relative',
            }}
          >
            <div
              className="poster-canvas relative shadow-2xl shrink-0 overflow-hidden print:shadow-none flex flex-row"
              style={{
                width: `${targetWidth}px`,
                height: `${targetHeight}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                background: bg,
                color: textPrimary,
              }}
            >
              {/* Outer decorative gold border line */}
              <div 
                className="absolute inset-0 print:inset-[2.5mm] pointer-events-none z-30 transition-all" 
                style={{ 
                  border: `2px solid ${borderColor}`,
                  boxShadow: `inset 0 0 0 1px ${isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)'}`
                }} 
              />

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* 1. HERO SECTION (Landscape Sleek Left Sidebar)                 */}
              {/* ══════════════════════════════════════════════════════════════ */}
              <div
                  className="relative overflow-hidden flex flex-col justify-between shrink-0 z-10 w-[25%]"
                  style={{
                    borderRight: `1.5px solid ${borderColor}`,
                    background: isDark 
                      ? 'linear-gradient(180deg, #120e0a 0%, #0a0806 50%, #120e0a 100%)' 
                      : 'linear-gradient(180deg, #fdfbf7 0%, #f4eee2 50%, #fdfbf7 100%)',
                  }}
                >
                  {/* Subtle Warm Amber Glow in Center */}
                  <div 
                    className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none rounded-full blur-3xl opacity-25"
                    style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
                  />

                  {/* Top Section: Brand Identity */}
                  <div 
                    className="relative z-20 text-center flex flex-col items-center"
                    style={{
                      paddingTop: '16px',
                      paddingLeft: '10px',
                      paddingRight: '10px',
                    }}
                  >
                    <div 
                      className="flex items-center justify-center rounded-full shadow-lg relative mb-1.5"
                      style={{
                        width: '46px',
                        height: '46px',
                        background: isDark ? 'radial-gradient(circle, #251d14 0%, #120e0a 100%)' : '#ffffff',
                        border: `1.5px solid ${accent}`,
                        boxShadow: `0 4px 16px ${isDark ? 'rgba(0,0,0,0.6)' : 'rgba(180,83,9,0.15)'}`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/logo-cropped.png"
                        alt="Samba Cafe Logo"
                        className="w-[74%] h-[74%] object-contain"
                      />
                    </div>

                    <h1 
                      style={{
                        fontSize: '19px',
                        fontWeight: 900,
                        letterSpacing: '0.14em',
                        lineHeight: 1,
                        margin: 0,
                        color: textPrimary,
                      }}
                    >
                      SAMBA{' '}
                      <span style={{ 
                        color: accent, 
                        fontStyle: 'italic', 
                        fontFamily: "'Georgia', serif",
                      }}>
                        CAFE
                      </span>
                    </h1>

                    <p 
                      style={{
                        fontSize: '7.5px',
                        letterSpacing: '0.24em',
                        fontWeight: 700,
                        color: isDark ? accentLight : accent,
                        textTransform: 'uppercase',
                        marginTop: '3.5px',
                        marginBottom: 0,
                      }}
                    >
                      Coffee · Eatery · Comfort
                    </p>

                    <div className="flex items-center justify-center gap-2 w-24 mt-1.5">
                      <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, transparent, ${borderColor})` }} />
                      <div style={{ width: '3px', height: '3px', background: accent, transform: 'rotate(45deg)' }} />
                      <div style={{ flex: 1, height: '1px', background: `linear-gradient(to left, transparent, ${borderColor})` }} />
                    </div>
                  </div>

                  {/* Center Section: Clean Architectural Photography */}
                  <div 
                    className="relative z-20 flex flex-col items-center text-center w-full my-auto"
                    style={{
                      paddingLeft: '12px',
                      paddingRight: '12px',
                    }}
                  >
                    <div 
                      className="w-full rounded-2xl overflow-hidden relative shadow-xl"
                      style={{
                        border: `1px solid ${isDark ? 'rgba(224, 170, 62, 0.35)' : 'rgba(180, 83, 9, 0.25)'}`,
                        boxShadow: isDark 
                          ? '0 10px 30px rgba(0,0,0,0.7), 0 0 20px rgba(224,170,62,0.1)' 
                          : '0 8px 24px rgba(180,83,9,0.12)',
                      }}
                    >
                      <div className="relative w-full overflow-hidden" style={{ height: '146px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/images/samba_restaurant_hero.jpg"
                          alt="Suasana Samba Cafe"
                          className="w-full h-full object-cover"
                        />
                        <div 
                          className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(to top, rgba(12,9,7,0.4) 0%, transparent 60%)',
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 text-center">
                      <h3 
                        style={{
                          fontSize: '8.5px',
                          fontWeight: 800,
                          letterSpacing: '0.18em',
                          color: isDark ? accentLight : accent,
                          textTransform: 'uppercase',
                          margin: 0,
                        }}
                      >
                        Cita Rasa &amp; Kehangatan
                      </h3>
                      <p 
                        style={{
                          fontSize: '7.5px',
                          color: textSecondary,
                          lineHeight: 1.4,
                          marginTop: '2.5px',
                          marginBottom: 0,
                          maxWidth: '94%',
                          marginInline: 'auto',
                        }}
                      >
                        Kopi racikan barista dan hidangan lezat dalam suasana santai bernuansa hangat.
                      </p>
                    </div>

                    <div 
                      className="flex items-center justify-center gap-1.5 mt-2 text-center"
                      style={{
                        fontSize: '6.5px',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        color: isDark ? 'rgba(248, 244, 236, 0.75)' : 'rgba(26, 19, 14, 0.75)',
                        textTransform: 'uppercase',
                      }}
                    >
                      <span>Specialty Coffee</span>
                      <span style={{ color: accent }}>•</span>
                      <span>Fresh Cuisine</span>
                      <span style={{ color: accent }}>•</span>
                      <span>Cozy Vibe</span>
                    </div>
                  </div>

                  {/* Bottom Section: Clean Footer Badge */}
                  <div 
                    className="relative z-20 flex flex-col items-center text-center"
                    style={{
                      paddingBottom: '14px',
                    }}
                  >
                    <div 
                      className="flex items-center gap-1.5"
                      style={{
                        fontSize: '7px',
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        color: isDark ? accentLight : accent,
                        textTransform: 'uppercase',
                      }}
                    >
                      <span>✦</span>
                      <span>100% Halal &amp; Fresh Daily</span>
                      <span>✦</span>
                    </div>
                    <span 
                      style={{ 
                        fontSize: '6px', 
                        color: textMuted, 
                        marginTop: '2px',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Selamat Menikmati Hidangan Kami
                    </span>
                  </div>
                </div>

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* 2. MENU SECTION (Daftar Menu Makanan, Minuman, Kopi & Snack)   */}
              {/* ══════════════════════════════════════════════════════════════ */}
              <div 
                className="flex-1 flex flex-col justify-between relative z-20 h-full overflow-hidden"
                style={{
                  padding: '12px 12px 14px',
                  background: bg,
                }}
              >
                {/* Header Menu */}
                <div 
                  className="text-center shrink-0"
                  style={{ marginBottom: '3px' }}
                >
                  {/* Small decorative label */}
                  <div 
                    style={{
                      fontSize: '7.5px',
                      fontWeight: 800,
                      letterSpacing: '0.24em',
                      color: accent,
                      textTransform: 'uppercase',
                      marginBottom: '1.5px',
                    }}
                  >
                    Culinary Selection &amp; Price List
                  </div>

                  {/* Main Title */}
                  <div className="flex items-center justify-center gap-2">
                    <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, transparent, ${accent})` }} />
                    <div style={{
                      width: '4px',
                      height: '4px',
                      background: accent,
                      transform: 'rotate(45deg)',
                    }} />
                    <h2 
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 900,
                        letterSpacing: '0.12em',
                        color: textPrimary,
                        textTransform: 'uppercase',
                        margin: 0,
                      }}
                    >
                      DAFTAR MENU SPESIAL
                    </h2>
                    <div style={{
                      width: '4px',
                      height: '4px',
                      background: accent,
                      transform: 'rotate(45deg)',
                    }} />
                    <div style={{ flex: 1, height: '1px', background: `linear-gradient(to left, transparent, ${accent})` }} />
                  </div>
                </div>

                {/* Columns Menu Layout (3 cols in A5 Landscape) */}
                <div 
                  className="flex-1 grid grid-cols-3 min-h-0"
                  style={{
                    columnGap: '8px',
                  }}
                >
                  {columns.map((col, colIdx) => (
                    <div key={colIdx} className="flex flex-col gap-1.5 h-full min-h-0">
                      {col.map(({ cat, items }, cardIdx) => {
                        const isLastCard = cardIdx === col.length - 1;
                        const conf = CATEGORY_CONFIG[cat.name] || { label: cat.name.toUpperCase(), icon: Sparkles };
                        const IconComp = conf.icon;
                        const isFoodCategory = cat.name.toLowerCase().includes('food') || cat.name.toLowerCase().includes('makanan');
                        const isDessert = cat.name.toLowerCase().includes('dessert');
                        const isPopMie = cat.name.toLowerCase().includes('pop mie');
                        const isSnack = cat.name.toLowerCase().includes('snack');
                        
                        // Pick signature item for Food category
                        const signatureProduct = isFoodCategory
                          ? items.find(p => p.name.toLowerCase().includes('katsu')) || items[0]
                          : null;

                        // Pick featured sweet item for Dessert category to balance Column 1
                        const featuredDessert = isDessert
                          ? items.find(p => p.name.toLowerCase().includes('buko')) || items[0]
                          : null;

                        const otherProducts = signatureProduct 
                          ? items.filter(p => p.id !== signatureProduct.id)
                          : (featuredDessert
                              ? items.filter(p => p.id !== featuredDessert.id)
                              : items);

                        // Optimal row vertical padding per category for uniform layout balance
                        const rowPadding = colIdx === 2
                          ? '2px 0'
                          : isSnack
                            ? '2.4px 0'
                            : isDessert
                              ? '2.8px 0'
                              : isPopMie
                                ? '2.8px 0'
                                : '2.6px 0';

                        return (
                          <div 
                            key={cat.id} 
                            className={`rounded-xl transition-colors ${isLastCard ? 'flex-1 flex flex-col justify-between' : ''}`}
                            style={{
                              padding: '4.5px 7px',
                              background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.015)',
                              border: `1.5px solid ${isDark ? 'rgba(224,170,62,0.22)' : 'rgba(180,83,9,0.18)'}`,
                            }}
                          >
                            <div>
                              {/* Category Header */}
                              <div 
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '3px',
                                  paddingBottom: '2px',
                                  borderBottom: `1.5px solid ${borderColor}`,
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <div 
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '5px',
                                      background: isDark ? 'rgba(224,170,62,0.18)' : 'rgba(180,83,9,0.12)',
                                      border: `1px solid ${accent}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: accent,
                                    }}
                                  >
                                    <IconComp size={11} />
                                  </div>
                                  <span 
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: 900,
                                      letterSpacing: '0.08em',
                                      color: isDark ? accentLight : '#92400e',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {conf.label}
                                  </span>
                                </div>
                              </div>

                              {/* Featured Chef's Signature Card inside Food */}
                              {signatureProduct && (
                                <div 
                                  className="w-full rounded-lg overflow-hidden shadow-md mb-1.5 relative"
                                  style={{
                                    background: 'rgba(22, 17, 12, 0.95)',
                                    border: `1.5px solid ${accent}`,
                                    boxShadow: '0 3px 10px rgba(0,0,0,0.4)',
                                  }}
                                >
                                  {/* Featured Dish Photo */}
                                  <div className="relative w-full overflow-hidden" style={{ height: '60px' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src="/images/samba_signature_dish.jpg"
                                      alt={signatureProduct.name}
                                      className="w-full h-full object-cover"
                                    />
                                    <div 
                                      className="absolute inset-0"
                                      style={{ background: 'linear-gradient(to top, rgba(14,11,8,0.92) 0%, transparent 60%)' }}
                                    />
                                    <div 
                                      className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full font-black uppercase text-[7px]"
                                      style={{
                                        background: 'rgba(0,0,0,0.85)',
                                        color: accentLight,
                                        border: `1px solid ${accent}`,
                                        backdropFilter: 'blur(3px)',
                                      }}
                                    >
                                      <Star size={8.5} className="fill-amber-400 text-amber-400" />
                                      <span>Chef&apos;s Signature</span>
                                    </div>
                                  </div>

                                  {/* Card Content */}
                                  <div style={{ padding: '3.5px 6.5px' }}>
                                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                                      <span 
                                        className="min-w-0 flex-1"
                                        style={{
                                          fontSize: signatureProduct.name.trim().length > 20 ? '8.8px' : '10px',
                                          fontWeight: 800,
                                          color: '#ffffff',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          letterSpacing: signatureProduct.name.trim().length > 20 ? '-0.025em' : '-0.01em',
                                        }}
                                      >
                                        {signatureProduct.name}
                                      </span>
                                      <span 
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 900,
                                          color: accent,
                                          fontFamily: "'Inter', sans-serif",
                                          flexShrink: 0,
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {signatureProduct.price >= 1000
                                          ? `${(signatureProduct.price / 1000).toFixed(signatureProduct.price % 1000 === 0 ? 0 : 1)}K`
                                          : `${signatureProduct.price}`}
                                      </span>
                                    </div>
                                    <p 
                                      style={{
                                        fontSize: '7.5px',
                                        color: 'rgba(255,255,255,0.8)',
                                        marginTop: '1.5px',
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      {getFoodDescription(signatureProduct.name)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Featured Sweet Card inside Dessert */}
                              {featuredDessert && (
                                <div 
                                  className="w-full rounded-lg overflow-hidden shadow-sm mb-1.5"
                                  style={{
                                    background: isDark 
                                      ? 'linear-gradient(135deg, rgba(224,170,62,0.15) 0%, rgba(20,16,12,0.95) 100%)' 
                                      : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                                    border: `1.5px solid ${accent}`,
                                    padding: '4px 7px',
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-1.5 min-w-0">
                                    <div className="flex items-center gap-1 min-w-0 flex-1">
                                      <Sparkles size={9} className={isDark ? "text-amber-400 shrink-0" : "text-amber-600 shrink-0"} />
                                      <span 
                                        style={{
                                          fontSize: featuredDessert.name.trim().length > 20 ? '9px' : '10px',
                                          fontWeight: 800,
                                          color: isDark ? '#ffffff' : '#18181b',
                                          lineHeight: 1.2,
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          letterSpacing: featuredDessert.name.trim().length > 20 ? '-0.02em' : '-0.01em',
                                        }}
                                      >
                                        {featuredDessert.name}
                                      </span>
                                    </div>
                                    <span 
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 900,
                                        color: accent,
                                        fontFamily: "'Inter', sans-serif",
                                        flexShrink: 0,
                                        whiteSpace: 'nowrap',
                                        lineHeight: 1.2,
                                      }}
                                    >
                                      {featuredDessert.price >= 1000
                                        ? `${(featuredDessert.price / 1000).toFixed(featuredDessert.price % 1000 === 0 ? 0 : 1)}K`
                                        : `${featuredDessert.price}`}
                                    </span>
                                  </div>
                                  <p 
                                    style={{
                                      fontSize: '7.5px',
                                      color: isDark ? 'rgba(255,255,255,0.8)' : '#78350f',
                                      marginTop: '1.5px',
                                      lineHeight: 1.2,
                                    }}
                                  >
                                    {getDessertDescription(featuredDessert.name)}
                                  </p>
                                </div>
                              )}

                              {/* Menu Items List */}
                              <div className="flex flex-col">
                                {otherProducts.map((product) => {
                                  const isPopular = POPULAR_KEYWORDS.some(k => product.name.toLowerCase().includes(k));
                                  const isLongName = product.name.trim().length > 20;

                                  return (
                                    <div 
                                      key={product.id} 
                                      className="flex items-baseline justify-between group"
                                      style={{
                                        padding: rowPadding,
                                      }}
                                    >
                                      <div className="flex items-baseline gap-1 overflow-hidden shrink min-w-0">
                                        {isPopular && (
                                          <Star size={8} className="fill-amber-400 text-amber-400 shrink-0 self-center" />
                                        )}
                                        <span 
                                          style={{
                                            fontSize: isLongName ? '9.2px' : '10.5px',
                                            fontWeight: isPopular ? 800 : 700,
                                            color: isDark ? '#ffffff' : '#18181b',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            letterSpacing: isLongName ? '-0.025em' : '-0.01em',
                                          }}
                                        >
                                          {product.name.trim()}
                                        </span>
                                      </div>

                                      <div className="menu-dot-leader" style={{ minWidth: '5px' }} />

                                      <span 
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 900,
                                          color: isDark ? accentLight : accent,
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                          fontFamily: "'Inter', sans-serif",
                                        }}
                                      >
                                        {product.price >= 1000
                                          ? `${(product.price / 1000).toFixed(product.price % 1000 === 0 ? 0 : 1)}K`
                                          : `${product.price}`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Optional subtle footer note inside short categories */}
                            {isDessert && (
                              <div 
                                className="mt-1 pt-0.5 text-center flex items-center justify-center gap-1"
                                style={{ borderTop: `1px dashed ${borderColor}` }}
                              >
                                <span style={{ fontSize: '7px', color: textSecondary, fontWeight: 600 }}>
                                  ✨ Segar &amp; Manis · Teman Santai Sore
                                </span>
                              </div>
                            )}

                            {isPopMie && (
                              <div 
                                className="mt-1 pt-0.5 text-center flex items-center justify-center gap-1"
                                style={{ borderTop: `1px dashed ${borderColor}` }}
                              >
                                <span style={{ fontSize: '7px', color: textSecondary, fontWeight: 600 }}>
                                  🍜 Seduh Panas · Cepat &amp; Praktis
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Footer Strip */}
                <div 
                  className="shrink-0 flex items-center justify-between"
                  style={{
                    marginTop: '2.5px',
                    paddingTop: '2.5px',
                    borderTop: `1px dashed ${borderColor}`,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span 
                      style={{
                        fontSize: '7px',
                        color: textSecondary,
                        fontWeight: 600,
                      }}
                    >
                      ★ = Menu Rekomendasi Favorit · Harga sudah termasuk pajak
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span 
                      className="px-2 py-0.5 rounded text-[7px] font-bold"
                      style={{
                        background: isDark ? 'rgba(224,170,62,0.12)' : 'rgba(180,83,9,0.08)',
                        color: accent,
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      Pemesanan di Kasir / Scan QR
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
