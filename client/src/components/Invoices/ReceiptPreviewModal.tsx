import React, { useState, useEffect } from "react";
import { X, Printer, RefreshCw, FileText, UtensilsCrossed, CheckCircle2 } from "lucide-react";
import { paymentsApi, InvoiceRecord } from "../../api/payments.api";
import { useAuth } from "../../context/AuthContext";

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber?: string;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
}) => {
  const { branch } = useAuth();
  const [activeView, setActiveView] = useState<"CUSTOMER" | "KITCHEN">("CUSTOMER");
  const [customerText, setCustomerText] = useState<string>("");
  const [kitchenText, setKitchenText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [isReprinting, setIsReprinting] = useState(false);
  const [reprintSuccess, setReprintSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && invoiceId) {
      setIsLoading(true);
      setReprintSuccess(false);

      Promise.all([
        paymentsApi.getInvoiceReceipt(invoiceId),
        paymentsApi.getInvoiceById(invoiceId),
      ])
        .then(([receiptRes, inv]) => {
          setCustomerText(receiptRes.rawText);
          setInvoice(inv);

          // Find kitchen job text if available
          const kitchenJob = inv.printJobs?.find((j) => j.destination === "KITCHEN");
          if (kitchenJob && kitchenJob.payloadSnapshot?.rawText) {
            setKitchenText(kitchenJob.payloadSnapshot.rawText);
          } else {
            setKitchenText("Kitchen ticket for order #" + inv.order?.orderNumber);
          }
        })
        .catch((err) => {
          console.error("Failed to load receipt preview:", err);
          setCustomerText("Error loading thermal receipt preview.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, invoiceId]);

  const handleReprint = async () => {
    setIsReprinting(true);
    setReprintSuccess(false);
    try {
      await paymentsApi.reprintInvoice(invoiceId, {
        destination: activeView === "CUSTOMER" ? "CUSTOMER_RECEIPT" : "KITCHEN",
        reason: "Customer receipt preview reprint",
      });
      setReprintSuccess(true);
      setTimeout(() => setReprintSuccess(false), 3000);
    } catch (err: any) {
      alert("Failed to reprint: " + (err.message || "Unknown error"));
    } finally {
      setIsReprinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <h3 className="text-sm font-bold text-[#172033] flex items-center gap-2">
              <Printer className="w-4 h-4 text-[#2563EB]" />
              <span>Thermal Print Preview</span>
              {invoiceNumber && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-[#2563EB] font-bold rounded-md">
                  {invoiceNumber}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Accurate 80mm ESC/POS monospaced layout simulator
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveView("CUSTOMER")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeView === "CUSTOMER"
                ? "bg-white text-[#2563EB] border-[#E2E8F0] border-b-white -mb-px shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Customer Receipt (80mm)</span>
          </button>

          <button
            onClick={() => setActiveView("KITCHEN")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-x ${
              activeView === "KITCHEN"
                ? "bg-white text-[#2563EB] border-[#E2E8F0] border-b-white -mb-px shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
            <span>Kitchen Ticket (KOT)</span>
          </button>
        </div>

        {/* Paper Simulation Content Area */}
        <div className="flex-1 p-5 overflow-y-auto bg-[#F1F5F9] flex justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#64748B] gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
              <span className="text-xs font-semibold">Generating ticket layout...</span>
            </div>
          ) : (
            <div className="bg-white px-5 pt-4 pb-6 rounded-lg shadow-md border border-slate-300 w-fit max-w-full font-mono text-[11px] sm:text-xs leading-relaxed text-slate-800 overflow-x-auto select-all">
              {activeView === "CUSTOMER" && (
                <div className="flex flex-col items-center justify-center mb-1.5">
                  <img
                    src={branch?.logoPath || "/rollz-logo.png"}
                    alt={branch?.name || "ROLLZ Logo"}
                    className="h-10 w-auto object-contain"
                  />
                </div>
              )}
              <div className="whitespace-pre">
                {activeView === "CUSTOMER" ? customerText : kitchenText}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Reprint Button */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="text-xs">
            {reprintSuccess && (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Reprint dispatched to printer queue</span>
              </span>
            )}
            {invoice?.status && (
              <span className="text-slate-500 font-medium">Status: {invoice.status}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReprint}
              disabled={isReprinting || isLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isReprinting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>Send Reprint</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
