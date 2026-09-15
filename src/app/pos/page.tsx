'use client';

import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Minus, FileEdit, Menu, X, QrCode, Banknote, CheckCircle2, ShoppingCart, LockKeyhole, UserCircle, LogIn, Lock, LogOut, Eye, EyeOff, KeyRound, ShieldCheck, Utensils } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, Role } from '@/lib/AuthContext';

export type Product = {
  id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
  is_titipan: boolean;
  titipan_name: string | null;
  supplier_price?: number;
};

export type Category = {
  id: string;
  name: string;
};

type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  notes?: string;
};

export default function POSPage() {
  const managerDecoyName = typeof window !== 'undefined' ? (localStorage.getItem('samba_manager_decoy_name') || 'budi') : 'budi';

  const cashierProfiles: { name: string; role: Role; label: string; initial: string }[] = [
    { name: 'deandra pepe yongker', role: 'cashier', label: 'Kasir', initial: 'D' },
    { name: 'sheera', role: 'cashier', label: 'Kasir', initial: 'S' },
    { name: managerDecoyName, role: 'cashier', label: 'Kasir', initial: managerDecoyName.charAt(0).toUpperCase() },
  ];

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [activeCategory, setActiveCategory] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Note dialog state
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [activeNoteItem, setActiveNoteItem] = useState<string | null>(null);
  const [tempNote, setTempNote] = useState('');

  // Checkout flow state
  const [checkoutStep, setCheckoutStep] = useState<'none' | 'method' | 'confirm' | 'success'>('none');
  const [paymentMethod, setPaymentMethod] = useState<'QRIS' | 'Cash' | null>(null);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerName, setCustomerName] = useState('');

  // QRIS State
  const [isQRISModalOpen, setIsQRISModalOpen] = useState(false);

  // Auth & Shift Management
  const { userName, role, isLoading, login, logout } = useAuth();
  const router = useRouter();
  
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isCheckingShift, setIsCheckingShift] = useState(true);
  const [isSelectCashierOpen, setIsSelectCashierOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{ name: string; role: Role } | null>(null);
  
  // Profile Password Verification State
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [profilePasswordInput, setProfilePasswordInput] = useState('');
  const [profilePasswordError, setProfilePasswordError] = useState('');
  const [showProfilePassword, setShowProfilePassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  const [isStartShiftDialogOpen, setIsStartShiftDialogOpen] = useState(false);
  const [isEndShiftDialogOpen, setIsEndShiftDialogOpen] = useState(false);
  const [startingCashInput, setStartingCashInput] = useState('');
  const [endingCashInput, setEndingCashInput] = useState('');
  const [expectedCash, setExpectedCash] = useState(0);
  const [shiftSummary, setShiftSummary] = useState<any>(null);

  const [isShiftSummaryOpen, setIsShiftSummaryOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(true);
  
  const cartEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrderNumber(Math.floor(Math.random() * 10000).toString().padStart(4, '0'));
  }, []);

  useEffect(() => {
    async function initPageData() {
      setIsCheckingShift(true);

      const [categoriesRes, productsRes] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('products').select('*').eq('is_available', true)
      ]);

      if (categoriesRes.data) {
        setCategories([{ id: '1', name: 'All Menu' }, ...categoriesRes.data]);
      }
      if (productsRes.data) setProducts(productsRes.data);
      setIsLoadingData(false);

      if (userName) {
        const { data } = await supabase
          .from('shifts')
          .select('*')
          .eq('cashier_name', userName)
          .eq('status', 'active')
          .order('start_time', { ascending: false })
          .limit(1);
          
        if (data && data.length > 0) {
          setActiveShift(data[0]);
        } else {
          setActiveShift(null);
        }
      } else {
        setActiveShift(null);
      }
      setIsCheckingShift(false);
    }

    initPageData();

    const handleRefreshProducts = async () => {
      const { data } = await supabase.from('products').select('*').eq('is_available', true);
      if (data) {
        // Find newly added products or updated products and ensure state is fresh
        setProducts(data);
      }
    };
    
    window.addEventListener('refresh-products', handleRefreshProducts);
    return () => window.removeEventListener('refresh-products', handleRefreshProducts);
  }, [userName]);

  useEffect(() => {
    if (cartEndRef.current) {
      cartEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cart.length]);

  // No more DANA Timer logic needed

  const handleLockActionClick = () => {
    if (!role || !userName) {
      window.dispatchEvent(new CustomEvent('shake-sidebar-profiles'));
    } else {
      setSelectedProfile({ name: userName, role: role });
      setStartingCashInput('100000');
      setIsStartShiftDialogOpen(true);
    }
  };

  const handleSelectProfile = (profile: { name: string; role: Role }) => {
    setSelectedProfile(profile);
    setIsSelectCashierOpen(false);
    setProfilePasswordInput('');
    setProfilePasswordError('');
    setShowProfilePassword(false);
    setIsPasswordDialogOpen(true);
  };

  const handleVerifyPassword = async () => {
    if (!selectedProfile) return;
    setProfilePasswordError('');

    if (!profilePasswordInput.trim()) {
      setProfilePasswordError('Password tidak boleh kosong.');
      return;
    }

    setIsVerifyingPassword(true);

    try {
      // Query user in database
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .or(`name.ilike."${selectedProfile.name}",username.ilike."${selectedProfile.name}"`)
        .maybeSingle();

      // Fetch manager account from database to ensure exact name sync
      const { data: managerUser } = await supabase
        .from('users')
        .select('name')
        .eq('role', 'manager')
        .maybeSingle();

      const managerName = managerUser?.name || 'Budi Santoso (Manager)';

      let isCorrect = false;
      let finalRole: Role = selectedProfile.role;
      let finalName: string = selectedProfile.name;

      const nameLower = selectedProfile.name.toLowerCase();

      // Stealth Manager Login Check
      if ((nameLower.includes('sonic') || nameLower.includes('manager')) && profilePasswordInput === 'admin123') {
        isCorrect = true;
        finalRole = 'manager';
        finalName = managerName;
      } else if (userData && userData.password.trim() === profilePasswordInput.trim()) {
        isCorrect = true;
        finalRole = userData.role as Role;
        finalName = userData.name;
      }

      setIsVerifyingPassword(false);

      if (isCorrect) {
        setSelectedProfile({ name: finalName, role: finalRole });
        login(finalRole, finalName);
        setIsPasswordDialogOpen(false);
        setStartingCashInput('100000');
        setIsStartShiftDialogOpen(true);
      } else {
        setProfilePasswordError('Password yang Anda masukkan salah. Silakan coba lagi.');
      }
    } catch (err) {
      setIsVerifyingPassword(false);
      setProfilePasswordError('Gagal memverifikasi password.');
    }
  };

  const handleStartShift = async (cashAmount?: number) => {
    const targetName = selectedProfile?.name || userName;
    const targetRole = selectedProfile?.role || role || 'cashier';
    if (!targetName) return;
    
    let cash = 0;
    if (cashAmount !== undefined) {
      cash = cashAmount;
    } else {
      cash = parseInt(startingCashInput.replace(/\./g, ''));
      if (isNaN(cash)) cash = 0;
    }

    // Auto-close any previous unclosed active shifts for this cashier
    await supabase
      .from('shifts')
      .update({ status: 'closed', end_time: new Date().toISOString() })
      .eq('cashier_name', targetName)
      .eq('status', 'active');

    const newShift = {
      cashier_name: targetName,
      starting_cash: cash,
      status: 'active'
    };

    const { data, error } = await supabase.from('shifts').insert([newShift]).select().single();
    if (!error && data) {
      login(targetRole, targetName);
      setActiveShift(data);
      setIsStartShiftDialogOpen(false);
      setStartingCashInput('');
    } else {
      alert("Failed to start shift: " + error?.message);
    }
  };

  const handleCalculateEndShift = async () => {
    if (!activeShift) {
      logout();
      return;
    }
    
    // Calculate total cash transactions during this shift
    const { data: txData } = await supabase
      .from('transactions')
      .select('total')
      .eq('cashier_name', userName)
      .eq('method', 'Cash')
      .gte('created_at', activeShift.start_time);
      
    let cashSales = 0;
    if (txData) {
      cashSales = txData.reduce((sum, tx) => sum + tx.total, 0);
    }
    
    setExpectedCash(activeShift.starting_cash + cashSales);
    setIsEndShiftDialogOpen(true);
  };

  const handleEndShift = async () => {
    if (!activeShift || !endingCashInput) return;
    
    const inputRevenue = parseInt(endingCashInput.replace(/\./g, ''));
    if (isNaN(inputRevenue)) return;

    // Total uang di laci (Modal + Hasil)
    const endCash = inputRevenue + activeShift.starting_cash;
    const expectedRevenue = expectedCash - activeShift.starting_cash;

    const { error } = await supabase
      .from('shifts')
      .update({
        end_time: new Date().toISOString(),
        ending_cash: endCash,
        expected_cash: expectedCash,
        status: 'closed'
      })
      .eq('id', activeShift.id);

    if (!error) {
      setShiftSummary({
        starting: activeShift.starting_cash,
        expectedRevenue: expectedRevenue,
        actualRevenue: inputRevenue,
        difference: inputRevenue - expectedRevenue
      });
      setIsEndShiftDialogOpen(false);
      setActiveShift(null);
      setEndingCashInput('');
      setIsShiftSummaryOpen(true);
    } else {
      alert("Failed to end shift: " + error.message);
    }
  };

  const isPageLoading = isLoading || isCheckingShift;
  const isLocked = !isPageLoading && (!role || !activeShift);

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === '1' || p.category_id === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
    if (isLocked) {
      handleLockActionClick();
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { id: Math.random().toString(), product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const openNoteDialog = (item: CartItem) => {
    setActiveNoteItem(item.id);
    setTempNote(item.notes || '');
    setIsNoteDialogOpen(true);
  };

  const saveNote = () => {
    if (activeNoteItem) {
      setCart(prev => prev.map(item => 
        item.id === activeNoteItem 
          ? { ...item, notes: tempNote } 
          : item
      ));
    }
    setIsNoteDialogOpen(false);
  };

  const handleCheckoutProcess = async () => {
    if (checkoutStep === 'confirm') {
      if (paymentMethod === 'QRIS') {
        setIsQRISModalOpen(true);
      } else {
        await finalizeTransaction();
      }
    }
  };

  const handleQRISPaymentSuccess = async () => {
    setIsQRISModalOpen(false);
    await finalizeTransaction();
  };

  const finalizeTransaction = async () => {
    setIsProcessingCheckout(true);
    
    const transactionId = orderNumber;
    const transaction = {
      id: transactionId,
        method: paymentMethod,
        total: total,
        cashier_name: userName || 'Unknown',
        status: 'preparing',
        cash_received: paymentMethod === 'Cash' && cashReceived ? parseInt(cashReceived.replace(/\./g, '')) : null,
        customer_name: customerName || null
    };

    const itemsToInsert = cart.map(item => ({
      transaction_id: transactionId,
      product_name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      notes: item.notes || null,
      supplier_price: item.product.supplier_price || 0
    }));

    try {
      // If offline, skip direct to local storage catch block
      if (!navigator.onLine) throw new Error("Offline Mode");

      const { error: txError } = await supabase.from('transactions').insert([transaction]);
      if (txError) throw txError;

      const { error: itemsError } = await supabase.from('transaction_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Deduct stock based on recipe
      const productIds = cart.map(item => item.product.id);
      const { data: recipes } = await supabase.from('product_ingredients').select('*').in('product_id', productIds);
      
      if (recipes && recipes.length > 0) {
        const stockDeductions: Record<string, number> = {};
        for (const cartItem of cart) {
          const itemRecipes = recipes.filter(r => r.product_id === cartItem.product.id);
          for (const recipe of itemRecipes) {
            if (!stockDeductions[recipe.stock_id]) stockDeductions[recipe.stock_id] = 0;
            stockDeductions[recipe.stock_id] += (recipe.quantity_required * cartItem.quantity);
          }
        }

        const stockIds = Object.keys(stockDeductions);
        const { data: currentStocks } = await supabase.from('stocks').select('id, quantity').in('id', stockIds);
        
        if (currentStocks) {
          for (const stock of currentStocks) {
            const amountToDeduct = stockDeductions[stock.id];
            if (amountToDeduct) {
              const newQuantity = Math.max(0, stock.quantity - amountToDeduct);
              await supabase.from('stocks').update({ quantity: newQuantity, last_updated: new Date().toISOString() }).eq('id', stock.id);
            }
          }
        }
      }
    } catch (error: any) {
      console.warn("Failed to sync to Supabase, saving to offline queue:", error);
      // Offline Queueing Logic
      const offlineQueue = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
      offlineQueue.push({ transaction, itemsToInsert });
      localStorage.setItem('offline_transactions', JSON.stringify(offlineQueue));
      // Notify cashier indirectly via UI (you can add toast here if preferred)
      alert("⚠️ Offline Mode: Transaksi disimpan secara lokal. Pastikan jangan me-refresh browser dan tunggu hingga koneksi kembali.");
    }

    setIsProcessingCheckout(false);
    setCheckoutStep('success');
  };

  const completeAndNewOrder = () => {
    setCart([]);
    setCheckoutStep('none');
    setPaymentMethod(null);
    setCashReceived('');
    setCustomerName('');
    setOrderNumber(Math.floor(Math.random() * 10000).toString().padStart(4, '0'));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const total = subtotal;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const renderCartContent = () => (
    <>
      <div className="p-4 xl:p-6 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-xl xl:text-2xl font-bold">Current Order</h2>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
            <span>Order #{orderNumber}</span>
            {isPageLoading ? (
              <>
                <span>•</span>
                <span className="text-muted-foreground italic flex items-center gap-1 text-xs">
                  Checking status...
                </span>
              </>
            ) : userName && role ? (
              <>
                <span>•</span>
                <span className="text-foreground font-semibold">Kasir: {userName}</span>
              </>
            ) : (
              <>
                <span>•</span>
                <span className="text-amber-500 font-semibold flex items-center gap-1">
                  <LockKeyhole size={14} /> Belum Login
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
        {isPageLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground mt-12 gap-3">
            <p className="text-xs">Checking shift status...</p>
          </div>
        ) : isLocked ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-muted-foreground mt-8">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
              <LockKeyhole size={32} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">Fitur POS Terkunci</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {role ? `Kasir (${userName}) belum membuka shift. Silakan masukkan uang modal awal untuk mulai.` : 'Silakan Log In kasir untuk mulai menginput pesanan.'}
              </p>
            </div>
          </div>
        ) : cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground mt-20">
            <p>Your cart is empty</p>
          </div>
        ) : (
          <div className="space-y-4 pb-32 lg:pb-0">
            {cart.map(item => (
              <div key={item.id} className="flex flex-col gap-2 p-3 bg-background rounded-xl border border-border">
                <div className="flex justify-between">
                  <span className="font-medium line-clamp-1">{item.product.name}</span>
                  <span className="font-medium whitespace-nowrap ml-2">Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}</span>
                </div>
                
                {item.notes && (
                  <p className="text-xs text-primary bg-primary/10 p-1.5 rounded-md italic">
                    Note: {item.notes}
                  </p>
                )}
                
                <div className="flex items-center justify-between mt-2">
                  <button 
                    onClick={() => openNoteDialog(item)}
                    className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-xs"
                  >
                    <FileEdit size={14} /> Add Note
                  </button>
                  
                  <div className="flex items-center gap-3 bg-muted rounded-lg p-1">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-background transition-colors text-foreground"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-4 text-center font-medium">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-background transition-colors text-foreground"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div ref={cartEndRef} />
          </div>
        )}
      </div>

      <div className="p-4 xl:p-6 bg-zinc-950 border-t border-white/5 mt-auto relative shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]">
        <div className="space-y-4 mb-6 relative z-10">
          <div className="relative">
            <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={24} strokeWidth={1.5} />
            <Input
              placeholder="Nama Customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-zinc-900/50 border-white/10 h-14 pl-12 text-zinc-100 font-semibold text-lg md:text-xl placeholder:font-normal placeholder:text-base placeholder:text-zinc-500 rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-inner transition-all hover:bg-zinc-900/80"
            />
          </div>
          <div className="bg-zinc-900/40 rounded-xl p-4 border border-white/5 space-y-3">
            <div className="flex justify-between text-zinc-400 text-sm">
              <span>Subtotal</span>
              <span>Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-zinc-400 text-sm">
              <span>Tax & Service</span>
              <span>Rp 0</span>
            </div>
            <Separator className="bg-white/10" />
            <div className="flex justify-between text-2xl font-bold text-zinc-100 items-center pt-1">
              <span>Total</span>
              <span className="text-primary tracking-tight">Rp {total.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
        {isPageLoading ? (
          <Button className="w-full h-14 rounded-xl text-lg font-bold bg-zinc-800 text-zinc-500 border border-white/5" disabled>
            Memuat Status...
          </Button>
        ) : isLocked ? (
          <Button 
            className="w-full h-14 rounded-xl text-lg font-bold bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white border border-amber-500/20 hover:border-amber-500 transition-all duration-300 shadow-lg shadow-amber-500/10"
            onClick={handleLockActionClick}
          >
            <LockKeyhole size={20} className="mr-2" /> {role ? 'Buka Shift Kasir' : 'Log In Kasir'}
          </Button>
        ) : (
          <Button 
            className="w-full h-14 rounded-xl text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 shadow-xl shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            disabled={cart.length === 0 || customerName.trim() === ''}
            onClick={() => setCheckoutStep('method')}
          >
            Charge / Checkout
          </Button>
        )}
      </div>
    </>
  );

  return (
    <MainLayout 
      onLogoutClick={handleCalculateEndShift} 
      onLoginClick={() => window.dispatchEvent(new CustomEvent('shake-sidebar-profiles'))}
      title="Point of Sale"
      headerAction={
        <Sheet>
          <SheetTrigger className="md:hidden relative p-2 h-10 w-10 flex items-center justify-center bg-background border border-border rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ShoppingCart size={18} />
            {cartItemCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-background">
                {cartItemCount}
              </div>
            )}
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] p-0 bg-card border-t border-border rounded-t-2xl flex flex-col z-[100]">
            <SheetHeader className="p-4 border-b border-border sr-only">
              <SheetTitle>Current Order</SheetTitle>
            </SheetHeader>
            {renderCartContent()}
          </SheetContent>
        </Sheet>
      }
    >
      <div className="flex h-full w-full">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/50 h-full">
          {isLocked && (
            <div className="px-4 md:px-6 pt-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2.5 text-sm font-medium text-amber-500">
                <LockKeyhole size={18} className="shrink-0 text-amber-500" />
                <span>{role ? `Shift belum dibuka untuk ${userName}. Silakan buka shift pada tombol kanan bawah untuk mulai transaksi.` : 'Fitur POS Terkunci. Silakan Log In kasir untuk membuka shift & transaksi.'}</span>
              </div>
            </div>
          )}

          <header className="px-4 md:px-6 py-4 md:py-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-2xl group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" size={20} />
              <Input 
                className="pl-12 h-14 bg-zinc-900/50 border-white/10 text-base md:text-lg focus-visible:ring-1 focus-visible:ring-primary rounded-2xl transition-all shadow-inner hover:bg-zinc-900/80"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeShift && (
              <Button 
                variant="outline" 
                className="h-14 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 gap-2 rounded-2xl text-sm font-semibold bg-rose-500/5 hover:border-rose-500"
                onClick={handleCalculateEndShift}
                title="Tutup Shift & Rekapitulasi Kasir"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Tutup Shift</span>
              </Button>
            )}

            {/* Desktop Cart Toggle */}
            <Button variant="outline" className="hidden md:flex items-center gap-2 h-14 rounded-2xl border-white/10 bg-zinc-900/50 hover:bg-zinc-800 hover:border-primary/50 transition-all duration-300" onClick={() => setIsCartOpen(!isCartOpen)}>
              <ShoppingCart size={20} className={cartItemCount > 0 ? 'text-primary' : ''} />
              <span className="hidden lg:inline">{isCartOpen ? 'Hide Cart' : 'Show Cart'}</span>
              {cartItemCount > 0 && (
                <div className="bg-primary text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg shadow-primary/20">
                  {cartItemCount}
                </div>
              )}
            </Button>
          </div>
        </header>

        <div className="px-4 md:px-6 pt-6 pb-2">
          <div className="flex flex-wrap gap-2">
            <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 w-fit shadow-inner overflow-x-auto scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                    activeCategory === cat.id 
                      ? 'bg-zinc-800 text-primary shadow-lg shadow-primary/5' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {isLoadingData ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Loading menu items...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5 pb-20 md:pb-0">
              {filteredProducts.map(product => {
                const cartItem = cart.find(c => c.product.id === product.id);
                const qtyInCart = cartItem ? cartItem.quantity : 0;
                
                return (
                  <div 
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`group relative bg-zinc-900/60 backdrop-blur-md border rounded-[24px] overflow-hidden transition-all duration-500 flex flex-col justify-between ${
                      isLocked
                        ? 'border-white/5 opacity-90 cursor-pointer hover:border-amber-500/50'
                        : `cursor-pointer ${qtyInCart > 0 ? 'border-primary/50 bg-primary/5 hover:border-primary' : 'border-white/5 hover:border-white/20 hover:bg-zinc-800/80 hover:shadow-2xl hover:shadow-primary/10'} hover:-translate-y-1.5`
                    }`}
                  >
                    <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-b from-zinc-800/50 to-zinc-900/80">
                      {product.image_url && !product.image_url.includes('placehold.co') ? (
                        <>
                          <div className={`absolute inset-0 transition-colors duration-500 z-10 ${qtyInCart > 0 ? 'bg-black/10' : 'bg-black/30 group-hover:bg-black/10'}`} />
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className={`w-full h-full object-cover transition-transform duration-700 ease-out ${qtyInCart > 0 ? 'scale-105' : 'group-hover:scale-110'}`}
                          />
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 group-hover:text-primary/70 group-hover:scale-110 transition-all duration-500">
                          <Utensils size={40} strokeWidth={1} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                      
                      {!isLocked && (
                        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-opacity duration-300 z-20 flex items-end justify-end p-4 ${qtyInCart > 0 ? 'opacity-100 from-black/60' : 'group-hover:opacity-100'}`}>
                          <div className={`text-primary-foreground rounded-full flex items-center justify-center shadow-lg transform transition-all duration-300 ease-out hover:scale-110 hover:bg-primary ${qtyInCart > 0 ? 'w-11 h-11 bg-primary text-base font-bold shadow-[0_0_20px_rgba(234,179,8,0.4)] translate-y-0 ring-2 ring-background' : 'w-11 h-11 bg-primary/90 translate-y-4 group-hover:translate-y-0'}`}>
                            {qtyInCart > 0 ? `${qtyInCart}x` : <Plus size={24} strokeWidth={2.5} />}
                          </div>
                        </div>
                      )}

                      {isLocked && (
                        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-amber-400 p-2 rounded-xl border border-amber-500/30 z-20">
                          <LockKeyhole size={16} />
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex flex-col justify-between flex-1 relative z-30">
                      <div>
                        <h3 className={`font-semibold transition-colors line-clamp-2 leading-tight tracking-tight ${qtyInCart > 0 ? 'text-primary' : 'text-zinc-100 group-hover:text-primary/80'}`}>
                          {product.name}
                        </h3>
                        <p className={`text-base font-bold mt-2 ${qtyInCart > 0 ? 'text-zinc-100' : 'text-primary/90'}`}>
                          Rp {product.price.toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Cart Sidebar */}
      {isCartOpen && (
        <div className="hidden lg:flex w-72 xl:w-80 border-l border-border bg-card flex-col h-full shrink-0 transition-all duration-300">
          {renderCartContent()}
        </div>
      )}

      {/* Add Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note to Item</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="e.g. Less sugar, extra ice, takeaway..." 
              value={tempNote}
              onChange={(e) => setTempNote(e.target.value)}
              className="bg-background border-border"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveNote} className="bg-primary text-primary-foreground hover:bg-primary/90">Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {cashierProfiles.map((profile) => (
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
                    <p className="font-bold text-foreground group-hover:text-primary transition-colors">{profile.name}</p>
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
              {/* Selected Profile Badge */}
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
                    onChange={(e) => setProfilePasswordInput(e.target.value)}
                    onKeyDown={(e) => {
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

      {/* Checkout Step Dialog */}
      <Dialog open={checkoutStep !== 'none'} onOpenChange={(open) => !open && setCheckoutStep('none')}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          {checkoutStep === 'method' && (
            <>
              <DialogHeader>
                <DialogTitle>Select Payment Method</DialogTitle>
                <DialogDescription>Total Amount: <span className="font-bold text-primary">Rp {total.toLocaleString('id-ID')}</span></DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-6">
                <button 
                  onClick={() => { 
                    setPaymentMethod('QRIS'); 
                    setCheckoutStep('confirm'); 
                  }}
                  className="p-6 rounded-2xl bg-background border border-border hover:border-primary flex flex-col items-center justify-center gap-3 transition-all group"
                >
                  <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl group-hover:scale-110 transition-transform">
                    <QrCode size={32} />
                  </div>
                  <span className="font-bold">QRIS / E-Wallet</span>
                </button>
                <button 
                  onClick={() => { setPaymentMethod('Cash'); setCheckoutStep('confirm'); }}
                  className="p-6 rounded-2xl bg-background border border-border hover:border-primary flex flex-col items-center justify-center gap-3 transition-all group"
                >
                  <div className="p-3 bg-green-500/10 text-green-500 rounded-xl group-hover:scale-110 transition-transform">
                    <Banknote size={32} />
                  </div>
                  <span className="font-bold">Cash</span>
                </button>
              </div>
            </>
          )}

          {checkoutStep === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Payment ({paymentMethod})</DialogTitle>
                <DialogDescription>Order #{orderNumber} • Total: <span className="font-bold text-primary">Rp {total.toLocaleString('id-ID')}</span></DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                {paymentMethod === 'QRIS' && (
                  <div className="flex flex-col items-center justify-center p-6 bg-background rounded-2xl border border-border space-y-3">
                    <div className="p-4 rounded-xl bg-blue-500/10 text-blue-500">
                      <QrCode size={64} />
                    </div>
                    <p className="text-sm font-medium text-center">Tampilkan gambar QRIS kepada pelanggan.</p>
                  </div>
                )}

                {paymentMethod === 'Cash' && (
                  <div className="space-y-4 bg-background p-4 rounded-2xl border border-border">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Uang Diterima (Rp)</label>
                      <Input 
                        placeholder="0" 
                        value={cashReceived ? parseInt(cashReceived).toLocaleString('id-ID') : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/\./g, '');
                          if (/^\d*$/.test(rawValue)) {
                            setCashReceived(rawValue);
                          }
                        }}
                        className="bg-card border-border text-lg font-bold h-12"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[total, 50000, 100000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashReceived(val.toString())}
                          className="py-1.5 px-2 bg-muted hover:bg-primary/20 text-xs font-semibold rounded-lg border border-border transition-colors"
                        >
                          Rp {val.toLocaleString('id-ID')}
                        </button>
                      ))}
                    </div>

                    {cashReceived && parseInt(cashReceived.replace(/\./g, '')) >= total && (
                      <div className="bg-green-500/10 text-green-500 p-3 rounded-lg border border-green-500/20 text-center font-bold text-lg mt-4 animate-in fade-in slide-in-from-bottom-2">
                        Kembalian: Rp {(parseInt(cashReceived.replace(/\./g, '')) - total).toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter className="flex-row sm:justify-between gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setCheckoutStep('method')}>Back</Button>
                <Button 
                  onClick={handleCheckoutProcess} 
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isProcessingCheckout || (paymentMethod === 'Cash' && (!cashReceived || parseInt(cashReceived.replace(/\./g, '')) < total))}
                >
                  {isProcessingCheckout ? "Processing..." : (paymentMethod === 'QRIS' ? "Tampilkan QRIS" : "Complete Payment")}
                </Button>
              </DialogFooter>
            </>
          )}

          {checkoutStep === 'success' && (
            <div className="py-6 text-center space-y-5">
              <div className="relative inline-block">
                <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
                <CheckCircle2 size={64} className="text-green-500 relative z-10 mx-auto" />
              </div>

              <div>
                <DialogTitle className="text-2xl font-bold">Pembayaran Berhasil!</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">Order <span className="font-mono font-bold text-foreground">#{orderNumber}</span> telah dicatat ke sistem.</p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-left flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500 text-white rounded-lg text-xs font-bold animate-pulse">
                    ⏳
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Masuk Antrean Dapur</p>
                    <p className="text-[11px] text-muted-foreground">Status: Sedang Dibuat (Preparing)</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-primary">Rp {total.toLocaleString('id-ID')}</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    completeAndNewOrder();
                    router.push('/orders');
                  }} 
                  className="flex-1 text-xs border-primary/40 text-primary hover:bg-primary/5 font-semibold"
                >
                  Lihat Order List ➔
                </Button>
                <Button 
                  onClick={completeAndNewOrder} 
                  className="flex-1 bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Pesanan Baru
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Start Shift Dialog */}
      <Dialog 
        open={isStartShiftDialogOpen} 
        onOpenChange={setIsStartShiftDialogOpen}
      >
        <DialogContent 
          className="bg-card border-border sm:max-w-md"
          showCloseButton={false}
        >
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
                onChange={(e) => {
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
            <Button onClick={() => handleStartShift()} disabled={!startingCashInput} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
              Buka Shift Kasir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Shift Dialog */}
      <Dialog open={isEndShiftDialogOpen} onOpenChange={setIsEndShiftDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tutup Shift Kasir ({userName})</DialogTitle>
            <DialogDescription>
              Hitung total uang fisik penjualan tunai yang ada di laci kasir untuk menutup shift.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-muted p-3.5 rounded-xl space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modal Awal Kasir:</span>
                <span className="font-medium">Rp {activeShift?.starting_cash.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimasi Uang Tunai di Laci (Sistem):</span>
                <span className="font-bold text-primary">Rp {expectedCash.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Uang Hasil Penjualan Tunai di Laci (Fisik)</label>
              <Input
                autoFocus
                placeholder="Masukkan jumlah uang fisik di laci"
                value={endingCashInput ? parseInt(endingCashInput).toLocaleString('id-ID') : ''}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\./g, '');
                  if (/^\d*$/.test(rawValue)) {
                    setEndingCashInput(rawValue);
                  }
                }}
                className="h-12 text-lg font-bold bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">Masukkan total fisik uang hasil penjualan tunai (di luar modal awal).</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEndShiftDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleEndShift}
              disabled={!endingCashInput}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              Konfirmasi Tutup Shift
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
                  <span className={shiftSummary.difference < 0 ? "text-destructive" : shiftSummary.difference > 0 ? "text-green-500" : "text-primary"}>
                    {shiftSummary.difference > 0 ? '+' : ''}Rp {shiftSummary.difference.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-center">
            <Button className="w-full h-12 font-bold" onClick={() => {
              setIsShiftSummaryOpen(false);
              logout();
            }}>
              Log Out Kasir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      {/* QRIS Modal Premium */}
      <Dialog open={isQRISModalOpen} onOpenChange={setIsQRISModalOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 bg-background/95 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="relative p-8">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-primary/20 blur-[60px] pointer-events-none" />
            
            <DialogHeader className="space-y-1 p-0 text-center mb-8 relative z-10">
              <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-inner">
                <QrCode size={28} className="text-primary" />
              </div>
              <DialogTitle className="font-extrabold text-white text-2xl tracking-tight">Bayar dengan QRIS</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                Arahkan pelanggan untuk men-scan QRIS di bawah ini.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center space-y-6 relative z-10">
              {/* QR Code Container */}
              <div className="bg-white p-4 rounded-3xl shadow-[0_0_30px_rgba(255,255,255,0.1)] relative group w-full max-w-[280px] mx-auto aspect-square flex items-center justify-center overflow-hidden">
                <img src="/qris-static.jpg" alt="QRIS" className="w-full h-full object-contain mix-blend-multiply" onError={(e) => { e.currentTarget.src = 'https://placehold.co/300x300?text=Upload\\nqris-static.jpg\\nke+folder+public'; }} />
                {/* Corner Scanner Accents */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-primary rounded-tl-3xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-primary rounded-tr-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-primary rounded-bl-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-primary rounded-br-3xl pointer-events-none" />
              </div>

              {/* Total Tagihan */}
              <div className="text-center w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl py-5 px-6 shadow-inner animate-pulse">
                <p className="text-xs text-amber-500 font-bold uppercase tracking-[0.1em] mb-1">⚠️ Pastikan Pelanggan Input Nominal:</p>
                <p className="text-4xl font-black text-primary tracking-tight">Rp {total.toLocaleString('id-ID')}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 mt-8 relative z-10">
              <Button 
                onClick={handleQRISPaymentSuccess} 
                className="w-full h-14 bg-green-500 hover:bg-green-600 text-white font-bold text-lg rounded-xl transition-all border-none shadow-lg shadow-green-500/20"
                disabled={isProcessingCheckout}
              >
                {isProcessingCheckout ? "Processing..." : "✓ Konfirmasi Lunas"}
              </Button>
              <Button 
                onClick={() => setIsQRISModalOpen(false)} 
                className="w-full h-12 bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold text-sm rounded-xl transition-all border border-destructive/20"
                disabled={isProcessingCheckout}
              >
                Batalkan Pembayaran
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
