const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const artifactDir = 'C:/Users/Deandra/.gemini/antigravity-ide/brain/145dc835-ba12-49e0-93de-c94bd166e27f';
const targetDir = path.join(__dirname, 'public', 'images', 'products');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const updates = [
  { id: 'pv4jkf7jgr', file: 'indomie_soto_1790845208556.png' },
  { id: 'p8n4qq7rlx', file: 'risol_mayo_1790845244438.png' },
  { id: 'p2ige2ccap', file: 'kopi_liong_1790845261303.png' },
  { id: 'p4jp2cif5g', file: 'kopi_liong_1790845261303.png' },
  { id: 'pm79wov4q2', file: 'es_nutrisari_1790845273276.png' },
  { id: 'pq28agastl', file: 'es_cappuccino_1790845291653.png' },
  { id: 'p8qgxmlohq', file: 'es_cappuccino_1790845291653.png' },
  { id: 'phjjoa1vyr', file: 'es_cappuccino_1790845291653.png' },
  { id: 'pvydybiig9', file: 'es_cappuccino_1790845291653.png' },
  { id: 'puo99hgheg', file: 'tictac_snack_1790845303392.png' },
  { id: 'pd5i1eu9cc', file: 'good_time_cookies_1790845396295.png' },
  { id: 'pnouv9alhs', file: 'good_time_cookies_1790845396295.png' },
  { id: 'pw653gtpw1', file: 'chitato_chips_1790845413387.png' },
  { id: 'pq7i697jut', file: 'es_batu_1790845435024.png' },
  { id: 'patcy4zzk2', file: 'kiko_ice_1790845449373.png' },
  { id: 'pyxyvxjipp', file: 'pocky_sticks_1790845460387.png' },
  { id: 'p977zzwo7w', file: 'indomie_kari_1790845474669.png' },
];

async function updateProducts() {
  for (const update of updates) {
    const src = path.join(artifactDir, update.file);
    const dest = path.join(targetDir, update.file);
    
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      const imageUrl = `/images/products/${update.file}`;
      
      const { error } = await supabase
        .from('products')
        .update({ image_url: imageUrl })
        .eq('id', update.id);
        
      if (error) {
        console.error(`Failed to update ${update.id}:`, error);
      } else {
        console.log(`Updated ${update.id} with ${imageUrl}`);
      }
    } else {
      console.error(`Source file not found: ${src}`);
    }
  }
  console.log("Done");
}

updateProducts();
