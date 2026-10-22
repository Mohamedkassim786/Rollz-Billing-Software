# ROLLZ Restaurant POS

A production-grade, local-first Point of Sale (POS), billing, thermal receipt/kitchen printing, WhatsApp automated billing & CRM, inventory tracking, cash management, and analytics system designed for **ROLLZ Fast Food** — serving handcrafted rolls, burgers, grilled food, loaded fries, kebabs, beverages, and combos.

---

## Key Highlights & Core Capabilities

- **🚀 Local-First & Blazing Fast**: Operates offline locally on Windows with zero cloud latency.
- **📱 WhatsApp Automated Billing & CRM**: Automatically delivers digital receipts and welcome messages to customer WhatsApp upon payment confirmation, with one-click promotional broadcasts.
- **🎨 Dynamic Custom Branding**: Upload custom restaurant logos and login screen wallpapers with instant live preview across the app, sidebar, and receipts.
- **👥 Staff & Cashier Management**: Create cashier accounts, toggle active/inactive status, and reset staff passwords from the admin settings.
- **🔐 User Account & Password Control**: View account details, edit display names, and securely change passwords with hash verification.
- **⚡ Dynamic UPI QR Code Payments**: Generates instant NPCI-standard dynamic UPI payment QR codes on screen for the exact bill total, complete with a live test scanner in Settings.
- **🧾 GST & Non-GST Billing**: Toggle between 5% GST (2.5% CGST + 2.5% SGST with GSTIN) or Non-GST (0% Simple Bill) with a single switch.
- **🖨️ Thermal Receipts & Kitchen KOT**: Independent hardware printing for customer bills and kitchen tickets (supports both ESC/POS network TCP port 9100 and virtual development mock).
- **🖼️ Smart Menu Photo Optimizer**: Supports menu photos up to 15MB with automatic detection of photos > 2MB and high-speed client-side WebP compression.
- **💾 Automated Database Backups**: One-click compressed PostgreSQL dumps with automated retention pruning and safe test restoration.
- **🖥️ One-Click Windows Desktop Launcher**: Native desktop shortcut and borderless application window launcher.

---

## Architecture & Technology Stack

| Layer | Technologies & Tools |
| :--- | :--- |
| **Frontend** | React 18, Vite 6, TypeScript, Tailwind CSS, Lucide React, Axios, TanStack Query, QRCode.react |
| **Backend API** | Node.js (v18+ / v20+ / v22+), Express, TypeScript, Zod, Bcrypt, JWT, Multer |
| **Database & ORM** | PostgreSQL (14+ / 16+ / 18+), Prisma ORM 6 |
| **Messaging & CRM** | Baileys WhatsApp Web multi-file auth socket driver, QR code generator |
| **Printing Subsystem** | ESC/POS abstraction, raw TCP/network socket driver, mock development driver |
| **Desktop Launcher** | Windows Batch, PowerShell WScript COM shortcut generator, embedded 256x256 `.ico` |
| **Quality & Tests** | 140 / 140 automated integration & unit tests (`test:server`), strict TypeScript checking |

---

## System Prerequisites

Before setting up the software, ensure the following are installed on the host computer:

1. **Node.js**: `v18.18+`, `v20+`, or `v22+` (LTS recommended) — [Download Node.js](https://nodejs.org/)
2. **PostgreSQL**: `v14+`, `v16+`, or `v18+` — [Download PostgreSQL](https://www.postgresql.org/download/windows/)
   - Ensure `psql` and `pg_dump` are added to your Windows system `PATH` (typically `C:\Program Files\PostgreSQL\<version>\bin`).
3. **Web Browser**: Google Chrome or Microsoft Edge (used by the desktop launcher for clean window mode).

---

## Quick Start & Installation

### 1. Database Setup
Connect to your local PostgreSQL instance via **pgAdmin** or Command Prompt (`psql -U postgres`), and create the application databases:

```sql
-- Create application user
CREATE USER rollz_app WITH PASSWORD 'rollz_secure_pass_2026';

-- Create production and automated test databases
CREATE DATABASE rollz_pos OWNER rollz_app;
CREATE DATABASE rollz_pos_test OWNER rollz_app;

-- Grant full privileges
GRANT ALL PRIVILEGES ON DATABASE rollz_pos TO rollz_app;
GRANT ALL PRIVILEGES ON DATABASE rollz_pos_test TO rollz_app;
```

### 2. Environment Configuration
Verify `server/.env`:
```ini
DATABASE_URL="postgresql://rollz_app:rollz_secure_pass_2026@localhost:5432/rollz_pos?schema=public"
PORT=5000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"
JWT_SECRET="rollz_pos_jwt_secret_local_dev_key_2026_super_secure"
UPLOAD_DIR="uploads"
```

### 3. Initialize Database Schema
From the project root:

```bash
# Push database schema to PostgreSQL
npm run db:push

# Generate typed Prisma client
npm run db:generate
```

### 4. Install Dependencies
```bash
npm install
npm --prefix server install
npm --prefix client install
```

---

## Running the Application

### Option A: Windows Desktop Shortcut (Recommended for Restaurant Staff)
1. Double-click **`create-desktop-shortcut.bat`**.
2. A shortcut named **`ROLLZ Billing Software`** with the custom ROLLZ icon will appear on your Windows desktop.
3. Double-clicking this icon automatically:
   - Starts the backend server on port `5000`.
   - Starts the frontend terminal on port `5173`.
   - Opens the POS terminal in a clean, dedicated application window.

### Option B: Batch Launcher
Double-click **`ROLLZ-POS-Launcher.bat`** or **`start-pos.bat`** in the project root folder.

### Option C: Manual Command-Line Launch
```bash
# Start Backend API Server (Port 5000)
npm run dev:server

# Start Frontend POS Terminal (Port 5173, in a separate terminal)
npm run dev:client
```

- **POS Web Terminal**: `http://localhost:5173`
- **Backend API & Health Check**: `http://localhost:5000/api/health`

---

## Detailed Feature Guide

### 1. First-Run Owner Setup & User Roles
- Upon initial launch, if no admin account exists, the app presents the **First-Run Owner Setup** screen.
- Create master credentials (`OWNER` role) which have full access to Reports, Staff Management, Inventory, Menu Editing, Printers, and System Settings.
- In **Settings > Staff & Cashiers**, owners can create restricted **Cashier** accounts for daily billing staff. Cashiers only have access to POS ordering, payments, and shift operations.

### 2. POS Terminal & Checkout
- **Instant Search & Category Filtering**: Browse rolls, burgers, and drinks by category or quick search.
- **Item Modifiers & Custom Notes**: Select bread types, spice levels, sauces, extra toppings, and custom kitchen notes.
- **Customer Phone & Returning Visit Counter**: Enter phone numbers to auto-detect returning customers, displaying their total visits and lifetime spend.
- **Draft & Hold Orders**: Place active carts on hold to attend other customers and resume whenever ready.
- **Multi-Tender Payments**: Accept Cash (with live change calculator), UPI Dynamic QR, and Card payments.

### 3. WhatsApp Automated Billing & CRM (`/crm`)
- **Automated Bills on WhatsApp**: When a customer phone number is entered during checkout, a formatted digital bill with itemized totals and a welcome message is sent via WhatsApp immediately upon payment.
- **WhatsApp Web Pairing**: In the **CRM & WhatsApp** page, scan the QR code using your restaurant's WhatsApp phone to pair. Credentials are saved locally in `server/whatsapp_auth/` and auto-reconnect on server restart.
- **Promotional Broadcasts**: Send one-click promotional WhatsApp updates with personalized `{{name}}` tags. Target all customers, VIP high-spenders, or regular patrons.

### 4. Settings & Custom Branding (`/settings`)
The Settings page is organized into 5 dedicated tabs:
1. **Store & Branding**:
   - **Upload Store Logo**: Custom logo displayed on the sidebar, login screen, and thermal receipts.
   - **Upload Login Wallpaper**: Custom background photo on the left banner of the POS login screen.
   - **Store Details**: Name, brand tagline/slogan, address, and phone number.
   - **Tax Regulatory Mode**: Switch between **GST Mode** (5% CGST+SGST with GSTIN) and **Non-GST Mode** (0% Simple Bill).
   - **Dynamic UPI QR Code**: Configure Merchant UPI ID (VPA) and Payee Name, with an interactive live test scanner and custom test amount.
   - **Receipt Header & Footer**: Custom greeting and thank-you notes printed on bills.
2. **Staff & Cashiers**:
   - Create new cashier accounts with custom usernames and passwords.
   - One-click active/inactive toggle to instantly revoke or grant access.
   - Owner/manager password reset modal for any cashier.
3. **My Account & Password**:
   - View logged-in user profile, role badge, and account ID.
   - Update display name.
   - Secure password change form with current password verification.
4. **Thermal Printers**:
   - Independent configuration for Customer Bill and Kitchen KOT printers (Mock or Network TCP `IP:Port`, 80mm/58mm width, toggle on/off).
5. **Backups & LAN**:
   - One-click PostgreSQL backup generation.
   - View local network IP addresses for connecting secondary tablets and laptops.

### 5. Smart Menu Photo Optimizer (`/menu-items`)
- Upload dish photos up to **15MB**.
- If a photo exceeds 2MB, a prompt allows either:
  - **Optimize & Compress (Recommended)**: Compresses the image on the client side into high-quality WebP (< 1MB) for ultra-fast POS catalog rendering.
  - **Upload Original**: Uploads full uncompressed image up to 15MB.

---

## Local Network (LAN) & Multi-Device Access

To use secondary billing counters or waitstaff ordering tablets connected to the restaurant Wi-Fi:

1. **Find Host IP**: Open Command Prompt on the main host computer and run:
   ```cmd
   ipconfig
   ```
   Note your IPv4 Address (e.g. `192.168.1.100`).

2. **Windows Firewall**: Allow incoming TCP traffic on ports `5000` and `5173` on Private Networks.
3. **Access from Tablets/Laptops**: Open `http://<HOST_IP>:5173` in the browser of any authorized device on the same local network.

---

## Database Backups & Safe Test Restoration

- **Trigger Backup**: Run **`backup-pos.bat`** or click **Create Backup** in POS Settings. Timestamped `.dump` files are saved to `server/backups/`.
- **Verify Backup**: Run **`restore-pos-test.bat`** to safely verify database dump restoration against `rollz_pos_test` without endangering live production data.

---

## Automated Verification & Testing

The repository contains an automated test suite with **140 verified unit and integration tests**:

```bash
# Run full automated test suite (POS, Payments, Printing, Inventory, Reports, Security, Uploads)
npm run test:server

# Check TypeScript type safety across entire codebase
npm run typecheck

# Build optimized production bundles for server and client
npm run build
```

---

## Documentation Index

For in-depth architectural and operational guides, see:
* [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) — Comprehensive functional specifications and business rules.
* [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) — Entity-relationship models, schema indexes, and data dictionary.
* [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) — Windows single-PC hardening, LAN topology, and printer hardware setups.
* [docs/SECURITY_AND_RELIABILITY.md](docs/SECURITY_AND_RELIABILITY.md) — Role-based access control, security headers, and idempotency guarantees.
