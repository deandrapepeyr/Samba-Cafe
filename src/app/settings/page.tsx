'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { Layers, Loader2, Plus } from 'lucide-react';
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
  
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('1'); // '1' is 'All'

  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category_id: '1',
    image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=400&h=300'
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
    activeCategoryFilter === '1' || p.category_id === activeCategoryFilter
  );

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
        is_available: true
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
          image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=400&h=300'
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
      email: `${newUser.username}@sambacafe.com`
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
          <TabsList className="w-full lg:w-[400px] grid grid-cols-2 mb-6 bg-card border border-border flex-shrink-0">
            <TabsTrigger value="menu" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Food and Drinks</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">User Management</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border pr-2 pb-8">
            <TabsContent value="menu" className="m-0 border-none p-0 outline-none">
              
              <Card className="bg-card border-border">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
                  <div>
                    <CardTitle className="text-xl">Menu Management</CardTitle>
                    <CardDescription>Add, edit, or remove food and drinks from your catalog.</CardDescription>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline"
                      className="flex-1 sm:flex-none border-border"
                      onClick={() => setIsAddCategoryDialogOpen(true)}
                    >
                      <Layers size={16} className="mr-2" />
                      Manage Categories
                    </Button>
                    <Button 
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
                      onClick={() => setIsAddItemDialogOpen(true)}
                    >
                      Add New Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  
                  {/* Category Filter Chips */}
                  <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
                    {isLoadingData ? (
                      <div className="flex gap-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-24 h-9 rounded-full bg-muted animate-pulse"></div>
                        ))}
                      </div>
                    ) : (
                      categories.length > 0 && categories.map(cat => {
                        const itemCount = cat.id === '1' 
                          ? products.length 
                          : products.filter(p => p.category_id === cat.id).length;
                          
                        return (
                        <button
                          key={cat.id}
                          onClick={() => setActiveCategoryFilter(cat.id)}
                          className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                            activeCategoryFilter === cat.id 
                              ? 'bg-primary text-primary-foreground shadow-sm' 
                              : 'bg-background text-muted-foreground hover:bg-muted border border-border'
                          }`}
                        >
                          {cat.name}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeCategoryFilter === cat.id 
                              ? 'bg-primary-foreground/20 text-primary-foreground' 
                              : 'bg-muted-foreground/30 text-muted-foreground'
                          }`}>
                            {itemCount}
                          </span>
                        </button>
                      );
                      })
                    )}
                  </div>

                  <div className="space-y-4">
                    {isLoadingData ? (
                      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p>Memuat data menu...</p>
                      </div>
                    ) : (
                      <>
                        {filteredProducts.map(product => (
                          <div key={product.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-border rounded-lg bg-background">
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <h3 className="font-semibold">{product.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-primary font-medium text-sm">Rp {product.price.toLocaleString('id-ID')}</p>
                                  <span className="text-muted-foreground text-xs bg-muted px-2 py-0.5 rounded-full border border-border">
                                    {categories.find(c => c.id === product.category_id)?.name || 'Unknown'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                              <Button 
                                variant="outline" 
                                className="flex-1 sm:flex-none border-border"
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
                                className="flex-1 sm:flex-none"
                                onClick={async () => {
                                  const { error } = await supabase.from('products').delete().eq('id', product.id);
                                  if (error) {
                                    alert("Failed to delete product: " + error.message);
                                  } else {
                                    setProducts(products.filter(p => p.id !== product.id));
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                        {filteredProducts.length === 0 && (
                          <div className="text-center p-8 border border-dashed border-border rounded-lg text-muted-foreground">
                            No products found in this category.
                          </div>
                        )}
                      </>
                    )}
                  </div>
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
          </div>
        </Tabs>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Menu Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right text-sm font-medium">Name</label>
              <Input 
                id="name" 
                className="col-span-3 bg-background border-border" 
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="price" className="text-right text-sm font-medium">Price (Rp)</label>
              <Input 
                id="price" 
                type="text"
                className="col-span-3 bg-background border-border" 
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
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="category" className="text-right text-sm font-medium">Category</label>
              <select 
                id="category"
                className="col-span-3 flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={newItem.category_id}
                onChange={(e) => setNewItem({...newItem, category_id: e.target.value})}
              >
                {categories.filter(c => c.name !== 'All').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="image" className="text-right text-sm font-medium">Foto Menu</label>
              <Input 
                id="image" 
                type="file"
                accept="image/*"
                className="col-span-3 bg-background border-border" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setNewImageFile(e.target.files[0]);
                  }
                }}
              />
            </div>
            
            {/* Ingredients Section */}
            <div className="mt-2">
              <h4 className="text-sm font-medium mb-3 border-b border-border pb-2 text-muted-foreground">Resep / Bahan Baku (Opsional)</h4>
              {newIngredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2 mb-3 items-center animate-in fade-in">
                  <select 
                    className="flex-1 h-9 rounded-md border border-border bg-background px-2 py-1 text-sm"
                    value={ing.stock_id}
                    onChange={(e) => {
                      const newIngs = [...newIngredients];
                      newIngs[idx].stock_id = e.target.value;
                      setNewIngredients(newIngs);
                    }}
                  >
                    <option value="" disabled>Pilih bahan...</option>
                    {stocks.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                  </select>
                  <Input 
                    className="w-24 h-9 bg-background border-border" 
                    placeholder="Takaran" 
                    type="number" step="any"
                    value={ing.quantity_required}
                    onChange={(e) => {
                      const newIngs = [...newIngredients];
                      newIngs[idx].quantity_required = e.target.value;
                      setNewIngredients(newIngs);
                    }}
                  />
                  <Button variant="ghost" size="sm" className="h-9 px-2 text-destructive hover:bg-destructive/10" onClick={() => setNewIngredients(newIngredients.filter((_, i) => i !== idx))}>✕</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setNewIngredients([...newIngredients, {stock_id: '', quantity_required: ''}])}>
                <Plus size={14} className="mr-1" /> Tambah Bahan
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={isUploading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isUploading ? "Menyimpan..." : "Save Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="editName" className="text-right text-sm font-medium">Name</label>
                <Input 
                  id="editName" 
                  className="col-span-3 bg-background border-border" 
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="editPrice" className="text-right text-sm font-medium">Price (Rp)</label>
                <Input 
                  id="editPrice" 
                  type="text"
                  className="col-span-3 bg-background border-border" 
                  value={editingItem.price ? parseInt(editingItem.price.toString()).toLocaleString('id-ID') : ''}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\./g, '');
                    if (/^\d*$/.test(rawValue)) {
                      setEditingItem({...editingItem, price: parseInt(rawValue) || 0});
                    }
                  }}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="editCategory" className="text-right text-sm font-medium">Category</label>
                <select 
                  id="editCategory"
                  className="col-span-3 flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background"
                  value={editingItem.category_id}
                  onChange={(e) => setEditingItem({...editingItem, category_id: e.target.value})}
                >
                  {categories.filter(c => c.name !== 'All').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="editImage" className="text-right text-sm font-medium">Ubah Foto</label>
                <Input 
                  id="editImage" 
                  type="file"
                  accept="image/*"
                  className="col-span-3 bg-background border-border" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setEditImageFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
              
              {/* Ingredients Section */}
              <div className="mt-2">
                <h4 className="text-sm font-medium mb-3 border-b border-border pb-2 text-muted-foreground">Resep / Bahan Baku (Opsional)</h4>
                {editIngredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-2 mb-3 items-center animate-in fade-in">
                    <select 
                      className="flex-1 h-9 rounded-md border border-border bg-background px-2 py-1 text-sm"
                      value={ing.stock_id}
                      onChange={(e) => {
                        const newIngs = [...editIngredients];
                        newIngs[idx].stock_id = e.target.value;
                        setEditIngredients(newIngs);
                      }}
                    >
                      <option value="" disabled>Pilih bahan...</option>
                      {stocks.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                    </select>
                    <Input 
                      className="w-24 h-9 bg-background border-border" 
                      placeholder="Takaran" 
                      type="number" step="any"
                      value={ing.quantity_required}
                      onChange={(e) => {
                        const newIngs = [...editIngredients];
                        newIngs[idx].quantity_required = e.target.value;
                        setEditIngredients(newIngs);
                      }}
                    />
                    <Button variant="ghost" size="sm" className="h-9 px-2 text-destructive hover:bg-destructive/10" onClick={() => setEditIngredients(editIngredients.filter((_, i) => i !== idx))}>✕</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setEditIngredients([...editIngredients, {stock_id: '', quantity_required: ''}])}>
                  <Plus size={14} className="mr-1" /> Tambah Bahan
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditItemSave} disabled={isUploading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isUploading ? "Menyimpan..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Category Dialog */}
      <Dialog open={isAddCategoryDialogOpen} onOpenChange={setIsAddCategoryDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="New category name..."
                className="bg-background border-border flex-1" 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Button onClick={handleAddCategory} className="bg-primary text-primary-foreground hover:bg-primary/90">Add</Button>
            </div>
            
            <div className="pt-2">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Existing Categories</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
                {categories.filter(c => c.name !== 'All').map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-2.5 bg-background border border-border rounded-lg">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        const { error } = await supabase.from('categories').delete().eq('id', cat.id);
                        if (error) {
                          alert("Failed to delete category: " + error.message);
                        } else {
                          setCategories(categories.filter(c => c.id !== cat.id));
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
                {categories.length <= 1 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No categories found.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryDialogOpen(false)}>Close</Button>
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
    </MainLayout>
  );
}
