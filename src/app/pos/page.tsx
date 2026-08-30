'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Minus, FileEdit, Menu, X, QrCode, Banknote, CheckCircle2, ShoppingCart, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/AuthContext';

export type Product = {
  id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
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

  // Mobile sidebar state is now handled by MainLayout

  // Auth & Shift Management
  const { userName, role, isLoading, logout } = useAuth();
  const router = useRouter();
  
  const [activeShift, setActiveShift] = useState<any>(null);
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

  useEffect(() => {
    if (!isLoading && !role) {
      router.replace('/login');
    }
  }, [role, isLoading, router]);

  useEffect(() => {
    setOrderNumber(Math.floor(Math.random() * 10000).toString().padStart(4, '0'));
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [categoriesRes, productsRes] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('products').select('*').eq('is_available', true)
      ]);

      if (categoriesRes.data) {
        setCategories([{ id: '1', name: 'All Menu' }, ...categoriesRes.data]);
      }
      if (productsRes.data) setProducts(productsRes.data);
      
      setIsLoadingData(false);
    }
    
    async function checkActiveShift() {
      if (!userName) return;
      const { data } = await supabase
        .from('shifts')
        .select('*')
        .eq('cashier_name', userName)
        .eq('status', 'active')
        .order('start_time', { ascending: false })
        .limit(1)
        .single();
        
      if (data) {
        setActiveShift(data);
      }
    }

    if (userName) {
      checkActiveShift();
    }
    fetchData();
  }, [userName]);

  const handleStartShift = async (cashAmount?: number) => {
    if (!userName) return;
    
    let cash = 0;
    if (cashAmount !== undefined) {
      cash = cashAmount;
    } else {
      cash = parseInt(startingCashInput.replace(/\./g, ''));
      if (isNaN(cash)) cash = 0;
    }

    const newShift = {
      cashier_name: userName,
      starting_cash: cash,
      status: 'active'
    };

    const { data, error } = await supabase.from('shifts').insert([newShift]).select().single();
    if (!error && data) {
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

  if (!role) return null;


  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === '1' || p.category_id === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
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
      setIsProcessingCheckout(true);
      
      const transactionId = orderNumber;
      const transaction = {
        id: transactionId,
        method: paymentMethod,
        total: total,
        cashier_name: userName || 'Unknown',
        status: 'Paid',
        cash_received: paymentMethod === 'Cash' && cashReceived ? parseInt(cashReceived.replace(/\./g, '')) : null
      };

      const { error: txError } = await supabase.from('transactions').insert([transaction]);
      
      if (txError) {
        alert("Failed to save transaction: " + txError.message);
        setIsProcessingCheckout(false);
        return;
      }

      const itemsToInsert = cart.map(item => ({
        transaction_id: transactionId,
        product_name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        notes: item.notes || null
      }));

      const { error: itemsError } = await supabase.from('transaction_items').insert(itemsToInsert);
      
      if (itemsError) {
        alert("Failed to save transaction items: " + itemsError.message);
        setIsProcessingCheckout(false);
        return;
      }

      // Deduct stock based on recipe
      const productIds = cart.map(item => item.product.id);
      const { data: recipes } = await supabase.from('product_ingredients').select('*').in('product_id', productIds);
      
      if (recipes && recipes.length > 0) {
        // Collect all required stock deductions
        const stockDeductions: Record<string, number> = {};
        for (const cartItem of cart) {
          const itemRecipes = recipes.filter(r => r.product_id === cartItem.product.id);
          for (const recipe of itemRecipes) {
            if (!stockDeductions[recipe.stock_id]) stockDeductions[recipe.stock_id] = 0;
            stockDeductions[recipe.stock_id] += (recipe.quantity_required * cartItem.quantity);
          }
        }

        // Fetch current stock levels to deduct from
        const stockIds = Object.keys(stockDeductions);
        const { data: currentStocks } = await supabase.from('stocks').select('id, quantity').in('id', stockIds);
        
        if (currentStocks) {
          // Update each stock sequentially
          for (const stock of currentStocks) {
            const amountToDeduct = stockDeductions[stock.id];
            if (amountToDeduct) {
              const newQuantity = Math.max(0, stock.quantity - amountToDeduct);
              await supabase.from('stocks').update({ quantity: newQuantity, last_updated: new Date().toISOString() }).eq('id', stock.id);
            }
          }
        }
      }

      setIsProcessingCheckout(false);
      setCheckoutStep('success');
    }
  };

  const completeAndNewOrder = () => {
    setCart([]);
    setCheckoutStep('none');
    setPaymentMethod(null);
    setCashReceived('');
    setOrderNumber(Math.floor(Math.random() * 10000).toString().padStart(4, '0'));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const total = subtotal;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const CartContent = () => (
    <>
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Current Order</h2>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm">
            <span>Order #{orderNumber}</span>
            {userName && (
              <>
                <span>•</span>
                <span>Kasir: {userName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
        {cart.length === 0 ? (
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
          </div>
        )}
      </div>

      <div className="p-6 bg-card border-t border-border mt-auto">
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-muted-foreground text-sm">
            <span>Subtotal</span>
            <span>Rp {subtotal.toLocaleString('id-ID')}</span>
          </div>
          <Separator className="bg-border" />
          <div className="flex justify-between text-xl font-bold text-foreground">
            <span>Total</span>
            <span className="text-primary">Rp {total.toLocaleString('id-ID')}</span>
          </div>
        </div>
        <Button 
          className="w-full h-14 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={cart.length === 0}
          onClick={() => setCheckoutStep('method')}
        >
          Charge / Checkout
        </Button>
      </div>
    </>
  );

  return (
    <MainLayout 
      onLogoutClick={handleCalculateEndShift} 
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
            <CartContent />
          </SheetContent>
        </Sheet>
      }
    >
      <div className="flex h-full w-full">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/50 h-full">
          <header className="px-4 md:px-6 py-4 md:py-6 border-b border-border flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 flex-1">
            {!activeShift && (
              <Button 
                variant="outline" 
                className="h-12 w-12 p-0 flex shrink-0 items-center justify-center bg-yellow-500/10 border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-black transition-colors rounded-xl" 
                onClick={() => setIsStartShiftDialogOpen(true)}
                title="Buka Kasir (Mulai Shift)"
              >
                <LockKeyhole size={20} />
              </Button>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input 
                className="pl-10 h-12 bg-card border-border text-base md:text-lg focus-visible:ring-primary rounded-xl"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Desktop Cart Toggle */}
            <Button variant="outline" className="hidden md:flex items-center gap-2 h-12" onClick={() => setIsCartOpen(!isCartOpen)}>
              <ShoppingCart size={20} />
              <span className="hidden lg:inline">{isCartOpen ? 'Hide Cart' : 'Show Cart'}</span>
              {cartItemCount > 0 && (
                <div className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </div>
              )}
            </Button>
          </div>
        </header>

        <div className="px-4 md:px-6 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat.id 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'bg-card text-muted-foreground hover:bg-muted border border-border'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-4 md:p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-border relative">
          {!activeShift && (
            <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center p-4">
              <div className="bg-card p-6 md:p-8 rounded-3xl shadow-xl border border-border flex flex-col items-center text-center max-w-sm">
                <div className="w-20 h-20 bg-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center mb-6">
                  <LockKeyhole size={40} />
                </div>
                <h3 className="text-2xl font-bold mb-3">Kasir Terkunci</h3>
                <p className="text-muted-foreground mb-8 text-sm md:text-base">Anda harus menginput modal awal di laci kasir terlebih dahulu untuk mulai menerima pesanan.</p>
                <Button onClick={() => setIsStartShiftDialogOpen(true)} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-12 text-lg rounded-xl">
                  Buka Kasir Sekarang
                </Button>
              </div>
            </div>
          )}
          
          {isLoadingData ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading menu...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 pb-24 md:pb-0">
              {filteredProducts.map(product => (
                <div 
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer group hover:border-primary/50 transition-all hover:shadow-[0_0_15px_rgba(250,204,21,0.1)] flex flex-col h-full"
                >
                  <div className="h-28 md:h-32 w-full overflow-hidden bg-muted">
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3 md:p-4 flex-1 flex flex-col justify-between">
                    <h3 className="font-medium md:font-semibold text-foreground text-sm md:text-base line-clamp-2">{product.name}</h3>
                    <p className="text-primary font-medium mt-1 text-sm md:text-base">Rp {product.price.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Cart/Checkout Panel */}
      <div className={`w-80 lg:w-96 border-l border-border bg-card flex-col shadow-xl z-10 h-full transition-all ${isCartOpen ? 'hidden md:flex' : 'hidden'}`}>
        <CartContent />
      </div>


      {/* Notes Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Note for Item</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="e.g. Less ice, extra sugar, no onions..."
              className="min-h-[100px] bg-background border-border text-foreground focus-visible:ring-primary"
              value={tempNote}
              onChange={(e) => setTempNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveNote} className="bg-primary text-primary-foreground hover:bg-primary/90">Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog Flow */}
      <Dialog open={checkoutStep !== 'none'} onOpenChange={(open) => !open && setCheckoutStep('none')}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          {checkoutStep === 'method' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Select Payment Method</DialogTitle>
                <DialogDescription>
                  Total amount to pay is <span className="font-bold text-primary">Rp {total.toLocaleString('id-ID')}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-6">
                <button
                  onClick={() => { setPaymentMethod('QRIS'); setCheckoutStep('confirm'); }}
                  className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/10 transition-all group"
                >
                  <QrCode size={40} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-semibold">QRIS</span>
                </button>
                <button
                  onClick={() => { setPaymentMethod('Cash'); setCheckoutStep('confirm'); }}
                  className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/10 transition-all group"
                >
                  <Banknote size={40} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="font-semibold">Cash</span>
                </button>
              </div>
            </>
          )}

          {checkoutStep === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Confirm Payment</DialogTitle>
              </DialogHeader>
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  {paymentMethod === 'QRIS' ? <QrCode size={32} className="text-primary" /> : <Banknote size={32} className="text-primary" />}
                </div>
                <h3 className="text-3xl font-bold text-foreground">Rp {total.toLocaleString('id-ID')}</h3>
                
                {paymentMethod === 'Cash' && (
                  <div className="w-full px-4 space-y-2 mt-6 text-left">
                    <label className="text-sm font-medium text-muted-foreground">Uang Diterima (Rp)</label>
                    <Input 
                      type="text"
                      className="text-lg h-12 bg-background border-border"
                      placeholder="Contoh: 50.000"
                      value={cashReceived ? parseInt(cashReceived).toLocaleString('id-ID') : ''}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\./g, '');
                        if (/^\d*$/.test(rawValue)) {
                          setCashReceived(rawValue);
                        }
                      }}
                    />
                    {cashReceived && parseInt(cashReceived.replace(/\./g, '')) >= total && (
                      <div className="bg-green-500/10 text-green-500 p-3 rounded-lg border border-green-500/20 text-center font-bold text-lg mt-4 animate-in fade-in slide-in-from-bottom-2">
                        Kembalian: Rp {(parseInt(cashReceived.replace(/\./g, '')) - total).toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                )}
                
                <p className="text-muted-foreground text-sm px-4 mt-6">
                  {paymentMethod === 'QRIS' ? 'Apakah pelanggan sudah scan dan berhasil bayar?' : 'Pastikan jumlah uang yang diterima sudah benar.'}
                </p>
              </div>
              <DialogFooter className="flex-row sm:justify-between gap-3">
                <Button variant="outline" className="flex-1 border-border" onClick={() => setCheckoutStep('method')}>
                  Kembali
                </Button>
                <Button 
                  onClick={handleCheckoutProcess} 
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isProcessingCheckout || (paymentMethod === 'Cash' && (!cashReceived || parseInt(cashReceived.replace(/\./g, '')) < total))}
                >
                  {isProcessingCheckout ? "Memproses..." : "Sudah Bayar"}
                </Button>
              </DialogFooter>
            </>
          )}

          {checkoutStep === 'success' && (
            <>
              <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
                <CheckCircle2 size={64} className="text-green-500 mb-2" />
                <DialogTitle className="text-2xl font-bold">Payment Successful!</DialogTitle>
                <p className="text-muted-foreground">The order has been processed.</p>
                <Button onClick={completeAndNewOrder} className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90 h-12 text-lg">
                  New Order
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* End Shift Calculation Dialog */}
      <Dialog open={isEndShiftDialogOpen} onOpenChange={setIsEndShiftDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tutup Kasir (Akhiri Shift)</DialogTitle>
            <DialogDescription>
              Pisahkan modal awal dari laci terlebih dahulu, lalu hitung sisa uang hasil penjualan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Modal Awal (Telah Dipisahkan):</span>
                <span className="font-medium text-muted-foreground">Rp {activeShift?.starting_cash?.toLocaleString('id-ID')}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-bold">
                <span>Ekspektasi Uang Hasil:</span>
                <span className="text-primary">Rp {(expectedCash - (activeShift?.starting_cash || 0)).toLocaleString('id-ID')}</span>
              </div>
            </div>
            
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">Uang Hasil Penjualan Fisik (Rp)</label>
              <Input 
                autoFocus
                placeholder="0"
                value={endingCashInput ? parseInt(endingCashInput).toLocaleString('id-ID') : ''}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\./g, '');
                  if (/^\d*$/.test(rawValue)) {
                    setEndingCashInput(rawValue);
                  }
                }}
                className="h-12 text-lg font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEndShiftDialogOpen(false)}>Batal</Button>
            <Button onClick={handleEndShift} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Konfirmasi Tutup Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={isStartShiftDialogOpen} 
        onOpenChange={setIsStartShiftDialogOpen}
      >
        <DialogContent 
          className="bg-card border-border sm:max-w-md"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>Buka Kasir (Mulai Shift)</DialogTitle>
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
            <Button onClick={() => handleStartShift()} disabled={!startingCashInput} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Mulai Shift
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
            <Button className="w-full h-12" onClick={() => {
              setIsShiftSummaryOpen(false);
              logout();
            }}>
              Log Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  );
}
