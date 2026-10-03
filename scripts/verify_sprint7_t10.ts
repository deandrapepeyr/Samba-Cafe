// VERIFICATION TOOLING ONLY — TEST 10 snapshot / verify / restore helper.
// Usage: npx tsx scripts/verify_sprint7_t10.ts snapshot | verify | restore
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const supabase = createClient('https://pvdzstecfsbxgacbvysk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZHpzdGVjZnNieGdhY2J2eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NjE1MzIsImV4cCI6MjEwMjMzNzUzMn0.Ov9OeYmILyHoO_SOzGvh_4gxvMnJlElpRo24hhqPAc4');
const STOCK_ID = '34c84f54-f601-4015-92bc-b47be56b83e7'; // Choki choki (base recipe of quick product pyj9khzdun)
const FILE = 'scripts/.t10_snapshot.json';
(async () => {
  const mode = process.argv[2];
  const { data: s } = await supabase.from('stocks').select('quantity').eq('id', STOCK_ID).single();
  if (mode === 'snapshot') {
    const { data: last } = await supabase.from('transactions').select('id,created_at').order('created_at', { ascending: false }).limit(1);
    fs.writeFileSync(FILE, JSON.stringify({ qty: s!.quantity, lastTx: last?.[0] ?? null, at: new Date().toISOString() }));
    console.log('SNAPSHOT', s!.quantity, JSON.stringify(last?.[0]));
    return;
  }
  const snap = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const { data: txs } = await supabase.from('transactions').select('*').gt('created_at', snap.at).order('created_at');
  if (mode === 'verify') {
    console.log('STOCK before', snap.qty, 'after', s!.quantity);
    for (const t of txs || []) {
      const { data: items } = await supabase.from('transaction_items').select('product_name,quantity,price').eq('transaction_id', t.id);
      const { data: mov } = await supabase.from('inventory_movements').select('stock_id,movement_type,quantity_delta,reference_type').eq('reference_id', t.id);
      console.log('TX', JSON.stringify(t), '\n ITEMS', JSON.stringify(items), '\n MOV', JSON.stringify(mov));
    }
    return;
  }
  if (mode === 'restore') {
    for (const t of txs || []) {
      if (t.cashier_name === undefined) continue;
      await supabase.from('inventory_movements').delete().eq('reference_id', t.id);
      await supabase.from('transaction_items').delete().eq('transaction_id', t.id);
      await supabase.from('transactions').delete().eq('id', t.id);
      console.log('removed test tx', t.id);
    }
    await supabase.from('stocks').update({ quantity: snap.qty }).eq('id', STOCK_ID);
    const { data: s2 } = await supabase.from('stocks').select('quantity').eq('id', STOCK_ID).single();
    const { data: left } = await supabase.from('transactions').select('id').gt('created_at', snap.at);
    console.log('RESTORED qty', s2!.quantity, '(orig', snap.qty + ')', 'remaining new tx:', left?.length);
  }
})();
