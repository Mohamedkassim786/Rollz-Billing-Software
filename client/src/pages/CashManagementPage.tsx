import React, { useState, useEffect } from "react";
import {
  Banknote,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  RefreshCw,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileText,
  CreditCard,
  Smartphone,
  Coins,
  History,
  TrendingUp,
  SlidersHorizontal,
} from "lucide-react";
import {
  shiftsApi,
  CashierShift,
  ShiftFinancials,
  DailySalesSummary,
} from "../api/shifts.api";
import { formatPaise } from "../utils/currency";
import { StartShiftModal } from "../components/CashManagement/StartShiftModal";
import { CashMovementModal } from "../components/CashManagement/CashMovementModal";
import { CloseShiftModal } from "../components/CashManagement/CloseShiftModal";
import { ShiftReportModal } from "../components/CashManagement/ShiftReportModal";

export const CashManagementPage: React.FC = () => {
  // Tab State
  const [activeTab, setActiveTab] = useState<"ACTIVE_LEDGER" | "DAILY_SUMMARY" | "HISTORY">(
    "ACTIVE_LEDGER"
  );

  // Active Shift States
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [activeFinancials, setActiveFinancials] = useState<ShiftFinancials | null>(null);
  const [isLoadingActive, setIsLoadingActive] = useState<boolean>(true);

  // Daily Summary States
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [dailySummary, setDailySummary] = useState<DailySalesSummary | null>(null);
  const [isLoadingDaily, setIsLoadingDaily] = useState<boolean>(false);

  // Shift History States
  const [shiftHistory, setShiftHistory] = useState<CashierShift[]>([]);
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>("ALL");
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Modals
  const [isStartModalOpen, setIsStartModalOpen] = useState<boolean>(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState<boolean>(false);
  const [movementModalType, setMovementModalType] = useState<"CASH_IN" | "CASH_OUT">("CASH_OUT");
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [reportModalShiftId, setReportModalShiftId] = useState<string | null>(null);

  // Mutation Loading States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch active shift on load
  useEffect(() => {
    fetchActiveShift();
  }, []);

  // Fetch daily summary when tab or date changes
  useEffect(() => {
    if (activeTab === "DAILY_SUMMARY") {
      fetchDailySummary(selectedDate);
    } else if (activeTab === "HISTORY") {
      fetchShiftHistory();
    }
  }, [activeTab, selectedDate, historyFilterStatus]);

  const fetchActiveShift = async () => {
    setIsLoadingActive(true);
    setActionError(null);
    try {
      const data = await shiftsApi.getActiveShift();
      if (data && data.shift) {
        setActiveShift(data.shift);
        setActiveFinancials(data.financials || null);
      } else {
        setActiveShift(null);
        setActiveFinancials(null);
      }
    } catch (err: any) {
      console.error("Failed to load active shift", err);
      setActionError("Could not retrieve active shift status.");
    } finally {
      setIsLoadingActive(false);
    }
  };

  const fetchDailySummary = async (dateStr: string) => {
    setIsLoadingDaily(true);
    try {
      const data = await shiftsApi.getDailySummary(dateStr);
      setDailySummary(data);
    } catch (err) {
      console.error("Failed to load daily summary", err);
    } finally {
      setIsLoadingDaily(false);
    }
  };

  const fetchShiftHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const statusParam =
        historyFilterStatus === "ALL" ? undefined : (historyFilterStatus as any);
      const data = await shiftsApi.listShifts({ status: statusParam, limit: 30 });
      setShiftHistory(data.shifts);
    } catch (err) {
      console.error("Failed to load shift history", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handlers
  const handleStartShift = async (openingCashPaise: number) => {
    setIsSubmitting(true);
    try {
      await shiftsApi.startShift(openingCashPaise);
      await fetchActiveShift();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordMovement = async (data: {
    type: "CASH_IN" | "CASH_OUT";
    amount: number;
    reason: string;
    notes?: string;
  }) => {
    setIsSubmitting(true);
    try {
      await shiftsApi.recordCashMovement(data);
      await fetchActiveShift();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCloseModal = async () => {
    if (!activeShift) return;
    setIsLoadingActive(true);
    try {
      const preview = await shiftsApi.getClosingPreview(activeShift.id);
      setActiveFinancials(preview);
      setIsCloseModalOpen(true);
    } catch (err: any) {
      setActionError(err?.response?.data?.message || "Failed to load closing preview");
    } finally {
      setIsLoadingActive(false);
    }
  };

  const handleCloseShift = async (data: { actualCash: number; closingNotes?: string }) => {
    if (!activeShift) return;
    setIsSubmitting(true);
    try {
      const closed = await shiftsApi.closeShift(activeShift.id, data);
      setIsCloseModalOpen(false);
      // Immediately offer view of closing report
      setReportModalShiftId(closed.shift.id);
      await fetchActiveShift();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-xs">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-[#172033]">
                Cash Management & Cashier Shifts
              </h1>
              {activeShift ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>SHIFT ACTIVE ({activeShift.shiftNumber})</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  NO ACTIVE SHIFT
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Strict physical drawer float control, cash in/out tracking, live reconciliation, and 80mm closing audit slips
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              fetchActiveShift();
              if (activeTab === "DAILY_SUMMARY") fetchDailySummary(selectedDate);
              if (activeTab === "HISTORY") fetchShiftHistory();
            }}
            title="Refresh shift data"
            className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#172033] hover:bg-slate-100 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoadingActive || isLoadingDaily || isLoadingHistory ? "animate-spin text-[#2563EB]" : ""}`}
            />
          </button>

          {!activeShift ? (
            <button
              onClick={() => setIsStartModalOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Start Cashier Shift</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMovementModalType("CASH_IN");
                  setIsMovementModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>+ Cash In</span>
              </button>

              <button
                onClick={() => {
                  setMovementModalType("CASH_OUT");
                  setIsMovementModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1.5"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>- Cash Out</span>
              </button>

              <button
                onClick={handleOpenCloseModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-black transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Close Shift</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Active Shift Financial Summary Grid */}
      {activeShift && activeFinancials ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Opening Cash */}
            <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B] mb-1">
                <span className="text-[11px] font-semibold">Opening Float</span>
                <Coins className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-base font-bold font-mono text-[#172033]">
                {formatPaise(activeFinancials.openingCash)}
              </p>
              <span className="text-[10px] text-slate-400">Non-revenue drawer base</span>
            </div>

            {/* Cash Sales */}
            <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-[11px] font-semibold">Cash Sales</span>
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-base font-bold font-mono text-emerald-700">
                {formatPaise(activeFinancials.cashSales)}
              </p>
              <span className="text-[10px] text-slate-400">Physical tender collected</span>
            </div>

            {/* UPI Sales */}
            <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
              <div className="flex items-center justify-between text-cyan-700 mb-1">
                <span className="text-[11px] font-semibold">UPI Sales</span>
                <Smartphone className="w-3.5 h-3.5 text-cyan-600" />
              </div>
              <p className="text-base font-bold font-mono text-cyan-700">
                {formatPaise(activeFinancials.upiSales)}
              </p>
              <span className="text-[10px] text-slate-400">Bank deposit (not in drawer)</span>
            </div>

            {/* Card Sales */}
            <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
              <div className="flex items-center justify-between text-purple-700 mb-1">
                <span className="text-[11px] font-semibold">Card Sales</span>
                <CreditCard className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <p className="text-base font-bold font-mono text-purple-700">
                {formatPaise(activeFinancials.cardSales)}
              </p>
              <span className="text-[10px] text-slate-400">Terminal swipe (not in drawer)</span>
            </div>

            {/* Cash In & Out (Ledger Movements) */}
            <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
              <div className="flex items-center justify-between text-[#64748B] mb-1">
                <span className="text-[11px] font-semibold">In / Out Moves</span>
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                <span className="text-emerald-600">+{formatPaise(activeFinancials.cashInTotal)}</span>
                <span className="text-slate-300">/</span>
                <span className="text-red-600">-{formatPaise(activeFinancials.cashOutTotal)}</span>
              </div>
              <span className="text-[10px] text-slate-400">Float adds & expenses</span>
            </div>

            {/* Expected Drawer Cash */}
            <div className="bg-blue-50/70 p-4 rounded-xl border-2 border-[#2563EB] shadow-xs">
              <div className="flex items-center justify-between text-blue-900 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Expected Drawer Cash
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
              </div>
              <p className="text-lg font-extrabold font-mono text-[#2563EB]">
                {formatPaise(activeFinancials.expectedDrawerCash)}
              </p>
              <span className="text-[10px] text-blue-700 font-medium">
                Must physically match count
              </span>
            </div>
          </div>

          {/* Active Shift Details Bar */}
          <div className="bg-white px-5 py-3 rounded-xl border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Cashier:</span>
                <strong className="text-[#172033] font-semibold">
                  {activeShift.cashier?.displayName}
                </strong>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Opened At:</span>
                <strong className="text-[#172033] font-mono">
                  {new Date(activeShift.openedAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </strong>
              </div>
              <div className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-slate-400" />
                <span>Finalized Orders:</span>
                <strong className="text-[#172033] font-mono font-bold">
                  {activeFinancials.finalizedOrdersCount}
                </strong>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Total Finalized Revenue:</span>
                <strong className="text-[#2563EB] font-mono font-bold">
                  {formatPaise(activeFinancials.totalSales)}
                </strong>
              </div>
            </div>

            <button
              onClick={() => setReportModalShiftId(activeShift.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Preview Closing Slip</span>
            </button>
          </div>
        </div>
      ) : (
        /* Empty State when no shift is open */
        <div className="bg-white p-8 rounded-2xl border border-dashed border-[#CBD5E1] text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-[#64748B] flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-[#172033]">
              No Open Shift For This Register
            </h3>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
              To process cash payments and maintain an auditable financial drawer, please start a cashier shift by declaring the physical opening float.
            </p>
          </div>
          <button
            onClick={() => setIsStartModalOpen(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 transition-colors shadow-xs inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Open Drawer & Start Shift</span>
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-[#E2E8F0] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("ACTIVE_LEDGER")}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "ACTIVE_LEDGER"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-[#64748B] hover:text-[#172033]"
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Active Shift Cash Ledger</span>
            {activeShift?.cashMovements && activeShift.cashMovements.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-[#2563EB]">
                {activeShift.cashMovements.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("DAILY_SUMMARY")}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "DAILY_SUMMARY"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-[#64748B] hover:text-[#172033]"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Daily Sales Summary</span>
          </button>

          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === "HISTORY"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-[#64748B] hover:text-[#172033]"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Shift History & Audits</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ACTIVE LEDGER */}
      {activeTab === "ACTIVE_LEDGER" && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                Cash Movements & Ledger Entries
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Immutable log of cash float top-ups and cash petty expenses during this shift
              </p>
            </div>

            {activeShift && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setMovementModalType("CASH_IN");
                    setIsMovementModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Record Cash In</span>
                </button>
                <button
                  onClick={() => {
                    setMovementModalType("CASH_OUT");
                    setIsMovementModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Record Cash Out</span>
                </button>
              </div>
            )}
          </div>

          {activeShift && activeShift.cashMovements && activeShift.cashMovements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] font-semibold">
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Movement Type</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Additional Notes</th>
                    <th className="py-3 px-4">Recorded By</th>
                    <th className="py-3 px-4 text-right">Drawer Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {activeShift.cashMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            m.type === "CASH_IN"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {m.type === "CASH_IN" ? (
                            <ArrowDownRight className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          <span>{m.type === "CASH_IN" ? "CASH IN" : "CASH OUT"}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#172033]">{m.reason}</td>
                      <td className="py-3 px-4 text-[#64748B] italic">{m.notes || "—"}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {m.user?.displayName || "Cashier"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={m.type === "CASH_IN" ? "text-emerald-600" : "text-red-600"}
                        >
                          {m.type === "CASH_IN" ? "+" : "-"}
                          {formatPaise(m.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-[#64748B]">
              <p className="text-xs">
                No manual cash movements recorded yet for this active shift.
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Any petty cash withdrawals or change additions recorded will appear here immediately.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAILY SALES SUMMARY */}
      {activeTab === "DAILY_SUMMARY" && (
        <div className="space-y-4">
          {/* Date Selector Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#2563EB]" />
              <span className="text-xs font-bold text-[#172033]">Summary Date (IST):</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>

            <div className="text-[11px] text-[#64748B]">
              Consolidates finalized invoices and shifts for {selectedDate}
            </div>
          </div>

          {dailySummary ? (
            <div className="space-y-4">
              {/* Daily Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
                  <span className="text-[11px] text-[#64748B] block font-medium">
                    Finalized Orders
                  </span>
                  <p className="text-xl font-bold font-mono text-[#172033] mt-0.5">
                    {dailySummary.finalizedOrdersCount}
                  </p>
                  <span className="text-[10px] text-slate-400">Excludes drafts & failed</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
                  <span className="text-[11px] text-[#64748B] block font-medium">
                    Gross Finalized Sales
                  </span>
                  <p className="text-xl font-bold font-mono text-[#172033] mt-0.5">
                    {formatPaise(dailySummary.grossSales)}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    Discounts: -{formatPaise(dailySummary.discountsTotal)}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
                  <span className="text-[11px] text-[#64748B] block font-medium">
                    Taxes Collected (GST)
                  </span>
                  <p className="text-xl font-bold font-mono text-[#172033] mt-0.5">
                    {formatPaise(dailySummary.taxesTotal)}
                  </p>
                  <span className="text-[10px] text-slate-400">Tax compliance liability</span>
                </div>

                <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 shadow-xs">
                  <span className="text-[11px] text-[#2563EB] block font-bold uppercase tracking-wider">
                    Net Finalized Sales
                  </span>
                  <p className="text-xl font-extrabold font-mono text-[#2563EB] mt-0.5">
                    {formatPaise(dailySummary.netSales)}
                  </p>
                  <span className="text-[10px] text-blue-700">Authoritative day revenue</span>
                </div>
              </div>

              {/* Tenders Breakdown & Shift Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Payment Breakdown Card */}
                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wider flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#2563EB]" />
                    <span>Sales By Payment Method</span>
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 rounded-xl">
                      <div className="flex items-center gap-2 text-emerald-800">
                        <Banknote className="w-4 h-4 text-emerald-600" />
                        <span className="font-semibold">Cash Payments</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        {formatPaise(dailySummary.paymentBreakdown.cash)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-cyan-50/50 rounded-xl">
                      <div className="flex items-center gap-2 text-cyan-800">
                        <Smartphone className="w-4 h-4 text-cyan-600" />
                        <span className="font-semibold">UPI Payments</span>
                      </div>
                      <span className="font-mono font-bold text-cyan-700 text-sm">
                        {formatPaise(dailySummary.paymentBreakdown.upi)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-purple-50/50 rounded-xl">
                      <div className="flex items-center gap-2 text-purple-800">
                        <CreditCard className="w-4 h-4 text-purple-600" />
                        <span className="font-semibold">Card Payments</span>
                      </div>
                      <span className="font-mono font-bold text-purple-700 text-sm">
                        {formatPaise(dailySummary.paymentBreakdown.card)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cash Movements & Shifts Count */}
                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wider flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#2563EB]" />
                    <span>Drawer Operations & Shifts</span>
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 bg-[#F8FAFC] rounded-xl">
                      <span className="text-[#64748B]">Total Cash Paid Out (Expenses):</span>
                      <span className="font-mono font-bold text-red-600 text-sm">
                        -{formatPaise(dailySummary.cashExpensesTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-[#F8FAFC] rounded-xl">
                      <span className="text-[#64748B]">Total Cash Float Added:</span>
                      <span className="font-mono font-bold text-emerald-600 text-sm">
                        +{formatPaise(dailySummary.cashAdditionsTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-[#64748B]">Shifts Opened / Closed Today:</span>
                      <span className="font-mono font-bold text-[#172033]">
                        {dailySummary.shiftsOpenedCount} Opened / {dailySummary.shiftsClosedCount} Closed
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-[#E2E8F0] text-center text-slate-400">
              <p className="text-xs">No daily sales recorded for {selectedDate}.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SHIFT HISTORY */}
      {activeTab === "HISTORY" && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden space-y-0">
          {/* Filters Bar */}
          <div className="p-4 px-6 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC]">
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                Cashier Shift History
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Closed shifts are locked and read-only. Click view to reprint 80mm closing slips.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] font-medium">Status:</span>
              <select
                value={historyFilterStatus}
                onChange={(e) => setHistoryFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#172033] bg-white focus:outline-hidden"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open Only</option>
                <option value="CLOSED">Closed Only</option>
              </select>
            </div>
          </div>

          {shiftHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] font-semibold">
                    <th className="py-3 px-4">Shift #</th>
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4">Opened At</th>
                    <th className="py-3 px-4">Closed At</th>
                    <th className="py-3 px-4 text-right">Opening Float</th>
                    <th className="py-3 px-4 text-right">Expected Drawer</th>
                    <th className="py-3 px-4 text-right">Actual Count</th>
                    <th className="py-3 px-4 text-center">Discrepancy</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {shiftHistory.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#2563EB] whitespace-nowrap">
                        {s.shiftNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {s.cashier?.displayName || "Cashier"}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(s.openedAt).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {s.closedAt
                          ? new Date(s.closedAt).toLocaleString("en-IN", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#172033]">
                        {formatPaise(s.openingCash)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#172033]">
                        {s.expectedCash !== null && s.expectedCash !== undefined
                          ? formatPaise(s.expectedCash)
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#172033]">
                        {s.actualCash !== null && s.actualCash !== undefined
                          ? formatPaise(s.actualCash)
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {s.cashDifference !== null && s.cashDifference !== undefined ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              s.cashDifference === 0
                                ? "bg-emerald-100 text-emerald-800"
                                : s.cashDifference > 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {s.cashDifference === 0
                              ? "Exact"
                              : `${s.cashDifference > 0 ? "+" : ""}${formatPaise(s.cashDifference)}`}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            s.status === "CLOSED"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setReportModalShiftId(s.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Report</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No shifts found matching the filter criteria.
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <StartShiftModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        onSubmit={handleStartShift}
        isLoading={isSubmitting}
      />

      <CashMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        defaultType={movementModalType}
        onSubmit={handleRecordMovement}
        isLoading={isSubmitting}
      />

      {activeShift && activeFinancials && (
        <CloseShiftModal
          isOpen={isCloseModalOpen}
          onClose={() => setIsCloseModalOpen(false)}
          shift={activeShift}
          financials={activeFinancials}
          onSubmit={handleCloseShift}
          isLoading={isSubmitting}
        />
      )}

      {reportModalShiftId && (
        <ShiftReportModal
          isOpen={!!reportModalShiftId}
          onClose={() => setReportModalShiftId(null)}
          shiftId={reportModalShiftId}
        />
      )}
    </div>
  );
};
export default CashManagementPage;
