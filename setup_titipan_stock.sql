-- Add stock column to products table for tracking titipan inventory
ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0;
