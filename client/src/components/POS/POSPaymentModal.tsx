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
} from "lucide-react";
import { formatPaise } from "../../utils/currency";
import { paymentsApi, PaymentTender, PaymentResultResponse } from "../../api/payments.api";

interface POSPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  orderType: "TAKEAWAY" | "DINE_IN";
  grandTotalPaise: number;
  itemCount: number;
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
  onPaymentSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"CASH" | "UPI" | "CARD" | "SPLIT">("CASH");

  // Cash state (in rupees for input)
  const [cashTenderedRupees, setCashTenderedRupees] = useState<string>(
    (grandTotalPaise / 100).toFixed(0)
  );

  // UPI state
  const [upiRef, setUpiRef] = useState("");
  const [isUpiVerified, setIsUpiVerified] = useState(false);

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

  // Initialize cash tendered when modal opens or total changes
  useEffect(() => {
    if (isOpen) {
      setCashTenderedRupees((grandTotalPaise / 100).toString());
      setErrorMessage(null);
      setIsSubmitting(false);
      setIsUpiVerified(false);
      setIsCardVerified(false);
    }
  }, [isOpen, grandTotalPaise]);

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
        confirmationType: "MANUAL_CASHIER",
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
              <span>5% GST Included</span>
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
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                  <QrCode className="w-4 h-4 text-[#2563EB]" />
                  <span>Manual Cashier UPI Verification</span>
                </div>
                <p className="text-xs text-blue-800">
                  Customer should scan the restaurant UPI QR code and pay{" "}
                  <strong>{formatPaise(grandTotalPaise)}</strong>. Verify notification on phone or soundbox before proceeding.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  UPI Transaction / UTR Reference (Optional)
                </label>
                <input
                  type="text"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  placeholder="e.g. 12-digit UTR or Txn ID"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={isUpiVerified}
                  onChange={(e) => setIsUpiVerified(e.target.checked)}
                  className="mt-0.5 rounded text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span className="text-xs text-slate-700 font-medium">
                  I confirm that the customer has completed the payment of{" "}
                  <strong>{formatPaise(grandTotalPaise)}</strong> on the restaurant UPI soundbox / account.
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
            className="flex-1 sm:flex-none sm:min-w-[200px] flex items-center justify-center gap-2 px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Finalizing & Printing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Finalize ({formatPaise(grandTotalPaise)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
