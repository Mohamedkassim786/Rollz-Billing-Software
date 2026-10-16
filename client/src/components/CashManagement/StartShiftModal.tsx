import React, { useState } from "react";
import { X, Banknote, ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";
import { rupeesToPaise, formatPaise } from "../../utils/currency";

interface StartShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (openingCashPaise: number) => Promise<void>;
  isLoading: boolean;
}

export const StartShiftModal: React.FC<StartShiftModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [openingRupees, setOpeningRupees] = useState<string>("2000");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickFloatOptions = [1000, 2000, 3000, 5000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(openingRupees);
    if (isNaN(val) || val < 0) {
      setError("Please enter a valid non-negative opening float amount.");
      return;
    }

    const paise = rupeesToPaise(val);
    try {
      await onSubmit(paise);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to start shift");
    }
  };

  const currentPaise = rupeesToPaise(parseFloat(openingRupees) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#172033]">Start Cashier Shift</h3>
              <p className="text-[11px] text-[#64748B]">Initialize drawer opening cash float</p>
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

          <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[11px] text-[#2563EB] uppercase tracking-wider">
                Cash Float Notice
              </p>
              <p className="text-[11px] text-blue-900/80 leading-relaxed mt-0.5">
                The opening amount is the physical cash placed in the cash drawer at shift start. It is not counted as sales revenue.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#172033] mb-1.5">
              Opening Cash Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={openingRupees}
                onChange={(e) => setOpeningRupees(e.target.value)}
                placeholder="2000.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-lg font-bold text-[#172033] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5 px-0.5">
              <span>Formatted amount:</span>
              <span className="font-mono font-bold text-[#2563EB]">
                {formatPaise(currentPaise)}
              </span>
            </div>
          </div>

          {/* Quick preset chips */}
          <div>
            <span className="text-[11px] font-semibold text-[#64748B] block mb-1.5">
              Quick Float Presets:
            </span>
            <div className="grid grid-cols-4 gap-2">
              {quickFloatOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setOpeningRupees(opt.toString())}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    parseFloat(openingRupees) === opt
                      ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                      : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:bg-slate-100 hover:text-[#172033]"
                  }`}
                >
                  ₹{opt}
                </button>
              ))}
            </div>
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
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Starting Shift...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Start Shift</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
