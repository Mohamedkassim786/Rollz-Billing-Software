# ROLLZ POS — Project Specification

## 1. Product overview

ROLLZ POS is a restaurant point-of-sale and management application for a fast-food restaurant. Its initial users are the owner/administrator and cashier. Kitchen orders are printed on a dedicated thermal printer after payment confirmation.

## 2. Restaurant menu categories

Initial example categories:
- Rolls
- Burgers
- Grill
- Loaded Fries
- Kebabs
- Starters
- Sandwiches
- Beverages
- Combos
- Add-ons

These are editable examples, not hard-coded categories. The administrator must be able to add, rename, reorder, deactivate, and manage categories and products.

## 3. Main modules

### 3.1 Authentication and roles
- First-run owner/admin setup.
- Secure login and logout.
- Roles and permissions enforced by the backend.
- Initial roles: Owner/Admin, Manager, Cashier, Kitchen (future display or ticket management).
- Never ship a hard-coded production password.
- Passwords must be hashed using a modern password-hashing library.

### 3.2 Restaurant and branch settings
- Restaurant name and logo.
- Address and contact details.
- Applicable tax registration details, when relevant.
- Receipt header/footer.
- Currency: INR (₹) initially.
- Time zone: Asia/Kolkata.
- Invoice numbering configuration.
- One branch at launch, but model branch ownership from the start.
- Do not add multi-branch UI complexity until the single-branch workflow is reliable.

### 3.3 Menu management
- Categories and menu items.
- Item name, short description, price, tax category, SKU/code (optional), availability, and display order.
- Enable/disable an item without deleting historic order references.
- Modifier groups and options, such as spice level, cheese, sauces, extra patty, extra meat, and toppings.
- Support required single-choice groups and optional/multiple-choice groups.
- Configurable extra prices.
- Snapshot item name, base price, modifier names, and modifier prices into each order item so historic bills do not change when menu prices are edited.

### 3.4 POS billing
- Fast category navigation and product search.
- Add/remove items and change quantities.
- Select modifiers and enter kitchen notes.
- Order types: takeaway and dine-in at minimum; delivery can be enabled/configured later.
- Optional table assignment for dine-in.
- Show subtotal, discounts, applicable taxes, rounding (if configured), and total.
- Hold/resume cart only if it can be implemented without losing data.
- Require authorization for voids, discounts above configured limits, and refunds.
- Show a clear confirmation before final payment.
- Prevent accidental duplicate submissions.

### 3.5 Payments
- Initial payment methods: cash, UPI, card, and split tender recording.
- Cash payment can be confirmed by cashier after receiving cash.
- UPI/card terminal payments must not be claimed successful merely because the cashier clicked a button. Unless a payment provider integration verifies the payment, record these as manually confirmed external payments with a clear audit trail.
- Online payment gateway integration is optional and will require internet connectivity.
- Record amount tendered and change due for cash.
- Payment and order finalization must use database transactions and idempotency protections.

### 3.6 Invoices and receipts
- Generate a unique, persistent bill/invoice number.
- Store a snapshot of restaurant details, item prices, modifiers, discounts, tax breakdown, and totals at finalization.
- Customer receipt and kitchen ticket are different print formats and different destinations.
- Reprints must be marked as reprints where appropriate and logged.
- Do not silently edit a finalized invoice. Use controlled cancellation, refund, or correction records.

### 3.7 Kitchen printing
- A kitchen print job is created only after payment is confirmed and the order is finalized.
- Print only food preparation information: order number, order type, time, items, quantities, modifiers, and kitchen notes.
- Do not include sensitive payment information or unnecessary customer details.
- Separate customer receipt and kitchen printer destinations.
- Maintain print-job states such as pending, printing, printed, and failed.
- Show failed jobs clearly and provide an authorized retry action.
- Do not claim that software can guarantee exactly-once physical printing: a printer may print a ticket even if the acknowledgement is lost. Use job IDs, print status, visible retry controls, and duplicate/reprint labels to reduce confusion.
- Printer hardware is not purchased yet. Use a mock/development printer adapter and design an interface that can later support compatible ESC/POS printers over USB or LAN.
- Do not bind implementation to a guessed printer model, COM port, USB identifier, or vendor SDK.

### 3.8 Cash sessions
- Opening cash amount.
- Cash sales and cash refunds during the session.
- Cash paid in/out with reason and authorization.
- Expected closing cash, counted closing cash, and variance.
- Session close report.
- Avoid treating UPI/card receipts as cash in the drawer.

### 3.9 Inventory (later phase)
- Ingredients, units, suppliers, purchases, stock movements, wastage, and stock counts.
- Optional recipe/BOM per menu item.
- Deduct estimated ingredient quantities according to a documented event policy.
- Track stock corrections and wastage; never silently overwrite stock.
- Inventory accuracy depends on configured recipes and staff recording purchases, wastage, and adjustments.

### 3.10 Reports (later phase)
- Sales by day/date range.
- Order count and average order value.
- Item/category sales.
- Payment method totals.
- Discounts, voids, refunds, and tax summaries.
- Cash session closing.
- Inventory and expenses when those modules are implemented.
- Clearly distinguish sales revenue, gross margin, and net profit.

## 4. Local-first operating requirements

- Core application, API, database, menu, billing, local printing, and reports should work without internet.
- Keep frontend assets bundled locally; avoid runtime dependencies on remote fonts, CDNs, or external APIs for core POS operation.
- A single computer runs all services initially.
- LAN access is a future-ready capability, not a requirement to expose the server to the public internet.
- If the server computer is off, other devices cannot use the centralized system.
- Local database backups must be copied to a separate disk or other independent storage. A backup stored only on the same disk is not sufficient protection against disk failure.
- Online payment gateways and cloud access from outside the restaurant require internet.

## 5. Non-functional requirements

- Fast, keyboard-friendly POS workflow.
- Clear errors and recoverable failures.
- Correct currency arithmetic; use integer minor units (paise) or a safe decimal strategy, never binary floating-point for financial calculations.
- Database constraints for important invariants.
- Transactions around order finalization, payment records, invoice creation, and print-job creation.
- Audit logs for sensitive operations.
- Responsive interface for future tablet/LAN use.
- No destructive database reset in production.
- Tests for tax calculations, totals, discounts, payment transitions, invoice numbering, and kitchen-print eligibility.

## 6. Out of scope for the first milestone

- Customer mobile application.
- QR ordering.
- Loyalty points.
- Delivery partner integrations.
- Online ordering website.
- Cloud multi-branch dashboard.
- Automatic payment-provider verification until a provider and hardware/workflow are selected.

These can be considered after core billing and printing are stable.
