import React, { useState } from "react";
import { X, ArrowDownRight, ArrowUpRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { CashMovementType } from "../../api/shifts.api";
import { rupeesToPaise, formatPaise } from "../../utils/currency";

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: CashMovementType;
  onSubmit: (data: {
    type: CashMovementType;
    amount: number;
    reason: string;
    notes?: string;
  }) => Promise<void>;
  isLoading: boolean;
}

export const CashMovementModal: React.FC<CashMovementModalProps> = ({
  isOpen,
  onClose,
  defaultType = "CASH_OUT",
  onSubmit,
  isLoading,
}) => {
  const [type, setType] = useState<CashMovementType>(defaultType);
  const [rupees, setRupees] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setRupees("");
      setReason("");
      setNotes("");
      setError(null);
    }
  }, [isOpen, defaultType]);

  if (!isOpen) return null;

  const cashInReasons = [
    "Float Addition / More Change Added",
    "Change Exchange from Bank",
    "Drawer Replenishment",
    "Manager Cash Injection",
    "Other Cash Addition",
  ];

  const cashOutReasons = [
    "Petty Cash: Milk / Dairy / Ice Purchase",
    "Petty Cash: Fresh Vegetables / Grocery",
    "Petty Cash: Cleaning / Packaging Supplies",
    "Vendor Cash Payment",
    "Emergency Repair / Fuel",
    "Authorized Cash Removal",
    "Other Restaurant Expense",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(rupees);
    if (isNaN(val) || val <= 0) {
      setError("Please enter a valid positive cash amount.");
      return;
    }

    if (!reason.trim()) {
      setError("Please provide or select a reason for this cash movement.");
      return;
    }

    const paise = rupeesToPaise(val);
    try {
      await onSubmit({
        type,
        amount: paise,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to record cash movement");
    }
  };

  const currentPaise = rupeesToPaise(parseFloat(rupees) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                type === "CASH_IN"
                  ? "bg-emerald-50 border border-emerald-100 text-emerald-600"
                  : "bg-red-50 border border-red-100 text-red-600"
              }`}
            >
              {type === "CASH_IN" ? (
                <ArrowDownRight className="w-5 h-5" />
              ) : (
                <ArrowUpRight className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#172033]">
                {type === "CASH_IN" ? "Record Cash In (Drawer Addition)" : "Record Cash Out (Expense / Removal)"}
              </h3>
              <p className="text-[11px] text-[#64748B]">
                {type === "CASH_IN"
                  ? "Add physical cash float or change into drawer"
                  : "Deduct physical cash from drawer for expenses"}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Toggle Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#F1F5F9] rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setType("CASH_IN");
                setReason("");
              }}
              className={`py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                type === "CASH_IN"
                  ? "bg-white text-emerald-700 shadow-xs border border-emerald-200"
                  : "text-[#64748B] hover:text-[#172033]"
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>CASH IN (+ Drawer)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType("CASH_OUT");
                setReason("");
              }}
              className={`py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                type === "CASH_OUT"
                  ? "bg-white text-red-700 shadow-xs border border-red-200"
                  : "text-[#64748B] hover:text-[#172033]"
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>CASH OUT (- Drawer)</span>
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-[#172033] mb-1.5">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={rupees}
                onChange={(e) => setRupees(e.target.value)}
                placeholder="500.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-lg font-bold text-[#172033] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5 px-0.5">
              <span>Effect on Drawer Balance:</span>
              <span
                className={`font-mono font-bold ${
                  type === "CASH_IN" ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {type === "CASH_IN" ? "+" : "-"}
                {formatPaise(currentPaise)}
              </span>
            </div>
          </div>

          {/* Quick preset reasons */}
          <div>
            <label className="block text-xs font-bold text-[#172033] mb-1.5">
              Reason <span className="text-red-500">*</span>
            </label>
            <div className="space-y-1.5 mb-2">
              <div className="flex flex-wrap gap-1.5">
                {(type === "CASH_IN" ? cashInReasons : cashOutReasons).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border text-left transition-all ${
                      reason === r
                        ? "bg-blue-50 text-[#2563EB] border-blue-200 font-semibold"
                        : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-slate-100 hover:text-[#172033]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Or type custom reason..."
              className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-medium text-[#172033] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-[#172033] mb-1.5">
              Additional Notes <span className="text-[11px] font-normal text-[#64748B]">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Receipt #123 attached from grocery vendor"
              className="w-full px-3.5 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-medium text-[#172033] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] resize-none"
            />
          </div>

          {/* Actions */}
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
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50 ${
                type === "CASH_IN"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Record {type === "CASH_IN" ? "Cash In" : "Cash Out"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
