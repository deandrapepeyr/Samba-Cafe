'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, Settings, UserCircle, LogOut, LogIn, Coffee, Package, FileText, ChevronLeft, ChevronRight, Loader2, ChefHat, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function Sidebar({ onLogoutClick, onLoginClick }: { onLogoutClick?: () => void; onLoginClick?: () => void } = {}) {
  const pathname = usePathname();
  const { role, userName, logout, isLoading, login } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true); // Always true on first render to match SSR
  const [mounted, setMounted] = useState(false);
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(0);

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{name: string; role: any} | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [managerDecoyName, setManagerDecoyName] = useState('budi');
  const [shakeAccounts, setShakeAccounts] = useState(false);

  useEffect(() => {
    const handleShake = () => {
      setShakeAccounts(true);
      setTimeout(() => setShakeAccounts(false), 500);
    };
    window.addEventListener('shake-sidebar-profiles', handleShake);
    return () => window.removeEventListener('shake-sidebar-profiles', handleShake);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    if (saved !== null) {
      setIsExpanded(saved === 'true');
    }
    const decoy = localStorage.getItem('samba_manager_decoy_name');
    if (decoy) {
      setManagerDecoyName(decoy);
    }
    // Delay setting mounted to true so the initial snap to saved state has no transition
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mounted && role) {
      fetchActiveCount();
      
      const channelId = `sidebar_orders_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase
        .channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
          fetchActiveCount();
        })
        .subscribe();

      const interval = setInterval(fetchActiveCount, 10000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, [mounted, role]);

  const fetchActiveCount = async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('transactions')
      .select('status')
      .gte('created_at', startOfDay.toISOString());

    if (data) {
      const active = data.filter(t => {
        const st = (t.status || 'preparing').toLowerCase();
        return st === 'preparing' || st === 'ready' || st === 'paid';
      }).length;
      setActiveOrdersCount(active);
    }
  };

  const isManager = mounted && !isLoading && role === 'manager';
  const isAuthLoaded = mounted && !isLoading;

  const cashierProfiles = [
    { name: 'deandra pepe yongker', role: 'cashier', label: 'Kasir', initial: 'D' },
    { name: 'sheera', role: 'cashier', label: 'Kasir', initial: 'S' },
    { name: managerDecoyName, role: 'cashier', label: 'Kasir', initial: managerDecoyName.charAt(0).toUpperCase() },
  ];

  const handleProfileClick = (profile: any) => {
    setSelectedProfile(profile);
    setPasswordInput('');
    setPasswordError('');
    setShowPassword(false);
    setIsPasswordDialogOpen(true);
  };

  const handleVerifyPassword = async () => {
    if (!selectedProfile) return;
    setPasswordError('');
    if (!passwordInput.trim()) {
      setPasswordError('Password tidak boleh kosong');
      return;
    }
    setIsVerifying(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .or(`name.eq."${selectedProfile.name}",username.eq."${selectedProfile.name}"`)
        .maybeSingle();

      const { data: managerUser } = await supabase
        .from('users')
        .select('name')
        .eq('role', 'manager')
        .maybeSingle();

      const managerName = managerUser?.name || 'Budi Santoso (Manager)';
      let isCorrect = false;
      let finalRole = selectedProfile.role;
      let finalName = selectedProfile.name;
      const nameLower = selectedProfile.name.toLowerCase();

      if ((nameLower.includes('budi') || nameLower.includes('manager') || nameLower === managerDecoyName.toLowerCase()) && passwordInput === 'admin123') {
        isCorrect = true;
        finalRole = 'manager';
        finalName = managerName;
      } else if (nameLower.includes('sheera') && passwordInput === 'password123') {
        isCorrect = true;
        finalRole = 'cashier';
        finalName = 'sheera';
      } else if (nameLower.includes('deandra') && passwordInput === '123456') {
        isCorrect = true;
        finalRole = 'cashier';
        finalName = 'deandra pepe yongker';
      } else if (userData && userData.password === passwordInput) {
        isCorrect = true;
        finalRole = userData.role;
        finalName = userData.name;
      }

      if (isCorrect) {
        login(finalRole, finalName);
        setIsPasswordDialogOpen(false);
      } else {
        setPasswordError('Password salah');
      }
    } catch (err) {
      setPasswordError('Koneksi error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <>
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
      <div className={cn(
        "h-screen bg-background border-r border-border flex flex-col justify-between py-6 relative",
        mounted ? "transition-all duration-300" : "",
        isExpanded ? "w-64" : "w-20"
      )}>
      <button 
        onClick={() => {
          const newVal = !isExpanded;
          setIsExpanded(newVal);
          localStorage.setItem('sidebar_expanded', String(newVal));
        }}
        className="absolute -right-3 top-8 bg-card border border-border rounded-full p-1 text-muted-foreground hover:text-foreground z-10 hidden md:block"
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className={cn("flex flex-col px-0 space-y-8", isExpanded ? "items-stretch px-4" : "items-center")}>
        <div className={cn("flex items-center gap-3 px-2", isExpanded ? "justify-start" : "justify-center")}>
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
            <img src="/logo.png" alt="Samba Cafe" className="w-full h-full object-cover" />
          </div>
          <span className={cn("text-primary font-bold text-xl tracking-tight", isExpanded ? "block" : "hidden")}>Samba Cafe</span>
        </div>

        <nav className="flex flex-col gap-2">
          <Link href="/pos" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/pos' })}>
            <Home size={20} className="shrink-0" />
            <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>POS</span>
          </Link>

          {role ? (
            <>
              <Link href="/orders" className={cn("flex items-center justify-between px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/orders' })}>
                <div className="flex items-center gap-3">
                  <ChefHat size={20} className="shrink-0" />
                  <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Pesanan</span>
                </div>
                {activeOrdersCount > 0 && (
                  <span className={cn("px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white animate-pulse", isExpanded ? "block" : "hidden")}>
                    {activeOrdersCount}
                  </span>
                )}
              </Link>
              {isManager && (
                <Link href="/dashboard" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/dashboard' })}>
                  <LayoutDashboard size={20} className="shrink-0" />
                  <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Dashboard</span>
                </Link>
              )}
              <Link href="/history" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/history' })}>
                <Coffee size={20} className="shrink-0" />
                <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>History</span>
              </Link>
              {isManager && (
                <>
                  <Link href="/reports" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/reports' })}>
                    <FileText size={20} className="shrink-0" />
                    <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Reports</span>
                  </Link>
                  <Link href="/stock" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/stock' })}>
                    <Package size={20} className="shrink-0" />
                    <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Stock</span>
                  </Link>
                  <Link href="/stock/recipes" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/stock/recipes' })}>
                    <BookOpen size={20} className="shrink-0" />
                    <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Resep Menu</span>
                  </Link>
                  <Link href="/settings" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/settings' })}>
                    <Settings size={20} className="shrink-0" />
                    <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Settings</span>
                  </Link>
                </>
              )}
            </>
          ) : (
            <div className={cn("flex flex-col gap-2 mt-2", shakeAccounts ? "animate-shake" : "")}>
              <span className={cn("text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1", isExpanded ? "block" : "hidden")}>Pilih Akun</span>
              {cashierProfiles.map(profile => (
                <button 
                  key={profile.name}
                  onClick={() => handleProfileClick(profile)} 
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {profile.initial}
                  </div>
                  <div className={cn("flex-col overflow-hidden", isExpanded ? "flex" : "hidden")}>
                    <span className="font-medium text-sm text-foreground truncate">{profile.name}</span>
                    <span className="text-xs opacity-70 truncate">{profile.label}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </nav>
      </div>

      <div className={cn("flex flex-col gap-2 px-2", isExpanded ? "px-4" : "")}>
        {!isAuthLoaded ? (
          <div className="px-3 py-3 text-muted-foreground flex items-center gap-3 text-sm">
            <Loader2 size={20} className="animate-spin text-primary shrink-0" />
            <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Memuat...</span>
          </div>
        ) : role ? (
          <>
            <Link href="/profile" className={cn("flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all", { "bg-primary/10 text-primary hover:bg-primary/10": pathname === '/profile' })}>
              <UserCircle size={20} className="shrink-0" />
              <span className={cn("font-medium truncate", isExpanded ? "block" : "hidden")}>{userName || 'Profile'}</span>
            </Link>
            <button onClick={onLogoutClick || logout} className="flex items-center gap-3 px-3 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-all">
              <LogOut size={20} className="shrink-0" />
              <span className={cn("font-medium", isExpanded ? "block" : "hidden")}>Log Out</span>
            </button>
          </>
        ) : null}
      </div>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[380px] p-0 bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
          <div className="relative">
            {/* Top gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
            
            {/* Content */}
            <div className="px-7 pt-8 pb-7">
              {/* Avatar + Info */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
                  <span className="text-xl font-bold text-primary">
                    {selectedProfile?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-base font-semibold text-white tracking-tight">
                    Verifikasi Akun
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#888]">
                    Masukkan password untuk{' '}
                    <span className="text-primary font-medium">{selectedProfile?.name}</span>
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Password input */}
              <div className="space-y-3">
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] group-focus-within:text-primary transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyPassword(); }}
                    autoFocus
                    className="w-full h-11 pl-10 pr-10 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder:text-[#444] outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#999] transition-colors"
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Error message */}
                {passwordError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/8 border border-red-500/20 rounded-lg">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-xs text-red-400 font-medium">{passwordError}</span>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-2.5 mt-5">
                <button 
                  onClick={() => setIsPasswordDialogOpen(false)}
                  className="flex-1 h-10 rounded-xl border border-[#2a2a2a] bg-transparent text-sm font-medium text-[#888] hover:text-white hover:border-[#444] transition-all"
                >
                  Batal
                </button>
                <button 
                  onClick={handleVerifyPassword} 
                  disabled={isVerifying}
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      <span>Verifikasi...</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      <span>Masuk</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
