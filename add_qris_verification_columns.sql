-- add_qris_verification_columns.sql
-- Run this in your Supabase SQL Editor

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by text,
  ADD COLUMN IF NOT EXISTS payment_proof_url text;
