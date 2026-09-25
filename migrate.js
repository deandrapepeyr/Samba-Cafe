const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function migrate() {
  console.log('Fetching titipan products...');
  const { data: products, error: pErr } = await supabase.from('products').select('*').eq('is_titipan', true);
  if (pErr) throw pErr;
  
  const { data: existingIngredients, error: iErr } = await supabase.from('product_ingredients').select('*');
  if (iErr) throw iErr;
  
  for (const product of products) {
    const hasLinkedStock = existingIngredients.some(i => i.product_id === product.id);
    if (!hasLinkedStock) {
      console.log('Migrating:', product.name);
      
      const packedName = product.titipan_name ? `${product.name.trim()} |titipan:${product.titipan_name.trim()}|` : product.name.trim();
      
      const { data: newStock, error: sErr } = await supabase.from('stocks').insert([{
        name: packedName,
        quantity: product.stock,
        unit: 'pcs',
        cost_per_unit: product.supplier_price || 0,
        min_stock_alert: 0
      }]).select();
      
      if (sErr) {
        console.error('Failed to create stock for', product.name, sErr);
        continue;
      }
      
      const { error: piErr } = await supabase.from('product_ingredients').insert([{
        product_id: product.id,
        stock_id: newStock[0].id,
        quantity_required: 1
      }]);
      
      if (piErr) {
        console.error('Failed to link stock for', product.name, piErr);
      } else {
        console.log('Successfully migrated', product.name);
      }
    }
  }
  console.log('Migration complete.');
}
migrate();
