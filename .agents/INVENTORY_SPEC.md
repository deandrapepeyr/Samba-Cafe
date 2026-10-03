# SAMBA CAFE POS — INVENTORY, RECIPE, TOPPING, HPP & CHECKPOINT STOCK SYSTEM

**IMPORTANT**: This is an implementation specification, not a brainstorming request.

You MUST implement exactly the business rules, data relationships, stock behavior, HPP behavior, and UX principles defined below.

Do NOT invent, simplify, reinterpret, rename, remove, merge, or add business logic unless explicitly instructed.

If something in the existing codebase conflicts with this specification, STOP and report the conflict before changing the business logic.

The goal is to produce a practical cafe inventory system with minimal manual input, not an enterprise inventory system.

---

## 1. PRIMARY OBJECTIVE

Implement an inventory and recipe system for Samba Cafe POS.

The system must support:
- Inventory/Bahan management.
- Exact physical stock tracking.
- Checkpoint-based consumption tracking for ingredients that are difficult to measure.
- Menu recipes.
- Optional toppings/add-ons.
- Automatic stock consumption when an order is confirmed.
- Restock management.
- Restock history.
- Low-stock warnings.
- HPP calculation.
- Usage history for checkpoint items.
- Automatic checkpoint recommendations based on actual historical consumption.
- Minimal manual input.
- Safe, atomic, idempotent stock processing.
- Historical order accuracy even when recipes change later.

The system must remain simple enough for a small cafe operator to use every day.

---

## 2. NON-NEGOTIABLE DEVELOPMENT RULES

### 2.1 DO NOT IMPROVISE BUSINESS LOGIC

Do not add business rules simply because they seem useful.

For example, DO NOT automatically add:
- batch management
- expiry management
- supplier management
- purchase orders
- warehouse management
- multi-outlet stock
- accounting
- FIFO / FEFO
- automatic stock opname
- complicated unit conversion
- AI forecasting
- automatic purchasing
- advanced procurement
- complicated inventory valuation
- separate ingredient master
- separate topping inventory
- separate recipe master

unless explicitly requested later.

### 2.2 EXISTING SYSTEM MUST BE INSPECTED FIRST

Before modifying anything:
- Inspect the existing project structure.
- Inspect existing database/schema.
- Inspect existing inventory tables.
- Inspect existing menu tables.
- Inspect existing order tables.
- Inspect existing authentication/authorization.
- Inspect existing UI components.
- Inspect existing API/service layer.
- Inspect existing stock logic if any.
- Identify reusable components.

Do NOT immediately create new tables/files.

First determine whether an equivalent structure already exists.

**Rule**: If an existing table/function/component already performs the required responsibility: **EXTEND OR REUSE IT.** Do not create a duplicate implementation.

---

## 3. CORE BUSINESS PRINCIPLE

The entire system follows this principle:

> Inventory is the single source of truth for anything that is physically purchased, stored, restocked, and consumed.

There must be ONE inventory master. Ingredients and toppings are NOT separate inventory systems.

---

## 4. INVENTORY MASTER

Use one inventory table/entity: `inventory_items`

Each inventory item represents something physically stocked by the cafe.

Examples: Beras, Telur, Ayam, Garam, Minyak, Kecap, Keju, Oreo, Boba, Whipped Cream

---

## 5. INVENTORY ITEM TYPE

Every inventory item has a type. Allowed values:
- `INGREDIENT` — Used as part of the normal/base recipe (Beras, Telur, Ayam, Garam, Minyak, Kecap, Susu, Kopi)
- `TOPPING` — An optional add-on that customers may select (Boba, Oreo, Keju, Whipped Cream, Extra Cheese)

### 5.1 IMPORTANT
Do NOT create `ingredients` and `toppings` as separate inventory master tables.
Instead: `inventory_items` contains both. Differentiate them using `item_type`.

---

## 6. STOCK TRACKING METHODS

Every inventory item has exactly one stock tracking method. Allowed values:
- `EXACT`
- `CHECKPOINT`

Recommended UI labels:
- Jumlah Pasti
- Berdasarkan Pemakaian

---

## 7. EXACT STOCK

EXACT is used when stock can reasonably be counted/measured.

Examples: Telur = 30 pcs, Ayam = 5 kg, Boba = 2 kg, Cup = 100 pcs

The system maintains `current_stock` which represents the system's current physical-stock estimate.

---

## 8. CHECKPOINT STOCK

CHECKPOINT is specifically for ingredients where exact per-menu consumption is impractical.

Examples: Garam, Merica, Minyak, Kecap, Saus, Bumbu, Spices

The system MUST NOT pretend it knows the exact physical stock after every sale.

Instead it tracks: `usage_since_restock`

Example: Garam, Restock: 1 kg, Usage: 1, 2, 3, ... 63

When the physical salt is actually empty, the user can select "Tandai Habis"

The system records: `actual_usage_count = 63`
This means: The previous restock lasted approximately 63 usages.

---

## 9. CHECKPOINT IS NOT AN EXACT STOCK VALUE

A checkpoint does NOT mean "Stock is definitely empty at 63."
It means: "Based on historical usage, the user should check the physical stock around 63 usages."

Therefore: checkpoint = warning/checkpoint, NOT guaranteed physical depletion.

---

## 10. CHECKPOINT STATUS

For a CHECKPOINT item:

**Before checkpoint**: Usage: 37, Checkpoint: 60 → Status: `NORMAL`

**At or beyond checkpoint**: Usage: 60+ → Status: `CHECK_STOCK`

UI message: "Sudah waktunya cek stok" or "Perlu Dicek"

DO NOT automatically display HABIS / OUT OF STOCK unless the user explicitly marks the item as empty.

---

## 11. CHECKPOINT CAN BE EMPTY INITIALLY

A new CHECKPOINT item may have `checkpoint_usage = NULL`. UI: "Belum diketahui". This is valid. DO NOT force the user to enter a checkpoint.

---

## 12. LEARNING CHECKPOINT FROM ACTUAL USAGE

The system should learn from actual depletion history.

Example cycles: 63, 59, 62, 61, 60 → Average = 61

Show: "Saran checkpoint: 61 penggunaan"

But: **NEVER automatically change the user's checkpoint.** The user must explicitly confirm.

---

## 13. CHECKPOINT HISTORY

Maintain historical consumption cycles via `inventory_consumption_cycles`.

Store: id, inventory_item_id, restock_id, actual_usage_count, started_at, emptied_at, created_at

---

## 14-16. RESTOCK SYSTEM

Every inventory item must support Restock. Form should use previous/default values to minimize typing.

Must distinguish between Default/template and Actual restock.

---

## 17. RESTOCK HISTORY

Every restock must be stored as historical data. Historical prices must NOT be overwritten.

---

## 18. UNIT COST

Unit cost should be calculated from restock data. Do not require the user to manually type unit cost if it can be calculated.

---

## 19. INVENTORY DATA MODEL

```
inventory_items:
  id, name, item_type, tracking_method, unit,
  current_stock, minimum_stock,
  restock_quantity_default, restock_price_default,
  checkpoint_usage, usage_since_restock,
  created_at, updated_at
```

---

## 20. FIELD RULES

**EXACT**: current_stock, minimum_stock, unit are relevant.
**CHECKPOINT**: usage_since_restock, checkpoint_usage are relevant. checkpoint_usage may be NULL.

---

## 21-24. RECIPE SYSTEM

Menu → menu_ingredients → inventory_items

Recipe creation: Default first, exception only. Default usage = 1. Advanced quantity only when needed.

---

## 25. DECIMAL QUANTITY

Quantity must respect the inventory unit. Telur → integer, Beras → decimal allowed.

---

## 26-27. CHECKPOINT ITEMS IN RECIPES

CHECKPOINT item does NOT require exact recipe quantity. Each confirmed sale increments usage_since_restock.

For EXACT: recipe quantity = physical consumption
For CHECKPOINT: recipe relation = usage occurrence

---

## 28-34. TOPPING ARCHITECTURE

Toppings use inventory_items with item_type = TOPPING.

Menu → menu_toppings → inventory_items (TOPPING)

Topping selling price ≠ inventory cost. Toppings only consumed when selected by customer.

---

## 35. ORDER SNAPSHOT REQUIREMENT

Store relevant topping/menu pricing in the order data. Historical orders must NOT change if prices/recipes change later.

---

## 36-40. AUTOMATIC STOCK DEDUCTION

Stock consumed only on order confirmation. Not on view/cart/draft.

EXACT: subtract recipe quantity × order quantity
CHECKPOINT: increment usage_since_restock × order quantity
TOPPING EXACT: subtract topping usage × order quantity (only if selected)
TOPPING CHECKPOINT: increment usage × order quantity (only if selected)

---

## 41-42. ATOMIC & IDEMPOTENT STOCK PROCESSING

Stock deduction and order confirmation must be atomic.
Same order must never consume stock twice (idempotency).

---

## 43. CANCELLATION / REFUND

If system supports cancellation: restore stock/usage. If not specified: preserve current behavior and report.

---

## 44-45. STOCK MOVEMENT HISTORY

Maintain inventory_movements for auditability. Types: RESTOCK, SALE, ADJUSTMENT, RETURN.

---

## 46-49. LOW STOCK & CHECKPOINT WARNING

EXACT: NORMAL → LOW STOCK → OUT OF STOCK
CHECKPOINT: NORMAL → CHECK_STOCK (Perlu Dicek)

Mark Empty: Records actual_usage_count, closes consumption cycle, creates history.
Checkpoint Recommendation: Show average from history, user must confirm.

---

## 50-56. HPP

HPP = base recipe HPP + selected toppings HPP

EXACT: usage_quantity × unit_cost
CHECKPOINT: estimated (restock_price / checkpoint_usage). If checkpoint NULL → "Belum dapat dihitung"

Clearly indicate estimates. Never confuse selling price with inventory cost.

---

## 57-64. UX PRINCIPLES

Minimal input. Default first, exception only. Clean, modern, practical, mobile-friendly.
Use Indonesian terminology: Bahan, Stok, Resep, Topping, Restock, HPP, Perlu Dicek, Tandai Habis.

---

## 65-79. DATA RELATIONSHIPS

One inventory master for both ingredients and toppings.
menu_ingredients for base recipe, menu_toppings for optional add-ons.

---

## 80. POSSIBLE DATA MODEL

```sql
inventory_items (id, name, item_type, tracking_method, unit, current_stock, minimum_stock, restock_quantity_default, restock_price_default, checkpoint_usage, usage_since_restock, created_at, updated_at)
menus (id, name, price, category, created_at, updated_at)
menu_ingredients (id, menu_id, inventory_item_id, usage_quantity, created_at, updated_at)
menu_toppings (id, menu_id, inventory_item_id, selling_price, usage_quantity, created_at, updated_at)
restocks (id, inventory_item_id, quantity, price, unit_cost, created_at, created_by)
inventory_movements (id, inventory_item_id, movement_type, quantity_delta, usage_delta, reference_type, reference_id, created_at)
inventory_consumption_cycles (id, inventory_item_id, restock_id, actual_usage_count, started_at, emptied_at, created_at)
```

---

## 81-93. RULES SUMMARY

- Optional fields must remain optional
- No fake precision
- No fake physical stock for checkpoint items
- Restock resets usage_since_restock for CHECKPOINT, adds to current_stock for EXACT
- HPP should not require extra data entry
- HPP must be transparent about estimates
- Human-readable errors
- Loading states on buttons
- Confirmation for destructive actions
- No unnecessary dashboard complexity

---

## 94. IMPLEMENTATION ORDER

1. Inspect existing system
2. Inventory data model
3. EXACT / CHECKPOINT tracking
4. Restock
5. Recipe
6. Topping/add-on
7. Order consumption
8. HPP
9. Checkpoint history
10. Checkpoint recommendations
11. UI/UX refinement
12. Testing

---

## 95. TEST CASES

1. EXACT ingredient consumption
2. EXACT ingredient with quantity override
3. CHECKPOINT usage increment
4. CHECKPOINT reached status
5. CHECKPOINT unknown (NULL)
6. Mark empty
7. Restock reset
8. Topping not selected (no consumption)
9. Topping selected (consumption)
10. Topping price snapshot
11. Recipe change doesn't affect old orders
12. Double request idempotency
13. CHECKPOINT HPP calculation
14. Unknown checkpoint HPP

---

## 96. ACCEPTANCE CRITERIA

See full checklist in specification.

---

## 97-100. ANTI-IMPROVISATION & FINAL RULES

Classify every change as REQUIRED / OPTIONAL / NOT SPECIFIED.
Only implement REQUIRED. Report ambiguities as AMBIGUITY FOUND.
Do not overengineer. Keep it simple, practical, fast, reliable, minimal input.
