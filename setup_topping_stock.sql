-- Jalankan script ini di menu SQL Editor pada Supabase Dashboard Anda.
-- Ini akan menambahkan kolom is_topping untuk memisahkan bahan baku biasa dengan topping.

ALTER TABLE stocks ADD COLUMN IF NOT EXISTS is_topping BOOLEAN DEFAULT false;

-- Tambahkan opsi untuk Topping di product_ingredients
ALTER TABLE product_ingredients ADD COLUMN IF NOT EXISTS variant_name TEXT;
ALTER TABLE product_ingredients ADD COLUMN IF NOT EXISTS choice_name TEXT;
