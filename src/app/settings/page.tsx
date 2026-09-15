'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { Search, Plus, Trash2, Edit2, Check, X, Tag, DollarSign, Image as ImageIcon, Box, Utensils, Loader2, Layers, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SettingsPage() {
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
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoadingData(true);
    const [categoriesRes, productsRes, stocksRes, usersRes] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('products').select('*'),
      supabase.from('stocks').select('*'),
      supabase.from('users').select('*')
    ]);
    if (categoriesRes.error) console.error("Error fetching categories:", categoriesRes.error);
    if (productsRes.error) console.error("Error fetching products:", productsRes.error);
    
    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (stocksRes.data) setStocks(stocksRes.data);
    if (usersRes.data) setUsers(usersRes.data);
    setIsLoadingData(false);
  };
  
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [isAddCategoryDialogOpen, setIsAddCategoryDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  
  const [viewMode, setViewMode] = useState<'categories' | 'items'>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeItemTab, setActiveItemTab] = useState<string>('my-item');

  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category_id: '1',
    image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=400&h=300',
    is_titipan: false,
    titipan_name: '',
    supplier_price: ''
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

  const handleResetTransactions = async () => {
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
        supplier_price: newItem.is_titipan ? parseInt(newItem.supplier_price.toString()) || 0 : 0
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
          supplier_price: ''
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
                  <div>
                    <CardTitle className="text-xl">
                      {viewMode === 'categories' ? 'Menu Categories' : selectedCategoryName}
                    </CardTitle>
                    <CardDescription>
                      {viewMode === 'categories' 
                        ? 'Select a category to view or manage its items.'
                        : 'Add, edit, or remove food and drinks from this category.'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    {viewMode === 'categories' ? (
                      <Button 
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-white/10 hover:border-primary/50 transition-all duration-300 rounded-xl shadow-sm hover:shadow-primary/10 hover:-translate-y-0.5"
                        onClick={() => setIsAddCategoryDialogOpen(true)}
                      >
                        <Plus size={16} className="mr-2 text-primary" />
                        Add Category
                      </Button>
                    ) : (
                      <>
                        <Button 
                          variant="outline"
                          className="flex-1 sm:flex-none border-white/10 hover:bg-white/5 transition-all duration-300 rounded-xl"
                          onClick={() => { setViewMode('categories'); setSelectedCategoryId(null); }}
                        >
                          <ChevronLeft size={16} className="mr-2" />
                          Back
                        </Button>
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
                      {viewMode === 'categories' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 p-2">
                          {categories.map(cat => {
                            const itemCount = cat.id === '1' 
                              ? products.length 
                              : products.filter(p => p.category_id === cat.id).length;
                            return (
                              <div 
                                key={cat.id} 
                                className="cursor-pointer group relative overflow-hidden p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-primary/50 hover:bg-zinc-900/80 transition-all duration-300 flex flex-col items-start gap-4 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
                                onClick={() => { 
                                  setSelectedCategoryId(cat.id); 
                                  setViewMode('items'); 
                                }}
                              >
                                <div className="flex justify-between items-start w-full">
                                  <div className="w-12 h-12 rounded-xl bg-white/5 text-zinc-400 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-300">
                                    {cat.id === '1' ? <Layers size={22} strokeWidth={1.5} /> : <Utensils size={22} strokeWidth={1.5} />}
                                  </div>
                                  {cat.id !== '1' && (
                                    <div 
                                      className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all duration-300"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm(`Yakin ingin menghapus kategori ${cat.name}?`)) {
                                          const { error } = await supabase.from('categories').delete().eq('id', cat.id);
                                          if (error) {
                                            alert("Failed to delete category: " + error.message);
                                          } else {
                                            setCategories(categories.filter(c => c.id !== cat.id));
                                          }
                                        }
                                      }}
                                    >
                                      <Trash2 size={14} />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h3 className="text-lg font-medium text-zinc-100 group-hover:text-primary transition-colors">{cat.name}</h3>
                                  <p className="text-sm text-zinc-500 mt-0.5">{itemCount} Menu Items</p>
                                </div>
                                <div className="absolute right-5 bottom-5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                  <ChevronLeft className="w-5 h-5 text-primary rotate-180" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500 p-2">
                          {(() => {
                            const titipanNames = Array.from(new Set(filteredProducts.filter(p => p.is_titipan && p.titipan_name).map(p => p.titipan_name as string)));
                            
                            const finalProducts = filteredProducts.filter(p => {
                              if (activeItemTab === 'my-item' || !titipanNames.includes(activeItemTab)) {
                                return !p.is_titipan;
                              }
                              return p.is_titipan && p.titipan_name === activeItemTab;
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
                                  {finalProducts.map(product => (
                                    <div key={product.id} className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-white/5 hover:bg-zinc-900/80 hover:border-white/10 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
                                      <div className="flex items-center gap-5">
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
                                            setEditingItem(product);
                                            setIsEditItemDialogOpen(true);
                                          }}
                                        >
                                          Edit
                                        </Button>
                                        <Button 
                                          variant="destructive" 
                                          className="flex-1 sm:flex-none rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all duration-300"
                                          onClick={async () => {
                                            if (window.confirm(`Yakin ingin menghapus menu ${product.name}?`)) {
                                              const { error } = await supabase.from('products').delete().eq('id', product.id);
                                              if (error) {
                                                alert("Failed to delete product: " + error.message);
                                              } else {
                                                setProducts(products.filter(p => p.id !== product.id));
                                              }
                                            }
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

            <TabsContent value="system" className="m-0 border-none p-0 outline-none">
              <Card className="bg-card border-border border-red-500/20">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
                  <div>
                    <CardTitle className="text-xl text-destructive">Danger Zone</CardTitle>
                    <CardDescription>System actions like resetting dummy data.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
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
          <div className="grid gap-5 py-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
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
                  <Input 
                    id="titipan_name" 
                    className="bg-zinc-900/80 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl" 
                    placeholder="Contoh: Ibu Sari"
                    value={newItem.titipan_name}
                    onChange={(e) => setNewItem({...newItem, titipan_name: e.target.value})}
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
                      className="flex-1 h-10 rounded-xl border border-white/10 bg-zinc-900/50 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
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
                      className="w-24 h-10 bg-zinc-900/50 border-white/10 text-zinc-100 rounded-xl text-center" 
                      placeholder="Takaran" 
                      type="number" step="any"
                      value={ing.quantity_required}
                      onChange={(e) => {
                        const newIngs = [...newIngredients];
                        newIngs[idx].quantity_required = e.target.value;
                        setNewIngredients(newIngs);
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl" onClick={() => setNewIngredients(newIngredients.filter((_, i) => i !== idx))}>
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
            <div className="grid gap-5 py-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
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
                    <Input 
                      id="edit_titipan_name" 
                      className="bg-zinc-900/80 border-white/10 text-zinc-100 focus-visible:ring-primary h-11 rounded-xl" 
                      placeholder="Contoh: Ibu Sari"
                      value={editingItem.titipan_name || ''}
                      onChange={(e) => setEditingItem({...editingItem, titipan_name: e.target.value})}
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
                        className="flex-1 h-10 rounded-xl border border-white/10 bg-zinc-900/50 px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
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
                        className="w-24 h-10 bg-zinc-900/50 border-white/10 text-zinc-100 rounded-xl text-center" 
                        placeholder="Takaran" 
                        type="number" step="any"
                        value={ing.quantity_required}
                        onChange={(e) => {
                          const newIngs = [...editIngredients];
                          newIngs[idx].quantity_required = e.target.value;
                          setEditIngredients(newIngs);
                        }}
                      />
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl" onClick={() => setEditIngredients(editIngredients.filter((_, i) => i !== idx))}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full border-dashed border-white/20 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 h-10 rounded-xl transition-colors" onClick={() => setEditIngredients([...editIngredients, {stock_id: '', quantity_required: ''}])}>
                    <Plus size={16} className="mr-2" /> Tambah Bahan
                  </Button>
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
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
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
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleResetTransactions} disabled={isResetting}>
              {isResetting ? "Mereset..." : "Ya, Reset Semua Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
