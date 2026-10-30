import React, { useState } from "react";
import {
  CheckCircle2,
  Printer,
  FileText,
  RotateCcw,
  PlusCircle,
  AlertCircle,
  RefreshCw,
  UtensilsCrossed,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { formatPaise } from "../../utils/currency";
import { PaymentResultResponse, paymentsApi } from "../../api/payments.api";
import { ReceiptPreviewModal } from "../Invoices/ReceiptPreviewModal";

interface POSPaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: PaymentResultResponse | null;
  onStartNewOrder: () => void;
}

export const POSPaymentSuccessModal: React.FC<POSPaymentSuccessModalProps> = ({
  isOpen,
  result,
  onStartNewOrder,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isReprinting, setIsReprinting] = useState(false);
  const [reprintMessage, setReprintMessage] = useState<string | null>(null);

  if (!isOpen || !result) return null;

  const { invoice, payments, printJobs } = result;

  const customerJob = printJobs?.find((j) => j.destination === "CUSTOMER_RECEIPT");
  const kitchenJob = printJobs?.find((j) => j.destination === "KITCHEN");

  const handleReprintReceipt = async () => {
    setIsReprinting(true);
    setReprintMessage(null);
    try {
      await paymentsApi.reprintInvoice(invoice.id, {
        destination: "CUSTOMER_RECEIPT",
        reason: "Customer Requested Duplicate",
      });
      setReprintMessage("Receipt reprinted successfully!");
      setTimeout(() => setReprintMessage(null), 3000);
    } catch (err: any) {
      setReprintMessage("Reprint failed: " + (err.message || "Unknown error"));
    } finally {
      setIsReprinting(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await paymentsApi.retryPrintJob(jobId);
      setReprintMessage("Print job retried successfully");
      setTimeout(() => setReprintMessage(null), 3000);
    } catch (err: any) {
      setReprintMessage("Retry failed: " + (err.message || "Unknown error"));
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] w-full max-w-lg overflow-hidden flex flex-col">
          {/* Top Banner */}
          <div className="bg-emerald-600 text-white p-6 text-center space-y-2">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-xs">
              <CheckCircle2 className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-xl font-black tracking-tight">Payment Confirmed!</h2>
            <p className="text-xs text-emerald-100 font-medium">
              Order has been finalized and immutable invoice snapshot stored.
            </p>
          </div>

          {/* Details Card */}
          <div className="p-6 space-y-5">
            {reprintMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-[#2563EB] font-bold flex items-center gap-2">
                <Printer className="w-4 h-4 shrink-0" />
                <span>{reprintMessage}</span>
              </div>
            )}

            {/* Invoicing summary */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs">
              <div>
                <span className="text-slate-400 font-semibold block text-[11px]">Invoice Number</span>
                <span className="text-[#172033] font-black text-sm">{invoice.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[11px]">Order Number</span>
                <span className="text-[#172033] font-black text-sm">#{result.order.orderNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[11px]">Total Paid</span>
                <span className="text-emerald-600 font-black text-sm">
                  {formatPaise(invoice.grandTotal)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[11px]">Payment Mode</span>
                <span className="text-slate-700 font-bold">
                  {payments.map((p) => p.method).join(", ")}
                </span>
              </div>
            </div>

            {/* Print Jobs Status Box */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Thermal Printing Status</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Customer Receipt */}
                <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-700">Customer Bill</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      customerJob?.status === "PRINTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : customerJob?.status === "FAILED"
                        ? "bg-red-100 text-red-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {customerJob?.status || "QUEUED"}
                  </span>
                </div>

                {/* Kitchen Order Ticket */}
                <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-slate-700">Kitchen KOT</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      kitchenJob?.status === "PRINTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : kitchenJob?.status === "FAILED"
                        ? "bg-red-100 text-red-800"
                        : kitchenJob?.status === "PENDING" || kitchenJob?.status === "PRINTING"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {kitchenJob ? kitchenJob.status : "DISABLED"}
                  </span>
                </div>
              </div>

              {/* Retry if failed */}
              {(customerJob?.status === "FAILED" || kitchenJob?.status === "FAILED") && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {kitchenJob?.status === "FAILED" && kitchenJob.lastError
                        ? `Kitchen: ${kitchenJob.lastError}`
                        : customerJob?.status === "FAILED" && customerJob.lastError
                        ? `Customer receipt: ${customerJob.lastError}`
                        : "Printer offline or connection timeout"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (customerJob?.status === "FAILED") handleRetryJob(customerJob.id);
                      if (kitchenJob?.status === "FAILED") handleRetryJob(kitchenJob.id);
                    }}
                    className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    Retry Job
                  </button>
                </div>
              )}
            </div>

            {/* WhatsApp CRM & Digital Receipt Status */}
            <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp Digital Receipt & CRM</span>
                </span>
                {result.whatsapp?.success ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Delivered</span>
                  </span>
                ) : result.order?.customerPhone ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                    Offline Fallback
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-400">
                    No phone entered
                  </span>
                )}
              </div>

              {result.order?.customerPhone ? (
                <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                  <div className="text-slate-600 truncate">
                    <span>To: </span>
                    <span className="font-semibold text-slate-800">
                      {result.order.customerName ? `${result.order.customerName} (` : ""}
                      {result.order.customerPhone}
                      {result.order.customerName ? ")" : ""}
                    </span>
                    {result.customer?.totalVisits && (
                      <span className="ml-1 text-[11px] text-blue-600 font-semibold">
                        • {result.customer.totalVisits} visits
                      </span>
                    )}
                  </div>

                  {result.whatsapp?.directUrl && (
                    <a
                      href={result.whatsapp.directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                      title="Open in WhatsApp Web / App"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>{result.whatsapp?.success ? "Chat" : "Send via WhatsApp"}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Tip: Next time enter customer phone number in POS to auto-save and send instant WhatsApp bills.
                </p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Receipt</span>
              </button>

              <button
                type="button"
                onClick={handleReprintReceipt}
                disabled={isReprinting}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isReprinting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Reprint Receipt</span>
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-end">
            <button
              type="button"
              onClick={onStartNewOrder}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Start New Order</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Receipt Preview Modal */}
      <ReceiptPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
      />
    </>
  );
};
