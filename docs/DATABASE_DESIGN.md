# ROLLZ POS — Database Design Notes

This document describes the intended domain model. It is not a substitute for the actual Prisma schema; adapt names and relations to the chosen Prisma version and project conventions.

## Design principles

- Use PostgreSQL.
- Use UUIDs or another consistent opaque identifier strategy for internal IDs.
- Store monetary amounts as integer paise or a carefully selected PostgreSQL `NUMERIC`/Prisma Decimal strategy. Never use JavaScript floating-point arithmetic for money.
- Store timestamps in UTC in the database and display them in `Asia/Kolkata`.
- Add `createdAt` and `updatedAt` where appropriate.
- Prefer deactivation/archival over deleting records referenced by historical transactions.
- Enforce important invariants with database constraints as well as application validation.
- Scope operational records to a branch from the start.
- Use transactions for finalization and payment workflows.

## Core entities

### Branch
- id
- name
- code
- address/contact fields
- active status
- timestamps

### User and Role
- User: id, display name, username/email, password hash, active status, timestamps
- Role/permission structure or a well-defined enum with backend authorization
- Do not store plaintext passwords.
- Do not rely on frontend-only role checks.

### Category and MenuItem
- Category: id, branch/global scope policy, name, display order, active status
- MenuItem: id, category, name, description, base price, tax category/config reference, active/available status, optional code, timestamps
- Decide explicitly whether menu definitions are global or branch-specific. For the first branch, branch-specific is simplest while still allowing future shared templates.

### ModifierGroup and ModifierOption
- Group: name, selection type, required flag, minimum/maximum selections, active status
- Option: name, extra price, active status, display order
- Validate selection counts and availability on the backend.

### Order
- id
- branch id
- order number / human-readable number
- order type
- status
- cashier/user id
- optional table reference
- subtotal, discount, tax total, grand total
- notes
- timestamps and lifecycle timestamps

Use a unique constraint appropriate to the chosen numbering scheme, such as branch + business date + sequence, if daily numbering is chosen. Do not generate invoice/order numbers by simply querying the current row count.

### OrderItem and selected modifiers
- Order id
- menu item reference where available
- Snapshot item name and base price
- Quantity
- Modifier snapshots (name and price)
- Kitchen notes
- Discount/tax snapshots if needed
- Line totals

Historical invoices must not change when menu data changes.

### Payment
- Order id
- method
- amount
- status
- reference (optional)
- who confirmed it and when
- provider verification metadata only when an actual provider integration exists
- idempotency key or equivalent duplicate-protection strategy

Support split payments only with a clear rule for when an order becomes fully paid.

### Invoice
- Order id
- unique invoice number
- immutable finalized snapshot
- subtotal, discounts, taxes, total
- status and correction/refund references
- finalized by/at
- receipt details needed for reprint

Do not reuse invoice numbers casually. Define cancellation and legal numbering rules before production.

### PrintJob
- order/invoice id
- destination: customer receipt or kitchen
- payload/template version or reconstructable snapshot
- status: pending, printing, printed, failed
- attempt count
- created/updated/printed timestamps
- error message
- requested by and retry audit information

Only create a kitchen print job after the server confirms the order is paid and finalized. Consider creating the customer receipt print job in the same transaction too, then dispatching print jobs after commit.

### CashSession
- branch, cashier, opened/closed timestamps
- opening cash
- expected cash
- counted cash
- variance
- session status

### AuditLog
- actor, action, entity type/id, timestamp, reason and safe metadata
- Never log passwords, tokens, or full payment credentials.

## Later-phase inventory entities

- Ingredient
- Supplier
- Purchase and purchase lines
- StockMovement
- Recipe and recipe lines
- Waste/stock count adjustment
- Expense

Every stock movement should be traceable to its source and must not be silently overwritten.

## Important transaction: finalizing a paid order

In one database transaction:
1. Lock or validate the order so it cannot be finalized twice.
2. Recalculate all prices, discounts, and applicable taxes on the server.
3. Validate payment records and the total paid amount.
4. Mark the order paid/finalized.
5. Generate a unique invoice number and save the invoice snapshot.
6. Create customer receipt print job and kitchen print job.
7. Commit the transaction.

Only after commit should a worker attempt physical printing. If printing fails, the order and invoice remain finalized, and the print job is retryable. Never reverse a valid payment simply because a printer is offline.
