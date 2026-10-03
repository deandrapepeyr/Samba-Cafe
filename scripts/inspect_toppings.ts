// Verification tooling only (read-only inspection)
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://pvdzstecfsbxgacbvysk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZHpzdGVjZnNieGdhY2J2eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NjE1MzIsImV4cCI6MjEwMjMzNzUzMn0.Ov9OeYmILyHoO_SOzGvh_4gxvMnJlElpRo24hhqPAc4');
(async () => {
  for (const pid of ['pq28agastl', 'pbfp7ztcfg', 'p309zzjuwl', 'p8t5wlgpu2', 'pvh4yzh29i']) {
    const { data: p } = await supabase.from('products').select('id,name,is_available,variants').eq('id', pid).single();
    const { data: pi } = await supabase.from('product_ingredients').select('stock_id,quantity_required,variant_name,choice_name, stocks(name,tracking_method,quantity,item_type)').eq('product_id', pid);
    console.log(JSON.stringify({ p, pi }));
  }
  const { data: q } = await supabase.from('products').select('id,name,is_available').eq('is_quick', true);
  console.log('QUICK', JSON.stringify(q));
  for (const x of q || []) {
    const { data: pi } = await supabase.from('product_ingredients').select('stock_id,quantity_required,variant_name, stocks(name,tracking_method,quantity)').eq('product_id', x.id);
    console.log(x.name, JSON.stringify(pi));
  }
})();
