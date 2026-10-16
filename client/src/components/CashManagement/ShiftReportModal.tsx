import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Copy,
  Check,
  FileText,
  LayoutGrid,
} from "lucide-react";
import { CashierShift, ShiftFinancials, shiftsApi } from "../../api/shifts.api";
import { formatPaise } from "../../utils/currency";

interface ShiftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId: string;
}

export const ShiftReportModal: React.FC<ShiftReportModalProps> = ({
  isOpen,
  onClose,
  shiftId,
}) => {
  const [reportText, setReportText] = useState<string>("");
  const [shiftData, setShiftData] = useState<{
    shift: CashierShift;
    financials: ShiftFinancials;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"thermal" | "cards">("thermal");

  useEffect(() => {
    if (isOpen && shiftId) {
      loadReport();
    }
  }, [isOpen, shiftId]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await shiftsApi.getShiftReport(shiftId);
      setReportText(res.reportText);
      setShiftData(res.data);
    } catch (err) {
      console.error("Failed to load shift closing report", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBrowserPrint = () => {
    const printWindow = window.open("", "_blank", "width=450,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>ROLLZ Shift Report - ${shiftData?.shift?.shiftNumber || ""}</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              line-height: 1.25;
              margin: 0;
              padding: 5px;
              color: #000;
              white-space: pre-wrap;
              word-break: break-all;
            }
          </style>
        </head>
        <body>${reportText}</body>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#172033]">
                  Shift Closing Audit Report
                </h3>
                {shiftData?.shift?.shiftNumber && (
                  <span className="font-mono text-[10px] bg-blue-100 text-[#2563EB] px-2 py-0.5 rounded-full font-bold">
                    {shiftData.shift.shiftNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#64748B]">
                Authoritative 80mm thermal receipt & structured financial summary
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("thermal")}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "thermal"
                    ? "bg-white text-[#172033] shadow-xs"
                    : "text-[#64748B] hover:text-[#172033]"
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Thermal (80mm)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("cards")}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "cards"
                    ? "bg-white text-[#172033] shadow-xs"
                    : "text-[#64748B] hover:text-[#172033]"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Structured Cards</span>
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F5F7FB]">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-7 h-7 border-3 border-blue-200 border-t-[#2563EB] rounded-full animate-spin" />
              <span className="text-xs font-medium">Generating Closing Report...</span>
            </div>
          ) : activeTab === "thermal" ? (
            /* Tab 1: Monospace 80mm Thermal Paper View */
            <div className="max-w-md mx-auto">
              <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 relative font-mono text-xs text-[#172033] leading-relaxed selection:bg-blue-100">
                {/* Paper header notch styling */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 rounded-t-xl" />

                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-tight text-slate-900 overflow-x-auto">
                  {reportText}
                </pre>

                {/* Paper zigzag bottom styling */}
                <div className="mt-4 pt-3 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-400 font-sans">
                  •••••• END OF THERMAL SLIP ••••••
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: Clean Structured Cards Breakdown */
            shiftData && (
              <div className="space-y-4 max-w-xl mx-auto">
                {/* Shift Meta */}
                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-[#64748B] block">Cashier</span>
                    <span className="font-bold text-[#172033]">
                      {shiftData.shift.cashier?.displayName} (@{shiftData.shift.cashier?.username})
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] block">Shift Status</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        shiftData.shift.status === "CLOSED"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {shiftData.shift.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] block">Opened At</span>
                    <span className="font-mono text-slate-700">
                      {new Date(shiftData.shift.openedAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#64748B] block">Closed At</span>
                    <span className="font-mono text-slate-700">
                      {shiftData.shift.closedAt
                        ? new Date(shiftData.shift.closedAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Shift in progress"}
                    </span>
                  </div>
                </div>

                {/* Sales Totals */}
                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-2.5">
                  <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                    Sales Breakdown
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 bg-[#F8FAFC] rounded-lg">
                      <span className="text-[10px] text-[#64748B] block">Finalized Orders</span>
                      <span className="text-sm font-bold text-[#172033] font-mono">
                        {shiftData.financials.finalizedOrdersCount}
                      </span>
                    </div>
                    <div className="p-2.5 bg-[#F8FAFC] rounded-lg">
                      <span className="text-[10px] text-[#64748B] block">Gross Sales</span>
                      <span className="text-sm font-bold text-[#172033] font-mono">
                        {formatPaise(shiftData.financials.grossSales)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-blue-50/50 rounded-lg">
                      <span className="text-[10px] text-[#2563EB] block">Net Finalized Sales</span>
                      <span className="text-sm font-bold text-[#2563EB] font-mono">
                        {formatPaise(shiftData.financials.netSales)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payments By Tender */}
                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-2.5">
                  <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                    Tenders Collected
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 bg-emerald-50/50 rounded-lg">
                      <span className="text-[10px] text-emerald-800 block">Cash Tender</span>
                      <span className="text-sm font-bold text-emerald-700 font-mono">
                        {formatPaise(shiftData.financials.cashSales)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-cyan-50/50 rounded-lg">
                      <span className="text-[10px] text-cyan-800 block">UPI Tender</span>
                      <span className="text-sm font-bold text-cyan-700 font-mono">
                        {formatPaise(shiftData.financials.upiSales)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-purple-50/50 rounded-lg">
                      <span className="text-[10px] text-purple-800 block">Card Tender</span>
                      <span className="text-sm font-bold text-purple-700 font-mono">
                        {formatPaise(shiftData.financials.cardSales)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cash Reconciliation Summary */}
                <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-2.5">
                  <h4 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                    Cash Drawer Reconciliation
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 bg-[#F8FAFC] rounded-lg">
                      <span className="text-[#64748B]">Opening Cash Float:</span>
                      <span className="font-mono font-bold">{formatPaise(shiftData.financials.openingCash)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-emerald-50/40 rounded-lg">
                      <span className="text-emerald-800">+ Cash Sales:</span>
                      <span className="font-mono font-bold text-emerald-700">{formatPaise(shiftData.financials.cashSales)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-blue-50/40 rounded-lg">
                      <span className="text-blue-800">+ Cash In (Additions):</span>
                      <span className="font-mono font-bold text-blue-700">{formatPaise(shiftData.financials.cashInTotal)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-red-50/40 rounded-lg">
                      <span className="text-red-800">- Cash Out (Expenses):</span>
                      <span className="font-mono font-bold text-red-700">{formatPaise(shiftData.financials.cashOutTotal)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-100 rounded-lg col-span-2">
                      <span className="font-bold text-[#172033]">Expected Drawer Cash:</span>
                      <span className="font-mono font-bold text-base text-[#172033]">
                        {formatPaise(shiftData.financials.expectedDrawerCash)}
                      </span>
                    </div>
                    {shiftData.shift.actualCash !== null && shiftData.shift.actualCash !== undefined && (
                      <>
                        <div className="flex justify-between p-2 bg-[#F8FAFC] rounded-lg">
                          <span className="text-[#64748B]">Actual Cash Counted:</span>
                          <span className="font-mono font-bold">{formatPaise(shiftData.shift.actualCash)}</span>
                        </div>
                        <div
                          className={`flex justify-between p-2 rounded-lg font-bold ${
                            (shiftData.shift.cashDifference || 0) < 0
                              ? "bg-red-100 text-red-800"
                              : (shiftData.shift.cashDifference || 0) > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          <span>Reconciliation Difference:</span>
                          <span className="font-mono">
                            {(shiftData.shift.cashDifference || 0) > 0 ? "+" : ""}
                            {formatPaise(shiftData.shift.cashDifference || 0)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Audit & Notes */}
                {shiftData.shift.closingNotes && (
                  <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xl text-xs text-amber-900">
                    <span className="font-bold block text-[11px] uppercase tracking-wider mb-0.5">
                      Closing Notes
                    </span>
                    <p>{shiftData.shift.closingNotes}</p>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-between bg-white shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#172033] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-slate-100 transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied Slip" : "Copy ASCII Text"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#172033] hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#2563EB] hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip (80mm)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
