// VERIFICATION TOOLING ONLY — not application/business logic.
// Sprint 7 dedicated TEST 4 (EXACT topping insufficient) and TEST 6 (unselected topping).
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://pvdzstecfsbxgacbvysk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZHpzdGVjZnNieGdhY2J2eXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NjE1MzIsImV4cCI6MjEwMjMzNzUzMn0.Ov9OeYmILyHoO_SOzGvh_4gxvMnJlElpRo24hhqPAc4');

const PRODUCT_ID = 'purjxdfion'; // "milo": base Milo + topping "pake es batu" (variant "pake es?")

// Exact copy of /pos/page.tsx deduction builder (lines 688-729)
function buildDeductions(recipes: any[], cart: any[]) {
  const stockDelta: Record<string, number> = {};
  for (const cartItem of cart) {
    for (const recipe of recipes.filter(r => r.product_id === cartItem.product.id)) {
      const isBaseRecipe = !recipe.variant_name;
      let matchesVariant = false;
      if (!isBaseRecipe && cartItem.variantChoices) {
        const sel = cartItem.variantChoices[recipe.variant_name] || [];
        if (sel.includes(recipe.choice_name)) matchesVariant = true;
      }
      if (isBaseRecipe || matchesVariant) stockDelta[recipe.stock_id] = (stockDelta[recipe.stock_id] || 0) + recipe.quantity_required * cartItem.quantity;
    }
  }
  return Object.entries(stockDelta).filter(([, a]) => a !== 0).map(([id, amount]) => ({ id, amount }));
}

const snap = async (ids: string[]) => {
  const { data } = await supabase.from('stocks').select('id,name,quantity,usage_since_restock').in('id', ids);
  return Object.fromEntries((data || []).map(s => [s.id, s]));
};
const countMov = async (id: string) => (await supabase.from('inventory_movements').select('id', { count: 'exact', head: true }).eq('stock_id', id)).count;
const txRows = async (txId: string) => ({
  tx: (await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('id', txId)).count,
  items: (await supabase.from('transaction_items').select('id', { count: 'exact', head: true }).eq('transaction_id', txId)).count,
  mov: (await supabase.from('inventory_movements').select('id', { count: 'exact', head: true }).eq('reference_id', txId)).count,
});
const cleanupTx = async (txId: string) => {
  await supabase.from('inventory_movements').delete().eq('reference_id', txId);
  await supabase.from('transaction_items').delete().eq('transaction_id', txId);
  await supabase.from('transactions').delete().eq('id', txId);
};
const check = (label: string, ok: boolean) => { console.log(`  [${ok ? 'OK' : 'XX'}] ${label}`); return ok; };

(async () => {
  const { data: product } = await supabase.from('products').select('*').eq('id', PRODUCT_ID).single();
  const { data: recipes } = await supabase.from('product_ingredients').select('*').eq('product_id', PRODUCT_ID);
  const base = recipes!.find(r => !r.variant_name)!;
  const top = recipes!.find(r => r.variant_name)!;
  const { data: cps } = await supabase.from('stocks').select('id,usage_since_restock').eq('tracking_method', 'CHECKPOINT');
  const cpBefore = JSON.stringify(cps);
  console.log(`Product: ${product.name} | base=${base.stock_id} topping=${top.stock_id} (${top.variant_name}/${top.choice_name})`);
  const ORIG = await snap([base.stock_id, top.stock_id]);
  console.log('ORIGINAL SNAPSHOT', JSON.stringify(ORIG));
  const item = (txId: string, notes: string | null) => [{ transaction_id: txId, product_name: product.name, price: product.price, quantity: 1, notes, supplier_price: 0 }];
  const tx = (id: string) => ({ id, method: 'Cash', total: product.price, cashier_name: 'TEST_SPRINT7', status: 'completed' });
  let t4 = true, t6 = true;

  // ---------- TEST 4 ----------
  console.log('\nTEST 4 — EXACT TOPPING INSUFFICIENT');
  const tx4 = `TEST_S7_T4_${Date.now()}`;
  await supabase.from('stocks').update({ quantity: 0 }).eq('id', top.stock_id); // make topping insufficient
  const pre4 = await snap([base.stock_id, top.stock_id]);
  const movB4 = await countMov(base.stock_id), movT4 = await countMov(top.stock_id);
  const ded4 = buildDeductions(recipes!, [{ product, quantity: 1, variantChoices: { [top.variant_name]: [top.choice_name] } }]);
  console.log('  before:', JSON.stringify(pre4), 'deductions:', JSON.stringify(ded4));
  const { error: e4 } = await supabase.rpc('process_checkout_v2', { p_is_edit: false, p_transaction: tx(tx4), p_transaction_items: item(tx4, top.choice_name), p_titipan_deductions: [], p_stock_deductions: ded4 });
  const post4 = await snap([base.stock_id, top.stock_id]);
  const r4 = await txRows(tx4);
  console.log('  error:', e4?.message);
  console.log('  after:', JSON.stringify(post4), 'rows:', JSON.stringify(r4));
  t4 = check('payload contains base + selected topping', ded4.length === 2) && t4;
  t4 = check('checkout FAIL', !!e4) && t4;
  t4 = check('error is INSUFFICIENT_STOCK', !!e4?.message.includes('INSUFFICIENT_STOCK')) && t4;
  t4 = check('transaction not committed', r4.tx === 0) && t4;
  t4 = check('no transaction_items left', r4.items === 0) && t4;
  t4 = check('no movement for tx', r4.mov === 0) && t4;
  t4 = check('base unchanged', post4[base.stock_id].quantity === pre4[base.stock_id].quantity) && t4;
  t4 = check('topping unchanged', post4[top.stock_id].quantity === pre4[top.stock_id].quantity) && t4;
  t4 = check('no negative stock', post4[base.stock_id].quantity >= 0 && post4[top.stock_id].quantity >= 0) && t4;
  t4 = check('no base/topping movement added', (await countMov(base.stock_id)) === movB4 && (await countMov(top.stock_id)) === movT4) && t4;
  const { data: cps4 } = await supabase.from('stocks').select('id,usage_since_restock').eq('tracking_method', 'CHECKPOINT');
  t4 = check('no checkpoint usage changed', JSON.stringify(cps4) === cpBefore) && t4;
  await cleanupTx(tx4);
  await supabase.from('stocks').update({ quantity: ORIG[top.stock_id].quantity }).eq('id', top.stock_id);
  console.log(`TEST 4 ${t4 ? 'PASS' : 'FAIL'}`);

  // ---------- TEST 6 ----------
  console.log('\nTEST 6 — UNSELECTED TOPPING');
  const tx6 = `TEST_S7_T6_${Date.now()}`;
  const pre6 = await snap([base.stock_id, top.stock_id]);
  const movT6 = await countMov(top.stock_id);
  const ded6 = buildDeductions(recipes!, [{ product, quantity: 1, variantChoices: {} }]);
  console.log('  before:', JSON.stringify(pre6), 'topping movements:', movT6, 'deductions:', JSON.stringify(ded6));
  const { error: e6 } = await supabase.rpc('process_checkout_v2', { p_is_edit: false, p_transaction: tx(tx6), p_transaction_items: item(tx6, null), p_titipan_deductions: [], p_stock_deductions: ded6 });
  const post6 = await snap([base.stock_id, top.stock_id]);
  const r6 = await txRows(tx6);
  const { data: mov6 } = await supabase.from('inventory_movements').select('stock_id,quantity_delta').eq('reference_id', tx6);
  console.log('  error:', e6?.message, '| after:', JSON.stringify(post6), 'rows:', JSON.stringify(r6), 'movements:', JSON.stringify(mov6));
  t6 = check('checkout SUCCESS', !e6 && r6.tx === 1 && r6.items === 1) && t6;
  t6 = check('base consumed per recipe', post6[base.stock_id].quantity === pre6[base.stock_id].quantity - base.quantity_required) && t6;
  t6 = check('base movement recorded', !!mov6?.some(m => m.stock_id === base.stock_id && Number(m.quantity_delta) === -base.quantity_required)) && t6;
  t6 = check('topping quantity unchanged', post6[top.stock_id].quantity === pre6[top.stock_id].quantity) && t6;
  t6 = check('topping usage_since_restock unchanged', post6[top.stock_id].usage_since_restock === pre6[top.stock_id].usage_since_restock) && t6;
  t6 = check('no new topping movement', (await countMov(top.stock_id)) === movT6 && !mov6?.some(m => m.stock_id === top.stock_id)) && t6;
  await cleanupTx(tx6);
  await supabase.from('stocks').update({ quantity: ORIG[base.stock_id].quantity }).eq('id', base.stock_id);
  console.log(`TEST 6 ${t6 ? 'PASS' : 'FAIL'}`);

  // ---------- RESTORE CHECK ----------
  const fin = await snap([base.stock_id, top.stock_id]);
  const { data: cpsF } = await supabase.from('stocks').select('id,usage_since_restock').eq('tracking_method', 'CHECKPOINT');
  const left = (await supabase.from('transactions').select('id').like('id', 'TEST_S7_%')).data;
  const restored = JSON.stringify(fin) === JSON.stringify(ORIG) && JSON.stringify(cpsF) === cpBefore && (left?.length || 0) === 0;
  console.log('\nFINAL SNAPSHOT', JSON.stringify(fin));
  console.log(`DATABASE RESTORED: ${restored ? 'YES' : 'NO'}`);
})();
