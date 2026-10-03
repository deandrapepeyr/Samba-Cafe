# SAMBA CAFE POS
# MASTER CONTROL PROMPT — STRICT IMPLEMENTATION CONTRACT

IMPORTANT:

This project already has an existing production-oriented architecture.

You are NOT building a new inventory system from scratch.

You are extending the EXISTING Samba Cafe POS system.

The existing system is the source of truth for architecture, naming conventions,
relationships, routes, components, authentication, and existing business behavior.

The specification below defines ONLY the new inventory/recipe/checkpoint/topping
behavior that must be implemented.

==================================================
1. ABSOLUTE RULE — NO IMPROVISATION
==================================================

You MUST NOT:

- invent business rules
- invent database structures unnecessarily
- create duplicate master tables
- rename existing tables unnecessarily
- replace existing architecture without explicit reason
- rewrite unrelated functionality
- remove existing functionality
- change existing business behavior outside this specification
- introduce enterprise inventory concepts
- add features because they "might be useful"
- silently resolve ambiguities
- silently choose between conflicting business rules
- silently change existing POS behavior

If something is not explicitly defined:

DO NOT GUESS.

Report it as:

AMBIGUITY FOUND

and stop before implementing that specific behavior.

==================================================
2. EXISTING SYSTEM MUST BE PRESERVED
==================================================

The existing system already contains:

stocks
products
categories
transactions
transaction_items
product_ingredients
settings

Existing pages include:

/stock
/recipes
/settings
/pos
/history
/reports
/dashboard

These existing structures MUST be reused wherever possible.

DO NOT create:

inventory_items

if `stocks` already performs the inventory-master responsibility.

DO NOT create:

menu_ingredients

if `product_ingredients` already performs the recipe relationship.

The conceptual specification may use generic names such as
"inventory_items" or "menu_ingredients", but implementation MUST map
those concepts to the existing database architecture.

==================================================
3. INVENTORY MASTER
==================================================

`stocks` is the single inventory master.

All physically stocked items belong to `stocks`.

This includes:

- ingredients
- toppings

There must NOT be separate inventory master tables for:

- ingredients
- toppings
- add-ons

==================================================
4. TOPPING ARCHITECTURE
==================================================

Toppings are inventory items.

Existing:

is_topping

must remain supported for backward compatibility.

Add:

item_type

with:

INGREDIENT
TOPPING

Mapping:

is_topping = false
→ item_type = INGREDIENT

is_topping = true
→ item_type = TOPPING

Do NOT remove `is_topping` immediately.

Do NOT break existing code that depends on it.

The new `item_type` becomes the normalized business representation.

==================================================
5. EXISTING RECIPE ARCHITECTURE
==================================================

Existing:

product_ingredients

is the base recipe relationship.

DO NOT create a duplicate:

menu_ingredients

table if `product_ingredients` already provides this relationship.

The conceptual relationship remains:

products
→ product_ingredients
→ stocks

==================================================
6. STOCK TRACKING
==================================================

Each stock item supports:

EXACT
CHECKPOINT

Internal values:

EXACT
CHECKPOINT

User-facing labels:

EXACT
→ Jumlah Pasti

CHECKPOINT
→ Berdasarkan Pemakaian

==================================================
7. EXACT
==================================================

EXACT is for items where physical quantity can reasonably be tracked.

Examples:

- telur
- ayam
- roti
- sosis
- cup
- bottled drinks

Use the existing stock quantity field as the physical stock value.

Do NOT introduce a second current-stock field if the existing
`stocks.quantity` already represents current stock.

==================================================
8. CHECKPOINT
==================================================

CHECKPOINT is for items where exact per-menu physical consumption
is impractical.

Examples:

- garam
- kecap
- saus
- merica
- minyak
- spices

For CHECKPOINT items:

track:

usage_since_restock

and optionally:

checkpoint_usage

checkpoint_usage may be NULL.

NULL is valid.

The user must NOT be forced to guess a checkpoint.

==================================================
9. CHECKPOINT SEMANTICS
==================================================

checkpoint_usage is NOT an exact depletion amount.

It is only a warning threshold.

Example:

usage = 63
checkpoint = 60

means:

"Sudah waktunya cek stok."

It does NOT mean:

"Stock is definitely empty."

Never display an unverified CHECKPOINT item as physically empty.

Only the user can confirm physical depletion using:

Tandai Habis

==================================================
10. RECIPE INPUT PRINCIPLE
==================================================

The recipe UX follows:

DEFAULT FIRST, EXCEPTION ONLY.

When adding an ingredient to a product:

default usage = 1

Do not force the user to manually type quantity for every ingredient.

Example:

Nasi Goreng:

✓ Beras
✓ Telur
✓ Ayam
✓ Garam
✓ Minyak
✓ Kecap

==================================================
11. QUANTITY OVERRIDE
==================================================

If an EXACT item requires a different quantity:

allow:

Ubah jumlah

Example:

Martabak
Telur = 2

The quantity override must remain optional.

Do not show unnecessary advanced controls by default.

==================================================
12. CHECKPOINT RECIPE RULE
==================================================

CHECKPOINT items do NOT require a physical quantity.

Selecting:

Garam

means:

"This product consumes Garam."

One confirmed menu portion increments:

usage_since_restock by 1.

Example:

Nasi Goreng × 3

Garam usage:

+3

Do NOT invent:

3 grams
5 grams
10 grams

etc.

==================================================
13. TOPPING RULE
==================================================

Toppings are OPTIONAL.

Base ingredients are mandatory.

Example:

Es Kopi Susu:

BASE:
Coffee
Milk
Sugar

OPTIONAL:
Boba
Oreo
Cheese Foam

A topping is consumed ONLY when selected by the customer.

==================================================
14. TOPPING PRICE
==================================================

Topping selling price is separate from inventory cost.

Example:

Boba inventory cost:
Rp1.500

Boba customer add-on price:
Rp5.000

HPP:
Rp1.500

Revenue:
Rp5.000

Never mix these values.

==================================================
15. RESTOCK
==================================================

Restock must support:

- quantity
- price
- unit cost
- history
- default/pre-filled values

Previous/default restock values should prefill the next restock form.

The user must still be able to edit them.

==================================================
16. EXACT RESTOCK
==================================================

For EXACT:

new quantity:

existing quantity + actual restock quantity

Example:

20 + 50 = 70

==================================================
17. CHECKPOINT RESTOCK
==================================================

For CHECKPOINT:

usage_since_restock = 0

Start a new consumption cycle.

The previous cycle remains historical.

Do not delete historical consumption.

==================================================
18. RESTOCK HISTORY
==================================================

Every actual restock must remain historical.

Example:

01 Sep
1 kg
Rp20.000

08 Sep
1 kg
Rp21.000

15 Sep
2 kg
Rp39.000

Never overwrite old restock prices.

==================================================
19. CHECKPOINT HISTORY
==================================================

When the user selects:

Tandai Habis

record:

actual_usage_count

for that consumption cycle.

Example:

usage = 63

→ actual_usage_count = 63

==================================================
20. CHECKPOINT RECOMMENDATION
==================================================

Historical actual usage may be used to calculate a recommendation.

Example:

63
59
62
61
60

Average:
61

Display:

Saran checkpoint: 61 penggunaan

Buttons:

[Gunakan]
[Abaikan]

NEVER automatically change the checkpoint.

==================================================
21. ORDER STOCK CONSUMPTION
==================================================

Stock consumption occurs ONLY when an order reaches
the existing valid/confirmed state.

Do NOT consume stock when:

- menu opened
- product viewed
- cart opened
- item added to cart
- checkout opened
- draft order created

==================================================
22. EXACT ORDER CONSUMPTION
==================================================

Formula:

recipe quantity
×
order quantity

Example:

Telur = 1 per menu

Nasi Goreng × 3

→ consume 3 Telur

==================================================
23. CHECKPOINT ORDER CONSUMPTION
==================================================

Formula:

usage occurrence
×
order quantity

Example:

Garam used by Nasi Goreng.

Nasi Goreng × 3

→ usage +3

Never convert it into an invented gram/ml amount.

==================================================
24. TOPPING CONSUMPTION
==================================================

If topping is NOT selected:

consume nothing.

If topping IS selected:

consume according to the topping's configured usage.

==================================================
25. ATOMICITY
==================================================

Stock consumption and order confirmation must be handled atomically
where the current architecture supports transactional behavior.

Do not leave a state where:

order succeeds
but stock update partially fails

or:

stock is consumed
but order creation fails.

==================================================
26. IDEMPOTENCY
==================================================

The same order confirmation must never consume stock twice.

Protect against:

- double click
- refresh
- retry
- network retry
- duplicate request

Use the existing transaction/order ID as the idempotency reference
where appropriate.

==================================================
27. ORDER SNAPSHOT
==================================================

Historical orders must remain historically accurate.

If the current system already stores:

transaction_items.product_name
transaction_items.price
transaction_items.supplier_price

preserve those fields.

When toppings are selected, store the relevant topping information
and price snapshot according to the existing architecture.

Past orders must NOT change when:

- menu price changes
- topping price changes
- recipe changes
- topping configuration changes

==================================================
28. HPP
==================================================

EXACT:

HPP =
effective recipe quantity
×
unit cost

CHECKPOINT:

If checkpoint exists:

estimated cost per usage =
latest applicable restock price
/
checkpoint usage

If no checkpoint exists and there is insufficient historical basis:

display:

Belum dapat dihitung

Never fabricate a cost.

==================================================
29. HPP TRANSPARENCY
==================================================

If HPP contains CHECKPOINT-derived values,
clearly mark them as:

Estimated

Do not present estimated HPP as exact.

==================================================
30. LOW STOCK
==================================================

EXACT:

quantity > minimum
→ Aman

quantity <= minimum and > 0
→ Stok Menipis

quantity <= 0
→ Habis

CHECKPOINT:

usage < checkpoint
→ Aman

usage >= checkpoint
→ Perlu Dicek

Do NOT automatically mark CHECKPOINT as Habis.

==================================================
31. NEGATIVE STOCK — DO NOT GUESS
==================================================

The existing application currently has its own behavior for insufficient
stock.

DO NOT independently change this behavior unless the user has explicitly
approved the new policy.

If implementation of atomic stock handling requires a decision about
insufficient stock:

STOP and report:

NEGATIVE STOCK POLICY REQUIRES CONFIRMATION

Do not invent the policy.

==================================================
32. TITIPAN — PRESERVE
==================================================

The existing application contains titipan-related behavior.

The inventory specification does not redefine titipan.

Therefore:

PRESERVE ALL EXISTING TITIPAN BEHAVIOR.

Do not refactor or redesign titipan as part of this implementation.

Do not remove:

is_titipan
titipan_name
supplier_price

or related existing logic unless explicitly requested.

==================================================
33. EXISTING FUNCTIONALITY
==================================================

Before modifying anything:

inspect:

/stock
/recipes
/settings
/pos
/history
/reports
/dashboard

Understand their dependencies.

Do not break unrelated functionality.

==================================================
34. DATABASE MIGRATION RULE
==================================================

Before creating a new table:

check whether an equivalent table already exists.

Before creating a new column:

check whether an equivalent field already exists.

Before creating a new relationship:

check whether an equivalent relationship already exists.

Never duplicate an existing concept simply because the specification
uses a different generic name.

==================================================
35. SPRINT GATES
==================================================

Implementation MUST follow:

SPRINT
→ IMPLEMENT
→ TEST
→ REPORT
→ DEMO/REVIEW
→ USER CONFIRMATION
→ NEXT SPRINT

Never automatically continue to the next sprint.

After each sprint:

STOP.

Wait for explicit user approval.

Accepted commands:

"Lanjut Sprint X"

or equivalent explicit approval.

==================================================
36. SPRINT 1
==================================================

Only implement:

- stocks schema extension
- checkpoint fields
- item_type
- tracking_method
- restock defaults
- restocks table
- inventory_movements table
- inventory_consumption_cycles table
- backward-compatible migration
- existing functionality verification

DO NOT redesign UI.

STOP after Sprint 1.

==================================================
37. SPRINT 2
==================================================

Only implement:

- EXACT UI
- CHECKPOINT UI
- tracking selector
- low stock
- checkpoint warning
- Tandai Habis
- status badges

STOP after Sprint 2.

==================================================
38. SPRINT 3
==================================================

Only implement:

- Restock
- defaults
- history
- unit cost
- movement recording

STOP after Sprint 3.

==================================================
39. SPRINT 4
==================================================

Only implement:

- consumption cycles
- mark empty
- historical usage
- checkpoint recommendation
- manual checkpoint override

STOP after Sprint 4.

==================================================
40. SPRINT 5
==================================================

Only implement:

- recipe integration
- default usage 1
- optional quantity override
- CHECKPOINT usage semantics
- recipe UX

STOP after Sprint 5.

==================================================
41. SPRINT 6
==================================================

Only implement:

- topping integration
- item_type TOPPING
- topping selling price
- topping configuration
- conditional topping consumption

STOP after Sprint 6.

==================================================
42. SPRINT 7
==================================================

Only implement:

- atomic stock processing
- EXACT consumption
- CHECKPOINT usage
- topping consumption
- idempotency
- movement records
- order snapshots

STOP after Sprint 7.

==================================================
43. SPRINT 8
==================================================

Only implement:

- HPP
- exact HPP
- checkpoint estimated HPP
- unknown HPP
- HPP breakdown

STOP after Sprint 8.

==================================================
44. SPRINT 9
==================================================

Only implement:

- UI consistency
- Indonesian terminology
- minimal input
- loading states
- confirmations
- error messages
- responsive/mobile UX

STOP after Sprint 9.

==================================================
45. SPRINT 10
==================================================

Run all defined acceptance tests.

Do not claim success if a test was not actually executed.

For every test:

PASS
FAIL
BLOCKED

If BLOCKED:

explain exactly why.

STOP after Sprint 10.

==================================================
46. TESTING REQUIREMENT
==================================================

At minimum verify:

1. EXACT consumption
2. EXACT quantity override
3. CHECKPOINT increment
4. CHECKPOINT threshold
5. NULL checkpoint
6. Mark empty
7. Restock reset
8. topping not selected
9. topping selected
10. topping price snapshot
11. recipe change does not modify old order
12. duplicate confirmation
13. checkpoint HPP
14. unknown checkpoint HPP

==================================================
47. FINAL REPORT FORMAT
==================================================

After each sprint report:

# Sprint X Report

## 1. Completed
List actual completed work.

## 2. Files Changed
Only actual files.

## 3. Database Changes
Only actual changes.

## 4. Business Logic
Explain actual implemented behavior.

## 5. Tests
Show actual test results.

## 6. Existing Behavior Preserved
Explain what was intentionally not changed.

## 7. Issues / Ambiguities
List unresolved items.

## 8. Next Sprint
Describe what WOULD happen next.

Then:

STOP.

Do not proceed until user confirms.

==================================================
48. FINAL RULE
==================================================

The hierarchy of authority is:

1. Existing working application architecture
2. This implementation specification
3. Explicit user instruction
4. Developer conventions
5. Your own implementation preference

Your own preference is NEVER sufficient reason to change
business logic.

If there is uncertainty:

DO NOT GUESS.

If there is a conflict:

DO NOT SILENTLY RESOLVE.

If there is an existing implementation:

DO NOT DUPLICATE.

If something is not specified:

DO NOT INVENT.

If a sprint is complete:

DO NOT CONTINUE.

WAIT FOR USER CONFIRMATION.

==================================================

END OF MASTER CONTROL PROMPT

==================================================
LOCKED DECISIONS (User Approved 2026-10-03)
==================================================

1. DO NOT create inventory_items. stocks IS the inventory master.
2. Keep is_topping for backward compatibility. Add item_type alongside it.
3. DO NOT create menu_ingredients. product_ingredients IS the recipe table.
4. Toppings stay in stocks with item_type=TOPPING.
5. DO NOT touch titipan system. Preserve exactly as-is.
6. Negative stock policy: DEFER to Sprint 7. Must get explicit user approval.
