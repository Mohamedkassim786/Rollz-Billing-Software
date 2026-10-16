# ROLLZ Restaurant POS

A production-grade, local-first Point of Sale (POS), billing, thermal receipt/kitchen printing, inventory tracking, cash management, and analytics system designed for **ROLLZ**, a fast-food restaurant serving rolls, burgers, grilled food, loaded fries, kebabs, beverages, and combos.

---

## Architecture & Technology Stack

| Layer | Technologies & Tools |
| :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Axios |
| **Backend API** | Node.js (v18+ or v20+), Express, TypeScript, Zod, Bcrypt, JWT |
| **Database & ORM** | PostgreSQL (14+ / 16+), Prisma ORM |
| **Printing Subsystem** | ESC/POS abstraction, raw TCP/network socket driver, mock development driver |
| **Reliability & Security**| Strict role-based isolation (`OWNER`, `CASHIER`), atomic sequence generation, automated PostgreSQL backups, crash queue recovery |

---

## System Prerequisites

Before setting up the software, ensure the following software is installed on the host computer:

1. **Node.js**: `v18.18+` or `v20+` (LTS recommended) — [Download Node.js](https://nodejs.org/)
2. **PostgreSQL**: `v14+`, `v15+`, or `v16+` — [Download PostgreSQL](https://www.postgresql.org/download/windows/)
   - Ensure `psql` and `pg_dump` are added to your Windows system `PATH` (typically `C:\Program Files\PostgreSQL\<version>\bin`).
3. **Web Browser**: Google Chrome, Microsoft Edge, or any modern Chromium-based browser.

---

## PostgreSQL Database Setup

### 1. Create PostgreSQL User and Databases
Open **pgAdmin** or your Windows Command Prompt / PowerShell, connect as the postgres superuser, and execute:

```sql
-- Connect via psql:
-- psql -U postgres

-- 1. Create application user
CREATE USER rollz_app WITH PASSWORD 'rollz_secure_pass_2026';

-- 2. Create production and automated test databases
CREATE DATABASE rollz_pos OWNER rollz_app;
CREATE DATABASE rollz_pos_test OWNER rollz_app;

-- 3. Grant full privileges
GRANT ALL PRIVILEGES ON DATABASE rollz_pos TO rollz_app;
GRANT ALL PRIVILEGES ON DATABASE rollz_pos_test TO rollz_app;
```

*(Optional alternative: You may use your existing `postgres` superuser credentials if preferred by updating `.env` accordingly).*

### 2. Configure Environment Variables

The repository includes pre-configured environment files for quick start.

#### Backend (`server/.env`):
```ini
DATABASE_URL="postgresql://rollz_app:rollz_secure_pass_2026@localhost:5432/rollz_pos?schema=public"
PORT=5000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"
JWT_SECRET="rollz_pos_jwt_secret_local_dev_key_2026_super_secure"
UPLOAD_DIR="uploads"
```

#### Frontend (`client/.env`):
```ini
VITE_API_URL="http://localhost:5000"
```

### 3. Push Database Schema & Generate Prisma Client

From the project root:

```bash
# Push database schema to PostgreSQL
npm run db:push

# Generate typed Prisma client
npm run db:generate
```

### 4. (Optional) Seed Demo Menu & Inventory

Populate initial food categories, items with modifiers, and ingredient stock:

```bash
# Seed menu categories and items (Rolls, Burgers, Fries, Combos, etc.)
npm --prefix server run prisma:generate
npx --prefix server tsx server/src/scripts/seedMenuItems.ts

# Seed raw ingredients, recipes, and baseline inventory
npx --prefix server tsx server/src/scripts/seedInventory.ts
```

---

## Running the Application

### Method A: One-Click Windows Launch (Recommended for Staff)
Simply double-click:
* **`start-pos.bat`**: Verifies prerequisites, launches the backend API on port `5000`, and opens the POS frontend on port `5173`.

### Method B: Manual Command-Line Launch
Install dependencies and run both servers concurrently:

```bash
# 1. Install root, server, and client dependencies
npm install
npm --prefix server install
npm --prefix client install

# 2. Start Backend API Server (Port 5000)
npm run dev:server

# 3. Start Frontend POS Terminal (Port 5173, in a separate terminal)
npm run dev:client
```

* **POS Web Terminal**: `http://localhost:5173`
* **Backend API / Health Check**: `http://localhost:5000/api/health`

---

## First-Run Setup & User Accounts

1. Navigate to `http://localhost:5173` in your browser.
2. If this is a fresh database, the setup wizard will detect that no administrator exists and present the **Initial Owner Setup** form.
3. Register your **Owner** username, display name, and password.
4. Once logged in:
   * **Owners** have unrestricted access to Reports, Inventory, Pricing, Settings, Printers, Backups, and Staff Management.
   * Go to **Settings > Staff** to create **Cashier** accounts for floor billing staff. Cashiers have restricted access focused solely on POS order drafting, payment processing, and shift operations.

---

## Local Network (LAN) & Multi-Device Access

To use secondary billing counters or waitstaff ordering tablets connected to the restaurant Wi-Fi:

1. **Find Host IP**: Open Command Prompt on the main host computer and run:
   ```cmd
   ipconfig
   ```
   Note your IPv4 Address (e.g., `192.168.1.100`).

2. **Windows Firewall**: Allow incoming TCP traffic on ports `5000` and `5173` on Private Networks.
3. **Access from Tablets/Laptops**: Open `http://<HOST_IP>:5173` in the browser of any authorized device on the same local network.

---

## Thermal Printer Setup

The software operates with strict separation of customer receipts and kitchen order tickets (KOT):

1. **Receipts vs. KOT**:
   * **Customer Receipts**: Printed on demand or at order finalization.
   * **Kitchen Tickets**: Triggered **only after payment confirmation** to prevent phantom orders.
2. **Printer Configuration**:
   * Open **Settings > Printer Settings** in the POS UI.
   * **Driver Type**:
     * `MOCK`: Logs formatted ESC/POS byte buffers to console (ideal for testing without physical hardware).
     * `NETWORK`: Direct raw ESC/POS over TCP/IP (standard port `9100` for Ethernet/Wi-Fi thermal printers).
   * **Dispatch Test Print**: Use the built-in test buttons in the Settings page to verify physical communication.
   * **Crash Recovery**: If the system shuts down unexpectedly during a print job, stale jobs are automatically reset to `PENDING` on server restart.

---

## Database Backups & Maintenance

Automated database protection is integrated directly into the system:

* **Manual Backup Script**: Double-click **`backup-pos.bat`** or click **Create Backup** in POS Settings. Timestamped `.dump` files are saved to `server/backups/`.
* **Safe Test Restoration**: Run **`restore-pos-test.bat`** to safely verify database dump restoration against `rollz_pos_test` without endangering live production data.

---

## Automated Verification & Testing

The repository contains an exhaustive automated test suite with **140 verified unit and integration tests**:

```bash
# Run full automated test suite (POS, Payments, Printing, Inventory, Reports, Security)
npm --prefix server test

# Check TypeScript type safety across entire codebase
npm run typecheck

# Build optimized production bundle
npm run build
```

---

## Documentation Index

For in-depth architectural and operational guides, see:
* [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) — Comprehensive functional specifications and business rules.
* [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) — Entity-relationship models, schema indexes, and data dictionary.
* [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) — Windows single-PC hardening, LAN topology, and printer hardware setups.
* [docs/SECURITY_AND_RELIABILITY.md](docs/SECURITY_AND_RELIABILITY.md) — Role-based access control, security headers, and idempotency guarantees.
