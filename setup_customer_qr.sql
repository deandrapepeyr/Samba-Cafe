-- setup_customer_qr.sql
-- Run this in your Supabase SQL Editor

-- 1. Add new columns to transactions table
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS order_source text DEFAULT 'POS',
  ADD COLUMN IF NOT EXISTS customer_session_id text,
  ADD COLUMN IF NOT EXISTS payment_status text;

-- 2. Update existing rows to have order_source = 'POS'
UPDATE transactions 
  SET order_source = 'POS' 
  WHERE order_source IS NULL;

-- Note: payment_status is left NULL for existing walk-in POS orders 
-- because they are essentially 'PAID' or 'UNPAID' based on their method/status logic already.
