import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

export type DateFilterMode = 'date' | 'month' | 'year' | 'all';

export interface DateFilterValue {
  mode: DateFilterMode;
  date?: Date; // For specific date
  month?: number; // 0-11
  year?: number;
}

interface DateFilterProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
  align?: 'left' | 'right';
  className?: string;
  showAllTime?: boolean;
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_NAMES_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function DateFilter({ value, onChange, align = 'left', className = '', showAllTime = true }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // The internal state for the picker navigation (what month/year we are currently viewing)
  const [viewYear, setViewYear] = useState(value.year || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(value.month ?? new Date().getMonth());
  const [activeTab, setActiveTab] = useState<'date' | 'month' | 'year'>(value.mode === 'all' ? 'date' : value.mode);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal view state when opened
  useEffect(() => {
    if (isOpen) {
      if (value.mode !== 'all') {
        setViewYear(value.year || new Date().getFullYear());
        setViewMonth(value.month ?? new Date().getMonth());
        setActiveTab(value.mode);
      } else {
        setViewYear(new Date().getFullYear());
        setViewMonth(new Date().getMonth());
        setActiveTab('date');
      }
    }
  }, [isOpen, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayLabel = () => {
    if (value.mode === 'all') return 'Semua Waktu';
    if (value.mode === 'year') return `Tahun ${value.year}`;
    if (value.mode === 'month') return `${MONTH_NAMES_FULL[value.month || 0]} ${value.year}`;
    if (value.mode === 'date' && value.date) {
      return value.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return 'Pilih Tanggal';
  };

  // Calendar logic for 'date' view
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null); // empty cells
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handleSelectDate = (day: number) => {
    const selectedDate = new Date(viewYear, viewMonth, day);
    onChange({
      mode: 'date',
      date: selectedDate,
      month: viewMonth,
      year: viewYear,
    });
    setIsOpen(false);
  };

  const handleSelectMonth = (monthIndex: number) => {
    onChange({
      mode: 'month',
      month: monthIndex,
      year: viewYear,
    });
    setIsOpen(false);
  };

  const handleSelectYear = (year: number) => {
    onChange({
      mode: 'year',
      year: year,
    });
    setIsOpen(false);
  };

  const handleSelectAll = () => {
    onChange({
      mode: 'all'
    });
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors bg-zinc-900/40 border border-white/10 px-3 py-1.5 rounded-lg"
      >
        <CalendarIcon size={14} />
        <span>{getDisplayLabel()}</span>
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden`}>
          {/* Tabs */}
          <div className="flex bg-zinc-800/50 p-1 m-2 rounded-lg border border-white/5">
            <button 
              onClick={() => setActiveTab('date')} 
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${activeTab === 'date' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >
              Tanggal
            </button>
            <button 
              onClick={() => setActiveTab('month')} 
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${activeTab === 'month' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >
              Bulan
            </button>
            <button 
              onClick={() => setActiveTab('year')} 
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${activeTab === 'year' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
            >
              Tahun
            </button>
          </div>

          {/* Header Navigation */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
            <button 
              onClick={() => {
                if (activeTab === 'date') {
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear(y => y - 1);
                  } else {
                    setViewMonth(m => m - 1);
                  }
                } else if (activeTab === 'month') {
                  setViewYear(y => y - 1);
                } else {
                  setViewYear(y => y - 9);
                }
              }} 
              className="text-zinc-400 hover:text-white transition-colors p-1"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex gap-1 text-xs font-bold text-white">
              {activeTab === 'date' && <span>{MONTH_NAMES_FULL[viewMonth]} {viewYear}</span>}
              {activeTab === 'month' && <span>{viewYear}</span>}
              {activeTab === 'year' && <span>{viewYear - 4} - {viewYear + 4}</span>}
            </div>

            <button 
              onClick={() => {
                if (activeTab === 'date') {
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear(y => y + 1);
                  } else {
                    setViewMonth(m => m + 1);
                  }
                } else if (activeTab === 'month') {
                  setViewYear(y => y + 1);
                } else {
                  setViewYear(y => y + 9);
                }
              }} 
              className="text-zinc-400 hover:text-white transition-colors p-1"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-2">
            {activeTab === 'date' && (
              <div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAYS_SHORT.map(d => (
                    <div key={d} className="text-[10px] font-bold text-zinc-500 text-center py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day, i) => {
                    if (!day) return <div key={i} className="p-1" />;
                    
                    const isSelected = value.mode === 'date' && value.date && 
                                       value.date.getDate() === day && 
                                       value.date.getMonth() === viewMonth && 
                                       value.date.getFullYear() === viewYear;
                    
                    const isToday = new Date().getDate() === day && 
                                    new Date().getMonth() === viewMonth && 
                                    new Date().getFullYear() === viewYear;

                    return (
                      <button
                        key={i}
                        onClick={() => handleSelectDate(day)}
                        className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold mx-auto transition-all ${
                          isSelected 
                            ? 'bg-amber-500 text-black' 
                            : isToday 
                              ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' 
                              : 'text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'month' && (
              <div className="grid grid-cols-3 gap-1">
                {MONTH_NAMES_SHORT.map((m, i) => {
                  const isActive = value.mode === 'month' && value.month === i && value.year === viewYear;
                  const isCurrent = i === new Date().getMonth() && viewYear === new Date().getFullYear();
                  return (
                    <button
                      key={m}
                      onClick={() => handleSelectMonth(i)}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                        isActive 
                          ? 'bg-amber-500 text-black' 
                          : isCurrent 
                            ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' 
                            : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'year' && (
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }, (_, i) => viewYear - 4 + i).map(y => {
                  const isActive = value.mode === 'year' && value.year === y;
                  const isCurrent = y === new Date().getFullYear();
                  return (
                    <button
                      key={y}
                      onClick={() => handleSelectYear(y)}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                        isActive 
                          ? 'bg-amber-500 text-black' 
                          : isCurrent 
                            ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' 
                            : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {showAllTime && (
            <div className="border-t border-white/5 p-2">
              <button
                onClick={handleSelectAll}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                  value.mode === 'all' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                Semua Waktu
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
