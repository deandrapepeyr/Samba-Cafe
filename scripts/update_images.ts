import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pvdzstecfsbxgacbvysk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZHpzdGVjZnNieGdhY2J2eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NjE1MzIsImV4cCI6MjEwMjMzNzUzMn0.Ov9OeYmILyHoO_SOzGvh_4gxvMnJlElpRo24hhqPAc4';
const supabase = createClient(supabaseUrl, supabaseKey);

const imageMap: Record<string, string> = {
  'Rice Bowl Chicken Katsu': 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&q=80&w=600',
  'Indomie Rebus': 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&q=80&w=600',
  'Indomie Goreng': 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&q=80&w=600',
  'Cireng Ayam Pedas': 'https://images.unsplash.com/photo-1626082895617-2c6fd1296ee9?auto=format&fit=crop&q=80&w=600',
  'Dimsum': 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&q=80&w=600',
  'French Fries': 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&q=80&w=600',
  'Otak Otak Goreng': 'https://images.unsplash.com/photo-1601000676449-6bb3a2b724f7?auto=format&fit=crop&q=80&w=600',
  'Mix Platter (Kentang dan Sosis)': 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&q=80&w=600',
  'Piscok': 'https://images.unsplash.com/photo-1529124419992-005697693fb0?auto=format&fit=crop&q=80&w=600',
  'Risol Mayo': 'https://images.unsplash.com/photo-1605333555543-97645bb38f83?auto=format&fit=crop&q=80&w=600',
  'Risol Rogut': 'https://images.unsplash.com/photo-1596450514735-a50d24f0a20e?auto=format&fit=crop&q=80&w=600',
  'Kripik Pisang': 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?auto=format&fit=crop&q=80&w=600',
  'Es Kelapa': 'https://images.unsplash.com/photo-1523910088385-d313124c68aa?auto=format&fit=crop&q=80&w=600',
  'Susu Ultra': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=600',
  'Es Kopi': 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&q=80&w=600',
  'Es Mango Selasih': 'https://images.unsplash.com/photo-1605808006277-3e1101962dc2?auto=format&fit=crop&q=80&w=600',
  'Es Jeruk Selasih': 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&q=80&w=600',
  'Cincau Panda': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=600',
  'Pocari': 'https://images.unsplash.com/photo-1527661591450-b2713f2eb3a8?auto=format&fit=crop&q=80&w=600',
  'Air Mineral': 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&q=80&w=600',
  'Teh Pucuk': 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&q=80&w=600',
  'Pudding': 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&q=80&w=600'
};

async function updateImages() {
  console.log('Fetching products...');
  const { data: products } = await supabase.from('products').select('*');
  
  if (products) {
    for (const product of products) {
      const url = imageMap[product.name];
      if (url) {
        console.log(`Updating ${product.name}...`);
        await supabase.from('products').update({ image_url: url }).eq('id', product.id);
      }
    }
  }
  console.log('Done updating images!');
}

updateImages().catch(console.error);
