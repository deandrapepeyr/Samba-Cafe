'use client';

import React, { useState, useEffect } from 'react';
import { Calculator, Delete } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CalculatorPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUseAsFreeItem?: (amount: number) => void;
}

export function CalculatorPanel({
  isOpen,
  onOpenChange,
}: CalculatorPanelProps) {
  const [expression, setExpression] = useState<string>('');
  const [chainFormula, setChainFormula] = useState<string>('');
  const [subtotal, setSubtotal] = useState<number | null>(null);
  const [currentValue, setCurrentValue] = useState<string>('0');
  const [history, setHistory] = useState<{ expr: string; result: number }[]>([]);
  const [justCalculated, setJustCalculated] = useState<boolean>(false);

  const formatDisplayNumber = (valStr: string) => {
    if (!valStr || valStr === '0') return '0';
    const isNegative = valStr.startsWith('-');
    const cleanStr = isNegative ? valStr.slice(1) : valStr;

    if (cleanStr.includes('.')) {
      const [intPart, decPart] = cleanStr.split('.');
      const formattedInt = (parseInt(intPart || '0', 10)).toLocaleString('id-ID');
      return `${isNegative ? '-' : ''}${formattedInt},${decPart}`;
    }
    const formatted = (parseInt(cleanStr, 10)).toLocaleString('id-ID');
    return `${isNegative ? '-' : ''}${formatted}`;
  };

  const calculate = (a: number, op: string, b: number): number => {
    let res = 0;
    if (op === '+') res = a + b;
    else if (op === '-') res = a - b;
    else if (op === '×') res = a * b;
    else if (op === '÷') res = b !== 0 ? a / b : 0;
    return Math.round(res * 10000) / 10000;
  };

  const handleNumber = (num: string) => {
    if (justCalculated) {
      setCurrentValue(num === '000' ? '0' : num);
      setJustCalculated(false);
      return;
    }
    if (num === '000') {
      if (currentValue === '0' || currentValue === '') return;
      if (currentValue.includes('.')) {
        const multiplied = Math.round(parseFloat(currentValue) * 1000);
        setCurrentValue(multiplied.toString());
      } else {
        setCurrentValue(prev => (prev + '000').slice(0, 12));
      }
      return;
    }
    if (currentValue === '0') {
      setCurrentValue(num);
    } else {
      setCurrentValue(prev => (prev + num).slice(0, 12));
    }
  };

  const handleComma = () => {
    if (justCalculated) {
      setCurrentValue('0.');
      setJustCalculated(false);
      return;
    }
    if (!currentValue.includes('.')) {
      setCurrentValue(prev => (prev || '0') + '.');
    }
  };

  const handleHalf = () => {
    if (justCalculated) {
      setCurrentValue('0.5');
      setJustCalculated(false);
      return;
    }
    if (currentValue === '0' || currentValue === '') {
      setCurrentValue('0.5');
    } else if (currentValue.endsWith('.')) {
      setCurrentValue(`${currentValue}5`);
    } else if (currentValue.includes('.')) {
      const num = parseFloat(currentValue);
      const newNum = Math.floor(num) + 0.5;
      setCurrentValue(newNum.toString());
    } else {
      setCurrentValue(`${currentValue}.5`);
    }
  };

  const handleOperator = (op: '+' | '-' | '×' | '÷') => {
    setJustCalculated(false);

    // Kasus 1: Ganti operator jika belum mengetik angka kedua
    if (currentValue === '0' && expression !== '') {
      const parts = expression.trim().split(' ');
      if (parts.length >= 1) {
        setExpression(`${parts[0]} ${op} `);
        setChainFormula(prev => {
          const trimmed = prev.trim();
          const lastSpace = trimmed.lastIndexOf(' ');
          if (lastSpace !== -1) {
            return `${trimmed.slice(0, lastSpace)} ${op} `;
          }
          return `${trimmed} ${op} `;
        });
        return;
      }
    }

    // Kasus 2: Chaining beruntun (misal 5 + 5 + 2 + ...)
    if (expression !== '') {
      const parts = expression.trim().split(' ');
      if (parts.length >= 2) {
        const left = parseFloat(parts[0]);
        const prevOp = parts[1];
        const right = parseFloat(currentValue || '0');
        const res = calculate(left, prevOp, right);

        setSubtotal(res);
        setExpression(`${res} ${op} `);
        setChainFormula(prev => `${prev}${formatDisplayNumber(currentValue)} ${op} `);
        setCurrentValue('0');
        return;
      }
    }

    // Kasus 3: Operasi pertama (misal 5 +)
    const val = parseFloat(currentValue || '0');
    setSubtotal(val);
    setExpression(`${val} ${op} `);
    setChainFormula(`${formatDisplayNumber(currentValue)} ${op} `);
    setCurrentValue('0');
  };

  const handleEquals = () => {
    if (!expression) return;
    const parts = expression.trim().split(' ');
    if (parts.length < 2) return;

    const left = parseFloat(parts[0]);
    const op = parts[1];
    const right = parseFloat(currentValue || '0');
    const result = calculate(left, op, right);

    const fullFormula = `${chainFormula}${formatDisplayNumber(currentValue)}`;
    const historyItem = `${fullFormula} = ${formatDisplayNumber(result.toString())}`;

    setHistory(prev => [{ expr: historyItem, result }, ...prev.slice(0, 2)]);
    setExpression('');
    setChainFormula('');
    setSubtotal(null);
    setCurrentValue(result.toString());
    setJustCalculated(true);
  };

  const handleClear = () => {
    setExpression('');
    setChainFormula('');
    setSubtotal(null);
    setCurrentValue('0');
    setJustCalculated(false);
  };

  const handleBackspace = () => {
    if (justCalculated) {
      handleClear();
      return;
    }
    if (currentValue.length > 1) {
      setCurrentValue(prev => prev.slice(0, -1));
    } else {
      setCurrentValue('0');
    }
  };

  // Menghitung angka yang ditampilkan di layar utama secara cerdas & live
  const getDisplayValue = () => {
    if (justCalculated) {
      return formatDisplayNumber(currentValue);
    }

    if (expression !== '') {
      const parts = expression.trim().split(' ');
      if (parts.length >= 2) {
        const left = parseFloat(parts[0]);
        const op = parts[1];
        if (currentValue !== '0' && currentValue !== '') {
          // Live calculation: hitung hasil sementara saat mengetik
          const right = parseFloat(currentValue);
          const liveResult = calculate(left, op, right);
          return formatDisplayNumber(liveResult.toString());
        }
        return formatDisplayNumber(subtotal !== null ? subtotal.toString() : parts[0]);
      }
    }

    return formatDisplayNumber(currentValue);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key >= '0' && e.key <= '9') {
        handleNumber(e.key);
      } else if (e.key === ',' || e.key === '.') {
        handleComma();
      } else if (e.key.toLowerCase() === 'h') {
        handleHalf();
      } else if (e.key === '+' || e.key === '-') {
        handleOperator(e.key);
      } else if (e.key === '*' || e.key.toLowerCase() === 'x') {
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key.toLowerCase() === 'c' || e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentValue, expression, chainFormula, subtotal, justCalculated]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-white/10 text-zinc-100 max-w-xs sm:max-w-sm rounded-3xl p-5 shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
          <DialogTitle className="text-base font-bold font-serif flex items-center gap-2 text-amber-400">
            <Calculator size={18} />
            Kalkulator
          </DialogTitle>
        </DialogHeader>

        {/* Display Screen */}
        <div className="bg-zinc-900/90 border border-white/5 p-4 rounded-2xl flex flex-col items-end justify-between min-h-[90px] shadow-inner my-2">
          {/* History / Expression */}
          <div className="w-full text-right text-xs text-zinc-500 font-mono truncate min-h-[18px]" id="calc-display-expression">
            {chainFormula ? (
              currentValue !== '0' ? (
                `${chainFormula}${formatDisplayNumber(currentValue)}`
              ) : (
                chainFormula
              )
            ) : justCalculated && history[0] ? (
              history[0].expr
            ) : (
              ''
            )}
          </div>

          {/* Main Large Number - Live Subtotal Result */}
          <div className="w-full text-right text-3xl font-black text-amber-400 font-sans tracking-tight truncate" id="calc-display-current">
            {getDisplayValue()}
          </div>
        </div>

        {/* Numpad Grid - 4x5 Symmetrical */}
        <div className="grid grid-cols-4 gap-2 py-1">
          {/* Row 1 */}
          <button
            id="calc-btn-c"
            type="button"
            onClick={handleClear}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-rose-400 border border-white/5 text-sm font-bold active:scale-95 transition-all cursor-pointer"
          >
            C
          </button>
          <button
            id="calc-btn-backspace"
            type="button"
            onClick={handleBackspace}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/5 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            <Delete size={18} />
          </button>
          <button
            id="calc-btn-000"
            type="button"
            onClick={() => handleNumber('000')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/5 text-xs font-bold active:scale-95 transition-all cursor-pointer"
          >
            000
          </button>
          <button
            id="calc-btn-divide"
            type="button"
            onClick={() => handleOperator('÷')}
            className="h-13 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            ÷
          </button>

          {/* Row 2 */}
          <button
            id="calc-btn-7"
            type="button"
            onClick={() => handleNumber('7')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            7
          </button>
          <button
            id="calc-btn-8"
            type="button"
            onClick={() => handleNumber('8')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            8
          </button>
          <button
            id="calc-btn-9"
            type="button"
            onClick={() => handleNumber('9')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            9
          </button>
          <button
            id="calc-btn-multiply"
            type="button"
            onClick={() => handleOperator('×')}
            className="h-13 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            id="calc-btn-4"
            type="button"
            onClick={() => handleNumber('4')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            4
          </button>
          <button
            id="calc-btn-5"
            type="button"
            onClick={() => handleNumber('5')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            5
          </button>
          <button
            id="calc-btn-6"
            type="button"
            onClick={() => handleNumber('6')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            6
          </button>
          <button
            id="calc-btn-minus"
            type="button"
            onClick={() => handleOperator('-')}
            className="h-13 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            -
          </button>

          {/* Row 4 */}
          <button
            id="calc-btn-1"
            type="button"
            onClick={() => handleNumber('1')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            1
          </button>
          <button
            id="calc-btn-2"
            type="button"
            onClick={() => handleNumber('2')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            2
          </button>
          <button
            id="calc-btn-3"
            type="button"
            onClick={() => handleNumber('3')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            3
          </button>
          <button
            id="calc-btn-plus"
            type="button"
            onClick={() => handleOperator('+')}
            className="h-13 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            +
          </button>

          {/* Row 5 - 0, Comma, Half (½), Equals (=) */}
          <button
            id="calc-btn-0"
            type="button"
            onClick={() => handleNumber('0')}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            0
          </button>
          <button
            id="calc-btn-comma"
            type="button"
            onClick={handleComma}
            className="h-13 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/5 text-lg font-bold active:scale-95 transition-all cursor-pointer"
          >
            ,
          </button>
          <button
            id="calc-btn-half"
            type="button"
            onClick={handleHalf}
            className="h-13 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-base font-black active:scale-95 transition-all cursor-pointer"
            title="Tambah Setengah (0,5)"
          >
            ½
          </button>
          <button
            id="calc-btn-equals"
            type="button"
            onClick={handleEquals}
            className="h-13 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            =
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
