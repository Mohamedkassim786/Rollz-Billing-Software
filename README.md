# ROLLZ Restaurant POS & Automated Billing Software

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B%20%7C%2016%2B-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Cloudflare Tunnel](https://img.shields.io/badge/Cloudflare_Tunnel-Zero--Config-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
[![Zero Gateway Fees](https://img.shields.io/badge/UPI_Gateway_Fees-0%25_Direct_Bank-success)](https://npci.org.in/)

A production-grade, local-first Point of Sale (POS), billing terminal, dual thermal receipt/kitchen printing, WhatsApp automated billing & CRM, inventory tracking, cash drawer management, and **zero-fee automated UPI payment gateway** designed for **ROLLZ Fast Food** — serving handcrafted rolls, burgers, grilled food, loaded fries, kebabs, beverages, and combos.

---

## 🌟 Key Highlights & Core Capabilities

- **⚡ Automated Zero-Fee UPI Payment Gateway & Soundbox**: Turn any Android phone into an automated UPI soundbox and payment verification terminal with **0% per-transaction gateway fees** (saving 2% on third-party aggregators). Incoming bank SMS alerts and UPI app notifications (Google Pay, PhonePe, Paytm, BHIM, Bank Apps) are auto-detected, reconciled with the exact order, and confirmed in real time.
- **🛡️ Cloudflare Quick Tunnel (`cloudflared`)**: Automatic zero-configuration tunneling connects the Android SMS observer directly to the local POS backend over encrypted TLS without requiring router port forwarding, static public IPs, or flaky third-party proxies.
- **💳 Enterprise Dynamic QR Checkout**: High-conversion POS checkout modal with verified merchant security badges, live 10-minute session countdown timer, QR scanner reticles, dynamic amount locking, and an animated real-time payment observer radar that automatically captures bank UTRs and completes orders.
- **🖥️ Customer Monitor View & Kiosk Display**: Dual-display customer monitor view and full-screen customer kiosk display (`↗ Customer Screen`) showing live cart updates, subtotal, GST status, dynamic QR code, and real-time payment celebration screen.
- **🔄 One-Click System Updater (`update-pos.bat`)**: Automated batch updater that safely pulls GitHub updates, syncs Prisma database schema, verifies `cloudflared`, installs dependencies, and rebuilds production bundles without data loss.
- **📱 WhatsApp Automated Billing & CRM (`/crm`)**: Automatically delivers itemized digital receipts and greeting messages to customer WhatsApp upon checkout, with one-click promotional broadcasts filtered by customer spend tiers.
- **🎨 Dynamic Custom Branding (`/settings`)**: Upload custom restaurant logos and login screen wallpapers with instant live preview across the app, sidebar, and printed receipts.
- **👥 Staff & Cashier Management**: Create cashier accounts, toggle active/inactive access, and securely reset staff passwords from the admin settings.
- **🔐 User Account & Password Control**: View account details, edit display names, and securely change passwords with hash verification.
- **🧾 GST & Non-GST Billing**: Toggle between 5% GST (2.5% CGST + 2.5% SGST with GSTIN) or Non-GST (0% Simple Bill) with a single switch.
- **🖨️ Complete Thermal Printing Subsystem (USB, Bluetooth, Network)**:
  - **USB Win32 RAW Spooler**: Direct byte-level hardware printing via Windows `winspool.drv` for USB thermal receipt printers (TVS-E RP 3230, Epson TM-T82, Posiflex, Rongta, NGX) with automated paper cutting and cash drawer kick.
  - **Bluetooth & Serial COM Ports**: Print wirelessly or via serial cables (`COM1`–`COM99`) with configurable baud rates.
  - **Hardware Auto-Discovery Scanner**: 1-click auto-detection of all installed Windows spooler printers and COM ports directly from **Settings &rarr; Thermal Printers**.
  - **Official ROLLZ Monochrome Logo Printing**: Pre-centered 1-bit ESC/POS raster bitmap (`GS v 0`) printed at the top of every customer bill.
  - **Indian Rupee (`Rs.`) & Clean Encoding**: Formats as `Rs.150.00` and cleans bullet characters so ESC/POS printers never print corrupted characters (`Γé╣` or `ΓÇó`).
  - **Web Bluetooth & Web Serial**: Direct browser-level wireless printing from Chrome or Edge without driver installation.
  - **Independent Kitchen KOT**: Separate toggle and printer destination for Kitchen Order Tickets.
  - **Dedicated Save Button**: Save printer settings directly inside the Thermal Printers tab with instant feedback.
- **🖼️ Smart Menu Photo Optimizer**: Supports menu photos up to 15MB with automatic detection of photos > 2MB and high-speed client-side WebP compression.
- **💾 Automated Database Backups & Safe Test Restoration**: One-click compressed PostgreSQL dumps with automated retention pruning and safe test restoration against `rollz_pos_test`.
- **🖥️ One-Click Windows Desktop Launcher**: Native desktop shortcut and borderless application window launcher.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technologies & Tools | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite 6, TypeScript, Tailwind CSS, Lucide React, Axios, TanStack Query, QRCode.react | POS ordering UI, payment checkout terminal, customer monitor view, settings & reports |
| **Backend API** | Node.js (v18+ / v20+ / v22+), Express, TypeScript, Zod, Bcrypt, JWT, Multer | Local REST API, transaction handling, order lifecycle, payment verification |
| **Database & ORM** | PostgreSQL (14+ / 16+ / 18+), Prisma ORM 6 | Relational data persistence, sales ledger, inventory, audit logs, and `upi_bank_alerts` |
| **UPI Observer Gateway** | Cloudflare Tunnel (`cloudflared`), YouPI Android SMS/Push Gateway APK | Automated zero-fee UPI credit detection, 12-digit UTR extraction, smart deduplication |
| **Messaging & CRM** | Baileys WhatsApp Web multi-file auth socket driver, QR code generator | Automated digital WhatsApp receipts and broadcast messaging |
| **Printing Subsystem** | ESC/POS abstraction, raw TCP/network socket driver, mock development driver | 80mm/58mm thermal receipt printing and kitchen ticket generation |
| **Desktop Launcher** | Windows Batch, PowerShell WScript COM shortcut generator, embedded 256x256 `.ico` | One-click desktop shortcut launching in dedicated Chrome/Edge app mode |
| **Quality & Tests** | 140 / 140 automated integration & unit tests (`test:server`), strict TypeScript checking | End-to-end reliability, financial accuracy, idempotency guarantees |

---

## 💻 System Prerequisites

Before setting up the software, ensure the following are installed on the host computer:

1. **Node.js**: `v18.18+`, `v20+`, or `v22+` (LTS recommended) — [Download Node.js](https://nodejs.org/)
2. **PostgreSQL**: `v14+`, `v16+`, or `v18+` — [Download PostgreSQL](https://www.postgresql.org/download/windows/)
   - Ensure `psql` and `pg_dump` are added to your Windows system `PATH` (typically `C:\Program Files\PostgreSQL\<version>\bin`).
3. **Cloudflare Tunnel (`cloudflared`)**: (Optional manual install; the updater auto-installs via `winget`):
   - [Download Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) or run:
     ```cmd
     winget install --id Cloudflare.cloudflared -e
     ```
4. **Web Browser**: Google Chrome or Microsoft Edge (used by the desktop launcher for clean window mode).

---

## 🚀 Quick Start & Installation

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
Verify or create `server/.env`:
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

## 🏃 Running the Application

### Option A: Windows Desktop Shortcut (Recommended for Restaurant Staff)
1. Double-click **`create-desktop-shortcut.bat`**.
2. A shortcut named **`ROLLZ Billing Software`** with the custom ROLLZ icon will appear on your Windows desktop.
3. Double-clicking this icon automatically:
   - Starts the backend server on port `5000`.
   - Starts the Cloudflare UPI Tunnel in the background.
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

## ⚡ Automated Zero-Fee UPI Payment Gateway (Soundbox)

The system includes a built-in automated UPI observer that replaces expensive payment gateways (which charge 1.8% – 2.0% + GST per transaction). Any standard Android phone can be paired to act as an automated payment soundbox.

```
┌─────────────────────────┐          ┌──────────────────────────┐          ┌─────────────────────────┐
│ Customer Scans Dynamic  │          │ Android Observer Phone   │          │ ROLLZ POS Backend       │
│ UPI QR Code on Terminal │ ───────> │ Receives Bank SMS / Push │ ───────> │ Cloudflare Quick Tunnel │
│ (GPay, PhonePe, Paytm)  │          │ (Auto-Extracted UTR/Amt) │          │ (Reconciles Order & UTR)│
└─────────────────────────┘          └──────────────────────────┘          └─────────────────────────┘
                                                                                        │
                                                                                        ▼
                                                                           ┌─────────────────────────┐
                                                                           │ POS Screen Instantly    │
                                                                           │ Verifies & Completes!   │
                                                                           │ (0% Platform Fee)       │
                                                                           └─────────────────────────┘
```

### How to Setup the Android Gateway:
1. **Install Android APK**: Install the official YOUPI Gateway APK (`YouPI-PG/apk/youpi-v1.0.0.apk`) on the restaurant's Android phone containing the bank SIM card / UPI apps.
2. **Grant Android Permissions**: Grant **SMS Read** and **Notification Access** permissions when prompted.
3. **Open POS Settings**: Navigate to **Settings > Store & Branding > Automated Zero-Fee UPI Observer**.
4. **Scan Pairing QR Code**: Click **"Start Gateway Tunnel"** to generate the active Cloudflare Tunnel URL, and scan the displayed pairing QR code using the Android app.
5. **Live Verification**:
   - The Android phone will show status: **"Connected & Listening"**.
   - When a customer scans the dynamic QR at POS checkout and completes the payment, the bank SMS or UPI soundbox alert is received by the phone, dispatched securely over Cloudflare Tunnel, verified against the active order, and the POS checkout screen immediately confirms with a green celebration card and audio chime!

### Smart 3-Tier Deduplication:
- **UTR Deduplication**: Identifies the 12-digit Indian banking UTR (e.g. `666696256343`) and rejects duplicate submissions.
- **5-Minute Text Hash**: Identifies identical SMS payloads within 5 minutes.
- **SMS / Google Messages App Notification Merge**: When Android triggers both a raw SMS broadcast and a Google Messages notification for the same credit ~1.4 seconds apart, the backend automatically suppresses the duplicate.

---

## 🔄 One-Click System Updater (`update-pos.bat`)

To deploy updates to secondary counter laptops or update your billing machine:

1. Double-click **`update-pos.bat`** (or open terminal, run `git pull`, and double-click `update-pos.bat`).
2. The automated script will:
   - Safely close any active POS processes so files are not locked.
   - Run `git pull` to fetch the latest code and assets from GitHub.
   - Install all root, server, and client npm dependencies.
   - Check and auto-install Cloudflare Tunnel (`cloudflared`) via `winget` if missing.
   - Run `prisma generate` and `prisma db push` to synchronize any schema updates safely without data loss.
   - Rebuild production client and server bundles.
   - Ensure all printer drivers, PowerShell scripts, and ESC/POS logo assets are in place.
3. Once completed, launch the POS using `ROLLZ-POS-Launcher.bat` or your desktop shortcut!

---

## 🖥️ Customer Monitor View (Dual-Screen Display)

For restaurants with a secondary customer-facing monitor or counter tablet:

1. In the POS header, click **"Customer Monitor View"**.
2. Move the newly opened browser window to the customer-facing secondary monitor and press `F11` for full screen.
3. **Features on Customer Screen**:
   - Live real-time cart item list, quantities, and prices.
   - Subtotal, discounts, and GST/Tax breakdown.
   - When cashier clicks checkout, the customer screen displays a large dynamic UPI QR code with corner scanner guides.
   - When the customer pays, the screen immediately transforms into a full-screen **"Payment Successful! Thank you!"** celebration card.

---

## 📱 WhatsApp Automated Billing & CRM (`/crm`)

- **Automated Bills on WhatsApp**: When a customer phone number is entered during checkout, a formatted digital bill with itemized totals and a welcome greeting is sent via WhatsApp immediately upon payment.
- **WhatsApp Web Pairing**: In the **CRM & WhatsApp** page, scan the QR code using your restaurant's WhatsApp phone to pair. Credentials are saved locally in `server/whatsapp_auth/` and auto-reconnect on server restart.
- **Promotional Broadcasts**: Send one-click promotional WhatsApp updates with personalized `{{name}}` tags. Target all customers, VIP high-spenders, or regular patrons.

---

## ⚙️ Settings & Custom Branding (`/settings`)

The Settings page is organized into 5 dedicated tabs:
1. **Store & Branding**:
   - **Upload Store Logo**: Custom logo displayed on the sidebar, login screen, and thermal receipts.
   - **Upload Login Wallpaper**: Custom background photo on the left banner of the POS login screen.
   - **Store Details**: Name, brand tagline/slogan, address, and phone number.
   - **Tax Regulatory Mode**: Switch between **GST Mode** (5% CGST+SGST with GSTIN) and **Non-GST Mode** (0% Simple Bill).
   - **Dynamic UPI QR Code**: Configure Merchant UPI ID (VPA) and Payee Name, with an interactive live test scanner and custom test amount.
   - **Automated UPI Observer Gateway**: Cloudflare Tunnel manager, pairing QR generator, live listener device registry, and recent bank alerts audit table.
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
   - **Hardware Device Scanner**: Auto-detects connected Windows printers (e.g. `TVS-E RP 3230`) and active COM ports (e.g. `COM3`) with click-to-select pills.
   - **Customer Receipt Printer**: Configure USB (Win32 Spooler), Bluetooth (Serial COM), Network TCP (`IP:Port`), or Mock, with paper width (80mm / 58mm).
   - **Kitchen KOT Printer**: Toggle KOT printing independently or route to a dedicated kitchen printer / counter printer.
   - **ESC/POS Monochrome Logo**: Automatically prepends the sharp, centered ROLLZ logo bitmap to customer bills.
   - **Test Print & Direct Web Bluetooth**: Test receipts with live configuration overrides and browser-native BLE test button.
   - **Dedicated Save Button**: Prominent "Save Printer Settings" button located right inside the Printers tab.
5. **Backups & LAN**:
   - One-click PostgreSQL backup generation.
   - View local network IP addresses for connecting secondary tablets and laptops.

---

## 🌐 Local Network (LAN) & Multi-Device Access

To use secondary billing counters or waitstaff ordering tablets connected to the restaurant Wi-Fi:

1. **Find Host IP**: Open Command Prompt on the main host computer and run:
   ```cmd
   ipconfig
   ```
   Note your IPv4 Address (e.g. `192.168.1.100`).

2. **Windows Firewall**: Allow incoming TCP traffic on ports `5000` and `5173` on Private Networks.
3. **Access from Tablets/Laptops**: Open `http://<HOST_IP>:5173` in the browser of any authorized device on the same local network.

---

## 💾 Database Backups & Safe Test Restoration

- **Trigger Backup**: Run **`backup-pos.bat`** or click **Create Backup** in POS Settings. Timestamped `.dump` files are saved to `server/backups/`.
- **Verify Backup**: Run **`restore-pos-test.bat`** to safely verify database dump restoration against `rollz_pos_test` without endangering live production data.

---

## 🧪 Automated Verification & Testing

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

## 📚 Documentation Index

For in-depth architectural and operational guides, see:
* [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) — Comprehensive functional specifications and business rules.
* [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) — Entity-relationship models, schema indexes, and data dictionary.
* [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) — Windows single-PC hardening, LAN topology, and printer hardware setups.
* [docs/SECURITY_AND_RELIABILITY.md](docs/SECURITY_AND_RELIABILITY.md) — Role-based access control, security headers, and idempotency guarantees.
* [YouPI-PG/docs/ANDROID_MOBILE_APP.md](YouPI-PG/docs/ANDROID_MOBILE_APP.md) — Android Kotlin SMS/Push listener service architecture and security enrollment.
