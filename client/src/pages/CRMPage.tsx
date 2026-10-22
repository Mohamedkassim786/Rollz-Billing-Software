import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  MessageSquare,
  QrCode,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  Sparkles,
  Award,
  Wallet,
  Smartphone,
  Check,
  X,
  Power,
  Info,
} from "lucide-react";
import { whatsappApi, WhatsAppStatusResponse } from "../api/whatsapp.api";
import { customersApi, CustomerRecord } from "../api/customers.api";
import { formatPaise } from "../utils/currency";

export const CRMPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"BROADCAST" | "WHATSAPP" | "CUSTOMERS">("BROADCAST");

  // WhatsApp State
  const [waStatus, setWaStatus] = useState<WhatsAppStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Hello from ROLLZ Restaurant! Your WhatsApp integration is working perfectly. 🌯✨");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Customer List State
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [totalCustomersCount, setTotalCustomersCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustNotes, setNewCustNotes] = useState("");
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Broadcast State
  const [broadcastTarget, setBroadcastTarget] = useState<"ALL" | "VIP" | "REGULAR">("ALL");
  const [broadcastText, setBroadcastText] = useState(
    "🔥 *WEEKEND SPECIAL AT ROLLZ!* 🔥\n\nHello {{name}}, enjoy flat *20% OFF* on all Handcrafted Rolls & Burgers this Saturday & Sunday!\n\nShow this WhatsApp message at the billing counter to claim your discount.\n\n📍 *Visit Rollz Restaurant today!*"
  );
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);

  // Quick message presets
  const messagePresets = [
    {
      title: "🔥 Weekend 20% OFF",
      text: "🔥 *WEEKEND SPECIAL AT ROLLZ!* 🔥\n\nHello {{name}}, enjoy flat *20% OFF* on all Handcrafted Rolls & Burgers this Saturday & Sunday!\n\nShow this WhatsApp message at the billing counter to claim your discount.\n\n📍 *Visit Rollz Restaurant today!*",
    },
    {
      title: "🎉 Flat ₹50 Discount",
      text: "🎉 *SPECIAL ROLLZ TREAT!* 🎉\n\nDear {{name}}, get flat *₹50 OFF* on your next order above ₹299!\n\nValid for Dine-in & Takeaway this entire week. Treat yourself and your friends!\n\n📍 *Rollz - Fresh • Crispy • Handcrafted*",
    },
    {
      title: "🥤 Free Beverage Combo",
      text: "🥤 *FREE COOLER WITH EVERY ROLL!* 🌯\n\nHey {{name}}, buy any 2 Special Rolls and get a chilled beverage absolutely *FREE*!\n\nCome visit us today. We can't wait to serve you!\n\n❤️ *Team Rollz*",
    },
  ];

  // 1. Fetch WhatsApp Status
  const loadWhatsAppStatus = useCallback(async () => {
    try {
      const data = await whatsappApi.getStatus();
      setWaStatus(data);
    } catch (err) {
      console.warn("Failed to fetch WhatsApp status:", err);
    }
  }, []);

  // Poll status every 4 seconds if waiting for QR scan or broadcasting
  useEffect(() => {
    loadWhatsAppStatus();
    const interval = setInterval(() => {
      loadWhatsAppStatus();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadWhatsAppStatus]);

  // 2. Fetch Customers
  const loadCustomers = useCallback(async () => {
    setIsLoadingCustomers(true);
    try {
      const data = await customersApi.listCustomers(1, 100, searchQuery);
      setCustomers(data.customers);
      setTotalCustomersCount(data.pagination.total);
    } catch (err) {
      console.warn("Failed to load customers:", err);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Handle WhatsApp Init / QR generation
  const handleInitWhatsApp = async () => {
    setIsLoadingStatus(true);
    try {
      const data = await whatsappApi.initSession();
      setWaStatus(data);
    } catch (err: any) {
      alert("Failed to initialize WhatsApp: " + (err.message || "Unknown error"));
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Handle WhatsApp Logout / Disconnect
  const handleLogoutWhatsApp = async () => {
    if (!confirm("Are you sure you want to disconnect this WhatsApp session? You will need to scan QR code again.")) {
      return;
    }
    setIsLoadingStatus(true);
    try {
      await whatsappApi.logoutSession();
      await loadWhatsAppStatus();
    } catch (err: any) {
      alert("Failed to logout: " + (err.message || "Unknown error"));
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Send Single Test Message
  const handleSendTestMessage = async () => {
    if (!testPhone.trim()) {
      setTestResult({ type: "error", text: "Please enter a 10-digit mobile number." });
      return;
    }
    setIsSendingTest(true);
    setTestResult(null);
    try {
      await whatsappApi.sendMessage(testPhone, testMessage);
      setTestResult({ type: "success", text: `Test message sent successfully to +91 ${testPhone}!` });
    } catch (err: any) {
      setTestResult({ type: "error", text: err.response?.data?.error?.message || err.message || "Failed to send message" });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Target audience count calculation
  const targetAudienceCount = useMemo(() => {
    if (broadcastTarget === "VIP") {
      return customers.filter((c) => c.totalVisits >= 3).length;
    }
    if (broadcastTarget === "REGULAR") {
      return customers.filter((c) => c.totalVisits >= 2).length;
    }
    return totalCustomersCount || customers.length;
  }, [broadcastTarget, customers, totalCustomersCount]);

  // Execute Bulk Broadcast
  const handleExecuteBroadcast = async () => {
    setBroadcastConfirmOpen(false);
    setIsBroadcasting(true);
    setBroadcastFeedback(null);
    try {
      const minVisits = broadcastTarget === "VIP" ? 3 : broadcastTarget === "REGULAR" ? 2 : 0;
      const res = await whatsappApi.broadcast(broadcastText, minVisits);
      setBroadcastFeedback(`Broadcast initiated for ${res.total} customers! Messages are being dispatched with 1.5s safe spacing.`);
      await loadWhatsAppStatus();
    } catch (err: any) {
      setBroadcastFeedback("Broadcast failed: " + (err.response?.data?.error?.message || err.message || "Error"));
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Save New Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustPhone.trim()) return;
    setIsSavingCustomer(true);
    try {
      await customersApi.createCustomer({
        name: newCustName.trim() || "Valued Customer",
        phone: newCustPhone.trim(),
        notes: newCustNotes.trim() || undefined,
      });
      setIsAddCustomerOpen(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustNotes("");
      loadCustomers();
    } catch (err: any) {
      alert("Failed to save customer: " + (err.response?.data?.error?.message || err.message));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Stats
  const totalSpendSum = useMemo(() => {
    return customers.reduce((acc, c) => acc + c.totalSpent, 0);
  }, [customers]);

  const totalVisitsSum = useMemo(() => {
    return customers.reduce((acc, c) => acc + c.totalVisits, 0);
  }, [customers]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 opacity-10 pointer-events-none flex items-center justify-center">
          <MessageSquare className="w-80 h-80" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold text-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Free Local WhatsApp Web Integration (Zero API Fees)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Customers & WhatsApp Marketing
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl leading-relaxed">
              Auto-send welcome greetings & digital receipts when orders complete, save customer loyalty
              profiles automatically, and send 1-click broadcast offers to all your customers.
            </p>
          </div>

          {/* Quick WhatsApp Status Badge */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 shrink-0 shadow-lg">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                waStatus?.status === "CONNECTED"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-400/40"
                  : waStatus?.status === "SCAN_QR"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-400/40"
                  : "bg-slate-500/20 text-slate-300 border border-slate-400/40"
              }`}
            >
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider">
                WhatsApp Status
              </div>
              <div className="text-sm font-black text-white flex items-center gap-1.5">
                {waStatus?.status === "CONNECTED" ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Connected ({waStatus.connectedPhone || "Active"})</span>
                  </>
                ) : waStatus?.status === "SCAN_QR" ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Scan QR to Connect</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>Not Connected</span>
                  </>
                )}
              </div>
              {waStatus?.status !== "CONNECTED" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("WHATSAPP")}
                  className="mt-1 text-xs text-amber-300 hover:text-white underline font-semibold cursor-pointer"
                >
                  Pair WhatsApp Now &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("BROADCAST")}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "BROADCAST"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 border border-[#E2E8F0] hover:bg-slate-50"
          }`}
        >
          <Send className="w-4 h-4" />
          <span>1-Click Bulk Broadcast</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CUSTOMERS")}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "CUSTOMERS"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 border border-[#E2E8F0] hover:bg-slate-50"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customer Directory ({totalCustomersCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("WHATSAPP")}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "WHATSAPP"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
              : "bg-white text-slate-600 border border-[#E2E8F0] hover:bg-slate-50"
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>WhatsApp QR & Pairing</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: 1-CLICK BROADCAST                                     */}
      {/* ============================================================ */}
      {activeTab === "BROADCAST" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Broadcast Composer */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-5 h-5 text-[#2563EB]" />
                  <span>Compose Offer or Update Broadcast</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Send announcements, weekend discounts, and special offers to all your saved restaurant customers with one click.
                </p>
              </div>

              {/* Target Audience Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Select Audience</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setBroadcastTarget("ALL")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      broadcastTarget === "ALL"
                        ? "bg-blue-50 border-[#2563EB] text-[#2563EB] ring-2 ring-blue-500/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold">All Customers</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {totalCustomersCount || customers.length} recipients
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastTarget("REGULAR")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      broadcastTarget === "REGULAR"
                        ? "bg-blue-50 border-[#2563EB] text-[#2563EB] ring-2 ring-blue-500/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold">Frequent Diners</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">2+ visits</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastTarget("VIP")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      broadcastTarget === "VIP"
                        ? "bg-blue-50 border-[#2563EB] text-[#2563EB] ring-2 ring-blue-500/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold">VIP Diners</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">3+ visits</div>
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">Click to Use Quick Templates</span>
                <div className="flex flex-wrap gap-2">
                  {messagePresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBroadcastText(preset.text)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Composer Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-700">WhatsApp Message Content</label>
                  <span className="text-slate-400 text-[11px]">
                    Use <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">{"{{name}}"}</code> to insert customer's name
                  </span>
                </div>
                <textarea
                  rows={7}
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="Type your WhatsApp broadcast message here..."
                  className="w-full p-3.5 bg-white border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#172033] focus:outline-none focus:border-[#2563EB] font-sans leading-relaxed resize-y"
                />
              </div>

              {/* Broadcast Status feedback */}
              {broadcastFeedback && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-[#2563EB] font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{broadcastFeedback}</span>
                </div>
              )}

              {/* Active Broadcast Progress Banner */}
              {waStatus?.broadcastProgress?.isRunning && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      <span>Broadcasting in progress...</span>
                    </span>
                    <span>
                      {waStatus.broadcastProgress.sent} / {waStatus.broadcastProgress.total} sent
                    </span>
                  </div>
                  <div className="w-full bg-emerald-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full transition-all duration-300"
                      style={{
                        width: `${
                          (waStatus.broadcastProgress.sent / (waStatus.broadcastProgress.total || 1)) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Messages are spaced 1.5 seconds apart to ensure safe, reliable delivery.
                  </p>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={
                    isBroadcasting ||
                    !broadcastText.trim() ||
                    waStatus?.status !== "CONNECTED" ||
                    targetAudienceCount === 0
                  }
                  onClick={() => setBroadcastConfirmOpen(true)}
                  className="w-full py-3.5 px-6 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    Send Broadcast to {targetAudienceCount} Customers
                  </span>
                </button>

                {waStatus?.status !== "CONNECTED" && (
                  <p className="text-center text-xs text-amber-600 font-semibold mt-2">
                    ⚠️ Please pair WhatsApp Web first from the &quot;WhatsApp QR &amp; Pairing&quot; tab to enable broadcasts.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live WhatsApp Mobile Preview */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#2563EB]" />
              <span>Customer WhatsApp Phone Preview</span>
            </h4>

            {/* Mock Smartphone Frame */}
            <div className="bg-slate-900 rounded-[2.5rem] p-4 shadow-2xl border-4 border-slate-800 max-w-xs mx-auto">
              {/* Phone Camera Notch */}
              <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto mb-3" />

              {/* Screen Header */}
              <div className="bg-[#075E54] text-white p-3 rounded-t-2xl flex items-center gap-2 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white">
                  R
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">ROLLZ Restaurant</div>
                  <div className="text-[10px] text-emerald-200">Official Business Account</div>
                </div>
              </div>

              {/* Chat Bubble Area */}
              <div className="bg-[#EFEAE2] p-3 rounded-b-2xl min-h-[320px] flex flex-col justify-end space-y-2">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-xs text-xs text-slate-800 space-y-2 max-w-[95%]">
                  <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                    {broadcastText.replace(/{{name}}/gi, "Rahul Sharma")}
                  </div>
                  <div className="text-[9px] text-slate-400 text-right flex items-center justify-end gap-1">
                    <span>Just now</span>
                    <span className="text-blue-500 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 space-y-1">
              <span className="font-bold block">💡 Anti-Spam Safety Guaranteed</span>
              <p>
                Messages are dispatched with a natural 1.5-second pause between each customer to protect your WhatsApp account from rate limiting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: WHATSAPP QR CODE SCANNER & CONNECTION               */}
      {/* ============================================================ */}
      {activeTab === "WHATSAPP" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: QR Code Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#2563EB]" />
                  <span>WhatsApp Web QR Scanner</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connect your store's WhatsApp number in seconds.
                </p>
              </div>

              <button
                type="button"
                onClick={handleInitWhatsApp}
                disabled={isLoadingStatus}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Connection Display */}
            {waStatus?.status === "CONNECTED" ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/20">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-emerald-950">WhatsApp is Connected!</h4>
                  <p className="text-xs text-emerald-800 font-semibold mt-1">
                    Paired Phone: +91 {waStatus.connectedPhone || "Active"}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-2 max-w-sm mx-auto">
                    Automatic receipts and broadcast messages are fully enabled. No further configuration needed!
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleLogoutWhatsApp}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 mx-auto"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Disconnect / Re-pair Different Phone</span>
                  </button>
                </div>
              </div>
            ) : waStatus?.status === "SCAN_QR" && waStatus.qrDataUrl ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-4">
                <div className="bg-white p-3 rounded-2xl inline-block shadow-lg border border-slate-200">
                  <img
                    src={waStatus.qrDataUrl}
                    alt="WhatsApp Web QR Code"
                    className="w-64 h-64 mx-auto object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">
                    Scan this QR code using WhatsApp on your phone
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Code refreshes automatically every 20 seconds.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-4">
                <Smartphone className="w-12 h-12 text-slate-400 mx-auto" />
                <div>
                  <h4 className="text-sm font-bold text-slate-800">WhatsApp Session Offline</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                    Click the button below to initialize a free session and generate your pairing QR code.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleInitWhatsApp}
                  disabled={isLoadingStatus}
                  className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Generate QR Code
                </button>
              </div>
            )}

            {/* Step-by-Step Instructions */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-800 block">How to pair in 4 simple steps:</span>
              <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
                <li>Open <strong>WhatsApp</strong> on the cashier or manager's phone.</li>
                <li>Tap <strong>Settings</strong> (iOS) or <strong>Three Dots ⋮</strong> (Android) &gt; <strong>Linked Devices</strong>.</li>
                <li>Tap <strong>Link a Device</strong>.</li>
                <li>Point your camera at the QR code displayed above!</li>
              </ol>
            </div>
          </div>

          {/* Right: Test Message Sender */}
          <div className="space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  <span>Send Quick Test Message</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify that WhatsApp is transmitting messages smoothly.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Recipient Mobile Number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">+91</span>
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full pl-12 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Message</label>
                  <textarea
                    rows={4}
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full p-3 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      testResult.type === "success"
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                        : "bg-red-50 border border-red-200 text-red-800"
                    }`}
                  >
                    {testResult.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    )}
                    <span>{testResult.text}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSendTestMessage}
                  disabled={isSendingTest || waStatus?.status !== "CONNECTED"}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingTest ? "Sending..." : "Send Test WhatsApp Message"}</span>
                </button>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-xs text-slate-600">
              <span className="font-bold text-slate-800 block">✨ Features of Option A:</span>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>100% Free:</strong> No per-message fees and no Meta Cloud API subscription required.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Instant Receipts:</strong> Whenever an order is paid on POS, the customer automatically receives their receipt on WhatsApp.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>1-Click Fallback:</strong> If the connection ever drops, cashiers can still share invoices via 1-click <code>wa.me</code> direct links.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: CUSTOMER CRM DIRECTORY                                */}
      {/* ============================================================ */}
      {activeTab === "CUSTOMERS" && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold block">Total Customers</span>
                <span className="text-xl font-black text-slate-900">{totalCustomersCount}</span>
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold block">Total Store Visits</span>
                <span className="text-xl font-black text-slate-900">{totalVisitsSum}</span>
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold block">Total Customer Spend</span>
                <span className="text-xl font-black text-slate-900">{formatPaise(totalSpendSum)}</span>
              </div>
            </div>
          </div>

          {/* Search & Actions Bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or mobile number..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsAddCustomerOpen(true)}
              className="w-full sm:w-auto px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          </div>

          {/* Customer Table */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Visits</th>
                    <th className="py-3 px-4">Total Spend</th>
                    <th className="py-3 px-4">Last Visit</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingCustomers ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#2563EB] mb-2" />
                        <span>Loading customer directory...</span>
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-700">No customers found</p>
                        <p className="text-[11px]">Customers are automatically added when you enter their phone number at checkout.</p>
                      </td>
                    </tr>
                  ) : (
                    customers.map((cust) => {
                      const waDirect = `https://wa.me/91${cust.phone}?text=${encodeURIComponent(`Hello ${cust.name}! Greetings from ROLLZ Restaurant. 🌯`)}`;

                      return (
                        <tr key={cust.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 text-[#2563EB] font-bold flex items-center justify-center text-xs">
                                {cust.name.charAt(0).toUpperCase()}
                              </div>
                              <span>{cust.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-700">
                            +91 {cust.phone}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                cust.totalVisits >= 5
                                  ? "bg-purple-100 text-purple-800"
                                  : cust.totalVisits >= 2
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {cust.totalVisits} {cust.totalVisits === 1 ? "visit" : "visits"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {formatPaise(cust.totalSpent)}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {new Date(cust.lastVisitAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <a
                              href={waDirect}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-600" />
                              <span>WhatsApp</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Send Broadcast */}
      {broadcastConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 bg-blue-100 text-[#2563EB] rounded-2xl flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Confirm WhatsApp Broadcast</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to send this promotional update to{" "}
                <strong className="text-slate-800">{targetAudienceCount} customers</strong> via WhatsApp.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 max-h-36 overflow-y-auto whitespace-pre-wrap font-sans">
              {broadcastText}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBroadcastConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBroadcast}
                className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Yes, Send Broadcast</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateCustomer}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#2563EB]" />
                <span>Add New Customer</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Phone Number *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">+91</span>
                  <input
                    type="tel"
                    required
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full pl-12 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Customer Name</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                  placeholder="e.g. Likes extra spicy, regular evening guest"
                  className="w-full p-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingCustomer || !newCustPhone.trim()}
                className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isSavingCustomer ? "Saving..." : "Save Customer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
