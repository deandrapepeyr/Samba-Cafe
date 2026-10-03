-- =============================================
-- SPRINT 1: Database Schema Extension
-- Samba Cafe POS — Inventory System
-- =============================================
-- INSTRUCTIONS:
-- 1. Buka Supabase Dashboard → SQL Editor
-- 2. Paste seluruh SQL ini
-- 3. Klik "Run"
-- =============================================

-- 1. Add new columns to stocks table
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'INGREDIENT';
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS tracking_method TEXT DEFAULT 'EXACT';
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS checkpoint_usage INTEGER NULL;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS usage_since_restock INTEGER DEFAULT 0;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS restock_qty_default NUMERIC NULL;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS restock_price_default INTEGER NULL;

-- 2. Migrate existing is_topping data to item_type
UPDATE stocks SET item_type = 'TOPPING' WHERE is_topping = true;
UPDATE stocks SET item_type = 'INGREDIENT' WHERE is_topping = false OR is_topping IS NULL;

-- 3. Create restocks table
CREATE TABLE IF NOT EXISTS restocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- 4. Create inventory_movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  quantity_delta NUMERIC DEFAULT 0,
  usage_delta INTEGER DEFAULT 0,
  reference_type TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create inventory_consumption_cycles table
CREATE TABLE IF NOT EXISTS inventory_consumption_cycles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
  restock_id UUID REFERENCES restocks(id),
  actual_usage_count INTEGER NOT NULL,
  started_at TIMESTAMPTZ,
  emptied_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable RLS on new tables
ALTER TABLE restocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_consumption_cycles ENABLE ROW LEVEL SECURITY;

-- 7. Create permissive policies (matching existing stocks table pattern)
CREATE POLICY "Allow all for restocks" ON restocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for inventory_movements" ON inventory_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for inventory_consumption_cycles" ON inventory_consumption_cycles FOR ALL USING (true) WITH CHECK (true);
