ALTER TABLE product_ingredients ADD COLUMN IF NOT EXISTS variant_name text;
ALTER TABLE product_ingredients ADD COLUMN IF NOT EXISTS choice_name text;
