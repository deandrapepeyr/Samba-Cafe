import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pvdzstecfsbxgacbvysk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZHpzdGVjZnNieGdhY2J2eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NjE1MzIsImV4cCI6MjEwMjMzNzUzMn0.Ov9OeYmILyHoO_SOzGvh_4gxvMnJlElpRo24hhqPAc4';
const supabase = createClient(supabaseUrl, supabaseKey);

const imageMap: Record<string, string> = {
  // Rice Bowl Chicken Katsu NOT INCLUDED so it doesn't change
  
  // Generated images
  'Indomie Rebus': '/menu-images/indomie_rebus.png',
  'Indomie Goreng': '/menu-images/indomie_goreng.png',
  'Cireng Ayam Pedas': '/menu-images/cireng_ayam_pedas.png',
  'Dimsum': '/menu-images/dimsum.png',
  'French Fries': '/menu-images/french_fries.png',
  'Otak Otak Goreng': '/menu-images/otak_otak_goreng.png',
  'Mix Platter (Kentang dan Sosis)': '/menu-images/mix_platter.png',
  'Piscok': '/menu-images/piscok.png',
  'Risol Mayo': '/menu-images/risol_mayo.png',
  'Risol Rogut': '/menu-images/risol_rogut.png',
  'Kripik Pisang': '/menu-images/kripik_pisang.png',
  'Es Kelapa': '/menu-images/es_kelapa.png',
  'Susu Ultra': '/menu-images/susu_ultra.png',
  
  // High quality Unsplash placeholders for the rest
  'Es Kopi': 'https://images.unsplash.com/photo-1578314675249-a6910e80a867?auto=format&fit=crop&q=80&w=600',
  'Es Mango Selasih': 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?auto=format&fit=crop&q=80&w=600',
  'Es Jeruk Selasih': 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&q=80&w=600',
  'Cincau Panda': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=600',
  'Pocari': 'https://images.unsplash.com/photo-1621264448270-9ef00e88a935?auto=format&fit=crop&q=80&w=600',
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
