'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Utensils, Flame, Coffee, IceCream, Search, ChevronRight } from 'lucide-react';

export default function CustomerMenuPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchData() {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order', { ascending: true }),
        supabase.from('products').select('*').eq('is_available', true)
      ]);
      
      if (catRes.data) {
        setCategories([{ id: 'all', name: 'All' }, ...catRes.data.filter(c => c.id !== '1')]);
      }
      if (prodRes.data) {
        setProducts(prodRes.data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('food')) return <Utensils size={16} />;
    if (n.includes('snack')) return <Flame size={16} />;
    if (n.includes('minuman')) return <Coffee size={16} />;
    if (n.includes('dessert')) return <IceCream size={16} />;
    return <Utensils size={16} />;
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = activeCategory === 'All' || p.category_id === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    // Exclude titipan in customer facing menu unless specifically wanted, let's keep them if they are available
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-primary/30">
      {/* Hero Section */}
      <div className="relative h-[40vh] min-h-[300px] w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
        
        <div className="relative z-10 text-center space-y-4 px-4">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-2 backdrop-blur-md border border-primary/20">
            <Utensils size={24} />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white drop-shadow-xl">
            Samba <span className="text-primary font-serif italic">Cafe</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-md mx-auto">
            Discover our carefully crafted menu, bringing you the best flavors in town.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 pb-24 -mt-8 relative z-20">
        
        {/* Search and Filter */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-2 mb-8 shadow-2xl flex flex-col md:flex-row gap-2 sticky top-4 z-30">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Search for your cravings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none py-3 pl-12 pr-4 text-zinc-100 placeholder:text-zinc-500 h-full rounded-2xl focus:bg-white/5 transition-colors"
            />
          </div>
          <div className="w-px bg-white/10 hidden md:block" />
          <div className="flex overflow-x-auto hide-scrollbar gap-2 p-1">
            {categories.map(cat => (
              <button
                key={cat.id || cat.name}
                onClick={() => setActiveCategory(cat.id === 'all' ? 'All' : cat.id)}
                className={`flex items-center gap-2 whitespace-nowrap px-6 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 ${
                  (activeCategory === 'All' && cat.id === 'all') || activeCategory === cat.id
                    ? 'bg-primary text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]'
                    : 'bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                {cat.id !== 'all' && getCategoryIcon(cat.name)}
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-primary">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="text-zinc-500">Preparing the menu...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
              <Search className="text-zinc-500 w-8 h-8" />
            </div>
            <h3 className="text-xl font-medium text-zinc-300">No items found</h3>
            <p className="text-zinc-500 mt-2">Try a different search term or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product, index) => (
              <div 
                key={product.id}
                className="group relative bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden hover:bg-zinc-900/80 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8"
                style={{ animationFillMode: 'both', animationDelay: `${index * 50}ms` }}
              >
                {/* Image Container */}
                <div className="aspect-[4/3] w-full overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent z-10" />
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-in-out"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <Utensils className="w-12 h-12 text-zinc-600" />
                    </div>
                  )}
                  
                  {/* Category Badge */}
                  <div className="absolute top-4 left-4 z-20">
                    <span className="bg-black/50 backdrop-blur-md text-zinc-200 text-xs px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-wider font-medium">
                      {categories.find(c => c.id === product.category_id)?.name || 'Menu'}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 relative z-20 -mt-6">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-xl font-semibold text-zinc-100 leading-tight group-hover:text-primary transition-colors duration-300">
                      {product.name}
                    </h3>
                    <div className="flex-shrink-0">
                      <div className="bg-primary/10 border border-primary/20 text-primary font-bold px-3 py-1.5 rounded-xl whitespace-nowrap">
                        Rp {product.price.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center text-primary/60 text-sm font-medium opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    <span>Chef's Recommendation</span>
                    <ChevronRight size={16} className="ml-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
