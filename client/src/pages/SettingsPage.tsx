import React, { useState, useEffect } from "react";
import {
  Store,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Save,
  Printer,
  RefreshCw,
  Network,
  QrCode,
  Smartphone,
  Copy,
  Check,
  User as UserIcon,
  Users,
  Lock,
  KeyRound,
  Plus,
  Upload,
  X,
  Image as ImageIcon,
  HardDrive,
  ShieldCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import { settingsApi, BackupItem, HostInfo } from "../api/settings.api";
import { usersApi, StaffUser } from "../api/users.api";
import { authApi } from "../api/auth.api";
import { upiObserverApi, UpiBankAlertRecord } from "../api/upiObserver.api";

export const SettingsPage: React.FC = () => {
  const { user, branch, refreshAuthStatus } = useAuth();
  const [activeTab, setActiveTab] = useState<"STORE" | "STAFF" | "ACCOUNT" | "PRINTERS" | "BACKUPS">("STORE");

  // General & Branch Settings
  const [restaurantName, setRestaurantName] = useState("ROLLZ Fast Food");
  const [tagline, setTagline] = useState("Fresh • Crispy • Handcrafted");
  const [branchCode, setBranchCode] = useState("ROLLZ-001");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxMode, setTaxMode] = useState<"GST" | "NON_GST">("GST");
  const [gstin, setGstin] = useState("");
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(5);
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");

  // Branding (Logo & Login Photo)
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [loginBgPath, setLoginBgPath] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  // UPI Digital Payments Settings
  const [upiId, setUpiId] = useState("");
  const [upiPayeeName, setUpiPayeeName] = useState("");
  const [testAmountRupees, setTestAmountRupees] = useState("100");
  const [hasCopiedUpi, setHasCopiedUpi] = useState(false);

  // Automated UPI Observer & Soundbox
  const [upiAutoVerifyEnabled, setUpiAutoVerifyEnabled] = useState(true);
  const [upiWebhookSecret, setUpiWebhookSecret] = useState("rollz_upi_secret_default");
  const [hasCopiedWebhookUrl, setHasCopiedWebhookUrl] = useState(false);
  const [hasCopiedSecret, setHasCopiedSecret] = useState(false);
  const [simBankAmount, setSimBankAmount] = useState("140");
  const [simBankName, setSimBankName] = useState("HDFC Bank");
  const [simPayerVpa, setSimPayerVpa] = useState("customer@okaxis");
  const [isSimulatingSms, setIsSimulatingSms] = useState(false);
  const [simResult, setSimResult] = useState<{ success: boolean; message: string; sms?: string } | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<UpiBankAlertRecord[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showPairingQr, setShowPairingQr] = useState(false);
  const [pairingServerIp, setPairingServerIp] = useState<string>("192.168.1.9");
  const [pairingServerUrl, setPairingServerUrl] = useState<string>("");
  const [isSecureTunnel, setIsSecureTunnel] = useState<boolean>(false);
  const [isRestartingTunnel, setIsRestartingTunnel] = useState<boolean>(false);

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

  // Staff & Cashier Management
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"CASHIER" | "MANAGER">("CASHIER");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Reset Password Modal for Staff
  const [resetTargetUser, setResetTargetUser] = useState<StaffUser | null>(null);
  const [staffNewPassword, setStaffNewPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // My Account (Profile & Password Change)
  const [myDisplayName, setMyDisplayName] = useState(user?.displayName || "");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Host and Backup Info
  const [hostInfo, setHostInfo] = useState<HostInfo | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
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
      setTagline(b.tagline || "Fresh • Crispy • Handcrafted");
      setBranchCode(b.code || "ROLLZ-001");
      setAddress(b.address || "");
      setPhone(b.phone || "");
      setEmail(b.email || "");
      setTaxMode(b.taxMode || "GST");
      setGstin(b.gstin || "");
      setDefaultTaxRate(b.defaultTaxRate ?? 5);
      setReceiptHeader(b.receiptHeader || "WELCOME TO ROLLZ\nFresh • Crispy • Handcrafted");
      setReceiptFooter(b.receiptFooter || "Thank you for dining with us!\nVisit again soon.");
      setLogoPath(b.logoPath || null);
      setLoginBgPath(b.loginBgPath || null);

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

      setUpiAutoVerifyEnabled(b.upiAutoVerifyEnabled ?? true);
      setUpiWebhookSecret(b.upiWebhookSecret || "rollz_upi_secret_default");

      setHostInfo(data.hostInfo);
      setBackups(data.backups);
      loadUpiAlerts();

      fetch("/api/upi-observer/pairing-info")
        .then((r) => r.json())
        .then((info) => {
          if (info.serverUrl) setPairingServerUrl(info.serverUrl);
          if (info.localIp) setPairingServerIp(info.localIp);
          if (info.isSecureTunnel !== undefined) setIsSecureTunnel(info.isSecureTunnel);
        })
        .catch(() => {});
    } catch (err: any) {
      showNotification("error", "Failed to load restaurant settings: " + (err.message || "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  // Keep pairing info in sync when QR pairing card is visible
  useEffect(() => {
    if (!showPairingQr) return;
    const updatePairing = () => {
      fetch("/api/upi-observer/pairing-info")
        .then((r) => r.json())
        .then((info) => {
          if (info.serverUrl) setPairingServerUrl(info.serverUrl);
          if (info.localIp) setPairingServerIp(info.localIp);
          if (info.isSecureTunnel !== undefined) setIsSecureTunnel(info.isSecureTunnel);
        })
        .catch(() => {});
    };
    updatePairing();
    const interval = setInterval(updatePairing, 5000);
    return () => clearInterval(interval);
  }, [showPairingQr]);

  const loadUpiAlerts = async () => {
    setIsLoadingAlerts(true);
    try {
      const res = await upiObserverApi.getHistory();
      setRecentAlerts(res.alerts || []);
    } catch (err) {
      console.warn("Failed to load UPI alerts:", err);
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  const handleSimulateSmsInSettings = async () => {
    setIsSimulatingSms(true);
    setSimResult(null);
    try {
      const amt = parseFloat(simBankAmount) || 140;
      const res = await upiObserverApi.simulatePayment({
        amountRupees: amt,
        bankName: simBankName,
        payerVpa: simPayerVpa,
      });

      setSimResult({
        success: true,
        message: `Parsed & Recorded ₹${amt.toFixed(2)} from ${simBankName}!`,
        sms: res.simulatedSms,
      });
      loadUpiAlerts();
      showNotification("success", `Simulated ₹${amt.toFixed(2)} payment notification received!`);
    } catch (err: any) {
      setSimResult({
        success: false,
        message: err.response?.data?.error || "Simulation failed",
      });
    } finally {
      setIsSimulatingSms(false);
    }
  };

  const loadStaffUsers = async () => {
    setIsLoadingStaff(true);
    try {
      const users = await usersApi.listUsers();
      setStaffUsers(users);
    } catch (err: any) {
      console.warn("Failed to load staff list:", err);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === "STAFF") {
      loadStaffUsers();
    }
    if (user?.displayName) {
      setMyDisplayName(user.displayName);
    }
  }, [activeTab, user]);

  // Save Store Settings
  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const trimmedUpiId = upiId.trim();
      const trimmedUpiName = upiPayeeName.trim() || restaurantName;

      await settingsApi.updateSettings({
        name: restaurantName,
        tagline,
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
        upiAutoVerifyEnabled,
        upiWebhookSecret: upiWebhookSecret.trim() || "rollz_upi_secret_default",
      });

      if (trimmedUpiId) {
        localStorage.setItem("rollz_pos_upi_id", trimmedUpiId);
      } else {
        localStorage.removeItem("rollz_pos_upi_id");
      }
      localStorage.setItem("rollz_pos_upi_payee_name", trimmedUpiName);
      localStorage.setItem("rollz_pos_tax_mode", taxMode);

      await refreshAuthStatus();
      showNotification("success", "Restaurant settings saved successfully.");
    } catch (err: any) {
      showNotification("error", err.response?.data?.error?.message || "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  // Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploadingLogo(true);
      try {
        const res = await settingsApi.uploadLogo(file);
        setLogoPath(res.logoPath);
        await refreshAuthStatus();
        showNotification("success", "Logo updated successfully!");
      } catch (err: any) {
        showNotification("error", err.response?.data?.error?.message || "Failed to upload logo");
      } finally {
        setIsUploadingLogo(false);
      }
    }
  };

  const handleResetLogo = async () => {
    try {
      await settingsApi.deleteLogo();
      setLogoPath(null);
      await refreshAuthStatus();
      showNotification("success", "Logo reset to default Rollz branding.");
    } catch (err: any) {
      showNotification("error", "Failed to reset logo");
    }
  };

  // Login Background Wallpaper Upload
  const handleLoginBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploadingBg(true);
      try {
        const res = await settingsApi.uploadLoginBg(file);
        setLoginBgPath(res.loginBgPath);
        await refreshAuthStatus();
        showNotification("success", "Login screen wallpaper updated successfully!");
      } catch (err: any) {
        showNotification("error", err.response?.data?.error?.message || "Failed to upload wallpaper");
      } finally {
        setIsUploadingBg(false);
      }
    }
  };

  const handleResetLoginBg = async () => {
    try {
      await settingsApi.deleteLoginBg();
      setLoginBgPath(null);
      await refreshAuthStatus();
      showNotification("success", "Login screen background reset to default.");
    } catch (err: any) {
      showNotification("error", "Failed to reset background");
    }
  };

  // Create Staff / Cashier
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newUserPassword.trim()) return;
    setIsCreatingUser(true);
    try {
      await usersApi.createUser({
        username: newUsername.trim(),
        displayName: newDisplayName.trim() || newUsername.trim(),
        password: newUserPassword,
        role: newUserRole,
      });
      showNotification("success", `Staff member '${newDisplayName || newUsername}' created successfully!`);
      setIsAddUserOpen(false);
      setNewUsername("");
      setNewDisplayName("");
      setNewUserPassword("");
      loadStaffUsers();
    } catch (err: any) {
      showNotification("error", err.response?.data?.error?.message || "Failed to create staff member");
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Toggle Staff Status
  const handleToggleStaffStatus = async (staffId: string) => {
    try {
      const res = await usersApi.toggleStatus(staffId);
      showNotification("success", res.message);
      loadStaffUsers();
    } catch (err: any) {
      showNotification("error", err.response?.data?.error?.message || "Failed to change user status");
    }
  };

  // Reset Staff Password
  const handleResetStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !staffNewPassword.trim()) return;
    setIsResettingPassword(true);
    try {
      const res = await usersApi.resetPassword(resetTargetUser.id, staffNewPassword);
      showNotification("success", res.message);
      setResetTargetUser(null);
      setStaffNewPassword("");
    } catch (err: any) {
      showNotification("error", err.response?.data?.error?.message || "Failed to reset password");
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Change My Password
  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showNotification("error", "New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 6) {
      showNotification("error", "New password must be at least 6 characters long.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      showNotification("success", "Your password has been changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showNotification("error", err.response?.data?.error?.message || "Failed to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Update My Profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myDisplayName.trim()) return;
    setIsUpdatingProfile(true);
    try {
      await authApi.updateProfile({ displayName: myDisplayName.trim() });
      await refreshAuthStatus();
      showNotification("success", "Profile display name updated!");
    } catch (err: any) {
      showNotification("error", err.response?.data?.error?.message || "Failed to update profile.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Restart Secure UPI Tunnel
  const handleRestartTunnel = async () => {
    setIsRestartingTunnel(true);
    try {
      const res = await fetch("/api/upi-observer/tunnel/restart", { method: "POST" });
      const data = await res.json();
      if (data.tunnelUrl) {
        setPairingServerUrl(data.tunnelUrl);
        setIsSecureTunnel(true);
        showNotification("success", `Secure HTTPS tunnel updated: ${data.tunnelUrl}`);
      } else {
        showNotification("error", "Could not restart tunnel. Using local IP.");
      }
    } catch {
      showNotification("error", "Failed to restart tunnel");
    } finally {
      setIsRestartingTunnel(false);
    }
  };

  // Test Print
  const handleTestPrint = async (destination: "CUSTOMER_RECEIPT" | "KITCHEN") => {
    setTestingPrinter(destination);
    try {
      const res = await settingsApi.testPrint(destination);
      showNotification("success", res.message);
    } catch (err: any) {
      showNotification("error", err.response?.data?.error?.message || "Test print failed");
    } finally {
      setTestingPrinter(null);
    }
  };

  // Database Backup
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const res = await settingsApi.triggerBackup();
      showNotification("success", `Backup created: ${res.backup.filename}`);
      const bRes = await settingsApi.getBackups();
      setBackups(bRes.backups);
    } catch (err: any) {
      showNotification("error", err.response?.data?.error?.message || "Failed to create database backup.");
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
      showNotification("error", err.response?.data?.error?.message || "Restore verification failed");
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
    <div className="space-y-6 max-w-5xl pb-16 mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight flex items-center gap-2.5">
            <Store className="w-6 h-6 text-[#2563EB]" />
            <span>Settings & System Administration</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Manage restaurant branding, cashiers, user accounts, thermal printers, and database backups.
          </p>
        </div>

        {activeTab === "STORE" && isOwnerOrManager && (
          <button
            onClick={handleSaveStoreSettings}
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

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("STORE")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "STORE"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 border border-[#E2E8F0] hover:bg-slate-50"
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Store & Branding</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("STAFF")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "STAFF"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 border border-[#E2E8F0] hover:bg-slate-50"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff & Cashiers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ACCOUNT")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "ACCOUNT"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 border border-[#E2E8F0] hover:bg-slate-50"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>My Account & Password</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PRINTERS")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "PRINTERS"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 border border-[#E2E8F0] hover:bg-slate-50"
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Thermal Printers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("BACKUPS")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "BACKUPS"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 border border-[#E2E8F0] hover:bg-slate-50"
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Backups & LAN</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: STORE & BRANDING                                      */}
      {/* ============================================================ */}
      {activeTab === "STORE" && (
        <form onSubmit={handleSaveStoreSettings} className="space-y-6">
          {/* Section: Custom Branding (Logo & Login Photo) */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
            <div>
              <h2 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#2563EB]" />
                <span>Restaurant Branding & Visuals</span>
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Customize your restaurant logo and the welcome wallpaper on the POS login page.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Logo Uploader */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Restaurant Logo</span>
                  {logoPath && (
                    <button
                      type="button"
                      onClick={handleResetLogo}
                      className="text-[11px] text-red-600 hover:underline font-semibold"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>

                <div className="h-28 bg-white border border-slate-200 rounded-xl flex items-center justify-center p-3 relative overflow-hidden shadow-xs">
                  <img
                    src={logoPath || "/rollz-logo.png"}
                    alt="Logo Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <label className="block w-full">
                  <span className="sr-only">Choose Logo</span>
                  <div className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isUploadingLogo ? "Uploading..." : "Upload New Logo"}</span>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-slate-400 text-center">
                  PNG, SVG, or WEBP transparent logo recommended.
                </p>
              </div>

              {/* Login Wallpaper Uploader */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Login Screen Wallpaper</span>
                  {loginBgPath && (
                    <button
                      type="button"
                      onClick={handleResetLoginBg}
                      className="text-[11px] text-red-600 hover:underline font-semibold"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>

                <div className="h-28 bg-slate-900 border border-slate-200 rounded-xl flex items-center justify-center relative overflow-hidden shadow-xs">
                  {loginBgPath ? (
                    <img
                      src={loginBgPath}
                      alt="Login Background Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-3 space-y-1">
                      <ImageIcon className="w-6 h-6 text-slate-400 mx-auto" />
                      <span className="text-[10px] text-slate-400 block">Default dark gradient theme</span>
                    </div>
                  )}
                </div>

                <label className="block w-full">
                  <span className="sr-only">Choose Wallpaper</span>
                  <div className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isUploadingBg ? "Uploading..." : "Upload Login Wallpaper"}</span>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLoginBgUpload}
                    disabled={isUploadingBg}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-slate-400 text-center">
                  Full HD restaurant banner or food photo (up to 15MB).
                </p>
              </div>
            </div>
          </div>

          {/* Section: Restaurant Identity & Regulatory */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
            <div>
              <h2 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                <Store className="w-4 h-4 text-[#2563EB]" />
                <span>Restaurant Information & Tax Mode</span>
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Physical location, legal identity, and tax regulation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Restaurant Name</label>
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="e.g. ROLLZ Fast Food"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Brand Tagline / Slogan</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Fresh • Crispy • Handcrafted"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Branch Code</label>
                <input
                  type="text"
                  disabled
                  value={branchCode}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-mono font-semibold text-slate-500 bg-slate-100 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Store contact number"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Restaurant Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, State, PIN"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>

            {/* Regulatory Tax Mode */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172033]">Tax Regulatory Mode</label>
                  <select
                    value={taxMode}
                    onChange={(e) => setTaxMode(e.target.value as "GST" | "NON_GST")}
                    className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                  >
                    <option value="GST">GST Mode (CGST + SGST)</option>
                    <option value="NON_GST">Non-GST Simple Bill (0% Tax)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172033]">GSTIN Number</label>
                  <input
                    type="text"
                    disabled={taxMode === "NON_GST"}
                    value={taxMode === "NON_GST" ? "N/A (Non-GST)" : gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="e.g. 32AAAAA0000A1Z5"
                    className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-mono font-semibold text-[#172033] bg-[#F8FAFC] disabled:bg-slate-100 disabled:text-slate-400 focus:bg-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172033]">Default GST Rate (%)</label>
                  <input
                    type="number"
                    disabled={taxMode === "NON_GST"}
                    value={taxMode === "NON_GST" ? 0 : defaultTaxRate}
                    onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] disabled:bg-slate-100 disabled:text-slate-400 focus:bg-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div
                className={`p-3 rounded-xl text-xs ${
                  taxMode === "NON_GST"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-blue-50 text-blue-800 border border-blue-200"
                }`}
              >
                {taxMode === "NON_GST" ? (
                  <span>
                    <strong>Non-GST Mode Active:</strong> 0% tax is applied to orders. Checkout banners show &quot;No GST&quot;, and receipts print as Simple Bills without GSTIN lines.
                  </span>
                ) : (
                  <span>
                    <strong>GST Mode Active:</strong> Standard 5% GST (2.5% CGST + 2.5% SGST) applied to bills, with registered GSTIN printed on receipts.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section: UPI Payments & Dynamic QR Configuration with Live Test */}
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
                      className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-mono font-medium text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                    <p className="text-[11px] text-slate-500">
                      Any customer scanning this QR code in GPay, PhonePe, Paytm, or BHIM will send payment directly to this ID.
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
                      className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
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
                      className="w-24 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-bold text-[#172033] focus:outline-none focus:border-[#2563EB]"
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
                      <span className="truncate">{upiId.trim()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(upiId.trim());
                          setHasCopiedUpi(true);
                          setTimeout(() => setHasCopiedUpi(false), 2000);
                        }}
                        className="text-blue-600 hover:text-blue-800 cursor-pointer ml-1 shrink-0"
                        title="Copy UPI ID"
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

          {/* Section: Automated UPI Payment Observer & Soundbox (Zero-Fee) */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#172033]">Automated UPI Observer & Soundbox</h2>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">
                      0% Gateway Fees
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">
                    Automatically detects and confirms customer UPI payments via incoming bank credit SMS notifications
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/uploads/youpi-sms-gateway.apk"
                  download="youpi-sms-gateway.apk"
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Download the Android Observer APK directly to your phone"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>📥 Download APK</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowPairingQr(!showPairingQr)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border ${
                    showPairingQr
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showPairingQr ? "Hide Pairing QR" : "📷 1-Tap Pair Phone"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSetupGuide(!showSetupGuide)}
                  className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
                >
                  {showSetupGuide ? "Hide Guide" : "📖 Guide"}
                </button>
              </div>
            </div>

            {/* 1-Tap Phone Pairing QR & Manual Pairing Card */}
            {showPairingQr && (() => {
              const activeGatewayUrl = pairingServerUrl || (pairingServerIp ? `http://${pairingServerIp}:5000` : "http://192.168.1.9:5000");
              return (
              <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl space-y-5 animate-in fade-in">
                <div className="flex flex-col md:flex-row items-center justify-between gap-5">
                  <div className="space-y-2 text-center md:text-left flex-1">
                    <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                      <span className="text-[10px] uppercase font-black tracking-wider text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                        Instant Pairing
                      </span>
                      {isSecureTunnel ? (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>HTTPS Tunnel Verified (Android CA Trusted)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                          Local LAN Mode
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-black text-purple-950">
                      Pair Phone with Rollz POS (Camera QR or Manual)
                    </h3>
                    <p className="text-xs text-purple-800 leading-relaxed">
                      1. Open <strong>YOUPI SMS Gateway</strong> on your Android phone.<br />
                      2. Tap <strong>[📷 SCAN PAIRING QR]</strong> and point camera at the QR code.<br />
                      3. The app connects over verified HTTPS and immediately activates!
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="text-purple-900 font-semibold text-[11px]">PC Network IP:</span>
                      <input
                        type="text"
                        value={pairingServerIp}
                        onChange={(e) => setPairingServerIp(e.target.value)}
                        className="px-2 py-1 text-xs bg-white border border-purple-300 rounded-lg font-mono text-purple-950 w-32 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        placeholder="192.168.1.9"
                      />
                      <button
                        type="button"
                        onClick={handleRestartTunnel}
                        disabled={isRestartingTunnel}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-purple-700 bg-white hover:bg-purple-100 border border-purple-300 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                        title="Generate or refresh HTTPS tunnel connection"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRestartingTunnel ? "animate-spin" : ""}`} />
                        <span>{isRestartingTunnel ? "Connecting..." : "Refresh Tunnel"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-2xl shadow-md border border-purple-200 shrink-0">
                    <QRCodeSVG
                      value={JSON.stringify({
                        type: "YOUPI_SMS_GATEWAY_PAIR",
                        version: "v1",
                        serverUrl: activeGatewayUrl,
                        gatewayUrl: activeGatewayUrl,
                        apiBaseUrl: activeGatewayUrl,
                        enrollmentToken: upiWebhookSecret || "rollz_upi_secret_default",
                        token: upiWebhookSecret || "rollz_upi_secret_default",
                        merchantId: branch?.id || "00000000-0000-0000-0000-000000000001",
                      })}
                      size={140}
                      level="M"
                    />
                    <span className="text-[10px] font-bold text-purple-700">Scan via Android App</span>
                  </div>
                </div>

                {/* Manual Credentials Box */}
                <div className="bg-white/80 border border-purple-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <span>⌨️ Manual Pairing Credentials (in App under Optional):</span>
                    </span>
                    <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-mono font-bold">
                      {isSecureTunnel ? "HTTPS Port 443" : "HTTP Port 5000"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Gateway URL</span>
                        <code className="text-xs font-bold text-slate-800 font-mono truncate block" title={activeGatewayUrl}>
                          {activeGatewayUrl}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activeGatewayUrl);
                          showNotification("success", "Gateway URL copied!");
                        }}
                        className="px-2 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded cursor-pointer shrink-0"
                      >
                        Copy
                      </button>
                    </div>

                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Enrollment Secret Token</span>
                        <code className="text-xs font-bold text-slate-800 font-mono">
                          {upiWebhookSecret || "rollz_upi_secret_default"}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(upiWebhookSecret || "rollz_upi_secret_default");
                          showNotification("success", "Secret Token copied!");
                        }}
                        className="px-2 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded cursor-pointer shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-purple-900 leading-snug">
                    👉 In the phone app, enter the Gateway URL and Secret Token above, then tap <strong>[Manual Connect]</strong>!
                  </p>
                </div>
              </div>
              );
            })()}

            {/* How It Works Guide Accordion */}
            {showSetupGuide && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl text-xs space-y-3 animate-in fade-in">
                <h4 className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Network className="w-4 h-4 text-blue-600" />
                  <span>3-Step Quick Phone Setup (YouPI Android APK or SMS Forwarder)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-700">
                  <div className="p-3 bg-white rounded-xl border border-blue-100">
                    <span className="font-bold text-blue-700 block mb-1">1. Install on Phone</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Install the YouPI Android Observer APK or any SMS-to-URL forwarder (like Tasker or MacroDroid) on the phone that receives your shop's bank SMS.
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-blue-100">
                    <span className="font-bold text-blue-700 block mb-1">2. Paste Webhook URL</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Set the target POST URL to your Rollz POS Webhook URL below and add the secret token header.
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-blue-100">
                    <span className="font-bold text-blue-700 block mb-1">3. Zero-Fee Instant POS Check</span>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      When a customer scans your QR and pays, the phone forwards the credit alert, and the billing screen auto-completes with zero fees!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Webhook Configuration & Secret Token */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">
                  Your Phone Webhook Target URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${pairingServerUrl || (pairingServerIp ? `http://${pairingServerIp}:5000` : "http://192.168.1.9:5000")}/api/upi-observer/webhook`}
                    className="flex-1 h-10 px-3 rounded-xl border border-[#E2E8F0] text-xs font-mono font-medium text-slate-700 bg-slate-50 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${pairingServerUrl || (pairingServerIp ? `http://${pairingServerIp}:5000` : "http://192.168.1.9:5000")}/api/upi-observer/webhook`;
                      navigator.clipboard.writeText(url);
                      setHasCopiedWebhookUrl(true);
                      setTimeout(() => setHasCopiedWebhookUrl(false), 2000);
                    }}
                    className="h-10 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                    title="Copy Webhook URL"
                  >
                    {hasCopiedWebhookUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Target endpoint where MacroDroid forwards bank credit SMS notifications.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">
                  Security Webhook Secret (Header: x-upi-secret)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={upiWebhookSecret}
                    onChange={(e) => setUpiWebhookSecret(e.target.value)}
                    placeholder="rollz_upi_secret_default"
                    className="flex-1 h-10 px-3 rounded-xl border border-[#E2E8F0] text-xs font-mono font-medium text-slate-700 bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(upiWebhookSecret);
                      setHasCopiedSecret(true);
                      setTimeout(() => setHasCopiedSecret(false), 2000);
                    }}
                    className="h-10 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                    title="Copy Secret"
                  >
                    {hasCopiedSecret ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Secret token required in <code className="font-mono text-blue-600">x-upi-secret</code> header for security.
                </p>
              </div>
            </div>

            {/* Test Payment Simulator Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#172033] flex items-center gap-1.5">
                    <span>⚡ Interactive Bank Notification Simulator</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Test the bank SMS parser and live billing screen match without spending real money
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Test Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={simBankAmount}
                    onChange={(e) => setSimBankAmount(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Bank Source</label>
                  <select
                    value={simBankName}
                    onChange={(e) => setSimBankName(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="State Bank of India">State Bank of India (SBI)</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="Axis Bank">Axis Bank</option>
                    <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                    <option value="Paytm Payments Bank">Paytm Payments Bank</option>
                    <option value="PhonePe Merchant">PhonePe SmartSpeaker</option>
                    <option value="Google Pay Business">Google Pay Business</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Customer Payer VPA</label>
                  <input
                    type="text"
                    value={simPayerVpa}
                    onChange={(e) => setSimPayerVpa(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSimulateSmsInSettings}
                  disabled={isSimulatingSms}
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSimulatingSms ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡ Send Test SMS</span>
                    </>
                  )}
                </button>
              </div>

              {simResult && (
                <div className={`p-3 rounded-xl border text-xs space-y-1 animate-in fade-in ${
                  simResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {simResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                    <span>{simResult.message}</span>
                  </div>
                  {simResult.sms && (
                    <p className="font-mono text-[10px] bg-white/80 p-2 rounded border border-emerald-200 text-slate-700">
                      {simResult.sms}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Recent Bank Alerts Log */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Recent Inbound Bank Credit Alerts ({recentAlerts.length})
                </span>
                <button
                  type="button"
                  onClick={loadUpiAlerts}
                  disabled={isLoadingAlerts}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingAlerts ? "animate-spin" : ""}`} />
                  <span>Refresh Log</span>
                </button>
              </div>

              {recentAlerts.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  No bank credit alerts recorded yet. Click &quot;Send Test SMS&quot; above to verify parser!
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                      <tr>
                        <th className="p-2.5 px-3">Time</th>
                        <th className="p-2.5 px-3">Bank Source</th>
                        <th className="p-2.5 px-3">Amount</th>
                        <th className="p-2.5 px-3">12-Digit UTR</th>
                        <th className="p-2.5 px-3">Payer</th>
                        <th className="p-2.5 px-3">POS Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentAlerts.slice(0, 5).map((alert) => (
                        <tr key={alert.id} className="hover:bg-slate-50/60 font-medium">
                          <td className="p-2.5 px-3 text-slate-500 text-[11px]">
                            {new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="p-2.5 px-3 font-semibold text-[#172033]">
                            {alert.bankName || "Bank UPI"}
                          </td>
                          <td className="p-2.5 px-3 font-mono font-bold text-emerald-600">
                            ₹{(alert.amountPaise / 100).toFixed(2)}
                          </td>
                          <td className="p-2.5 px-3 font-mono text-[11px] text-slate-700">
                            {alert.utrNumber || "—"}
                          </td>
                          <td className="p-2.5 px-3 text-[11px] text-slate-500 truncate max-w-[120px]">
                            {alert.payerInfo || "Customer"}
                          </td>
                          <td className="p-2.5 px-3">
                            {alert.matched ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Matched ✓
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                Received
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Section: Receipt Header & Footer */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
            <div>
              <h2 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#2563EB]" />
                <span>Receipt Header & Footer Messages</span>
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Printed on top and bottom of customer thermal receipts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Receipt Header Note</label>
                <textarea
                  rows={3}
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E2E8F0] text-xs font-mono text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Receipt Footer Greeting</label>
                <textarea
                  rows={3}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E2E8F0] text-xs font-mono text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ============================================================ */}
      {/* TAB 2: STAFF & CASHIER MANAGEMENT                           */}
      {/* ============================================================ */}
      {activeTab === "STAFF" && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#2563EB]" />
                  <span>Cashiers & Staff Accounts</span>
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Create cashier login credentials, reset passwords, and toggle staff active status.
                </p>
              </div>

              {isOwnerOrManager && (
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(true)}
                  className="flex items-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Cashier</span>
                </button>
              )}
            </div>

            {/* Staff List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingStaff ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#2563EB] mb-2" />
                        <span>Loading staff members...</span>
                      </td>
                    </tr>
                  ) : staffUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No staff members found</p>
                      </td>
                    </tr>
                  ) : (
                    staffUsers.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-[#2563EB] font-bold flex items-center justify-center text-xs">
                              {st.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span>{st.displayName}</span>
                              {st.id === user?.id && (
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-semibold">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                          @{st.username}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              st.role === "OWNER"
                                ? "bg-purple-100 text-purple-800"
                                : st.role === "MANAGER"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {st.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              st.isActive
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {st.isActive ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(st.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {isOwnerOrManager && (
                            <>
                              <button
                                type="button"
                                onClick={() => setResetTargetUser(st)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              >
                                Reset PIN
                              </button>

                              {st.id !== user?.id && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStaffStatus(st.id)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    st.isActive
                                      ? "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                                  }`}
                                >
                                  {st.isActive ? "Deactivate" : "Activate"}
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: MY ACCOUNT & PASSWORD                                 */}
      {/* ============================================================ */}
      {activeTab === "ACCOUNT" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Profile Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
            <div>
              <h2 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-[#2563EB]" />
                <span>My Account Profile</span>
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Current active session details and display settings.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-lg flex items-center justify-center shadow-md">
                  {user?.displayName?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{user?.displayName}</h3>
                  <p className="text-xs text-slate-500 font-mono">@{user?.username}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px] font-semibold">Role</span>
                  <span className="font-bold text-slate-800">{user?.role}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-semibold">Branch</span>
                  <span className="font-bold text-slate-800">{branch?.name || "ROLLZ Main"}</span>
                </div>
              </div>
            </div>

            {/* Edit Display Name Form */}
            <form onSubmit={handleUpdateProfile} className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-[#172033] block">Display Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={myDisplayName}
                  onChange={(e) => setMyDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="flex-1 h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
                <button
                  type="submit"
                  disabled={isUpdatingProfile || myDisplayName === user?.displayName}
                  className="h-10 px-4 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                >
                  {isUpdatingProfile ? "Updating..." : "Save Name"}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
            <div>
              <h2 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-600" />
                <span>Change Password</span>
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Update your login password securely.
              </p>
            </div>

            <form onSubmit={handleChangeMyPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#172033]">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#172033]">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#172033]">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <button
                type="submit"
                disabled={isChangingPassword || !currentPassword || !newPassword}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isChangingPassword ? "Updating Password..." : "Update Password"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: THERMAL PRINTERS                                      */}
      {/* ============================================================ */}
      {activeTab === "PRINTERS" && (
        <div className="space-y-6">
          {/* Customer Receipt Printer */}
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Printer Status</label>
                <div className="flex items-center h-10">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={customerPrinterEnabled}
                      onChange={(e) => setCustomerPrinterEnabled(e.target.checked)}
                      className="rounded text-[#2563EB] focus:ring-blue-100 w-4 h-4"
                    />
                    <span>{customerPrinterEnabled ? "Enabled" : "Disabled"}</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Adapter / Type</label>
                <select
                  value={customerPrinterType}
                  onChange={(e) => setCustomerPrinterType(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="MOCK">MOCK (Virtual Log Adapter)</option>
                  <option value="NETWORK_TCP">NETWORK_TCP (ESC/POS LAN)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Network Address (IP:Port)</label>
                <input
                  type="text"
                  disabled={customerPrinterType === "MOCK"}
                  value={customerPrinterAddress}
                  onChange={(e) => setCustomerPrinterAddress(e.target.value)}
                  placeholder="192.168.1.200:9100"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-mono text-[#172033] bg-[#F8FAFC] disabled:bg-slate-100 disabled:text-slate-400 focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Paper Width</label>
                <select
                  value={customerPrinterPaperWidth}
                  onChange={(e) => setCustomerPrinterPaperWidth(parseInt(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value={80}>80 mm (Standard Restaurant)</option>
                  <option value={58}>58 mm (Compact Mobile)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Kitchen Ticket (KOT) Printer */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#172033]">Kitchen Order Ticket (KOT) Printer</h2>
                  <p className="text-xs text-[#64748B]">Thermal printer dispatching orders to preparation line</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleTestPrint("KITCHEN")}
                disabled={testingPrinter === "KITCHEN" || !kitchenPrinterEnabled}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-[#172033] transition-all disabled:opacity-40 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-600" />
                <span>{testingPrinter === "KITCHEN" ? "Testing..." : "Test KOT"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">KOT Printer Status</label>
                <div className="flex items-center h-10">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={kitchenPrinterEnabled}
                      onChange={(e) => setKitchenPrinterEnabled(e.target.checked)}
                      className="rounded text-[#2563EB] focus:ring-blue-100 w-4 h-4"
                    />
                    <span>{kitchenPrinterEnabled ? "Enabled" : "Disabled"}</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Adapter / Type</label>
                <select
                  value={kitchenPrinterType}
                  onChange={(e) => setKitchenPrinterType(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="MOCK">MOCK (Virtual Log Adapter)</option>
                  <option value="NETWORK_TCP">NETWORK_TCP (ESC/POS LAN)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Network Address (IP:Port)</label>
                <input
                  type="text"
                  disabled={kitchenPrinterType === "MOCK"}
                  value={kitchenPrinterAddress}
                  onChange={(e) => setKitchenPrinterAddress(e.target.value)}
                  placeholder="192.168.1.201:9100"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E2E8F0] text-xs font-mono text-[#172033] bg-[#F8FAFC] disabled:bg-slate-100 disabled:text-slate-400 focus:bg-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Paper Width</label>
                <select
                  value={kitchenPrinterPaperWidth}
                  onChange={(e) => setKitchenPrinterPaperWidth(parseInt(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:bg-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value={80}>80 mm (Standard KOT)</option>
                  <option value={58}>58 mm (Compact KOT)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: BACKUPS & LAN                                         */}
      {/* ============================================================ */}
      {activeTab === "BACKUPS" && (
        <div className="space-y-6">
          {/* LAN Connection Info */}
          {hostInfo && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-sm">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#172033]">Local Network Deployment (LAN Ready)</h2>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Connect tablets and counters via this computer's local IP on port{" "}
                    <span className="font-mono font-bold text-[#2563EB]">{hostInfo.port}</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Database Backup Section */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-7 shadow-card space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-[#172033] flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-purple-600" />
                  <span>Production PostgreSQL Backups</span>
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Automated backups stored in your local server directory.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackupNow}
                disabled={isBackingUp}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <HardDrive className="w-4 h-4" />
                <span>{isBackingUp ? "Backing up..." : "Create Backup Now"}</span>
              </button>
            </div>

            {/* Backups Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Filename</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No backups found. Click &quot;Create Backup Now&quot; above to take a manual snapshot.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {b.filename}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {(b.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(b.createdAt).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleTestRestore(b.filename)}
                            disabled={restoringBackup === b.filename}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            {restoringBackup === b.filename ? "Verifying..." : "Verify Restore"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Staff / Cashier */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateStaff}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#2563EB]" />
                <span>Create New Cashier / Staff</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Staff Full Name</label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Login Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. cashier1"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] font-mono focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-bold text-[#172033] focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="CASHIER">CASHIER (POS Billing Only)</option>
                  <option value="MANAGER">MANAGER (POS, Stock & Reports)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Initial Password / PIN</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingUser || !newUsername || !newUserPassword}
                className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isCreatingUser ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Reset Staff Password */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <form
            onSubmit={handleResetStaffPassword}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-600" />
                <span>Reset Staff Password</span>
              </h3>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p>Staff: <strong className="text-slate-900">{resetTargetUser.displayName}</strong></p>
              <p>Username: <strong className="font-mono text-slate-800">@{resetTargetUser.username}</strong></p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">New Password / PIN</label>
              <input
                type="password"
                required
                minLength={6}
                value={staffNewPassword}
                onChange={(e) => setStaffNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isResettingPassword || !staffNewPassword}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              >
                {isResettingPassword ? "Saving..." : "Set New Password"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
