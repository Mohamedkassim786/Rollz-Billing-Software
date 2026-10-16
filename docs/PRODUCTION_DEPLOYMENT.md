# ROLLZ Restaurant POS - Production Deployment & Operations Guide

This document details the production architecture, Windows local deployment, local network (LAN) setup, database backups, disaster recovery, thermal printer integration, and troubleshooting procedures for **ROLLZ Restaurant POS**.

---

## 1. System Overview

ROLLZ is designed as an offline-first restaurant Point of Sale and management system running on a local Windows host computer in the restaurant, with optional client access over the restaurant's local network (LAN).

### Technology Stack
- **Frontend**: React 18, Vite 6, TypeScript, Tailwind CSS, Lucide Icons, TanStack Query
- **Backend**: Node.js, Express, TypeScript, Prisma ORM 6
- **Database**: PostgreSQL 18 (Local database hosted on `localhost:5432`)
- **Printers**: Modular thermal printer abstraction supporting both virtual `MOCK` and real `NETWORK_TCP` (ESC/POS raw socket over TCP port 9100)

---

## 2. Windows Local Deployment (Single Computer Operation)

In the default and recommended single-computer setup, the restaurant terminal runs PostgreSQL, the Express backend, and the React frontend locally.

### Prerequisites
1. **Windows 10 / 11 64-bit**
2. **Node.js**: v18+ or v20+ LTS installed ([https://nodejs.org](https://nodejs.org))
3. **PostgreSQL**: PostgreSQL 18 installed locally with `pg_dump.exe` and `pg_restore.exe` in `C:\Program Files\PostgreSQL\18\bin`.

### Environment Configuration (`server/.env`)
Create or verify `server/.env`:
```env
PORT=5000
HOST=0.0.0.0
NODE_ENV=production
DATABASE_URL="postgresql://rollz_app:rollz_secure_pass_2026@localhost:5432/rollz_pos?schema=public"
TEST_DATABASE_URL="postgresql://rollz_app:rollz_secure_pass_2026@localhost:5432/rollz_pos_test?schema=public"
JWT_SECRET="rollz_prod_secret_key_change_me_in_real_deployment_2026"
CORS_ORIGIN="http://localhost:5173"
BACKUP_DIR="backups"
BACKUP_RETENTION_COUNT=7
PG_BIN_DIR="C:\\Program Files\\PostgreSQL\\18\\bin"
```

> [!IMPORTANT]
> - Never expose PostgreSQL port 5432 to the public internet.
> - PostgreSQL should only listen on `localhost` or private internal restaurant interfaces.
> - Production passwords and JWT secrets should never be checked into version control.

### Safe Database Migrations & Client Generation
To initialize or safely update schema without data loss:
```powershell
cd server
npm run prisma:generate
npx prisma db push
```

### Windows One-Click Staff Startup (`start-pos.bat`)
For non-technical restaurant staff, double-click **`start-pos.bat`** from the root project folder:
1. Validates Node.js and PostgreSQL connectivity.
2. Starts the ROLLZ backend API server on port 5000 in background.
3. Starts the POS frontend terminal on port 5173.
4. Automatically opens the default browser to `http://localhost:5173`.

---

## 3. Local Network Access (LAN Operation)

To connect secondary cashier terminals, ordering tablets, or manager laptops over the restaurant Wi-Fi/Ethernet:

```mermaid
graph TD
    subgraph Host Computer [Main POS Computer (Server)]
        A[PostgreSQL 18] <--> B[Express Backend :5000]
        B <--> C[POS Terminal Frontend :5173]
    end
    subgraph LAN Devices [Restaurant Local Network]
        D[Auxiliary Tablet / PC] -->|HTTP / LAN IP| B
        E[Auxiliary Tablet / PC] -->|HTTP / LAN IP| C
    end
    subgraph Thermal Printers [Receipt & Kitchen Printers]
        B -->|ESC/POS TCP:9100| F[Receipt Printer]
        B -->|ESC/POS TCP:9100| G[Kitchen Printer]
    end
```

### LAN Architecture Rules
1. **Database Isolation**: Client devices **NEVER** connect directly to PostgreSQL. Only the server backend connects to PostgreSQL.
2. **Server Binding**: The backend binds to `0.0.0.0`, allowing incoming LAN connections from RFC1918 private subnets (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`).
3. **CORS Security**: Cross-Origin Resource Sharing is locked down to localhost and RFC1918 private subnets. Wildcard `*` is strictly disabled.
4. **Authentication**: All LAN client endpoints require valid JWT authentication. Cashier and Owner roles enforce branch isolation.

### Step-by-Step LAN Setup
1. On the Main POS Computer, open Command Prompt and type:
   ```cmd
   ipconfig
   ```
   Note the IPv4 Address (e.g. `192.168.1.100`).
2. Configure Windows Defender Firewall to allow inbound traffic on TCP ports **5000** and **5173** for **Private Networks** only.
3. On auxiliary tablets or computers connected to the same restaurant Wi-Fi, open:
   ```
   http://192.168.1.100:5173
   ```
4. Log in using authorized cashier or manager credentials.

---

## 4. Database Backup & Disaster Recovery

### Backup Strategy
- **Format**: PostgreSQL custom compressed archive (`-Fc`) generated using `pg_dump.exe`.
- **Naming**: Timestamped filenames `rollz_pos_backup_YYYYMMDD_HHMMSS.dump`.
- **Directory**: Saved to local `server/backups/`. Backups are outside web-served public folders.
- **Retention**: Automatically keeps the last 7 backups; older dumps are safely pruned.
- **Audit Logging**: Each backup completion or failure is recorded in the `BackupRecord` database table.

### Triggering Manual Backups
- **Via Settings UI**: Log in as Owner/Manager -> Go to **Settings** -> Click **Create Backup Now**.
- **Via Windows Script**: Double-click **`backup-pos.bat`** in the project root.
- **Via CLI**:
  ```powershell
  cd server
  npm run backup
  ```

### Disaster Recovery & Test Restoration
> [!CAUTION]
> Never restore an unverified backup directly over the active production database!

To safely verify backup integrity before restoring:
1. Double-click **`restore-pos-test.bat`** or run:
   ```powershell
   cd server
   npm run restore
   ```
2. The verification script automatically restores the latest dump into `rollz_pos_test` and confirms table counts and schema validity.
3. If an actual database crash occurs and production must be recovered:
   ```powershell
   "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h localhost -p 5432 -U rollz_app -d rollz_pos -c --if-exists -v "server\backups\rollz_pos_backup_YYYYMMDD_HHMMSS.dump"
   ```

---

## 5. Thermal Printer Hardware Integration

ROLLZ separates thermal printing into two distinct destinations:
1. **Customer Receipt Printer**: Prints guest invoices, itemized breakdown, tax details, and payment tenders. Triggers cash drawer pulse.
2. **Kitchen Ticket Printer**: Automatically prints tickets to the kitchen upon successful payment confirmation.

### Hardware Status
> [!IMPORTANT]
> Physical thermal printers have not yet been purchased for this deployment.
> The printer software adapter is fully modular and supports ESC/POS raw TCP communication, but **no physical hardware was connected or claimed tested** in this phase.

### Printer Adapters
- **`MOCK`**: In-memory virtual adapter. Logs print jobs and simulation payloads to the console and database. Default for development and staging.
- **`NETWORK_TCP`**: Standard ESC/POS thermal adapter connecting over raw TCP (default port 9100). Compatible with Epson, Citizen, Star Micronics, TVS, and thermal POS printers equipped with Ethernet or Wi-Fi.

### Configuration via UI
Owners/Managers can configure both printers independently in **Settings**:
- Enable/Disable toggle
- Adapter type (`MOCK` vs `NETWORK_TCP`)
- IP Address & Port (e.g. `192.168.1.200:9100` for Receipt, `192.168.1.201:9100` for Kitchen)
- Paper Width: `80mm` (48 columns) or `58mm` (32 columns)
- **Test Print** button to verify network reachability and paper cutting.

---

## 6. Automatic Kitchen Printing Invariants

ROLLZ adheres to strict fast-food kitchen workflow rules:
1. **Zero Kitchen Login**: The kitchen has **NO** login account and **NO** digital screen/dashboard. Kitchen staff operate exclusively via physical printed slips.
2. **Payment Gate**: Kitchen tickets are generated **only after successful payment finalization**. Unpaid, draft, held, or failed-payment orders never produce kitchen slips.
3. **No Double Billing on Printer Error**: A paper jam, offline printer, or disconnection failure **never reverses a successful payment** and **never generates duplicate invoices**.
4. **Crash Recovery**: Jobs stuck in `PRINTING` status due to a power outage or restart are automatically recovered to `PENDING` on server boot, or can be retried manually from the Print Queue recovery tool.
5. **Clear Reprint Labeling**: Any reprint triggered by a supervisor is stamped with `*** [REPRINT] ***` and an audit reason.

---

## 7. Security Hardening

- **Password Hashing**: Secure bcrypt hashing with high work factor.
- **Rate Limiting**: Sliding window rate limiter protects `/api/auth/login` against brute force attacks.
- **Security Headers**: Standard defense-in-depth headers applied (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`, `x-powered-by` stripped).
- **Branch Isolation**: All queries enforce tenant isolation by `branchId`. One branch cannot view or modify another branch's orders, settings, or inventory.
- **Error Obfuscation**: Production error responses hide stack traces and internal database errors from API clients.

---

## 8. Verification & Test Suite Summary

The entire test suite covers 140 automated tests:
```powershell
npm --prefix server test
```
- **140 Passing Tests / 0 Failures**:
  - Phase 1: Authentication & Restaurant Settings
  - Phase 2: Category, Menu Item & Modifier Management
  - Phase 3: POS Terminal Billing & Pricing Calculations
  - Phase 4: Payments, Invoices & Thermal Printing
  - Phase 5: Kitchen Ticket Generation & Hardware Separation
  - Phase 6: Inventory & Stock Consumption Movements
  - Phase 7: Cash Shifts, Tender Tracking & Daily Closings
  - Phase 8: Sales Reports, P&L Analytics & CSV Exports
  - Phase 9: Settings API, LAN Security, Print Queue Recovery, Backups & Test Restoration
