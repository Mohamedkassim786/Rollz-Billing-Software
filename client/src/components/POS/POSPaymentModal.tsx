import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Banknote,
  QrCode,
  CreditCard,
  Split,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  ShieldCheck,
  Copy,
  Check,
  Edit2,
  Maximize2,
  Save,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { formatPaise } from "../../utils/currency";
import { paymentsApi, PaymentTender, PaymentResultResponse } from "../../api/payments.api";
import { upiObserverApi, UpiBankAlertRecord } from "../../api/upiObserver.api";
import { useAuth } from "../../context/AuthContext";

function playPaymentSuccessSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
  } catch (e) {
    // Ignore audio permission errors
  }
}

interface POSPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  orderType: "TAKEAWAY" | "DINE_IN";
  grandTotalPaise: number;
  itemCount: number;
  taxTotalPaise?: number;
  taxRateBasisPoints?: number;
  onPaymentSuccess: (result: PaymentResultResponse) => void;
}

export const POSPaymentModal: React.FC<POSPaymentModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  orderType,
  grandTotalPaise,
  itemCount,
  taxTotalPaise,
  taxRateBasisPoints,
  onPaymentSuccess,
}) => {
  const { branch } = useAuth();
  const isNonGst =
    (typeof taxTotalPaise === "number" && taxTotalPaise === 0) ||
    taxRateBasisPoints === 0 ||
    branch?.taxMode === "NON_GST" ||
    localStorage.getItem("rollz_pos_tax_mode") === "NON_GST";
  const [activeTab, setActiveTab] = useState<"CASH" | "UPI" | "CARD" | "SPLIT">("CASH");

  // Cash state (in rupees for input)
  const [cashTenderedRupees, setCashTenderedRupees] = useState<string>(
    (grandTotalPaise / 100).toFixed(0)
  );

  // UPI state & Dynamic QR Code configuration
  const [modalUpiId, setModalUpiId] = useState<string>(() => {
    return localStorage.getItem("rollz_pos_upi_id") || branch?.upiId || "";
  });
  const [modalUpiName, setModalUpiName] = useState<string>(() => {
    return localStorage.getItem("rollz_pos_upi_payee_name") || branch?.upiPayeeName || branch?.name || "ROLLZ Fast Food";
  });
  const [isEditingUpi, setIsEditingUpi] = useState<boolean>(false);
  const [tempUpiInput, setTempUpiInput] = useState<string>("");
  const [tempUpiNameInput, setTempUpiNameInput] = useState<string>("");
  const [isEnlargedQr, setIsEnlargedQr] = useState<boolean>(false);
  const [hasCopiedUpi, setHasCopiedUpi] = useState<boolean>(false);
  const [splitActiveQrTender, setSplitActiveQrTender] = useState<{ id: string; amountRupees: string } | null>(null);
  const [upiRef, setUpiRef] = useState("");
  const [isUpiVerified, setIsUpiVerified] = useState(false);
  const [detectedUpiAlert, setDetectedUpiAlert] = useState<UpiBankAlertRecord | null>(null);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);

  // Card state
  const [cardAuthRef, setCardAuthRef] = useState("");
  const [isCardVerified, setIsCardVerified] = useState(false);

  // Split state
  const [splitTenders, setSplitTenders] = useState<
    Array<{ id: string; method: "CASH" | "UPI" | "CARD"; amountRupees: string; cashTendered?: string; ref?: string }>
  >([
    { id: "1", method: "CASH", amountRupees: ((grandTotalPaise / 2) / 100).toFixed(0), cashTendered: "" },
    { id: "2", method: "UPI", amountRupees: ((grandTotalPaise / 2) / 100).toFixed(0), ref: "" },
  ]);

  // Overall states
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idempotencyKey] = useState<string>(() => `IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Initialize cash tendered and UPI state when modal opens or total changes
  useEffect(() => {
    if (isOpen) {
      setCashTenderedRupees((grandTotalPaise / 100).toString());
      setErrorMessage(null);
      setIsSubmitting(false);
      setIsUpiVerified(false);
      setIsCardVerified(false);
      setIsEnlargedQr(false);
      setIsEditingUpi(false);
      setSplitActiveQrTender(null);
      setDetectedUpiAlert(null);
      setIsSimulatingPayment(false);

      const activeUpi = localStorage.getItem("rollz_pos_upi_id") || branch?.upiId || "";
      const activeName = localStorage.getItem("rollz_pos_upi_payee_name") || branch?.upiPayeeName || branch?.name || "ROLLZ Fast Food";
      setModalUpiId(activeUpi);
      setModalUpiName(activeName);
      setTempUpiInput(activeUpi);
      setTempUpiNameInput(activeName);
    }
  }, [isOpen, grandTotalPaise, branch]);

  // Background polling for bank SMS / UPI payment verification
  useEffect(() => {
    if (!isOpen || activeTab !== "UPI" || isSubmitting || detectedUpiAlert) {
      return;
    }

    let isMounted = true;
    const pollTimer = setInterval(async () => {
      try {
        const res = await upiObserverApi.checkOrderStatus(orderId);
        if (!isMounted) return;

        if (res.isPaid && res.alert) {
          setDetectedUpiAlert(res.alert);
          setIsUpiVerified(true);
          if (res.alert.utrNumber) {
            setUpiRef(res.alert.utrNumber);
          }
          playPaymentSuccessSound();
        }
      } catch (err) {
        // Silently retry during background poll
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
    };
  }, [isOpen, activeTab, orderId, isSubmitting, detectedUpiAlert]);

  // Test simulation handler for cashiers / training
  const handleSimulateTestPayment = async () => {
    setIsSimulatingPayment(true);
    setErrorMessage(null);
    try {
      const res = await upiObserverApi.simulatePayment({
        amountRupees: grandTotalPaise / 100,
        orderId,
        bankName: "HDFC Bank",
        payerVpa: "customer@upi",
      });

      if (res.alert) {
        setDetectedUpiAlert(res.alert);
        setIsUpiVerified(true);
        if (res.alert.utrNumber) {
          setUpiRef(res.alert.utrNumber);
        }
        playPaymentSuccessSound();
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || "Simulation failed");
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  const handleSaveUpiId = () => {
    const cleanId = tempUpiInput.trim();
    const cleanName = tempUpiNameInput.trim() || branch?.name || "ROLLZ Fast Food";
    if (!cleanId) {
      setErrorMessage("Please enter a valid UPI ID (e.g. shopname@okaxis or 9876543210@paytm)");
      return;
    }
    setModalUpiId(cleanId);
    setModalUpiName(cleanName);
    localStorage.setItem("rollz_pos_upi_id", cleanId);
    localStorage.setItem("rollz_pos_upi_payee_name", cleanName);
    setIsEditingUpi(false);
    setErrorMessage(null);
  };

  const upiAmountRupees = (grandTotalPaise / 100).toFixed(2);

  const upiUri = useMemo(() => {
    if (!modalUpiId.trim()) return "";
    const cleanName = encodeURIComponent(modalUpiName.trim().replace(/[^a-zA-Z0-9\s]/g, "") || "ROLLZ");
    const cleanOrderNum = orderNumber.replace(/[^a-zA-Z0-9]/g, "");
    const cleanNote = encodeURIComponent(`Order ${cleanOrderNum}`);
    return `upi://pay?pa=${modalUpiId.trim()}&pn=${cleanName}&am=${upiAmountRupees}&cu=INR&tn=${cleanNote}`;
  }, [modalUpiId, modalUpiName, upiAmountRupees, orderNumber]);

  const splitUpiUri = useMemo(() => {
    if (!splitActiveQrTender || !modalUpiId.trim()) return "";
    const amt = (parseFloat(splitActiveQrTender.amountRupees) || 0).toFixed(2);
    const cleanName = encodeURIComponent(modalUpiName.trim().replace(/[^a-zA-Z0-9\s]/g, "") || "ROLLZ");
    const cleanOrderNum = orderNumber.replace(/[^a-zA-Z0-9]/g, "");
    const cleanNote = encodeURIComponent(`Order ${cleanOrderNum} Split`);
    return `upi://pay?pa=${modalUpiId.trim()}&pn=${cleanName}&am=${amt}&cu=INR&tn=${cleanNote}`;
  }, [splitActiveQrTender, modalUpiId, modalUpiName, orderNumber]);

  // Cash calculations
  const cashTenderedPaise = useMemo(() => {
    const val = parseFloat(cashTenderedRupees);
    return isNaN(val) ? 0 : Math.round(val * 100);
  }, [cashTenderedRupees]);

  const cashChangeDuePaise = useMemo(() => {
    return Math.max(0, cashTenderedPaise - grandTotalPaise);
  }, [cashTenderedPaise, grandTotalPaise]);

  const isCashInsufficient = cashTenderedPaise < grandTotalPaise;

  // Split calculations
  const splitTotalPaise = useMemo(() => {
    return splitTenders.reduce((sum, t) => {
      const val = parseFloat(t.amountRupees);
      return sum + (isNaN(val) ? 0 : Math.round(val * 100));
    }, 0);
  }, [splitTenders]);

  const splitRemainingPaise = grandTotalPaise - splitTotalPaise;

  const handleAddSplitTender = () => {
    const nextMethod = splitTenders.some((t) => t.method === "UPI") ? "CARD" : "UPI";
    const remainingRupees = splitRemainingPaise > 0 ? (splitRemainingPaise / 100).toString() : "0";
    setSplitTenders([
      ...splitTenders,
      { id: Date.now().toString(), method: nextMethod, amountRupees: remainingRupees },
    ]);
  };

  const handleRemoveSplitTender = (id: string) => {
    if (splitTenders.length <= 1) return;
    setSplitTenders(splitTenders.filter((t) => t.id !== id));
  };

  const handleQuickCash = (addRupees: number) => {
    const current = parseFloat(cashTenderedRupees) || 0;
    setCashTenderedRupees((current + addRupees).toString());
  };

  const handleExactCash = () => {
    setCashTenderedRupees((grandTotalPaise / 100).toString());
  };

  const handleConfirmPayment = async () => {
    setErrorMessage(null);

    const paymentTenders: PaymentTender[] = [];

    if (activeTab === "CASH") {
      if (isCashInsufficient) {
        setErrorMessage(`Tendered amount is less than the total bill of ${formatPaise(grandTotalPaise)}`);
        return;
      }
      paymentTenders.push({
        method: "CASH",
        amount: grandTotalPaise,
        tenderedAmount: cashTenderedPaise,
        notes: notes || undefined,
        confirmationType: "MANUAL_CASHIER",
      });
    } else if (activeTab === "UPI") {
      if (!isUpiVerified) {
        setErrorMessage("Please confirm that you have verified customer's UPI payment receipt.");
        return;
      }
      paymentTenders.push({
        method: "UPI",
        amount: grandTotalPaise,
        externalReference: upiRef.trim() || undefined,
        notes: notes || undefined,
        confirmationType: detectedUpiAlert ? "AUTO_UPI_OBSERVER" : "MANUAL_CASHIER",
      });
    } else if (activeTab === "CARD") {
      if (!isCardVerified) {
        setErrorMessage("Please confirm that payment was approved on the physical card machine.");
        return;
      }
      paymentTenders.push({
        method: "CARD",
        amount: grandTotalPaise,
        externalReference: cardAuthRef.trim() || undefined,
        notes: notes || undefined,
        confirmationType: "TERMINAL_VERIFIED",
      });
    } else if (activeTab === "SPLIT") {
      if (splitRemainingPaise !== 0) {
        setErrorMessage(
          splitRemainingPaise > 0
            ? `Remaining unpaid balance: ${formatPaise(splitRemainingPaise)}`
            : `Split payments exceed total by ${formatPaise(Math.abs(splitRemainingPaise))}`
        );
        return;
      }

      for (const t of splitTenders) {
        const amtPaise = Math.round((parseFloat(t.amountRupees) || 0) * 100);
        if (amtPaise <= 0) {
          setErrorMessage("Each split payment method must have a positive amount");
          return;
        }

        let tenderedPaise: number | undefined = undefined;
        if (t.method === "CASH") {
          const cashVal = parseFloat(t.cashTendered || t.amountRupees);
          tenderedPaise = Math.round((isNaN(cashVal) ? 0 : cashVal) * 100);
          if (tenderedPaise < amtPaise) {
            setErrorMessage(`Tendered cash is less than the required cash split portion`);
            return;
          }
        }

        paymentTenders.push({
          method: t.method,
          amount: amtPaise,
          tenderedAmount: tenderedPaise,
          externalReference: t.ref || undefined,
          confirmationType: t.method === "CARD" ? "TERMINAL_VERIFIED" : "MANUAL_CASHIER",
        });
      }
    }

    setIsSubmitting(true);
    try {
      const response = await paymentsApi.processPayment(orderId, {
        payments: paymentTenders,
        idempotencyKey,
      });
      onPaymentSuccess(response);
    } catch (err: any) {
      console.error("Payment error:", err);
      const msg = err.response?.data?.error?.message || err.message || "Payment processing failed";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#172033]">Checkout & Payment</h2>
              <span className="px-2 py-0.5 bg-blue-100 text-[#2563EB] text-[10px] font-bold rounded-md">
                #{orderNumber}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded-md">
                {orderType}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              {itemCount} {itemCount === 1 ? "item" : "items"} in order
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Payable Banner */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white px-6 py-4 flex items-center justify-between shadow-inner">
          <div>
            <span className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Total Payable</span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">
              {formatPaise(grandTotalPaise)}
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-xs rounded-full text-xs font-medium text-blue-100 border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isNonGst ? "No GST" : "5% GST Included"}</span>
            </span>
          </div>
        </div>

        {/* Payment Methods Tab Navigation */}
        <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab("CASH")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeTab === "CASH"
                ? "bg-white text-[#2563EB] border-[#E2E8F0] border-b-white -mb-px shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Cash</span>
          </button>

          <button
            onClick={() => setActiveTab("UPI")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeTab === "UPI"
                ? "bg-white text-[#2563EB] border-[#E2E8F0] border-b-white -mb-px shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>UPI / QR</span>
          </button>

          <button
            onClick={() => setActiveTab("CARD")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeTab === "CARD"
                ? "bg-white text-[#2563EB] border-[#E2E8F0] border-b-white -mb-px shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Card Terminal</span>
          </button>

          <button
            onClick={() => setActiveTab("SPLIT")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeTab === "SPLIT"
                ? "bg-white text-[#2563EB] border-[#E2E8F0] border-b-white -mb-px shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            }`}
          >
            <Split className="w-4 h-4" />
            <span>Split Tender</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. CASH TAB */}
          {activeTab === "CASH" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cash Received / Tendered (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cashTenderedRupees}
                    onChange={(e) => setCashTenderedRupees(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-lg font-black text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExactCash}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Exact ({formatPaise(grandTotalPaise)})
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCash(50)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  +₹50
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCash(100)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  +₹100
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCash(500)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  +₹500
                </button>
              </div>

              {/* Change Calculation Box */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  isCashInsufficient
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}
              >
                <div>
                  <span className="text-xs font-semibold block">
                    {isCashInsufficient ? "Amount Short / Pending" : "Cash Change Due to Customer"}
                  </span>
                  <span className="text-xl font-black">
                    {isCashInsufficient
                      ? formatPaise(grandTotalPaise - cashTenderedPaise)
                      : formatPaise(cashChangeDuePaise)}
                  </span>
                </div>
                {!isCashInsufficient && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                )}
              </div>
            </div>
          )}

          {/* 2. UPI TAB */}
          {activeTab === "UPI" && (
            <div className="space-y-4">
              {/* If UPI ID is missing or cashier is editing it */}
              {(!modalUpiId.trim() || isEditingUpi) ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <QrCode className="w-4 h-4 text-amber-600" />
                    <span>{modalUpiId ? "Edit UPI Payment ID" : "Configure Restaurant UPI ID for Dynamic QR"}</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    Enter your UPI ID / VPA to immediately generate dynamic QR codes for this order and future orders.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        UPI ID / VPA <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={tempUpiInput}
                        onChange={(e) => setTempUpiInput(e.target.value)}
                        placeholder="e.g. yourshop@okaxis or 9876543210@paytm"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Payee / Business Name
                      </label>
                      <input
                        type="text"
                        value={tempUpiNameInput}
                        onChange={(e) => setTempUpiNameInput(e.target.value)}
                        placeholder={branch?.name || "ROLLZ Fast Food"}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveUpiId}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save & Generate QR</span>
                    </button>
                    {modalUpiId && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempUpiInput(modalUpiId);
                          setTempUpiNameInput(modalUpiName);
                          setIsEditingUpi(false);
                        }}
                        className="px-3 py-2 text-slate-600 hover:text-slate-800 text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Dynamic QR Code Card */
                <div className="p-4 bg-gradient-to-b from-blue-50/70 to-indigo-50/40 border border-blue-200 rounded-2xl space-y-4">
                  {/* Banner / Info */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#172033] flex items-center gap-2">
                          <span>Dynamic UPI Payment QR</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">
                            ₹{upiAmountRupees}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 mt-0.5">
                          <span className="font-mono font-medium">{modalUpiId}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(modalUpiId);
                              setHasCopiedUpi(true);
                              setTimeout(() => setHasCopiedUpi(false), 2000);
                            }}
                            className="text-blue-600 hover:text-blue-800 p-0.5 cursor-pointer"
                            title="Copy UPI ID"
                          >
                            {hasCopiedUpi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <span>•</span>
                          <span className="text-slate-500 font-medium">{modalUpiName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setTempUpiInput(modalUpiId);
                          setTempUpiNameInput(modalUpiName);
                          setIsEditingUpi(true);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-slate-600 hover:text-blue-600 bg-white border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer shadow-xs hover:border-blue-300 transition-colors"
                        title="Change UPI ID"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Change</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEnlargedQr(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        title="Show full screen for customer to scan"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Customer View</span>
                      </button>
                    </div>
                  </div>

                  {/* QR Presentation Box */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-5 bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                    {/* SVG QR Code */}
                    <div
                      onClick={() => setIsEnlargedQr(true)}
                      className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group relative shrink-0"
                      title="Click to enlarge QR for customer"
                    >
                      <QRCodeSVG
                        value={upiUri}
                        size={150}
                        level="M"
                        includeMargin={false}
                      />
                      <div className="absolute inset-0 bg-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center backdrop-blur-[1px]">
                        <span className="bg-white/95 text-blue-900 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" /> Enlarge
                        </span>
                      </div>
                    </div>

                    {/* Instructions & Supported Apps */}
                    <div className="flex-1 space-y-2.5 text-center sm:text-left">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Scan & Pay Exact Bill</span>
                        <p className="text-xs text-slate-700 font-medium">
                          Customer scans with Google Pay, PhonePe, Paytm, or BHIM. The amount of <strong>{formatPaise(grandTotalPaise)}</strong> is filled in automatically.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200">GPay</span>
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded border border-purple-200">PhonePe</span>
                        <span className="px-2 py-0.5 bg-sky-50 text-sky-700 text-[10px] font-bold rounded border border-sky-200">Paytm</span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">BHIM UPI</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-medium rounded border border-slate-200">Any Bank</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Automated UPI Observer Status Card */}
              {detectedUpiAlert ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-emerald-900">
                          Bank Payment Verified: ₹{(detectedUpiAlert.amountPaise / 100).toFixed(2)}
                        </span>
                        <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-800 px-1.5 py-0.2 rounded">
                          AUTO
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        {detectedUpiAlert.bankName || "Bank UPI"} • UTR:{" "}
                        <strong className="font-mono">{detectedUpiAlert.utrNumber || "N/A"}</strong>
                        {detectedUpiAlert.payerInfo ? ` • ${detectedUpiAlert.payerInfo}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs">
                    Ready to Finalize
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-blue-900 font-medium">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                    </span>
                    <span>Listening for bank SMS / Soundbox payment...</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateTestPayment}
                    disabled={isSimulatingPayment}
                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100/80 border border-blue-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                    title="Simulate receiving UPI payment notification"
                  >
                    {isSimulatingPayment ? "Simulating..." : "⚡ Test Verify"}
                  </button>
                </div>
              )}

              {/* UTR Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  UPI Transaction / UTR Reference {detectedUpiAlert ? "(Auto-Captured)" : "(Optional)"}
                </label>
                <input
                  type="text"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  placeholder="e.g. 12-digit UTR or Txn ID"
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono transition-colors ${
                    detectedUpiAlert
                      ? "bg-emerald-50/60 border-emerald-300 text-emerald-900 font-bold"
                      : "bg-white border-[#E2E8F0] text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                  }`}
                />
              </div>

              {/* Cashier confirmation checkbox */}
              <label className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-colors border ${
                detectedUpiAlert
                  ? "bg-emerald-50/60 border-emerald-200"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100/60"
              }`}>
                <input
                  type="checkbox"
                  checked={isUpiVerified}
                  onChange={(e) => setIsUpiVerified(e.target.checked)}
                  className="mt-0.5 rounded text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span className="text-xs text-slate-700 font-medium">
                  {detectedUpiAlert ? (
                    <strong className="text-emerald-800">
                      ✓ Bank credit confirmed via observer (Amount: {formatPaise(grandTotalPaise)})
                    </strong>
                  ) : (
                    <>
                      I confirm that customer has completed payment of{" "}
                      <strong>{formatPaise(grandTotalPaise)}</strong> on restaurant UPI soundbox / account.
                    </>
                  )}
                </span>
              </label>
            </div>
          )}

          {/* 3. CARD TAB */}
          {activeTab === "CARD" && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span>External Card Terminal (EDC Machine)</span>
                </div>
                <p className="text-xs text-purple-800">
                  Swipe/Insert customer card on the physical terminal for{" "}
                  <strong>{formatPaise(grandTotalPaise)}</strong>. Verify approval slip from the machine.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Terminal Auth / Slip Reference (Optional)
                </label>
                <input
                  type="text"
                  value={cardAuthRef}
                  onChange={(e) => setCardAuthRef(e.target.value)}
                  placeholder="e.g. Auth Code or Terminal Batch Ref"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={isCardVerified}
                  onChange={(e) => setIsCardVerified(e.target.checked)}
                  className="mt-0.5 rounded text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span className="text-xs text-slate-700 font-medium">
                  I confirm that card transaction has been approved by the physical EDC terminal.
                </span>
              </label>
            </div>
          )}

          {/* 4. SPLIT TAB */}
          {activeTab === "SPLIT" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Split Tender Breakdown</span>
                <button
                  type="button"
                  onClick={handleAddSplitTender}
                  className="flex items-center gap-1 text-xs text-[#2563EB] font-bold hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Tender</span>
                </button>
              </div>

              {splitTenders.map((t, idx) => (
                <div
                  key={t.id}
                  className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-xl space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={t.method}
                      onChange={(e) => {
                        const next = [...splitTenders];
                        next[idx].method = e.target.value as any;
                        setSplitTenders(next);
                      }}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="CARD">Card Terminal</option>
                    </select>

                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={t.amountRupees}
                        onChange={(e) => {
                          const next = [...splitTenders];
                          next[idx].amountRupees = e.target.value;
                          setSplitTenders(next);
                        }}
                        className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-[#172033]"
                        placeholder="Amount"
                      />
                    </div>

                    {t.method === "UPI" && parseFloat(t.amountRupees) > 0 && modalUpiId.trim() && (
                      <button
                        type="button"
                        onClick={() => setSplitActiveQrTender(t)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0"
                        title="Show dynamic QR for this split portion"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>QR (₹{t.amountRupees})</span>
                      </button>
                    )}

                    {splitTenders.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSplitTender(t.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                  splitRemainingPaise === 0
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}
              >
                <span>
                  {splitRemainingPaise === 0
                    ? "Split tenders exactly match total payable"
                    : splitRemainingPaise > 0
                    ? `Remaining Unpaid: ${formatPaise(splitRemainingPaise)}`
                    : `Exceeds total by: ${formatPaise(Math.abs(splitRemainingPaise))}`}
                </span>
                <span>{formatPaise(splitTotalPaise)} / {formatPaise(grandTotalPaise)}</span>
              </div>
            </div>
          )}

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Internal Cashier Payment Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. VIP guest, Cashier drawer #1"
              className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033]"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-[#E2E8F0] rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmPayment}
            disabled={isSubmitting || (activeTab === "CASH" && isCashInsufficient)}
            className={`flex-1 sm:flex-none sm:min-w-[200px] flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "UPI" && detectedUpiAlert
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400"
                : "bg-[#2563EB] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white shadow-md shadow-blue-500/20"
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Finalizing & Printing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {activeTab === "UPI" && detectedUpiAlert
                    ? `Payment Verified ✓ Finalize (${formatPaise(grandTotalPaise)})`
                    : `Confirm & Finalize (${formatPaise(grandTotalPaise)})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Fullscreen / Enlarged Customer-Facing UPI QR View */}
      {isEnlargedQr && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="text-left">
                <h3 className="text-sm font-black text-[#172033]">Scan & Pay via UPI</h3>
                <p className="text-[11px] text-slate-500">Order #{orderNumber} • {itemCount} items</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEnlargedQr(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Amount Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 py-3 px-4 rounded-2xl">
              <span className="text-xs text-blue-700 font-bold block uppercase tracking-wider">Total Payable</span>
              <span className="text-3xl font-black text-[#172033]">{formatPaise(grandTotalPaise)}</span>
            </div>

            {/* Large Dynamic QR */}
            <div className="flex justify-center p-5 bg-white rounded-2xl border border-slate-200 shadow-inner">
              <QRCodeSVG
                value={upiUri}
                size={220}
                level="M"
              />
            </div>

            <div className="space-y-0.5">
              <div className="text-xs font-bold text-[#172033]">{modalUpiName}</div>
              <div className="text-[11px] font-mono text-slate-500">{modalUpiId}</div>
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-slate-500 font-bold">
              <span>Google Pay</span> • <span>PhonePe</span> • <span>Paytm</span> • <span>BHIM</span>
            </div>

            <button
              type="button"
              onClick={() => setIsEnlargedQr(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Done / Back to Checkout
            </button>
          </div>
        </div>
      )}

      {/* Split Portion QR Popup */}
      {splitActiveQrTender && modalUpiId.trim() && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="text-left">
                <h3 className="text-sm font-black text-[#172033]">Split Portion UPI QR</h3>
                <p className="text-[11px] text-slate-500">Order #{orderNumber} (UPI Split)</p>
              </div>
              <button
                type="button"
                onClick={() => setSplitActiveQrTender(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 py-3 px-4 rounded-2xl">
              <span className="text-xs text-blue-700 font-bold block uppercase tracking-wider">UPI Split Portion</span>
              <span className="text-3xl font-black text-[#172033]">₹{(parseFloat(splitActiveQrTender.amountRupees) || 0).toFixed(2)}</span>
            </div>

            <div className="flex justify-center p-5 bg-white rounded-2xl border border-slate-200 shadow-inner">
              <QRCodeSVG
                value={splitUpiUri}
                size={200}
                level="M"
              />
            </div>

            <div className="space-y-0.5">
              <div className="text-xs font-bold text-[#172033]">{modalUpiName}</div>
              <div className="text-[11px] font-mono text-slate-500">{modalUpiId}</div>
            </div>

            <button
              type="button"
              onClick={() => setSplitActiveQrTender(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close Split QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
