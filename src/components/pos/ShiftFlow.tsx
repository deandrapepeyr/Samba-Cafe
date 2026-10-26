'use client';

import React from 'react';
import { UserCircle, LogIn, KeyRound, EyeOff, Eye, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Role } from '@/lib/AuthContext';

export interface CashierProfileItem {
  name: string;
  role: Role;
  label: string;
  initial: string;
}

export interface ShiftSummaryData {
  starting: number;
  expectedRevenue: number;
  actualRevenue: number;
  difference: number;
}

interface ShiftFlowProps {
  cashierProfiles: CashierProfileItem[];
  isSelectCashierOpen: boolean;
  setIsSelectCashierOpen: (open: boolean) => void;
  handleSelectProfile: (profile: { name: string; role: Role }) => void;
  isPasswordDialogOpen: boolean;
  setIsPasswordDialogOpen: (open: boolean) => void;
  selectedProfile: { name: string; role: Role } | null;
  profilePasswordError: string;
  showProfilePassword: boolean;
  setShowProfilePassword: (show: boolean) => void;
  profilePasswordInput: string;
  setProfilePasswordInput: (input: string) => void;
  handleVerifyPassword: () => void;
  isVerifyingPassword: boolean;
  isStartShiftDialogOpen: boolean;
  setIsStartShiftDialogOpen: (open: boolean) => void;
  userName: string | null;
  startingCashInput: string;
  setStartingCashInput: (cash: string) => void;
  handleStartShift: () => void;
  isEndShiftDialogOpen: boolean;
  setIsEndShiftDialogOpen: (open: boolean) => void;
  activeShift: any;
  expectedCash: number;
  endingCashInput: string;
  setEndingCashInput: (cash: string) => void;
  handleEndShift: () => void;
  isShiftSummaryOpen: boolean;
  setIsShiftSummaryOpen: (open: boolean) => void;
  shiftSummary: ShiftSummaryData | null;
  logout: () => void;
}

export function ShiftFlow({
  cashierProfiles,
  isSelectCashierOpen,
  setIsSelectCashierOpen,
  handleSelectProfile,
  isPasswordDialogOpen,
  setIsPasswordDialogOpen,
  selectedProfile,
  profilePasswordError,
  showProfilePassword,
  setShowProfilePassword,
  profilePasswordInput,
  setProfilePasswordInput,
  handleVerifyPassword,
  isVerifyingPassword,
  isStartShiftDialogOpen,
  setIsStartShiftDialogOpen,
  userName,
  startingCashInput,
  setStartingCashInput,
  handleStartShift,
  isEndShiftDialogOpen,
  setIsEndShiftDialogOpen,
  activeShift,
  expectedCash,
  endingCashInput,
  setEndingCashInput,
  handleEndShift,
  isShiftSummaryOpen,
  setIsShiftSummaryOpen,
  shiftSummary,
  logout,
}: ShiftFlowProps) {
  return (
    <>
      {/* Select Cashier Profile Dialog */}
      <Dialog open={isSelectCashierOpen} onOpenChange={setIsSelectCashierOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <UserCircle className="text-primary" size={24} />
              Pilih Profile Kasir
            </DialogTitle>
            <DialogDescription>
              Pilih profile kasir Anda untuk membuka shift dan mulai menginput pesanan.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            {cashierProfiles.map(profile => (
              <button
                key={profile.name}
                onClick={() => handleSelectProfile(profile)}
                className="w-full p-4 rounded-xl bg-muted/40 hover:bg-primary/10 border border-border hover:border-primary/50 transition-all flex items-center justify-between group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold text-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                    {profile.initial}
                  </div>
                  <div>
                    <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                      {profile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{profile.label}</p>
                  </div>
                </div>
                <span className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex items-center gap-1">
                  <LogIn size={14} /> Log In
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Password Verification Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <KeyRound className="text-primary" size={24} />
              Verifikasi Password Kasir
            </DialogTitle>
            <DialogDescription>
              Masukkan password untuk mengonfirmasi identitas Anda sebelum membuka shift.
            </DialogDescription>
          </DialogHeader>

          {selectedProfile && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3 p-3.5 bg-muted/50 rounded-xl border border-border">
                <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold text-xl flex items-center justify-center">
                  {selectedProfile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-foreground">{selectedProfile.name}</p>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase tracking-wider">
                    {selectedProfile.role}
                  </span>
                </div>
              </div>

              {profilePasswordError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs font-semibold text-destructive animate-in fade-in">
                  ⚠️ {profilePasswordError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password / PIN Kasir</label>
                <div className="relative">
                  <Input
                    type={showProfilePassword ? 'text' : 'password'}
                    placeholder="Masukkan password..."
                    value={profilePasswordInput}
                    onChange={e => setProfilePasswordInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleVerifyPassword();
                    }}
                    autoFocus
                    className="h-12 pr-10 text-base bg-background border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProfilePassword(!showProfilePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showProfilePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-row justify-between gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsPasswordDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleVerifyPassword}
              disabled={isVerifyingPassword || !profilePasswordInput}
              className="flex-1 bg-primary text-primary-foreground font-bold"
            >
              {isVerifyingPassword ? 'Memverifikasi...' : 'Verifikasi & Lanjut ➔'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Shift Dialog */}
      <Dialog open={isStartShiftDialogOpen} onOpenChange={setIsStartShiftDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Buka Kasir ({selectedProfile?.name || userName || 'Kasir'})</DialogTitle>
            <DialogDescription>Masukkan jumlah modal awal/kembalian di laci kasir.</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Modal Awal (Rp)</label>
              <Input
                autoFocus
                placeholder="Contoh: 100.000"
                value={startingCashInput ? parseInt(startingCashInput).toLocaleString('id-ID') : ''}
                onChange={e => {
                  const rawValue = e.target.value.replace(/\./g, '');
                  if (/^\d*$/.test(rawValue)) {
                    setStartingCashInput(rawValue);
                  }
                }}
                className="h-12 text-lg font-bold"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsStartShiftDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => handleStartShift()}
              disabled={!startingCashInput}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            >
              Buka Shift Kasir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Shift Dialog with Live Difference Calculation */}
      <Dialog open={isEndShiftDialogOpen} onOpenChange={setIsEndShiftDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 text-zinc-100 sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-serif text-amber-400">
              Tutup Shift Kasir ({userName})
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Hitung total uang fisik penjualan tunai yang ada di laci kasir untuk merekonsiliasi kas.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-4">
            <div className="bg-zinc-900/80 p-3.5 rounded-xl space-y-2 text-xs border border-white/5">
              <div className="flex justify-between text-zinc-400">
                <span>Modal Awal Kasir:</span>
                <span className="font-semibold text-zinc-200">Rp {(activeShift?.starting_cash || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Penjualan Tunai (Sistem):</span>
                <span className="font-semibold text-zinc-200">Rp {Math.max(0, expectedCash - (activeShift?.starting_cash || 0)).toLocaleString('id-ID')}</span>
              </div>
              <Separator className="bg-white/5" />
              <div className="flex justify-between text-sm font-bold">
                <span className="text-zinc-300">Total Seharusnya di Laci:</span>
                <span className="text-amber-400 font-sans">Rp {expectedCash.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Total Uang Fisik di Laci (Rp) *</label>
              <Input
                autoFocus
                placeholder="0"
                value={endingCashInput ? parseInt(endingCashInput.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID') : ''}
                onChange={e => {
                  const rawValue = e.target.value.replace(/\D/g, '');
                  setEndingCashInput(rawValue);
                }}
                className="h-12 text-lg font-black text-amber-400 bg-zinc-900 border-white/10 rounded-xl focus-visible:ring-amber-500"
              />
              <p className="text-[11px] text-zinc-500">
                Masukkan total fisik uang kas di laci (penjualan tunai + modal awal).
              </p>
            </div>

            {endingCashInput && (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between animate-in fade-in zoom-in-95 ${
                  parseInt(endingCashInput.replace(/\D/g, '') || '0', 10) - expectedCash < 0
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    : parseInt(endingCashInput.replace(/\D/g, '') || '0', 10) - expectedCash > 0
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Selisih Kas</span>
                  <p className="text-lg font-black font-sans">
                    {parseInt(endingCashInput.replace(/\D/g, '') || '0', 10) - expectedCash > 0 ? '+' : ''}
                    Rp {(parseInt(endingCashInput.replace(/\D/g, '') || '0', 10) - expectedCash).toLocaleString('id-ID')}
                  </p>
                </div>
                <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-black/30 border border-white/10">
                  {parseInt(endingCashInput.replace(/\D/g, '') || '0', 10) - expectedCash === 0
                    ? 'Sesuai (Pas)'
                    : parseInt(endingCashInput.replace(/\D/g, '') || '0', 10) - expectedCash > 0
                    ? 'Surplus (Lebih)'
                    : 'Defisit (Kurang)'}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEndShiftDialogOpen(false)}
              className="flex-1 bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800 rounded-xl h-11 text-xs font-bold"
            >
              Batal
            </Button>
            <Button
              onClick={handleEndShift}
              disabled={!endingCashInput}
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl h-11 text-xs shadow-lg shadow-rose-600/20"
            >
              Tutup Shift & Rekonsiliasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Summary Dialog */}
      <Dialog open={isShiftSummaryOpen} onOpenChange={setIsShiftSummaryOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md text-center" showCloseButton={false}>
          <div className="py-6 flex flex-col items-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4 border-4 border-primary/30">
              <CheckCircle2 size={32} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Shift Berhasil Ditutup!</h2>
            <p className="text-muted-foreground mb-6">Terima kasih atas kerja kerasmu hari ini.</p>

            {shiftSummary && (
              <div className="w-full bg-muted p-4 rounded-xl space-y-3 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Modal Awal:</span>
                  <span className="font-medium">Rp {shiftSummary.starting.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Uang Hasil (Sistem):</span>
                  <span className="font-medium">Rp {shiftSummary.expectedRevenue.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Uang Hasil (Aktual/Fisik):</span>
                  <span className="font-medium">Rp {shiftSummary.actualRevenue.toLocaleString('id-ID')}</span>
                </div>
                <Separator className="my-2 border-border" />
                <div className="flex justify-between font-bold text-lg">
                  <span>Selisih Hasil:</span>
                  <span
                    className={
                      shiftSummary.difference < 0
                        ? 'text-destructive'
                        : shiftSummary.difference > 0
                        ? 'text-green-500'
                        : 'text-primary'
                    }
                  >
                    {shiftSummary.difference > 0 ? '+' : ''}Rp {shiftSummary.difference.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button
              className="w-full h-12 font-bold"
              onClick={() => {
                setIsShiftSummaryOpen(false);
                logout();
              }}
            >
              Log Out Kasir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
