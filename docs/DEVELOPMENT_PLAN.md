# ROLLZ POS — Development Plan

## Milestone 0: Environment and repository
- Create `client` and `server` applications.
- Add root documentation and `.gitignore`.
- Confirm Node.js and npm versions.
- Install and start PostgreSQL locally.
- Create a dedicated database and database user for the application.
- Add `.env.example`; keep real `.env` out of Git.
- Confirm package versions before writing Prisma configuration.
- Add a health-check endpoint and verify the frontend can reach the backend.

**Acceptance criteria**
- Frontend starts locally.
- Backend starts locally.
- Backend reports healthy status.
- Backend can connect to PostgreSQL.
- No secrets are committed.

## Milestone 1: Foundation and first-run setup
- Establish shared API response/error conventions.
- Add structured server-side validation.
- Add secure authentication and session/token handling.
- Add first-run owner setup; disable public owner creation after setup.
- Add role/permission middleware.
- Add branch and restaurant settings.
- Add audit logging for login and sensitive actions.

**Acceptance criteria**
- Owner can be created securely once.
- Invalid credentials are rejected.
- Protected endpoints reject unauthenticated requests.
- Role permissions are tested on the backend.

## Milestone 2: Menu and modifiers
- CRUD for categories and menu items.
- CRUD for modifier groups/options.
- Required and optional modifier rules.
- Availability toggle.
- Currency-safe prices.
- Menu screen for POS.

**Acceptance criteria**
- Admin can create and edit categories/items.
- Inactive items cannot be added to new orders.
- Modifier selection is validated on the backend.
- Historical item snapshots remain unchanged after menu edits.

## Milestone 3: POS cart and order draft
- POS layout optimized for mouse and keyboard.
- Category tabs, product grid, search, cart.
- Quantity and modifier editing.
- Order type and optional table selection.
- Kitchen notes.
- Server-side price and tax calculation; never trust totals submitted by the browser.
- Draft order persistence/hold-resume if included.

**Acceptance criteria**
- Invalid or unavailable items are rejected by the server.
- Server calculates authoritative totals.
- Totals are tested with discounts, modifiers, and tax settings.

## Milestone 4: Payment and invoice finalization
- Payment methods: cash, UPI, card, split tender recording.
- Cash tendered and change due.
- Payment confirmation workflow.
- Invoice number generation safe under concurrent requests.
- Snapshot finalized invoice and line details.
- Database transaction for payment/order/invoice changes.
- Idempotency to prevent duplicate finalization.

**Acceptance criteria**
- Double-clicking Pay does not create duplicate invoices or payment records.
- Failed transaction leaves no partially finalized order.
- A finalized invoice cannot be silently edited.
- External payments are not falsely described as provider-verified.

## Milestone 5: Printing
- Define `ReceiptPrinter` and `KitchenPrinter` adapter interfaces.
- Implement a mock printer for development.
- Add print-job queue and statuses.
- Create kitchen print job only after confirmed payment and finalized order.
- Customer receipt and kitchen ticket templates.
- Retry UI and audit trail.
- Add hardware-specific adapter only after printer model/connection is selected.

**Acceptance criteria**
- Unpaid order never creates a kitchen print job.
- Failed print job is visible.
- Retrying a job is explicit and logged.
- Reprints are identifiable.

## Milestone 6: Cash management
- Open/close cashier session.
- Opening cash, cash sales, cash refunds, paid-in/out.
- Expected cash and counted cash variance.
- Closing report.

## Milestone 7: Inventory and expenses
- Ingredients, units, suppliers, purchases, stock movements.
- Recipes and ingredient usage.
- Wastage and stock counts.
- Expenses.
- Reports.

## Milestone 8: Installation and hardening
- Local Windows startup instructions.
- Database backup and restore scripts.
- Restrict server access to trusted LAN interfaces/firewall rules.
- Avoid exposing PostgreSQL directly to the LAN unless explicitly required.
- Test restart recovery, printer disconnection, database backup/restore, and internet outage.
- Test the full workflow using mock printing before physical printers are purchased.
- Create a production checklist and staff quick-start guide.

## Working practice
At the start of each milestone:
1. Inspect the existing code and current package versions.
2. Summarize the planned changes.
3. Make a small coherent implementation.
4. Run lint/type checks/tests and fix errors.
5. Report changed files, commands run, and anything not yet tested.
6. Do not move to the next milestone while critical acceptance criteria fail.
