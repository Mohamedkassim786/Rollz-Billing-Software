import React, { useState, useEffect } from "react";
import {
  Store,
  Phone,
  Receipt,
  Percent,
  CheckCircle2,
  AlertCircle,
  Save,
  Building,
  Printer,
  Database,
  RefreshCw,
  HardDrive,
  Network,
  RotateCcw,
  QrCode,
  Smartphone,
  Copy,
  Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import { settingsApi, BackupItem, HostInfo } from "../api/settings.api";

export const SettingsPage: React.FC = () => {
  const { user, refreshAuthStatus } = useAuth();

  // General & Branch Settings
  const [restaurantName, setRestaurantName] = useState("ROLLZ Fast Food");
  const [branchCode, setBranchCode] = useState("ROLLZ-001");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxMode, setTaxMode] = useState<"GST" | "NON_GST">("GST");
  const [gstin, setGstin] = useState("");
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(5);
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");

  // UPI Digital Payments Settings
  const [upiId, setUpiId] = useState("");
  const [upiPayeeName, setUpiPayeeName] = useState("");
  const [testAmountRupees, setTestAmountRupees] = useState("100");
  const [hasCopiedUpi, setHasCopiedUpi] = useState(false);

  // Customer Printer Configuration
  const [customerPrinterType, setCustomerPrinterType] = useState("MOCK");
  const [customerPrinterAddress, setCustomerPrinterAddress] = useState("192.168.1.200:9100");
  const [customerPrinterPaperWidth, setCustomerPrinterPaperWidth] = useState<number>(80);
  const [customerPrinterEnabled, setCustomerPrinterEnabled] = useState(true);

  // Kitchen Printer Configuration
  const [kitchenPrinterType, setKitchenPrinterType] = useState("MOCK");
  const [kitchenPrinterAddress, setKitchenPrinterAddress] = useState("192.168.1.201:9100");
  const [kitchenPrinterPaperWidth, setKitchenPrinterPaperWidth] = useState<number>(80);
  const [kitchenPrinterEnabled, setKitchenPrinterEnabled] = useState(true);

  // Host and Backup Info
  const [hostInfo, setHostInfo] = useState<HostInfo | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRecoveringQueue, setIsRecoveringQueue] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await settingsApi.getSettings();
      const b = data.branch;
      setRestaurantName(b.name || "ROLLZ Fast Food");
      setBranchCode(b.code || "ROLLZ-001");
      setAddress(b.address || "");
      setPhone(b.phone || "");
      setEmail(b.email || "");
      setTaxMode(b.taxMode || "GST");
      setGstin(b.gstin || "");
      setDefaultTaxRate(b.defaultTaxRate ?? 5);
      setReceiptHeader(b.receiptHeader || "WELCOME TO ROLLZ\nFresh • Crispy • Handcrafted");
      setReceiptFooter(b.receiptFooter || "Thank you for dining with us!\nVisit again soon.");
      const savedUpiId = b.upiId || localStorage.getItem("rollz_pos_upi_id") || "";
      const savedUpiName = b.upiPayeeName || localStorage.getItem("rollz_pos_upi_payee_name") || b.name || "ROLLZ Fast Food";
      setUpiId(savedUpiId);
      setUpiPayeeName(savedUpiName);

      setCustomerPrinterType(b.customerPrinterType || "MOCK");
      setCustomerPrinterAddress(b.customerPrinterAddress || "192.168.1.200:9100");
      setCustomerPrinterPaperWidth(b.customerPrinterPaperWidth || 80);
      setCustomerPrinterEnabled(b.customerPrinterEnabled ?? true);

      setKitchenPrinterType(b.kitchenPrinterType || "MOCK");
      setKitchenPrinterAddress(b.kitchenPrinterAddress || "192.168.1.201:9100");
      setKitchenPrinterPaperWidth(b.kitchenPrinterPaperWidth || 80);
      setKitchenPrinterEnabled(b.kitchenPrinterEnabled ?? true);

      setHostInfo(data.hostInfo);
      setBackups(data.backups || []);
    } catch (err: any) {
      console.error("Failed to load settings:", err);
      showNotification("error", "Failed to load restaurant settings from server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const trimmedUpiId = upiId.trim();
      const trimmedUpiName = upiPayeeName.trim() || restaurantName;

      await settingsApi.updateSettings({
        name: restaurantName,
        address,
        phone,
        email,
        taxMode,
        gstin,
        defaultTaxRate,
        receiptHeader,
        receiptFooter,
        upiId: trimmedUpiId || null,
        upiPayeeName: trimmedUpiName || null,
        customerPrinterType,
        customerPrinterAddress,
        customerPrinterPaperWidth,
        customerPrinterEnabled,
        kitchenPrinterType,
        kitchenPrinterAddress,
        kitchenPrinterPaperWidth,
        kitchenPrinterEnabled,
      });

      if (trimmedUpiId) {
        localStorage.setItem("rollz_pos_upi_id", trimmedUpiId);
      } else {
        localStorage.removeItem("rollz_pos_upi_id");
      }
      localStorage.setItem("rollz_pos_upi_payee_name", trimmedUpiName);

      await refreshAuthStatus();
      showNotification("success", "Settings and UPI configuration saved successfully.");
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Failed to save settings.";
      showNotification("error", msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = async (destination: "CUSTOMER_RECEIPT" | "KITCHEN") => {
    setTestingPrinter(destination);
    try {
      const res = await settingsApi.testPrint(destination);
      if (res.success) {
        showNotification("success", res.message);
      } else {
        showNotification("error", res.message || "Test print failed");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Failed to dispatch test print";
      showNotification("error", msg);
    } finally {
      setTestingPrinter(null);
    }
  };

  const handleRecoverQueue = async () => {
    setIsRecoveringQueue(true);
    try {
      const res = await settingsApi.recoverPrintQueue();
      showNotification("success", `${res.message} (${res.recoveredCount} jobs recovered)`);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Failed to recover print queue.";
      showNotification("error", msg);
    } finally {
      setIsRecoveringQueue(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await settingsApi.triggerBackup();
      showNotification("success", `Backup created: ${res.backup.filename}`);
      // Refresh backups
      const bRes = await settingsApi.getBackups();
      setBackups(bRes.backups);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Failed to create database backup.";
      showNotification("error", msg);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleTestRestore = async (filename: string) => {
    if (!window.confirm(`Run safe verification restore for '${filename}' against test database (rollz_pos_test)?\n\nNote: Production data will NOT be touched.`)) {
      return;
    }

    setRestoringBackup(filename);
    try {
      const res = await settingsApi.restoreBackup(filename, "rollz_pos_test");
      if (res.success) {
        showNotification("success", `Verification successful! Restored to ${res.targetDatabase} without error.`);
      } else {
        showNotification("error", res.message || "Restoration verification failed");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Restore verification failed";
      showNotification("error", msg);
    } finally {
      setRestoringBackup(null);
    }
  };

  const isOwnerOrManager = user?.role === "OWNER" || user?.role === "MANAGER";

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <RefreshCw className="w-8 h-8 text-[#2563EB] animate-spin" />
        <p className="text-xs font-semibold text-[#64748B]">Loading restaurant configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight flex items-center gap-2.5">
            <Store className="w-5 h-5 text-[#2563EB]" />
            <span>Settings & Production Readiness</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Manage restaurant identity, thermal printer hardware, network connectivity, and database backups.
          </p>
        </div>

        {isOwnerOrManager && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save Settings"}</span>
          </button>
        )}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-2.5 text-xs font-semibold animate-fadeIn ${
            notification.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Local Network Info Banner */}
      {hostInfo && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-5 shadow-card">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#172033]">Local Network Deployment (LAN Ready)</h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Connect other restaurant terminals via the main computer's local IP on port{" "}
                  <span className="font-mono font-bold text-[#2563EB]">{hostInfo.port}</span>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-3 py-1 bg-white border border-blue-200 text-slate-700 rounded-lg">
                Host: <b>{hostInfo.host}</b>
              </span>
              <span className="px-3 py-1 bg-white border border-blue-200 text-slate-700 rounded-lg">
                DB: <b>{hostInfo.database}</b>
              </span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Thermal Receipt Printer Configuration */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#172033]">Customer Receipt Printer</h2>
                <p className="text-xs text-[#64748B]">Thermal printer for finalized guest invoices</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestPrint("CUSTOMER_RECEIPT")}
                disabled={testingPrinter === "CUSTOMER_RECEIPT" || !customerPrinterEnabled}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-[#172033] transition-all disabled:opacity-40 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>{testingPrinter === "CUSTOMER_RECEIPT" ? "Testing..." : "Test Print"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Printer Status</label>
              <div className="flex items-center h-10">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={customerPrinterEnabled}
                    onChange={(e) => setCustomerPrinterEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{customerPrinterEnabled ? "Enabled" : "Disabled"}</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Adapter / Protocol</label>
              <select
                value={customerPrinterType}
                onChange={(e) => setCustomerPrinterType(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] font-medium"
              >
                <option value="MOCK">MOCK (Virtual / In-Memory)</option>
                <option value="NETWORK_TCP">NETWORK_TCP (ESC/POS Raw TCP)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Network Address (IP:Port)</label>
              <input
                type="text"
                placeholder="192.168.1.200:9100"
                value={customerPrinterAddress}
                onChange={(e) => setCustomerPrinterAddress(e.target.value)}
                disabled={customerPrinterType !== "NETWORK_TCP"}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-mono text-[#172033] disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Paper Width</label>
              <select
                value={customerPrinterPaperWidth}
                onChange={(e) => setCustomerPrinterPaperWidth(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] font-medium"
              >
                <option value={80}>80mm (Standard 48-Col)</option>
                <option value={58}>58mm (Compact 32-Col)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Kitchen Ticket Printer Configuration */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#172033]">Kitchen Ticket Printer</h2>
                <p className="text-xs text-[#64748B]">
                  Prints order tickets automatically upon payment (Kitchen has NO login)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestPrint("KITCHEN")}
                disabled={testingPrinter === "KITCHEN" || !kitchenPrinterEnabled}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-[#172033] transition-all disabled:opacity-40 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-600" />
                <span>{testingPrinter === "KITCHEN" ? "Testing..." : "Test Print"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Printer Status</label>
              <div className="flex items-center h-10">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={kitchenPrinterEnabled}
                    onChange={(e) => setKitchenPrinterEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{kitchenPrinterEnabled ? "Enabled" : "Disabled"}</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Adapter / Protocol</label>
              <select
                value={kitchenPrinterType}
                onChange={(e) => setKitchenPrinterType(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] font-medium"
              >
                <option value="MOCK">MOCK (Virtual / In-Memory)</option>
                <option value="NETWORK_TCP">NETWORK_TCP (ESC/POS Raw TCP)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Network Address (IP:Port)</label>
              <input
                type="text"
                placeholder="192.168.1.201:9100"
                value={kitchenPrinterAddress}
                onChange={(e) => setKitchenPrinterAddress(e.target.value)}
                disabled={kitchenPrinterType !== "NETWORK_TCP"}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-mono text-[#172033] disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Paper Width</label>
              <select
                value={kitchenPrinterPaperWidth}
                onChange={(e) => setKitchenPrinterPaperWidth(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] font-medium"
              >
                <option value={80}>80mm (Standard 48-Col)</option>
                <option value={58}>58mm (Compact 32-Col)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Print Queue Recovery */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#172033]">Print Queue Crash Recovery</h2>
                <p className="text-xs text-[#64748B]">
                  Recover print jobs stuck in 'PRINTING' state after power failures or abrupt shutdowns
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRecoverQueue}
              disabled={isRecoveringQueue}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecoveringQueue ? "animate-spin" : ""}`} />
              <span>{isRecoveringQueue ? "Scanning..." : "Recover Stale Jobs"}</span>
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Note: Jobs are automatically scanned and recovered on server startup. You may also trigger manual queue
            recovery at any time.
          </p>
        </div>

        {/* Section 4: Database Backup & Recovery */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#172033]">Database Backups & Disaster Recovery</h2>
                <p className="text-xs text-[#64748B]">Automated pg_dump exports with safe test restoration</p>
              </div>
            </div>

            {isOwnerOrManager && (
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>{isBackingUp ? "Backing up..." : "Create Backup Now"}</span>
              </button>
            )}
          </div>

          {/* Backup History Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#172033]">Recent Backups</h3>
            {backups.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 italic">No database backups recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="py-2 font-semibold">Filename</th>
                      <th className="py-2 font-semibold">Created</th>
                      <th className="py-2 font-semibold">Size</th>
                      <th className="py-2 font-semibold">Status</th>
                      <th className="py-2 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {backups.map((bk, i) => (
                      <tr key={bk.id || i} className="hover:bg-slate-50">
                        <td className="py-2.5 font-mono font-medium text-slate-800">{bk.filename}</td>
                        <td className="py-2.5 text-slate-500">
                          {new Date(bk.createdAt).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 text-slate-600 font-mono">
                          {(bk.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              bk.status === "SUCCESS"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {bk.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleTestRestore(bk.filename)}
                            disabled={restoringBackup === bk.filename}
                            title="Safely restore into test database rollz_pos_test to verify backup integrity without overwriting production"
                            className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {restoringBackup === bk.filename ? "Verifying..." : "Verify Restore"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Restaurant Information */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172033]">Restaurant Information</h2>
              <p className="text-xs text-[#64748B]">Brand identity and primary trading name</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Brand / Business Name</label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Branch Code</label>
              <input
                type="text"
                disabled
                value={branchCode}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-[#E2E8F0] rounded-xl text-xs font-mono font-bold text-[#2563EB] cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Section 6: Contact Information */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-emerald-50 text-[#16A34A] border border-emerald-100">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172033]">Store Contact & Location</h2>
              <p className="text-xs text-[#64748B]">Printed on bills and customer receipts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <div className="space-y-1.5 md:col-span-3">
              <label className="text-xs font-semibold text-[#172033]">Store Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-[#172033]">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Section 7: Tax Configuration */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-amber-50 text-[#D97706] border border-amber-100">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172033]">Tax Configuration</h2>
              <p className="text-xs text-[#64748B]">GST and Non-GST regulatory billing settings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Billing Mode</label>
              <select
                value={taxMode}
                onChange={(e) => {
                  const newMode = e.target.value as "GST" | "NON_GST";
                  setTaxMode(newMode);
                  if (newMode === "NON_GST") {
                    setDefaultTaxRate(0);
                  } else {
                    setDefaultTaxRate(5);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] font-semibold focus:outline-none focus:border-[#2563EB] cursor-pointer"
              >
                <option value="GST">GST Mode (CGST + SGST)</option>
                <option value="NON_GST">Non-GST Simple Bill</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">GSTIN Number</label>
              <input
                type="text"
                disabled={taxMode === "NON_GST"}
                value={taxMode === "NON_GST" ? "N/A (Non-GST)" : gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-mono text-[#172033] disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Default GST Rate (%)</label>
              <input
                type="number"
                disabled={taxMode === "NON_GST"}
                value={taxMode === "NON_GST" ? 0 : defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-mono text-[#172033] disabled:opacity-50"
              />
            </div>

            {taxMode === "NON_GST" ? (
              <div className="md:col-span-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-[#2563EB] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2563EB] shrink-0" />
                <span>
                  <strong>Non-GST Mode Active:</strong> 0% tax is applied to orders. Customer receipts print as Simple Bills without GSTIN or CGST/SGST lines.
                </span>
              </div>
            ) : (
              <div className="md:col-span-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>GST Mode Active:</strong> Standard 5% GST (2.5% CGST + 2.5% SGST) applied to bills, with registered GSTIN printed on receipts.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 8: UPI Payments & Dynamic QR Configuration */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172033]">UPI Payments & Dynamic QR Code</h2>
              <p className="text-xs text-[#64748B]">
                Configure your UPI ID so customer QR codes are automatically generated for the exact order total
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172033]">
                    Your UPI ID / VPA <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. shopname@okhdfcbank or 9876543210@paytm"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-mono font-medium text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <p className="text-[11px] text-slate-500">
                    Any customer scanning this QR code in GPay, PhonePe, Paytm or BHIM will send payment directly to this ID.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172033]">
                    Payee / Merchant Display Name
                  </label>
                  <input
                    type="text"
                    placeholder={restaurantName || "ROLLZ Fast Food"}
                    value={upiPayeeName}
                    onChange={(e) => setUpiPayeeName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <p className="text-[11px] text-slate-500">
                    Name displayed on customer's phone during UPI payment approval.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-[#172033] block">Test Scan QR Generator</span>
                  <span className="text-slate-500">Enter a test amount to preview the live generated QR code</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    min="1"
                    value={testAmountRupees}
                    onChange={(e) => setTestAmountRupees(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#172033]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-slate-500">Supported UPI Apps:</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md border border-blue-200">Google Pay</span>
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-md border border-purple-200">PhonePe</span>
                <span className="px-2 py-0.5 bg-sky-50 text-sky-700 text-[10px] font-bold rounded-md border border-sky-200">Paytm</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md border border-emerald-200">BHIM UPI</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">Cred / All Banks</span>
              </div>
            </div>

            {/* Live QR Preview Box */}
            <div className="flex flex-col items-center justify-center p-5 bg-gradient-to-b from-slate-50 to-blue-50/40 border border-blue-100 rounded-2xl text-center">
              <span className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>Live Test Preview</span>
              </span>

              {upiId.trim() ? (
                <>
                  <div className="p-3 bg-white rounded-xl shadow-md border border-slate-200 mb-3">
                    <QRCodeSVG
                      value={`upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(
                        upiPayeeName.trim() || restaurantName || "Merchant"
                      )}&am=${(parseFloat(testAmountRupees) || 1).toFixed(2)}&cu=INR&tn=TestPayment`}
                      size={150}
                      level="M"
                    />
                  </div>
                  <div className="text-xs font-extrabold text-[#172033] mb-1">
                    Amount: ₹{(parseFloat(testAmountRupees) || 1).toFixed(2)}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200 max-w-full truncate">
                    <span>{upiId.trim()}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(upiId.trim());
                        setHasCopiedUpi(true);
                        setTimeout(() => setHasCopiedUpi(false), 2000);
                      }}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer ml-1"
                    >
                      {hasCopiedUpi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready for POS checkout
                  </span>
                </>
              ) : (
                <div className="py-8 px-4 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <QrCode className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Enter your UPI ID on the left to see your live payment QR code preview
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 9: Receipt Header and Footer */}
        <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172033]">Receipt Header & Footer</h2>
              <p className="text-xs text-[#64748B]">Thermal printer customer receipt custom lines</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Receipt Header Message</label>
              <textarea
                rows={3}
                value={receiptHeader}
                onChange={(e) => setReceiptHeader(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-mono text-[#172033] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172033]">Receipt Footer Message</label>
              <textarea
                rows={3}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-mono text-[#172033] resize-none"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
