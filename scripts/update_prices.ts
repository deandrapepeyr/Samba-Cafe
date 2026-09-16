import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pvdzstecfsbxgacbvysk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZHpzdGVjZnNieGdhY2J2eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NjE1MzIsImV4cCI6MjEwMjMzNzUzMn0.Ov9OeYmILyHoO_SOzGvh_4gxvMnJlElpRo24hhqPAc4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePrices() {
  console.log('Updating prices...');

  const updates = [
    { match: 'Rice Bowl Chicken Katsu', price: 20000 },
    { match: 'French Fries', price: 15000 },
    { match: 'Cireng Ayam Pedas', price: 18000 }
  ];

  for (const update of updates) {
    const { error } = await supabase
      .from('products')
      .update({ price: update.price })
      .ilike('name', `%${update.match}%`);
      
    if (error) {
      console.error(`Error updating ${update.match}:`, error);
    } else {
      console.log(`Successfully updated ${update.match} to ${update.price}`);
    }
  }
  
  console.log('Done!');
}

updatePrices().catch(console.error);
