import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pvdzstecfsbxgacbvysk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZHpzdGVjZnNieGdhY2J2eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NjE1MzIsImV4cCI6MjEwMjMzNzUzMn0.Ov9OeYmILyHoO_SOzGvh_4gxvMnJlElpRo24hhqPAc4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Fetching all products...');
  const { data: oldProducts } = await supabase.from('products').select('*');
  
  if (oldProducts && oldProducts.length > 0) {
    console.log('Deleting existing products...');
    const ids = oldProducts.map(p => p.id);
    for (let i = 0; i < ids.length; i += 100) {
      await supabase.from('products').delete().in('id', ids.slice(i, i + 100));
    }
  }

  console.log('Fetching all categories...');
  const { data: oldCategories } = await supabase.from('categories').select('*');
  if (oldCategories && oldCategories.length > 0) {
    console.log('Deleting existing categories (except id 1 - All)...');
    const catIds = oldCategories.filter(c => c.id !== '1').map(c => c.id);
    for (let i = 0; i < catIds.length; i += 100) {
      await supabase.from('categories').delete().in('id', catIds.slice(i, i + 100));
    }
  }

  console.log('Inserting new categories...');
  const newCategories = [
    { id: 'cat_food', name: 'Food' },
    { id: 'cat_snack', name: 'Snack' },
    { id: 'cat_minuman', name: 'Minuman' },
    { id: 'cat_dessert', name: 'Dessert' }
  ];
  await supabase.from('categories').insert(newCategories);

  console.log('Inserting new products...');
  const defaultImage = 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=400&h=300';
  
  const createProduct = (id: string, name: string, category_id: string) => ({
    id,
    name,
    price: 0, // Placeholder price, can be updated later in the UI
    category_id,
    image_url: defaultImage,
    is_available: true,
    is_titipan: false
  });

  const newProducts = [
    // Food
    createProduct('p_food_1', 'Rice Bowl Chicken Katsu', 'cat_food'),
    createProduct('p_food_2', 'Indomie Rebus', 'cat_food'),
    createProduct('p_food_3', 'Indomie Goreng', 'cat_food'),

    // Snack
    createProduct('p_snack_1', 'Cireng Ayam Pedas', 'cat_snack'),
    createProduct('p_snack_2', 'Dimsum', 'cat_snack'),
    createProduct('p_snack_3', 'French Fries', 'cat_snack'),
    createProduct('p_snack_4', 'Otak Otak Goreng', 'cat_snack'),
    createProduct('p_snack_5', 'Mix Platter (Kentang dan Sosis)', 'cat_snack'),
    createProduct('p_snack_6', 'Piscok', 'cat_snack'),
    createProduct('p_snack_7', 'Risol Mayo', 'cat_snack'),
    createProduct('p_snack_8', 'Risol Rogut', 'cat_snack'),
    createProduct('p_snack_9', 'Kripik Pisang', 'cat_snack'),

    // Minuman
    createProduct('p_minuman_1', 'Es Kelapa', 'cat_minuman'),
    createProduct('p_minuman_2', 'Susu Ultra', 'cat_minuman'),
    createProduct('p_minuman_3', 'Es Kopi', 'cat_minuman'),
    createProduct('p_minuman_4', 'Es Mango Selasih', 'cat_minuman'),
    createProduct('p_minuman_5', 'Es Jeruk Selasih', 'cat_minuman'),
    createProduct('p_minuman_6', 'Cincau Panda', 'cat_minuman'),
    createProduct('p_minuman_7', 'Pocari', 'cat_minuman'),
    createProduct('p_minuman_8', 'Air Mineral', 'cat_minuman'),
    createProduct('p_minuman_9', 'Teh Pucuk', 'cat_minuman'),

    // Dessert
    createProduct('p_dessert_1', 'Pudding', 'cat_dessert')
  ];

  const { error } = await supabase.from('products').insert(newProducts);
  if (error) {
    console.error('Failed to insert products:', error);
  } else {
    console.log('Done replacing menu!');
  }
}

seed().catch(console.error);
