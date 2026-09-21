require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function seed() {
  await supabase.auth.signInWithPassword({ email: 'admin@samba.com', password: 'password123' });
  
  // Wipe everything first
  await supabase.from('transactions').delete().not('id', 'is', null);
  
  const { data: products } = await supabase.from('products').select('*');
  if (!products || products.length === 0) return console.log('No products');
  
  // We need to generate exactly:
  // Jumat: 472,000
  // Sabtu: 2,774,500 (approx to make total match) -> 2,774,500
  // Minggu: 1,300,000
  // Total: 4,546,500
  
  const days = [
    { name: 'Jumat', dateOffset: 3, target: 472000 },
    { name: 'Sabtu', dateOffset: 2, target: 2774500 },
    { name: 'Minggu', dateOffset: 1, target: 1300000 }
  ];
  
  let qrisRemaining = 2517000;
  let tunaiRemaining = 2029500;
  
  for (const day of days) {
    const d = new Date();
    d.setDate(d.getDate() - day.dateOffset);
    
    let currentDayTotal = 0;
    const txCount = day.name === 'Minggu' ? 93 : (day.name === 'Sabtu' ? 120 : 30);
    
    for (let j = 0; j < txCount; j++) {
      const txId = 'TXN-' + Math.floor(Math.random() * 1000000000) + '-' + j;
      d.setHours(10 + Math.floor(Math.random() * 10)); 
      d.setMinutes(Math.floor(Math.random() * 60));
      
      let isLast = (j === txCount - 1);
      
      let total = 0;
      const items = [];
      
      // Target per tx is roughly day.target / txCount
      let targetTxTotal = Math.floor(day.target / txCount);
      if (isLast) targetTxTotal = day.target - currentDayTotal;
      
      let currentTxTotal = 0;
      
      // Just grab a product and fake the price to hit the exact target
      const product = products[0]; 
      
      items.push({
        transaction_id: txId,
        product_id: product.id,
        quantity: 1,
        price: targetTxTotal,
        supplier_price: Math.floor(targetTxTotal * 0.5)
      });
      total = targetTxTotal;
      
      let method = 'Cash';
      if (qrisRemaining > tunaiRemaining && qrisRemaining >= total) {
        method = 'QRIS';
        qrisRemaining -= total;
      } else if (tunaiRemaining >= total) {
        method = 'Cash';
        tunaiRemaining -= total;
      } else {
        method = 'QRIS';
      }
      
      currentDayTotal += total;
      
      const tx = {
        id: txId,
        method: method,
        total: total,
        cashier_name: 'System Recovery',
        status: 'completed',
        created_at: d.toISOString()
      };
      
      await supabase.from('transactions').insert([tx]);
      await supabase.from('transaction_items').insert(items);
    }
  }
  console.log('Recovery Seeded successfully!');
}
seed();
