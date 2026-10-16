import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Coins,
} from "lucide-react";
import { CashierShift, ShiftFinancials } from "../../api/shifts.api";
import { formatPaise, rupeesToPaise, paiseToRupees } from "../../utils/currency";

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: CashierShift;
  financials: ShiftFinancials;
  onSubmit: (data: { actualCash: number; closingNotes?: string }) => Promise<void>;
  isLoading: boolean;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  shift,
  financials,
  onSubmit,
  isLoading,
}) => {
  const [actualRupees, setActualRupees] = useState<string>("");
  const [closingNotes, setClosingNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showDenominations, setShowDenominations] = useState<boolean>(false);

  // Denominations counter
  const [counts, setCounts] = useState<{ [denom: number]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    1: 0, // coins
  });

  useEffect(() => {
    if (isOpen) {
      // Default to expected cash in rupees for convenience if user wants to match or edit
      const defaultRupees = paiseToRupees(financials.expectedDrawerCash).toFixed(2);
      setActualRupees(defaultRupees);
      setClosingNotes("");
      setError(null);
      setShowDenominations(false);
      setCounts({ 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 1: 0 });
    }
  }, [isOpen, financials]);

  if (!isOpen) return null;

  // Handle denomination changes
  const updateDenomCount = (denom: number, val: number) => {
    const updated = { ...counts, [denom]: Math.max(0, val) };
    setCounts(updated);
    const totalRupees = Object.entries(updated).reduce(
      (sum, [d, qty]) => sum + Number(d) * (qty || 0),
      0
    );
    setActualRupees(totalRupees.toFixed(2));
  };

  const actualPaise = rupeesToPaise(parseFloat(actualRupees) || 0);
  const expectedPaise = financials.expectedDrawerCash;
  const differencePaise = actualPaise - expectedPaise;

  const isSurplus = differencePaise > 0;
  const isReconciled = differencePaise === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(actualRupees);
    if (isNaN(val) || val < 0) {
      setError("Please enter a valid non-negative actual cash count.");
      return;
    }

    try {
      await onSubmit({
        actualCash: actualPaise,
        closingNotes: closingNotes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to close shift");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#172033]">
                  Close Shift & Cash Reconciliation
                </h3>
                <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                  {shift.shiftNumber}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Count physical drawer cash and reconcile discrepancies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Financial Breakdown Cards */}
          <div>
            <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Shift Drawer Breakdown (Authoritative)</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3">
                <span className="text-[11px] text-[#64748B] block font-medium">Opening Float</span>
                <span className="text-sm font-bold text-[#172033] font-mono mt-0.5 block">
                  {formatPaise(financials.openingCash)}
                </span>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                <span className="text-[11px] text-emerald-800 block font-medium">+ Cash Sales</span>
                <span className="text-sm font-bold text-emerald-700 font-mono mt-0.5 block">
                  {formatPaise(financials.cashSales)}
                </span>
              </div>
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                <span className="text-[11px] text-blue-800 block font-medium">+ Cash In (Additions)</span>
                <span className="text-sm font-bold text-blue-700 font-mono mt-0.5 block">
                  {formatPaise(financials.cashInTotal)}
                </span>
              </div>
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-3">
                <span className="text-[11px] text-red-800 block font-medium">- Cash Out (Expenses)</span>
                <span className="text-sm font-bold text-red-700 font-mono mt-0.5 block">
                  {formatPaise(financials.cashOutTotal)}
                </span>
              </div>
            </div>

            {/* Non-cash breakdown info pill */}
            <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-[11px] text-[#64748B]">
              <span className="font-medium">
                Non-Cash Finalized: UPI <strong className="text-[#172033] font-mono">{formatPaise(financials.upiSales)}</strong>, Card <strong className="text-[#172033] font-mono">{formatPaise(financials.cardSales)}</strong>
              </span>
              <span className="text-slate-400 italic">Excluded from drawer count</span>
            </div>
          </div>

          {/* Section 2: Expected Drawer Cash Highlight */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-900 block">
                Calculated Expected Drawer Cash:
              </span>
              <span className="text-[11px] text-blue-700">
                Opening Float + Cash Sales + Cash In - Cash Out
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-[#2563EB] font-mono block">
                {formatPaise(expectedPaise)}
              </span>
            </div>
          </div>

          {/* Section 3: Actual Count Input & Denomination Counter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#172033]">
                Actual Physical Cash Counted (₹) <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowDenominations(!showDenominations)}
                className="text-[11px] font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>{showDenominations ? "Hide Currency Calculator" : "Use Denomination Calculator"}</span>
              </button>
            </div>

            {/* Denomination calculator grid */}
            {showDenominations && (
              <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                  Indian Currency Denominations
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[500, 200, 100, 50, 20, 10].map((denom) => (
                    <div key={denom} className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] p-1.5 rounded-lg">
                      <span className="font-mono font-bold text-[#172033] w-12 text-[11px]">₹{denom} ×</span>
                      <input
                        type="number"
                        min="0"
                        value={counts[denom] || ""}
                        onChange={(e) => updateDenomCount(denom, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full text-right font-mono font-bold text-xs p-1 border-0 focus:outline-hidden"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] p-1.5 rounded-lg col-span-2">
                    <span className="font-mono font-bold text-[#172033] text-[11px]">Coins (₹)</span>
                    <input
                      type="number"
                      min="0"
                      value={counts[1] || ""}
                      onChange={(e) => updateDenomCount(1, parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full text-right font-mono font-bold text-xs p-1 border-0 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={actualRupees}
                onChange={(e) => setActualRupees(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-xl font-extrabold text-[#172033] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all font-mono"
              />
            </div>
          </div>

          {/* Section 4: Live Reconciliation Result Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              isReconciled
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : isSurplus
                ? "bg-amber-50/70 border-amber-200 text-amber-900"
                : "bg-red-50/70 border-red-200 text-red-900"
            }`}
          >
            <div className="flex items-center gap-3">
              {isReconciled ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : isSurplus ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <div>
                <span className="font-bold text-xs block">
                  {isReconciled
                    ? "Drawer Perfectly Reconciled"
                    : isSurplus
                    ? "Cash Surplus Detected (+ Extra in drawer)"
                    : "Cash Shortage Detected (- Missing from drawer)"}
                </span>
                <span className="text-[11px] opacity-80">
                  {isReconciled
                    ? "Actual physical count matches expected drawer cash."
                    : `Discrepancy: ${formatPaise(Math.abs(differencePaise))}`}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase font-bold opacity-75 block">Difference</span>
              <span
                className={`text-lg font-extrabold font-mono ${
                  isReconciled
                    ? "text-emerald-700"
                    : isSurplus
                    ? "text-amber-700"
                    : "text-red-700"
                }`}
              >
                {differencePaise > 0 ? "+" : ""}
                {formatPaise(differencePaise)}
              </span>
            </div>
          </div>

          {/* Section 5: Closing Notes */}
          <div>
            <label className="block text-xs font-bold text-[#172033] mb-1.5">
              Closing Notes & Discrepancy Explanation
              {!isReconciled && <span className="text-red-500"> (Required for discrepancies)</span>}
            </label>
            <textarea
              rows={2}
              required={!isReconciled}
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder={
                !isReconciled
                  ? "Explain reason for cash difference (e.g. unrecorded tea expense ₹50, customer tip ₹20)"
                  : "Optional closing shift remarks..."
              }
              className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-medium text-[#172033] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] resize-none"
            />
          </div>

          {/* Notice about read-only finalized snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-[#64748B] flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Once closed, this shift will be permanently locked and an immutable 80mm thermal closing report will be produced.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#172033] hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-black transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Finalizing Shift...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Reconcile & Close Shift</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
