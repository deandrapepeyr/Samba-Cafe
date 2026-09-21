'use client';

import { useState, useRef, useEffect } from 'react';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_NAMES_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/* ───────────────────────────────────────────────────
   MonthYearPicker  –  Pilih bulan / tahun / semua
   ─────────────────────────────────────────────────── */
type MonthYearPickerProps = {
  month: number;          // 0-11
  year: number;
  mode: 'month' | 'year' | 'all';
  onChange: (month: number, year: number, mode: 'month' | 'year' | 'all') => void;
  size?: 'sm' | 'md';
};

export function MonthYearPicker({ month, year, mode, onChange, size = 'sm' }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const [view, setView] = useState<'month' | 'year'>('month');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setPickerYear(year); setView('month'); }
  }, [open, year]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = mode === 'all' ? 'Semua Waktu' : mode === 'year' ? `Tahun ${year}` : `${MONTH_NAMES_FULL[month]} ${year}`;

  const isSm = size === 'sm';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 font-semibold transition-colors ${
          isSm
            ? 'text-xs text-zinc-400 hover:text-white'
            : 'text-sm text-zinc-300 hover:text-white bg-zinc-800/60 border border-white/5 px-3 py-2 rounded-lg'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width={isSm ? 12 : 16} height={isSm ? 12 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
        <span>{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width={isSm ? 10 : 12} height={isSm ? 10 : 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-52 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Year navigation */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
            <button onClick={() => setPickerYear(p => p - (view === 'year' ? 9 : 1))} className="text-zinc-400 hover:text-white transition-colors p-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button
              onClick={() => setView(view === 'month' ? 'year' : 'month')}
              className="text-xs font-bold text-white hover:text-amber-400 transition-colors"
            >
              {view === 'year' ? `${pickerYear - 4} – ${pickerYear + 4}` : pickerYear}
            </button>
            <button onClick={() => setPickerYear(p => p + (view === 'year' ? 9 : 1))} className="text-zinc-400 hover:text-white transition-colors p-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          {view === 'month' ? (
            <div className="grid grid-cols-3 gap-1 p-2">
              {MONTH_NAMES_SHORT.map((m, i) => {
                const isActive = mode === 'month' && month === i && year === pickerYear;
                const isCurrent = i === new Date().getMonth() && pickerYear === new Date().getFullYear();
                return (
                  <button
                    key={m}
                    onClick={() => { onChange(i, pickerYear, 'month'); setOpen(false); }}
                    className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                      isActive
                        ? 'bg-amber-500 text-black'
                        : isCurrent
                          ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 p-2">
              {Array.from({ length: 9 }, (_, i) => pickerYear - 4 + i).map(y => {
                const isActive = mode === 'year' && year === y;
                const isCurrent = y === new Date().getFullYear();
                return (
                  <button
                    key={y}
                    onClick={() => { onChange(month, y, 'year'); setOpen(false); }}
                    className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                      isActive
                        ? 'bg-amber-500 text-black'
                        : isCurrent
                          ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          {/* All-time */}
          <div className="border-t border-white/5 p-2">
            <button
              onClick={() => { onChange(month, year, 'all'); setOpen(false); }}
              className={`w-full py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                mode === 'all' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              Semua Waktu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ───────────────────────────────────────────────────
   DatePicker  –  Pilih tanggal spesifik / clear
   ─────────────────────────────────────────────────── */
type DatePickerProps = {
  value: string;         // YYYY-MM-DD or ''
  onChange: (date: string) => void;
  placeholder?: string;
};

export function DatePicker({ value, onChange, placeholder = 'Pilih tanggal' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();
  const selected = value ? new Date(value + 'T00:00:00') : null;

  const [viewMonth, setViewMonth] = useState(selected ? selected.getMonth() : today.getMonth());
  const [viewYear, setViewYear] = useState(selected ? selected.getFullYear() : today.getFullYear());

  useEffect(() => {
    if (open && selected) {
      setViewMonth(selected.getMonth());
      setViewYear(selected.getFullYear());
    } else if (open) {
      setViewMonth(today.getMonth());
      setViewYear(today.getFullYear());
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number, y: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(viewMonth, viewYear);
  const firstDay = getFirstDayOfMonth(viewMonth, viewYear);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setOpen(false);
  };

  const displayLabel = selected
    ? `${selected.getDate()} ${MONTH_NAMES_FULL[selected.getMonth()]} ${selected.getFullYear()}`
    : placeholder;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800/60 border border-white/5 px-3 py-2 rounded-lg transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
        <span>{displayLabel}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[280px] bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Month/Year header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
            <button onClick={prevMonth} className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span className="text-xs font-bold text-white">
              {MONTH_NAMES_FULL[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-zinc-500 py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5 px-2 pb-2">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = value === dateStr;
              const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              return (
                <button
                  key={day}
                  onClick={() => selectDay(day)}
                  className={`w-full aspect-square flex items-center justify-center rounded-lg text-[11px] font-semibold transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-black'
                      : isToday
                        ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="border-t border-white/5 p-2 flex gap-2">
            <button
              onClick={() => { onChange(today.toISOString().split('T')[0]); setOpen(false); }}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
            >
              Hari Ini
            </button>
            {value && (
              <button
                onClick={() => { onChange(''); setOpen(false); }}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition-all"
              >
                Hapus Filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
