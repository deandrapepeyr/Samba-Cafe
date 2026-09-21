'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Trash2, Edit2, Check, X, Tag, DollarSign, Image as ImageIcon, Box, Utensils, Loader2, Layers, ChevronLeft, ChevronUp, ChevronDown, Menu, Printer, Settings } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BrochureModal } from '@/components/BrochureModal';

function TitipanAutocomplete({ id, value, onChange, options, placeholder }: { id: string, value: string, onChange: (val: string) => void, options: string[], placeholder?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const filtered = options.filter(o => o.toLowerCase().includes(value?.toLowerCase() || '') && o !== value);

  return (
    <div className="relative">
      <Input 
        id={id}
        className="bg-zinc-900/80 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl w-full" 
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsFocused(true);
          setIsOpen(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          setTimeout(() => setIsOpen(false), 200);
        }}
      />
      {isOpen && isFocused && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 bg-zinc-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 mb-1 bg-zinc-900/50">
            Daftar Penitip
          </div>
          {filtered.map(opt => (
            <div 
              key={opt}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setIsOpen(false);
              }} 
              className="px-4 py-2 hover:bg-zinc-700/50 cursor-pointer text-sm text-zinc-100 transition-colors"
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [isBrochureOpen, setIsBrochureOpen] = useState(false);
  const { role, userName, updateUserName, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!role) {
        router.replace('/pos');
      } else if (role !== 'manager') {
        router.replace('/pos');
      }
    }
  }, [role, isLoading, router]);

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcastEnabled, setIsBroadcastEnabled] = useState(true);
  const [isUpdatingBroadcast, setIsUpdatingBroadcast] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoadingData(true);
    const [categoriesRes, productsRes, stocksRes, usersRes, settingsRes] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('products').select('*'),
      supabase.from('stocks').select('*'),
      supabase.from('users').select('*'),
      supabase.from('settings').select('*').in('key', ['broadcast_message', 'broadcast_enabled'])
    ]);
    if (categoriesRes.error) console.error("Error fetching categories:", categoriesRes.error);
    if (productsRes.error) console.error("Error fetching products:", productsRes.error);
    
    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (productsRes.data) {
      setProducts(productsRes.data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    }
    if (stocksRes.data) setStocks(stocksRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    if (settingsRes.data) {
      const msg = settingsRes.data.find(s => s.key === 'broadcast_message');
      const enabled = settingsRes.data.find(s => s.key === 'broadcast_enabled');
      if (msg) setBroadcastMessage(msg.value);
      if (enabled) setIsBroadcastEnabled(enabled.value !== 'false');
    }
    setIsLoadingData(false);
  };
  
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  
  const [viewMode, setViewMode] = useState<'categories' | 'items' | 'list'>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeItemTab, setActiveItemTab] = useState<string>('my-item');

  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category_id: '1',
    image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=400&h=300',
    is_titipan: false,
    titipan_name: '',
    supplier_price: '',
    is_quick: false,
    variants: [] as any[]
  });
  const [newIngredients, setNewIngredients] = useState<{stock_id: string, quantity_required: string}[]>([]);

  useEffect(() => {
    if (categories.length > 1 && newItem.category_id === '1') {
      setNewItem(prev => ({ ...prev, category_id: categories[1].id }));
    }
  }, [categories]);

  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editIngredients, setEditIngredients] = useState<{stock_id: string, quantity_required: string}[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{id: string, name: string} | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    password: '',
    role: 'cashier'
  });
  
  const [editingUser, setEditingUser] = useState<any | null>(null);
  
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archivePassword, setArchivePassword] = useState('');

  const handleArchiveData = async () => {
    if (archivePassword !== 'samba123') {
      alert("Password salah! Fitur ini terkunci.");
      return;
    }
    setIsArchiving(true);
    try {
      // Archive transactions before today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: txs, error: fetchError } = await supabase
        .from('transactions')
        .select('*, transaction_items(*)')
        .lt('created_at', todayStart.toISOString());
        
      if (fetchError) throw fetchError;
      
      if (!txs || txs.length === 0) {
        alert("Tidak ada transaksi lama yang perlu diarsipkan.");
        setIsArchiveDialogOpen(false);
        setIsArchiving(false);
        return;
      }
      
      const { data: products } = await supabase.from('products').select('name, is_titipan');
      const titipanNames = new Set(products?.filter(p => p.is_titipan).map(p => p.name) || []);

      // Group by date
      const summariesByDate: Record<string, any> = {};
      
      txs.forEach((tx) => {
        if (tx.status === 'cancelled') return;
        
        const txDate = new Date(tx.created_at);
        const dateStr = txDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
        
        if (!summariesByDate[dateStr]) {
          summariesByDate[dateStr] = {
            date: dateStr,
            total_omzet: 0,
            total_qris: 0,
            total_cash: 0,
            samba_qris: 0,
            samba_cash: 0,
            titipan_qris: 0,
            titipan_cash: 0,
            total_transactions: 0,
            total_items: 0,
            total_profit: 0,
            qris_count: 0,
            cash_count: 0,
          };
        }
        
        const summary = summariesByDate[dateStr];
        summary.total_transactions++;
        summary.total_omzet += tx.total;
        
        let txItemCount = 0;
        let txProfit = 0;
        let txSamba = 0;
        let txTitipan = 0;
        
        tx.transaction_items?.forEach((item: any) => {
          txItemCount += item.quantity;
          txProfit += (item.price - (item.supplier_price || 0)) * item.quantity;
          
          if (!titipanNames.has(item.product_name)) {
            txSamba += item.price * item.quantity;
          } else {
            txTitipan += item.price * item.quantity;
          }
        });
        
        summary.total_items += txItemCount;
        summary.total_profit += txProfit;
        
        if (tx.method === 'QRIS') {
          summary.qris_count++;
          summary.total_qris += tx.total;
          summary.samba_qris += txSamba;
          summary.titipan_qris += txTitipan;
        } else {
          summary.cash_count++;
          summary.total_cash += tx.total;
          summary.samba_cash += txSamba;
          summary.titipan_cash += txTitipan;
        }
      });
      
      const summariesToInsert = Object.values(summariesByDate);
      
      if (summariesToInsert.length > 0) {
        const { error: upsertError } = await supabase
          .from('daily_summaries')
          .upsert(summariesToInsert, { onConflict: 'date' });
          
        if (upsertError) {
          throw upsertError;
        }
      }
      
      const txIds = txs.map(tx => tx.id);
      
      // Batch delete by chunks of 1000
      for (let i = 0; i < txIds.length; i += 1000) {
        const chunk = txIds.slice(i, i + 1000);
        await supabase.from('transaction_items').delete().in('transaction_id', chunk);
        await supabase.from('transactions').delete().in('id', chunk);
      }
      
      alert(`Berhasil mengarsipkan ${txs.length} transaksi lama.`);
      setIsArchiveDialogOpen(false);
      
    } catch (err: any) {
      console.error(err);
      alert("Terjadi kesalahan saat mengarsipkan: " + err.message);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleResetTransactions = async () => {
    if (resetPassword !== 'samba123') {
      alert("Password salah! Fitur ini terkunci.");
      return;
    }
    setIsResetting(true);
    try {
      // Menghapus semua item transaksi
      await supabase.from('transaction_items').delete().not('id', 'is', null);
      
      // Menghapus semua transaksi
      const { error } = await supabase.from('transactions').delete().not('id', 'is', null);
      
      if (error) {
        alert("Gagal mereset data transaksi: " + error.message);
      } else {
        setIsResetDialogOpen(false);
        alert("Data transaksi berhasil direset.");
      }
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('foto_items')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from('foto_items')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const filteredProducts = products.filter(p => 
    selectedCategoryId === '1' || p.category_id === selectedCategoryId
  );
  
  const selectedCategoryName = categories.find(c => c.id === selectedCategoryId)?.name || 'Items';

  const handleAddItem = async () => {
    if (!newItem.name || !newItem.price) return;
    setIsUploading(true);
    
    try {
      let imageUrl = newItem.image_url;
      if (newImageFile) {
        imageUrl = await uploadImage(newImageFile);
      }

      const product = {
        id: `p${Math.random().toString(36).substr(2, 9)}`,
        name: newItem.name,
        price: parseInt(newItem.price),
        category_id: newItem.category_id,
        image_url: imageUrl,
        is_available: true,
        is_titipan: newItem.is_titipan,
        titipan_name: newItem.is_titipan ? newItem.titipan_name : null,
        supplier_price: newItem.is_titipan ? parseInt(newItem.supplier_price.toString()) || 0 : 0,
        is_quick: newItem.is_quick,
        variants: newItem.variants || []
      };
      
      const { error } = await supabase.from('products').insert([product]);
      
      if (!error) {
        // Save ingredients
        const ingredientsToInsert = newIngredients
          .filter(ing => ing.stock_id && ing.quantity_required)
          .map(ing => ({
            product_id: product.id,
            stock_id: ing.stock_id,
            quantity_required: parseFloat(ing.quantity_required)
          }));
          
        if (ingredientsToInsert.length > 0) {
           await supabase.from('product_ingredients').insert(ingredientsToInsert);
        }

        setProducts([product, ...products]);
        setIsAddItemDialogOpen(false);
        setNewItem({
          name: '',
          price: '',
          category_id: categories.length > 1 ? categories[1].id : '1',
          image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=400&h=300',
          is_titipan: false,
          titipan_name: '',
          supplier_price: '',
          is_quick: false,
          variants: [] as any[]
        });
        setNewIngredients([]);
        setNewImageFile(null);
      } else {
        alert("Failed to add product: " + error.message);
        console.error(error);
      }
    } catch (error: any) {
      alert("Failed to upload image: " + error.message);
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditItemSave = async () => {
    if (!editingItem) return;
    setIsUploading(true);
    
    try {
      let updatedItem = { ...editingItem };
      if (!updatedItem.is_titipan) {
        updatedItem.titipan_name = null;
        updatedItem.supplier_price = 0;
      }
      if (editImageFile) {
        const imageUrl = await uploadImage(editImageFile);
        updatedItem.image_url = imageUrl;
      }

      const { error } = await supabase.from('products').update(updatedItem).eq('id', updatedItem.id);
      if (!error) {
        // Update ingredients
        await supabase.from('product_ingredients').delete().eq('product_id', updatedItem.id);
        const ingredientsToInsert = editIngredients
          .filter(ing => ing.stock_id && ing.quantity_required)
          .map(ing => ({
            product_id: updatedItem.id,
            stock_id: ing.stock_id,
            quantity_required: parseFloat(ing.quantity_required)
          }));
          
        if (ingredientsToInsert.length > 0) {
           await supabase.from('product_ingredients').insert(ingredientsToInsert);
        }

        setProducts(products.map(p => p.id === updatedItem.id ? updatedItem : p));
        setIsEditItemDialogOpen(false);
        setEditingItem(null);
        setEditIngredients([]);
        setEditImageFile(null);
      } else {
        alert("Failed to update product: " + error.message);
        console.error(error);
      }
    } catch (error: any) {
      alert("Failed to upload image: " + error.message);
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsUploading(true);
    try {
      const { error } = await supabase.from('products').delete().eq('id', productToDelete.id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== productToDelete.id));
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (error: any) {
      alert("Failed to delete product: " + error.message);
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName) return;
    
    const category = {
      id: `${Math.random().toString(36).substr(2, 9)}`,
      name: newCategoryName
    };
    
    const { error } = await supabase.from('categories').insert([category]);
    if (!error) {
      setCategories([...categories, category]);
      setNewCategoryName('');
    } else {
      alert("Failed to add category: " + error.message);
      console.error(error);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.username || !newUser.password) return;
    
    const userToInsert = {
      ...newUser,
      username: newUser.username.trim(),
      password: newUser.password.trim(),
      email: `${newUser.username.trim()}@sambacafe.com`
    };
    
    const { data, error } = await supabase.from('users').insert([userToInsert]).select();
    
    if (!error && data) {
      setUsers([...users, data[0]]);
      setIsAddUserDialogOpen(false);
      setNewUser({ name: '', username: '', password: '', role: 'cashier' });
    } else {
      alert("Failed to add user: " + error?.message);
      console.error(error);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser || !editingUser.name || !editingUser.username) return;
    
    // update password only if provided
    let updateData = {
      name: editingUser.name,
      username: editingUser.username,
      role: editingUser.role
    } as any;
    
    if (editingUser.password) {
      updateData.password = editingUser.password;
    }
    
    const { error } = await supabase.from('users').update(updateData).eq('id', editingUser.id);
    
    if (!error) {
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...updateData } : u));
      if (editingUser.role === role) {
        updateUserName(editingUser.name);
      }
      if (editingUser.role === 'manager' && editingUser.decoy_name) {
        localStorage.setItem('samba_manager_decoy_name', editingUser.decoy_name);
      }
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
    } else {
      alert("Failed to update user: " + error.message);
      console.error(error);
    }
  };

  if (role !== 'manager') return null; // Prevent flash of content

  return (
    <MainLayout title="Settings">
      <div className="flex-1 flex flex-col min-w-0 p-4 lg:p-8">
        <div className="flex items-center justify-between mb-6 lg:mb-8 flex-shrink-0">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground text-sm lg:text-base">Manage your cafe menu and users</p>
          </div>
        </div>

        <Tabs defaultValue="menu" className="w-full flex-1 flex flex-col min-h-0">
          <TabsList className="w-full lg:w-[600px] grid grid-cols-3 mb-6 bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 flex-shrink-0 h-auto min-h-[52px] items-stretch gap-1">
            <TabsTrigger value="menu" className="h-full rounded-xl py-2.5 data-active:bg-zinc-800 data-active:text-primary data-[state=active]:bg-zinc-800 data-[state=active]:text-primary dark:data-active:bg-zinc-800 data-[state=active]:shadow-lg transition-all text-zinc-400">Food and Drinks</TabsTrigger>
            <TabsTrigger value="users" className="h-full rounded-xl py-2.5 data-active:bg-zinc-800 data-active:text-primary data-[state=active]:bg-zinc-800 data-[state=active]:text-primary dark:data-active:bg-zinc-800 data-[state=active]:shadow-lg transition-all text-zinc-400">User Management</TabsTrigger>
            <TabsTrigger value="system" className="h-full rounded-xl py-2.5 data-active:bg-zinc-800 data-active:text-primary data-[state=active]:bg-zinc-800 data-[state=active]:text-primary dark:data-active:bg-zinc-800 data-[state=active]:shadow-lg transition-all text-zinc-400">System</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border pr-2 pb-8">
            <TabsContent value="menu" className="m-0 border-none p-0 outline-none">
              
              <Card className="bg-zinc-950/50 border-white/10 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
                  <div className="flex items-start sm:items-center gap-3">
                    {viewMode !== 'categories' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { setViewMode('categories'); setSelectedCategoryId(null); }}
                        className="rounded-full hover:bg-white/10 shrink-0 text-zinc-400 hover:text-white h-8 w-8 mt-1 sm:mt-0"
                      >
                        <ChevronLeft size={20} />
                      </Button>
                    )}
                    <div>
                      <CardTitle className="text-xl">
                        {viewMode === 'categories' ? 'Menu Categories' : viewMode === 'list' ? 'Daftar Menu' : selectedCategoryName}
                      </CardTitle>
                      <CardDescription>
                        {viewMode === 'categories' 
                          ? 'Select a category to view or manage its items.'
                          : viewMode === 'list'
                          ? 'Arrange the global order of all menu items.'
                          : 'Add, edit, or remove food and drinks from this category.'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    {viewMode === 'categories' ? (
                      <>
                        <Button 
                          variant="outline"
                          className="mr-2 border-white/10 hover:bg-white/5 transition-all duration-300 rounded-xl"
                          onClick={() => setIsBrochureOpen(true)}
                        >
                          <Printer size={16} className="mr-2 text-primary" />
                          Cetak Brosur A4
                        </Button>
                        <Button 
                          variant="outline"
                          className="mr-2 border-white/10 hover:bg-white/5 transition-all duration-300 rounded-xl"
                          onClick={() => setViewMode('list')}
                        >
                          <Menu size={16} className="mr-2" />
                          Daftar Menu
                        </Button>
                        <Button 
                          className="bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/10 hover:border-primary/50 transition-all duration-300 rounded-xl shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5"
                          onClick={() => setIsAddCategoryDialogOpen(true)}
                        >
                          <Plus size={16} className="mr-2 text-primary" />
                          Add Category
                        </Button>
                      </>
                    ) : viewMode === 'list' ? (
                      <>
                        <Button 
                          variant="outline"
                          className="mr-2 border-white/10 hover:bg-white/5 transition-all duration-300 rounded-xl"
                          onClick={() => setIsBrochureOpen(true)}
                        >
                          <Printer size={16} className="mr-2 text-primary" />
                          Cetak Brosur A4
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button 
                          className="bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/10 hover:border-primary/50 transition-all duration-300 rounded-xl shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5"
                          onClick={() => {
                            setNewItem(prev => ({ ...prev, category_id: selectedCategoryId && selectedCategoryId !== '1' ? selectedCategoryId : (categories.length > 1 ? categories[1].id : '1') }));
                            setIsAddItemDialogOpen(true);
                          }}
                        >
                          <Plus size={16} className="mr-2 text-primary" />
                          Add New Item
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  
                  {isLoadingData ? (
                    <div className="flex flex-col items-center justify-center p-12 text-muted-foreground space-y-4">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p>Memuat data...</p>
                    </div>
                  ) : (
                    <>
                      {viewMode === 'list' ? (
                        <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-500 p-2 max-w-3xl mx-auto">
                          {products.map((product, index) => (
                            <div key={product.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-white/5 hover:bg-zinc-900/80 transition-all duration-500 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 group">
                              <div className="flex items-center gap-5 w-full">
                                <div className="text-zinc-500/40 w-6 text-center font-serif italic text-lg">{index + 1}</div>
                                <div className="w-16 h-12 rounded-xl overflow-hidden relative shadow-md shadow-black/50 border border-white/10 flex-shrink-0 group-hover:border-primary/30 transition-colors">
                                  {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
                                  ) : (
                                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                      <Utensils size={14} className="text-zinc-600" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-zinc-100 text-sm truncate tracking-wide group-hover:text-primary transition-colors">{product.name}</h3>
                                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest mt-0.5">{categories.find(c => c.id === product.category_id)?.name}</p>
                                </div>
                                <div className="text-primary/90 font-medium text-sm px-4 hidden sm:block whitespace-nowrap">
                                  Rp {product.price.toLocaleString('id-ID')}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button 
                                  onClick={async () => {
                                    if (index === 0) return;
                                    const newProducts = [...products];
                                    const temp = newProducts[index];
                                    newProducts[index] = newProducts[index - 1];
                                    newProducts[index - 1] = temp;
                                    
                                    newProducts.forEach((p, idx) => p.sort_order = idx);
                                    setProducts([...newProducts]);
                                    
                                    await Promise.all([
                                      supabase.from('products').update({ sort_order: newProducts[index].sort_order }).eq('id', newProducts[index].id),
                                      supabase.from('products').update({ sort_order: newProducts[index - 1].sort_order }).eq('id', newProducts[index - 1].id)
                                    ]);
                                  }}
                                  disabled={index === 0}
                                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors rounded-md"
                                >
                                  <ChevronUp size={20} />
                                </button>
                                <button 
                                  onClick={async () => {
                                    if (index === products.length - 1) return;
                                    const newProducts = [...products];
                                    const temp = newProducts[index];
                                    newProducts[index] = newProducts[index + 1];
                                    newProducts[index + 1] = temp;
                                    
                                    newProducts.forEach((p, idx) => p.sort_order = idx);
                                    setProducts([...newProducts]);
                                    
                                    await Promise.all([
                                      supabase.from('products').update({ sort_order: newProducts[index].sort_order }).eq('id', newProducts[index].id),
                                      supabase.from('products').update({ sort_order: newProducts[index + 1].sort_order }).eq('id', newProducts[index + 1].id)
                                    ]);
                                  }}
                                  disabled={index === products.length - 1}
                                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors rounded-md"
                                >
                                  <ChevronDown size={20} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : viewMode === 'categories' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-2">
                          {categories.map(cat => {
                            const itemCount = cat.id === '1' 
                              ? products.length 
                              : products.filter(p => p.category_id === cat.id).length;
                            return (
                              <div 
                                key={cat.id} 
                                className="cursor-pointer group relative overflow-hidden px-5 py-4 rounded-xl bg-zinc-900/40 border border-white/5 hover:border-primary/50 hover:bg-zinc-900/80 transition-all duration-300 flex items-center justify-between hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5"
                                onClick={() => { 
                                  setSelectedCategoryId(cat.id); 
                                  setViewMode('items'); 
                                }}
                              >
                                <div>
                                  <h3 className="font-bold text-zinc-100 group-hover:text-primary transition-colors text-sm">{cat.name}</h3>
                                  <p className="text-xs text-zinc-500 mt-1">{itemCount} items</p>
                                </div>
                                {cat.id !== '1' && (
                                  <div onClick={e => e.stopPropagation()}>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger 
                                        className="w-8 h-8 rounded-lg text-zinc-400 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all duration-300"
                                      >
                                        <Settings size={16} />
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-40 border-white/10 bg-zinc-900 rounded-xl">
                                        <DropdownMenuItem 
                                          className="cursor-pointer hover:bg-white/5 focus:bg-white/5 text-zinc-200 py-2.5 rounded-lg"
                                          onClick={() => { setEditingCategory({ id: cat.id, name: cat.name }); setIsEditCategoryDialogOpen(true); }}
                                        >
                                          <Edit2 size={14} className="mr-2" /> Edit Kategori
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          className="cursor-pointer text-red-500 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-500 py-2.5 rounded-lg mt-1"
                                          onClick={async () => {
                                            if (confirm(`Yakin ingin menghapus kategori ${cat.name}?`)) {
                                              const { error } = await supabase.from('categories').delete().eq('id', cat.id);
                                              if (error) {
                                                alert("Failed to delete category");
                                              } else {
                                                setCategories(categories.filter(c => c.id !== cat.id));
                                              }
                                            }
                                          }}
                                        >
                                          <Trash2 size={14} className="mr-2" /> Hapus Kategori
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500 p-2">
                          {(() => {
                            const titipanNames = Array.from(new Set(filteredProducts.filter(p => p.is_titipan).map(p => (p.titipan_name as string) || 'Lainnya')));
                            
                            const finalProducts = filteredProducts.filter(p => {
                              if (activeItemTab === 'my-item' || !titipanNames.includes(activeItemTab)) {
                                return !p.is_titipan;
                              }
                              return p.is_titipan && (p.titipan_name || 'Lainnya') === activeItemTab;
                            });

                            return (
                              <>
                                {titipanNames.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mb-4 p-1.5 bg-zinc-900/40 rounded-2xl border border-white/5 w-fit shadow-inner">
                                    <button 
                                      onClick={() => setActiveItemTab('my-item')}
                                      className={`px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${activeItemTab === 'my-item' || !titipanNames.includes(activeItemTab) ? 'bg-zinc-800 text-primary shadow-lg shadow-primary/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
                                    >
                                      My Item
                                    </button>
                                    {titipanNames.map(name => (
                                      <button 
                                        key={name}
                                        onClick={() => setActiveItemTab(name)}
                                        className={`px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${activeItemTab === name ? 'bg-zinc-800 text-primary shadow-lg shadow-primary/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
                                      >
                                        {name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <div className="space-y-3">
                                  {finalProducts.map((product, index) => (
                                    <div key={product.id} className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-white/5 hover:bg-zinc-900/80 hover:border-white/10 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
                                      <div className="flex items-center gap-5">
                                        <div className="flex flex-col gap-1 mr-1">
                                          <button 
                                            onClick={async () => {
                                              if (index === 0) return;
                                              const newProducts = [...finalProducts];
                                              const temp = newProducts[index];
                                              newProducts[index] = newProducts[index - 1];
                                              newProducts[index - 1] = temp;
                                              
                                              newProducts.forEach((p, idx) => p.sort_order = idx);
                                              const updatedProducts = products.map(p => newProducts.find(np => np.id === p.id) || p);
                                              setProducts(updatedProducts.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
                                              
                                              await Promise.all(newProducts.map((p, idx) => supabase.from('products').update({ sort_order: idx }).eq('id', p.id)));
                                            }}
                                            disabled={index === 0}
                                            className="p-1 text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors rounded-md"
                                          >
                                            <ChevronUp size={18} />
                                          </button>
                                          <button 
                                            onClick={async () => {
                                              if (index === finalProducts.length - 1) return;
                                              const newProducts = [...finalProducts];
                                              const temp = newProducts[index];
                                              newProducts[index] = newProducts[index + 1];
                                              newProducts[index + 1] = temp;
                                              
                                              newProducts.forEach((p, idx) => p.sort_order = idx);
                                              const updatedProducts = products.map(p => newProducts.find(np => np.id === p.id) || p);
                                              setProducts(updatedProducts.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
                                              
                                              await Promise.all(newProducts.map((p, idx) => supabase.from('products').update({ sort_order: idx }).eq('id', p.id)));
                                            }}
                                            disabled={index === finalProducts.length - 1}
                                            className="p-1 text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors rounded-md"
                                          >
                                            <ChevronDown size={18} />
                                          </button>
                                        </div>
                                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex-shrink-0 flex items-center justify-center shadow-inner">
                                          {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <Utensils size={24} className="text-zinc-500 opacity-50" />
                                          )}
                                        </div>
                                        <div>
                                          <h3 className="font-medium text-zinc-100 group-hover:text-primary transition-colors">{product.name}</h3>
                                          <div className="flex items-center gap-3 mt-1.5">
                                            <p className="text-primary font-semibold text-sm">Rp {product.price.toLocaleString('id-ID')}</p>
                                            {selectedCategoryId === '1' && (
                                              <span className="text-zinc-400 text-xs bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                                                {categories.find(c => c.id === product.category_id)?.name || 'Unknown'}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 w-full sm:w-auto opacity-100 transition-opacity duration-300">
                                        <Button 
                                          variant="outline" 
                                          className="flex-1 sm:flex-none border-white/10 hover:bg-white/5 transition-colors rounded-xl"
                                          onClick={async () => {
                                            // Fetch recipe
                                            const { data } = await supabase.from('product_ingredients').select('*').eq('product_id', product.id);
                                            if (data) {
                                              setEditIngredients(data.map(d => ({ stock_id: d.stock_id, quantity_required: d.quantity_required.toString() })));
                                            } else {
                                              setEditIngredients([]);
                                            }
                                            setEditingItem({ ...product, variants: product.variants || [] });
                                            setIsEditItemDialogOpen(true);
                                          }}
                                        >
                                          Edit
                                        </Button>
                                        <Button 
                                          variant="destructive" 
                                          className="flex-1 sm:flex-none rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all duration-300"
                                          onClick={async () => {
                                            setProductToDelete(product);
                                            setIsDeleteDialogOpen(true);
                                          }}
                                        >
                                          Delete
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  {finalProducts.length === 0 && (
                                    <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl text-zinc-500 bg-zinc-900/20">
                                      No products found in this section.
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

            </TabsContent>
            
            <TabsContent value="users" className="m-0 border-none p-0 outline-none">
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
                  <div>
                    <CardTitle className="text-xl">User Management</CardTitle>
                    <CardDescription>Manage cashiers and admin access.</CardDescription>
                  </div>
                  <Button 
                    className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
                    onClick={() => setIsAddUserDialogOpen(true)}
                  >
                    Add User
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users.map(user => (
                      <div key={user.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-border rounded-lg bg-background">
                        <div>
                          <h3 className="font-semibold flex items-center gap-2">
                            {user.name} 
                            <span className={user.role === 'manager' ? "bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full" : "bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full border border-border"}>
                              {user.role === 'manager' ? 'Admin' : 'Cashier'}
                            </span>
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">@{user.username || user.name}</p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button 
                            variant="secondary" 
                            className="w-full sm:w-auto"
                            onClick={() => {
                              setEditingUser({ ...user, password: '' });
                              setIsEditUserDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="destructive" 
                            className="w-full sm:w-auto"
                            onClick={async () => {
                              const { error } = await supabase.from('users').delete().eq('id', user.id);
                              if (!error) {
                                setUsers(users.filter(u => u.id !== user.id));
                              } else {
                                alert("Failed to delete user: " + error.message);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                    {users.length === 0 && (
                      <div className="text-center p-8 border border-dashed border-border rounded-lg text-muted-foreground">
                        No users found.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="m-0 border-none p-0 outline-none space-y-6">
              
              {/* Broadcast Settings */}
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
                  <div>
                    <CardTitle className="text-xl">Pengaturan Broadcast</CardTitle>
                    <CardDescription>Atur pesan berjalan (marquee) yang tampil di semua layar kasir dan dashboard.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-zinc-300">Pesan Pengumuman</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        placeholder="Contoh: Promo diskon 20% khusus hari ini!"
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        className="bg-zinc-900/50 border-white/10 text-zinc-100 flex-1 h-11"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant={isBroadcastEnabled ? "default" : "outline"}
                          disabled={isUpdatingBroadcast}
                          onClick={async () => {
                            const newState = !isBroadcastEnabled;
                            setIsUpdatingBroadcast(true);
                            const { error } = await supabase
                              .from('settings')
                              .upsert({ key: 'broadcast_enabled', value: newState.toString() });
                            if (error) {
                              alert("Gagal ubah status: " + error.message);
                            } else {
                              setIsBroadcastEnabled(newState);
                            }
                            setIsUpdatingBroadcast(false);
                          }}
                          className={`h-11 px-4 ${isBroadcastEnabled ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'border-white/10 text-zinc-400 hover:text-white'}`}
                        >
                          {isBroadcastEnabled ? 'Status: ON' : 'Status: OFF'}
                        </Button>
                        <Button 
                          disabled={isUpdatingBroadcast}
                          onClick={async () => {
                            setIsUpdatingBroadcast(true);
                            const { error } = await supabase
                              .from('settings')
                              .upsert({ key: 'broadcast_message', value: broadcastMessage });
                            if (error) alert("Gagal update pesan: " + error.message);
                            else alert("Pesan berhasil diupdate!");
                            setIsUpdatingBroadcast(false);
                          }}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-6"
                        >
                          {isUpdatingBroadcast ? 'Loading...' : 'Simpan'}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Kosongkan dan klik "Siarkan" jika ingin menghilangkan pengumuman.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="bg-card border-border border-red-500/20">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
                  <div>
                    <CardTitle className="text-xl text-destructive">Danger Zone</CardTitle>
                    <CardDescription>System actions like resetting dummy data.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-blue-500/20 rounded-lg bg-blue-500/5">
                      <div>
                        <h3 className="font-semibold text-blue-500">Arsip Data Transaksi</h3>
                        <p className="text-sm text-muted-foreground mt-1">Mengarsipkan seluruh transaksi sebelum hari ini menjadi ringkasan (summary) agar database tidak penuh.</p>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full sm:w-auto border-blue-500/30 text-blue-500 hover:bg-blue-500 hover:text-white"
                        onClick={() => setIsArchiveDialogOpen(true)}
                      >
                        Arsip Data
                      </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                      <div>
                        <h3 className="font-semibold text-destructive">Reset Data Transaksi</h3>
                        <p className="text-sm text-muted-foreground mt-1">Tindakan ini akan menghapus semua riwayat transaksi secara permanen.</p>
                      </div>
                      <Button 
                        variant="destructive" 
                        className="w-full sm:w-auto"
                        onClick={() => setIsResetDialogOpen(true)}
                      >
                        Reset Data
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-[450px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-100">Add New Menu Item</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-4 px-4 max-h-[70vh] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 w-full">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium text-zinc-400">Name</label>
              <Input 
                id="name" 
                className="bg-zinc-900/50 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl" 
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="price" className="text-sm font-medium text-zinc-400">Price (Rp)</label>
              <Input 
                id="price" 
                type="text"
                className="bg-zinc-900/50 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl" 
                placeholder="15.000"
                value={newItem.price ? parseInt(newItem.price).toLocaleString('id-ID') : ''}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\./g, '');
                  if (/^\d*$/.test(rawValue)) {
                    setNewItem({...newItem, price: rawValue});
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="category" className="text-sm font-medium text-zinc-400">Category</label>
              <select 
                id="category"
                className="flex h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0"
                value={newItem.category_id}
                onChange={(e) => setNewItem({...newItem, category_id: e.target.value})}
              >
                {categories.filter(c => c.name !== 'All').map(c => (
                  <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="image" className="text-sm font-medium text-zinc-400">Foto Menu</label>
              <Input 
                id="image" 
                type="file"
                accept="image/*"
                className="bg-zinc-900/50 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl file:text-primary file:bg-primary/10 file:rounded-md file:border-0 file:mr-4 file:px-4 file:py-1 hover:file:bg-primary/20 transition-all cursor-pointer" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setNewImageFile(e.target.files[0]);
                  }
                }}
              />
            </div>
            
            {/* Titipan Section */}
            <div className="flex items-center space-x-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 mt-2">
              <input 
                type="checkbox"
                id="is_titipan"
                checked={newItem.is_titipan}
                onChange={(e) => setNewItem({...newItem, is_titipan: e.target.checked})}
                className="w-5 h-5 text-primary bg-zinc-900 border-white/10 rounded focus:ring-primary focus:ring-2 accent-primary cursor-pointer"
              />
              <label htmlFor="is_titipan" className="text-sm font-medium text-zinc-300 cursor-pointer select-none">Ini adalah barang Titipan?</label>
            </div>
            {newItem.is_titipan && (
              <div className="grid gap-4 animate-in fade-in slide-in-from-top-2 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                <div className="grid gap-2">
                  <label htmlFor="titipan_name" className="text-sm font-bold text-primary">Nama Penitip</label>
                  <TitipanAutocomplete
                    id="titipan_name" 
                    placeholder="Contoh: Ibu Sari"
                    options={Array.from(new Set(products.filter(p => p.is_titipan && p.titipan_name).map(p => p.titipan_name as string)))}
                    value={newItem.titipan_name}
                    onChange={(val) => setNewItem({...newItem, titipan_name: val})}
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="supplier_price" className="text-sm font-bold text-primary">Harga Setoran (Modal Titipan)</label>
                  <Input 
                    id="supplier_price" 
                    type="text"
                    className="bg-zinc-900/80 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl" 
                    placeholder="Misal: 10000"
                    value={newItem.supplier_price ? parseInt(newItem.supplier_price.toString()).toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\./g, '');
                      if (/^\d*$/.test(rawValue)) {
                        setNewItem({...newItem, supplier_price: rawValue});
                      }
                    }}
                  />
                  <p className="text-[10px] text-zinc-500 font-medium mt-1">Uang ini tidak akan dihitung sebagai Laba Bersih.</p>
                </div>
              </div>
            )}
            
            {/* Quick Food Section */}
            <div className="flex items-center space-x-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 mt-2">
              <input 
                type="checkbox"
                id="is_quick"
                checked={newItem.is_quick}
                onChange={(e) => setNewItem({...newItem, is_quick: e.target.checked})}
                className="w-5 h-5 text-primary bg-zinc-900 border-white/10 rounded focus:ring-primary focus:ring-2 accent-primary cursor-pointer"
              />
              <div>
                <label htmlFor="is_quick" className="text-sm font-medium text-zinc-300 cursor-pointer select-none block">Cepat Saji (Tanpa Masak)</label>
                <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Jika dicentang, menu ini tidak masuk Antrian Dapur saat Lunas.</p>
              </div>
            </div>
            
            {/* Ingredients Section */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="text-sm font-medium mb-3 text-zinc-300 flex items-center gap-2">
                <Utensils size={16} className="text-primary"/> 
                Resep / Bahan Baku (Opsional)
              </h4>
              <div className="space-y-3">
                {newIngredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-2 items-center animate-in fade-in">
                    <select 
                      className="flex-1 min-w-0 h-10 rounded-xl border border-white/10 bg-zinc-900/50 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                      value={ing.stock_id}
                      onChange={(e) => {
                        const newIngs = [...newIngredients];
                        newIngs[idx].stock_id = e.target.value;
                        setNewIngredients(newIngs);
                      }}
                    >
                      <option value="" disabled className="bg-zinc-900">Pilih bahan...</option>
                      {stocks.map(s => <option key={s.id} value={s.id} className="bg-zinc-900">{s.name} ({s.unit})</option>)}
                    </select>
                    <Input 
                      className="w-24 shrink-0 h-10 bg-zinc-900/50 border-white/10 text-zinc-100 rounded-xl text-center" 
                      placeholder="Takaran" 
                      type="number" step="any"
                      value={ing.quantity_required}
                      onChange={(e) => {
                        const newIngs = [...newIngredients];
                        newIngs[idx].quantity_required = e.target.value;
                        setNewIngredients(newIngs);
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl" onClick={() => setNewIngredients(newIngredients.filter((_, i) => i !== idx))}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full border-dashed border-white/20 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 h-10 rounded-xl transition-colors" onClick={() => setNewIngredients([...newIngredients, {stock_id: '', quantity_required: ''}])}>
                  <Plus size={16} className="mr-2" /> Tambah Bahan
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 mt-2 border-t border-white/5">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl" onClick={() => setIsAddItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={isUploading} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20">
              {isUploading ? "Menyimpan..." : "Save Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-[450px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-zinc-100">Edit Menu Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="flex flex-col gap-5 py-4 px-4 max-h-[70vh] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 w-full">
              <div className="grid gap-2">
                <label htmlFor="editName" className="text-sm font-medium text-zinc-400">Name</label>
                <Input 
                  id="editName" 
                  className="bg-zinc-900/50 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl" 
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="editPrice" className="text-sm font-medium text-zinc-400">Price (Rp)</label>
                <Input 
                  id="editPrice" 
                  type="text"
                  className="bg-zinc-900/50 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl" 
                  value={editingItem.price ? parseInt(editingItem.price.toString()).toLocaleString('id-ID') : ''}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\./g, '');
                    if (/^\d*$/.test(rawValue)) {
                      setEditingItem({...editingItem, price: parseInt(rawValue) || 0});
                    }
                  }}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="editCategory" className="text-sm font-medium text-zinc-400">Category</label>
                <select 
                  id="editCategory"
                  className="flex h-11 w-full items-center justify-between rounded-xl border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={editingItem.category_id}
                  onChange={(e) => setEditingItem({...editingItem, category_id: e.target.value})}
                >
                  {categories.filter(c => c.name !== 'All').map(c => (
                    <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="editImage" className="text-sm font-medium text-zinc-400">Ubah Foto</label>
                <Input 
                  id="editImage" 
                  type="file"
                  accept="image/*"
                  className="bg-zinc-900/50 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl file:text-primary file:bg-primary/10 file:rounded-md file:border-0 file:mr-4 file:px-4 file:py-1 hover:file:bg-primary/20 transition-all cursor-pointer" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setEditImageFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
              
              {/* Titipan Section */}
              <div className="flex items-center space-x-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 mt-2">
                <input 
                  type="checkbox"
                  id="edit_is_titipan"
                  checked={editingItem.is_titipan || false}
                  onChange={(e) => setEditingItem({...editingItem, is_titipan: e.target.checked})}
                  className="w-5 h-5 text-primary bg-zinc-900 border-white/10 rounded focus:ring-primary focus:ring-2 accent-primary cursor-pointer"
                />
                <label htmlFor="edit_is_titipan" className="text-sm font-medium text-zinc-300 cursor-pointer select-none">Ini adalah barang Titipan?</label>
              </div>
              {editingItem.is_titipan && (
                <div className="grid gap-4 animate-in fade-in slide-in-from-top-2 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                  <div className="grid gap-2">
                    <label htmlFor="edit_titipan_name" className="text-sm font-bold text-primary">Nama Penitip</label>
                    <TitipanAutocomplete
                      id="edit_titipan_name" 
                      placeholder="Contoh: Ibu Sari"
                      options={Array.from(new Set(products.filter(p => p.is_titipan && p.titipan_name).map(p => p.titipan_name as string)))}
                      value={editingItem.titipan_name || ''}
                      onChange={(val) => setEditingItem({...editingItem, titipan_name: val})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="edit_supplier_price" className="text-sm font-bold text-primary">Harga Setoran (Modal Titipan)</label>
                    <Input 
                      id="edit_supplier_price" 
                      type="text"
                      className="bg-zinc-900/80 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl" 
                      placeholder="Misal: 10000"
                      value={editingItem.supplier_price ? parseInt(editingItem.supplier_price.toString()).toLocaleString('id-ID') : ''}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\./g, '');
                        if (/^\d*$/.test(rawValue)) {
                          setEditingItem({...editingItem, supplier_price: rawValue});
                        }
                      }}
                    />
                    <p className="text-[10px] text-zinc-500 font-medium mt-1">Uang ini tidak akan dihitung sebagai Laba Bersih.</p>
                  </div>
                </div>
              )}
              
              {/* Quick Food Section */}
              <div className="flex items-center space-x-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 mt-2">
                <input 
                  type="checkbox"
                  id="edit_is_quick"
                  checked={editingItem.is_quick || false}
                  onChange={(e) => setEditingItem({...editingItem, is_quick: e.target.checked})}
                  className="w-5 h-5 text-primary bg-zinc-900 border-white/10 rounded focus:ring-primary focus:ring-2 accent-primary cursor-pointer"
                />
                <div>
                  <label htmlFor="edit_is_quick" className="text-sm font-medium text-zinc-300 cursor-pointer select-none block">Cepat Saji (Tanpa Masak)</label>
                  <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Jika dicentang, menu ini tidak masuk Antrian Dapur saat Lunas.</p>
                </div>
              </div>
              
              {/* Ingredients Section */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <h4 className="text-sm font-medium mb-3 text-zinc-300 flex items-center gap-2">
                  <Utensils size={16} className="text-primary"/> 
                  Resep / Bahan Baku (Opsional)
                </h4>
                <div className="space-y-3">
                  {editIngredients.map((ing, idx) => (
                    <div key={idx} className="flex gap-2 items-center animate-in fade-in">
                      <select 
                        className="flex-1 min-w-0 h-10 rounded-xl border border-white/10 bg-zinc-900/50 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                        value={ing.stock_id}
                        onChange={(e) => {
                          const newIngs = [...editIngredients];
                          newIngs[idx].stock_id = e.target.value;
                          setEditIngredients(newIngs);
                        }}
                      >
                        <option value="" disabled className="bg-zinc-900">Pilih bahan...</option>
                        {stocks.map(s => <option key={s.id} value={s.id} className="bg-zinc-900">{s.name} ({s.unit})</option>)}
                      </select>
                      <Input 
                        className="w-24 shrink-0 h-10 bg-zinc-900/50 border-white/10 text-zinc-100 rounded-xl text-center" 
                        placeholder="Takaran" 
                        type="number" step="any"
                        value={ing.quantity_required}
                        onChange={(e) => {
                          const newIngs = [...editIngredients];
                          newIngs[idx].quantity_required = e.target.value;
                          setEditIngredients(newIngs);
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl" onClick={() => setEditIngredients(editIngredients.filter((_, i) => i !== idx))}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full border-dashed border-white/20 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 h-10 rounded-xl transition-colors" onClick={() => setEditIngredients([...editIngredients, {stock_id: '', quantity_required: ''}])}>
                    <Plus size={16} className="mr-2" /> Tambah Bahan
                  </Button>
                </div>
              </div>

              {/* Separated Variants & Toppings Section */}
              <div className="mt-6 border-t border-white/5 pt-6 pb-2">
                
                {/* Varian Utama */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                    <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Varian Utama (Wajib Pilih)</h4>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4 pl-3.5">Customer wajib memilih 1 dari grup ini. Contoh: Pilihan Rasa, Level Pedas.</p>
                  
                  <div className="space-y-4">
                    {(editingItem.variants || []).map((variant: any, vIdx: number) => {
                      if (!variant.is_required) return null;
                      return (
                        <div key={vIdx} className="bg-zinc-900/30 border border-white/5 rounded-2xl p-4 md:p-5 relative group hover:border-white/10 transition-colors">
                          <button 
                            onClick={() => {
                              const newV = [...editingItem.variants];
                              newV.splice(vIdx, 1);
                              setEditingItem({...editingItem, variants: newV});
                            }}
                            className="absolute right-3 top-3 p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                            title="Hapus Varian"
                          >
                            <Trash2 size={16} />
                          </button>
                          
                          <div className="pr-10 mb-5">
                            <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">Nama Grup Varian</label>
                            <Input 
                              placeholder="Ketik nama varian..." 
                              className="h-10 bg-zinc-900/80 border-white/10 text-sm font-medium rounded-xl focus-visible:ring-primary/50 text-zinc-100 placeholder:text-zinc-600"
                              value={variant.name}
                              onChange={(e) => {
                                const newV = [...editingItem.variants];
                                newV[vIdx].name = e.target.value;
                                setEditingItem({...editingItem, variants: newV});
                              }}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-zinc-400 block mb-2">Pilihan & Harga</label>
                            {variant.choices.map((choice: any, cIdx: number) => (
                              <div key={cIdx} className="flex gap-2 items-center">
                                <Input 
                                  placeholder="Nama Pilihan (cth: Pedas)" 
                                  className="h-10 flex-1 bg-zinc-900/50 border-white/5 text-sm rounded-xl focus-visible:ring-primary/50 text-zinc-200 placeholder:text-zinc-600"
                                  value={choice.name}
                                  onChange={(e) => {
                                    const newV = [...editingItem.variants];
                                    newV[vIdx].choices[cIdx].name = e.target.value;
                                    setEditingItem({...editingItem, variants: newV});
                                  }}
                                />
                                <div className="relative w-32 shrink-0">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">Rp</span>
                                  <Input 
                                    placeholder="0" 
                                    className="h-10 pl-9 pr-3 bg-zinc-900/50 border-white/5 text-sm rounded-xl focus-visible:ring-primary/50 text-zinc-200"
                                    value={choice.price ? choice.price.toLocaleString('id-ID') : ''}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/\D/g, '');
                                      const newV = [...editingItem.variants];
                                      newV[vIdx].choices[cIdx].price = raw ? parseInt(raw) : 0;
                                      setEditingItem({...editingItem, variants: newV});
                                    }}
                                  />
                                </div>
                                <button 
                                  onClick={() => {
                                    const newV = [...editingItem.variants];
                                    newV[vIdx].choices.splice(cIdx, 1);
                                    setEditingItem({...editingItem, variants: newV});
                                  }}
                                  className="p-2.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ))}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-9 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 px-3 mt-2 rounded-xl"
                              onClick={() => {
                                const newV = [...editingItem.variants];
                                newV[vIdx].choices.push({ name: '', price: 0 });
                                setEditingItem({...editingItem, variants: newV});
                              }}
                            >
                              <Plus size={14} className="mr-1.5" /> Tambah Pilihan Lain
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full border-dashed border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 h-12 rounded-2xl transition-colors font-medium text-sm" 
                      onClick={() => {
                        const newV = [...(editingItem.variants || []), { name: '', is_required: true, choices: [{ name: '', price: 0 }] }];
                        setEditingItem({...editingItem, variants: newV});
                      }}
                    >
                      <Plus size={16} className="mr-2 text-primary" /> Buat Grup Varian Utama
                    </Button>
                  </div>
                </div>

                {/* Topping Tambahan */}
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
                    <h4 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Topping (Opsional)</h4>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4 pl-3.5">Customer bebas memilih topping tambahan ini (bisa lebih dari satu). Contoh: Ekstra Telur, Keju.</p>
                  
                  <div className="space-y-4">
                    {(editingItem.variants || []).map((variant: any, vIdx: number) => {
                      if (variant.is_required) return null;
                      return (
                        <div key={vIdx} className="bg-zinc-900/30 border border-white/5 rounded-2xl p-4 md:p-5 relative group hover:border-white/10 transition-colors">
                          <button 
                            onClick={() => {
                              const newV = [...editingItem.variants];
                              newV.splice(vIdx, 1);
                              setEditingItem({...editingItem, variants: newV});
                            }}
                            className="absolute right-3 top-3 p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                            title="Hapus Topping"
                          >
                            <Trash2 size={16} />
                          </button>
                          
                          <div className="pr-10 mb-5 flex flex-col gap-3">
                            <div>
                              <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">Nama Grup Topping</label>
                              <Input 
                                placeholder="Ketik nama topping..." 
                                className="h-10 bg-zinc-900/80 border-white/10 text-sm font-medium rounded-xl focus-visible:ring-amber-500/50 text-zinc-100 placeholder:text-zinc-600"
                                value={variant.name}
                                onChange={(e) => {
                                  const newV = [...editingItem.variants];
                                  newV[vIdx].name = e.target.value;
                                  setEditingItem({...editingItem, variants: newV});
                                }}
                              />
                            </div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="rounded border-white/10 bg-zinc-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 w-4 h-4"
                                checked={variant.is_multiple !== false}
                                onChange={(e) => {
                                  const newV = [...editingItem.variants];
                                  newV[vIdx].is_multiple = e.target.checked;
                                  setEditingItem({...editingItem, variants: newV});
                                }}
                              />
                              Customer Bisa Pilih Lebih dari 1 (Multi-select)
                            </label>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-zinc-400 block mb-2">Pilihan Topping & Harga</label>
                            {variant.choices.map((choice: any, cIdx: number) => (
                              <div key={cIdx} className="flex gap-2 items-center">
                                <Input 
                                  placeholder="Nama Pilihan (cth: Keju Slice)" 
                                  className="h-10 flex-1 bg-zinc-900/50 border-white/5 text-sm rounded-xl focus-visible:ring-amber-500/50 text-zinc-200 placeholder:text-zinc-600"
                                  value={choice.name}
                                  onChange={(e) => {
                                    const newV = [...editingItem.variants];
                                    newV[vIdx].choices[cIdx].name = e.target.value;
                                    setEditingItem({...editingItem, variants: newV});
                                  }}
                                />
                                <div className="relative w-32 shrink-0">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500">Rp</span>
                                  <Input 
                                    placeholder="0" 
                                    className="h-10 pl-9 pr-3 bg-zinc-900/50 border-white/5 text-sm rounded-xl focus-visible:ring-amber-500/50 text-zinc-200"
                                    value={choice.price ? choice.price.toLocaleString('id-ID') : ''}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/\D/g, '');
                                      const newV = [...editingItem.variants];
                                      newV[vIdx].choices[cIdx].price = raw ? parseInt(raw) : 0;
                                      setEditingItem({...editingItem, variants: newV});
                                    }}
                                  />
                                </div>
                                <button 
                                  onClick={() => {
                                    const newV = [...editingItem.variants];
                                    newV[vIdx].choices.splice(cIdx, 1);
                                    setEditingItem({...editingItem, variants: newV});
                                  }}
                                  className="p-2.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ))}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-9 text-xs font-semibold text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 px-3 mt-2 rounded-xl"
                              onClick={() => {
                                const newV = [...editingItem.variants];
                                newV[vIdx].choices.push({ name: '', price: 0 });
                                setEditingItem({...editingItem, variants: newV});
                              }}
                            >
                              <Plus size={14} className="mr-1.5" /> Tambah Pilihan Lain
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full border-dashed border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 h-12 rounded-2xl transition-colors font-medium text-sm" 
                      onClick={() => {
                        const newV = [...(editingItem.variants || []), { name: '', is_required: false, is_multiple: true, choices: [{ name: '', price: 0 }] }];
                        setEditingItem({...editingItem, variants: newV});
                      }}
                    >
                      <Plus size={16} className="mr-2 text-amber-500" /> Buat Grup Topping
                    </Button>
                  </div>
                </div>

              </div>

            </div>
          )}
          <DialogFooter className="pt-4 mt-2 border-t border-white/5">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl" onClick={() => setIsEditItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditItemSave} disabled={isUploading} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20">
              {isUploading ? "Menyimpan..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Add New Category</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-zinc-400 mb-2 block">Category Name</label>
            <Input 
              placeholder="e.g., Dessert, Coffee..."
              className="bg-zinc-900/50 border-white/10 text-zinc-100 focus-visible:ring-primary h-11" 
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddCategory();
                  setIsAddCategoryDialogOpen(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl" onClick={() => setIsAddCategoryDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                handleAddCategory();
                setIsAddCategoryDialogOpen(false);
              }} 
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
            >
              Save Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditCategoryDialogOpen} onOpenChange={setIsEditCategoryDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Edit Kategori</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-zinc-400 mb-2 block">Nama Kategori</label>
            <Input 
              placeholder="Nama Kategori" 
              className="bg-zinc-900/50 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl"
              value={editingCategory?.name || ''}
              onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCategoryDialogOpen(false)} className="border-white/10 hover:bg-white/5 rounded-xl">Batal</Button>
            <Button 
              onClick={async () => {
                if (!editingCategory || !editingCategory.name) return;
                const { error } = await supabase.from('categories').update({ name: editingCategory.name }).eq('id', editingCategory.id);
                if (error) {
                  alert("Gagal memperbarui kategori: " + error.message);
                } else {
                  setCategories(categories.map(c => c.id === editingCategory.id ? { ...c, name: editingCategory.name } : c));
                  setIsEditCategoryDialogOpen(false);
                }
              }} 
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Name</label>
              <Input 
                className="col-span-3 bg-background border-border" 
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Username</label>
              <Input 
                type="text"
                className="col-span-3 bg-background border-border" 
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Password</label>
              <Input 
                type="password"
                className="col-span-3 bg-background border-border" 
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Role</label>
              <select 
                className="col-span-3 flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              >
                <option value="cashier">Cashier</option>
                <option value="manager">Manager / Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser} className="bg-primary text-primary-foreground hover:bg-primary/90">Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Name</label>
                <Input 
                  className="col-span-3 bg-background border-border" 
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Username</label>
                <Input 
                  type="text"
                  className="col-span-3 bg-background border-border" 
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Password</label>
                <Input 
                  type="password"
                  placeholder="Leave empty to keep current"
                  className="col-span-3 bg-background border-border" 
                  value={editingUser.password}
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm font-medium">Role</label>
                <select 
                  className="col-span-3 flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                >
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager / Admin</option>
                </select>
              </div>

              {editingUser.role === 'manager' && (
                <div className="grid grid-cols-4 items-center gap-4 pt-1">
                  <label className="text-right text-xs font-semibold text-amber-500 leading-tight">Nama Samaran Kasir (Decoy)</label>
                  <Input 
                    placeholder="Contoh: budi, Kasir 3..."
                    className="col-span-3 bg-background border-border text-sm" 
                    value={editingUser.decoy_name ?? (typeof window !== 'undefined' ? localStorage.getItem('samba_manager_decoy_name') || 'budi' : 'budi')}
                    onChange={(e) => setEditingUser({...editingUser, decoy_name: e.target.value})}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditUser} className="bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Data Dialog */}
      <Dialog open={isResetDialogOpen} onOpenChange={(open) => {
        setIsResetDialogOpen(open);
        if (!open) setResetPassword('');
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset Data Transaksi</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground space-y-4">
            <p>
              Apakah Anda yakin ingin menghapus semua data transaksi? Tindakan ini akan menghapus permanen:
            </p>
            <ul className="list-disc pl-5">
              <li>Semua riwayat transaksi</li>
              <li>Semua item transaksi yang terjual</li>
            </ul>
            <p className="font-medium text-foreground">
              Masukkan password untuk melanjutkan:
            </p>
            <Input 
              type="password" 
              placeholder="Password..." 
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="w-full bg-background border-border text-foreground"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleResetTransactions} disabled={isResetting || !resetPassword}>
              {isResetting ? "Mereset..." : "Ya, Reset Semua Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 sm:max-w-md rounded-2xl z-[200]">
          <DialogHeader>
            <DialogTitle className="text-xl text-red-500 flex items-center gap-2">
              <Trash2 size={24} /> Hapus Produk
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-zinc-300">
            Apakah Anda yakin ingin menghapus produk <span className="font-bold text-zinc-100">{productToDelete?.name}</span> secara permanen?
          </div>
          <DialogFooter className="pt-4 mt-2 border-t border-white/5 gap-2 sm:gap-0">
            <Button variant="outline" className="border-white/10 hover:bg-white/5 rounded-xl text-zinc-300" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
            <Button 
              className="bg-red-500 text-white hover:bg-red-600 rounded-xl shadow-lg shadow-red-500/20"
              onClick={handleDeleteProduct}
              disabled={isUploading}
            >
              {isUploading ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Data Dialog */}
      <Dialog open={isArchiveDialogOpen} onOpenChange={(open) => {
        setIsArchiveDialogOpen(open);
        if (!open) setArchivePassword('');
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-blue-500">Arsip Data Transaksi</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground space-y-4">
            <p>
              Apakah Anda yakin ingin mengarsipkan semua data transaksi sebelum hari ini?
            </p>
            <p>
              Data rincian nota transaksi (item) akan dihapus, tetapi laporan omzet, jumlah pengunjung, kas, qris, dll akan tetap tersimpan sebagai rekapan.
            </p>
            <p className="font-medium text-foreground">
              Masukkan password untuk melanjutkan:
            </p>
            <Input 
              type="password" 
              placeholder="Password..." 
              value={archivePassword}
              onChange={(e) => setArchivePassword(e.target.value)}
              className="w-full bg-background border-border text-foreground"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)}>Batal</Button>
            <Button variant="default" className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleArchiveData} disabled={isArchiving || !archivePassword}>
              {isArchiving ? "Mengarsipkan..." : "Ya, Arsipkan Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BrochureModal 
        isOpen={isBrochureOpen} 
        onClose={() => setIsBrochureOpen(false)} 
        products={products} 
        categories={categories} 
      />
    </MainLayout>
  );
}
