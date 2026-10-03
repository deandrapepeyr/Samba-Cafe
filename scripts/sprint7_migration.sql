-- =============================================
-- SPRINT 7: Atomic Inventory Transaction
-- =============================================
-- INSTRUCTIONS:
-- 1. Buka Supabase Dashboard → SQL Editor
-- 2. Paste seluruh SQL ini
-- 3. Klik "Run"
-- =============================================

CREATE OR REPLACE FUNCTION process_checkout_v2(
  p_is_edit boolean,
  p_transaction jsonb,
  p_transaction_items jsonb,
  p_titipan_deductions jsonb,
  p_stock_deductions jsonb
) RETURNS jsonb AS $$
DECLARE
  v_tx_id text;
  v_stock record;
  v_deduction record;
  v_titipan record;
BEGIN
  v_tx_id := p_transaction->>'id';

  IF p_is_edit THEN
    -- Edit Mode
    IF NOT EXISTS (SELECT 1 FROM transactions WHERE id = v_tx_id) THEN
      RAISE EXCEPTION 'Transaction % does not exist.', v_tx_id;
    END IF;

    UPDATE transactions SET 
      method = p_transaction->>'method',
      total = (p_transaction->>'total')::numeric,
      status = p_transaction->>'status',
      cash_received = (p_transaction->>'cash_received')::numeric,
      customer_name = p_transaction->>'customer_name'
    WHERE id = v_tx_id;
    
    DELETE FROM transaction_items WHERE transaction_id = v_tx_id;
    
    INSERT INTO transaction_items (transaction_id, product_name, price, quantity, notes, supplier_price)
    SELECT v_tx_id, x.product_name, x.price, x.quantity, x.notes, x.supplier_price
    FROM jsonb_to_recordset(p_transaction_items) AS x(product_name text, price numeric, quantity int, notes text, supplier_price numeric);

  ELSE
    -- Insert Mode / Idempotency Check
    IF EXISTS (SELECT 1 FROM transactions WHERE id = v_tx_id) THEN
      -- Transaction already processed successfully previously
      RETURN jsonb_build_object('success', true, 'message', 'Transaction already exists (idempotent)');
    END IF;

    INSERT INTO transactions (id, method, total, cashier_name, status, cash_received, customer_name)
    VALUES (
      v_tx_id, 
      p_transaction->>'method', 
      (p_transaction->>'total')::numeric, 
      p_transaction->>'cashier_name', 
      p_transaction->>'status', 
      (p_transaction->>'cash_received')::numeric, 
      p_transaction->>'customer_name'
    );
    
    INSERT INTO transaction_items (transaction_id, product_name, price, quantity, notes, supplier_price)
    SELECT v_tx_id, x.product_name, x.price, x.quantity, x.notes, x.supplier_price
    FROM jsonb_to_recordset(p_transaction_items) AS x(product_name text, price numeric, quantity int, notes text, supplier_price numeric);
  END IF;

  -- Titipan Deductions (Reverted to original behavior: silent clamp to 0)
  FOR v_titipan IN SELECT * FROM jsonb_to_recordset(p_titipan_deductions) AS x(id text, amount int)
  LOOP
    IF v_titipan.amount <> 0 THEN
      -- The original frontend did: const newStock = Math.max(0, (p.stock || 0) - delta);
      UPDATE products 
      SET stock = GREATEST(0, stock - v_titipan.amount)
      WHERE id = v_titipan.id;
    END IF;
  END LOOP;

  -- Exact & Checkpoint Stock Deductions (Option A)
  FOR v_deduction IN SELECT * FROM jsonb_to_recordset(p_stock_deductions) AS x(id uuid, amount numeric)
  LOOP
    IF v_deduction.amount <> 0 THEN
      SELECT * INTO v_stock FROM stocks WHERE id = v_deduction.id FOR UPDATE;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock item not found: %', v_deduction.id;
      END IF;

      IF v_stock.tracking_method = 'CHECKPOINT' THEN
        -- CHECKPOINT: allow negative, increment usage_since_restock
        UPDATE stocks 
        SET usage_since_restock = usage_since_restock + v_deduction.amount
        WHERE id = v_deduction.id;
        
        -- Insert movement for tracking
        INSERT INTO inventory_movements (stock_id, movement_type, usage_delta, reference_type, reference_id)
        VALUES (v_deduction.id, 'CONSUMPTION', v_deduction.amount, 'TRANSACTION', v_tx_id);
      ELSE
        -- EXACT: Option A strict blocking if insufficient
        IF v_stock.quantity - v_deduction.amount < 0 THEN
           RAISE EXCEPTION 'INSUFFICIENT_STOCK: Stok % tidak mencukupi. Tersedia %, dibutuhkan %.', v_stock.name, v_stock.quantity, v_deduction.amount;
        END IF;

        UPDATE stocks 
        SET quantity = quantity - v_deduction.amount,
            last_updated = NOW()
        WHERE id = v_deduction.id;
        
        -- Insert movement for tracking
        INSERT INTO inventory_movements (stock_id, movement_type, quantity_delta, reference_type, reference_id)
        VALUES (v_deduction.id, 'CONSUMPTION', -v_deduction.amount, 'TRANSACTION', v_tx_id);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
