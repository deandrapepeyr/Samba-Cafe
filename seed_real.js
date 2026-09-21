require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function seed() {
  await supabase.auth.signInWithPassword({ email: 'admin@samba.com', password: 'password123' });
  
  // Clear dummy data
  await supabase.from('transactions').delete().not('id', 'is', null);
  
  const { data: products } = await supabase.from('products').select('*');
  if (!products || products.length === 0) return console.log('No products');
  
  const methods = ['Cash', 'QRIS', 'Cash (Lunas)'];
  const cashiers = ['Budi', 'Siti'];
  
  for (let i = 0; i < 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    
    // Generate 5-8 transactions per day
    const txCount = Math.floor(Math.random() * 4) + 5;
    
    for (let j = 0; j < txCount; j++) {
      const txId = 'TXN-' + Math.floor(Math.random() * 1000000000);
      d.setHours(10 + Math.floor(Math.random() * 10)); // Random hour between 10 and 20
      d.setMinutes(Math.floor(Math.random() * 60));
      
      const itemCount = Math.floor(Math.random() * 3) + 1;
      let total = 0;
      const items = [];
      
      for (let k = 0; k < itemCount; k++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        total += product.price * qty;
        
        items.push({
          transaction_id: txId,
          product_id: product.id,
          quantity: qty,
          price: product.price,
          supplier_price: product.supplier_price || (product.price * 0.6)
        });
      }
      
      const method = methods[Math.floor(Math.random() * methods.length)];
      
      const tx = {
        id: txId,
        method: method,
        total: total,
        cashier_name: cashiers[Math.floor(Math.random() * cashiers.length)],
        status: 'completed',
        created_at: d.toISOString()
      };
      
      await supabase.from('transactions').insert([tx]);
      await supabase.from('transaction_items').insert(items);
    }
  }
  console.log('Seeded successfully!');
}
seed();
