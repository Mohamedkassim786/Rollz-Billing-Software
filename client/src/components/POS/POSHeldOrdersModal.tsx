import React, { useState, useEffect } from "react";
import { X, Clock, Play, Trash2, RefreshCw, ShoppingCart, User, AlertCircle } from "lucide-react";
import { orderApi, OrderRecord } from "../../api/orders.api";
import { formatPaise } from "../../utils/currency";
import { Badge } from "../Common/Badge";

interface POSHeldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResumeOrder: (order: OrderRecord) => void;
}

export const POSHeldOrdersModal: React.FC<POSHeldOrdersModalProps> = ({
  isOpen,
  onClose,
  onResumeOrder,
}) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await orderApi.listOrders();
      // Filter for active drafts or held orders
      const activeDrafts = data.filter((o) => o.status === "DRAFT" || o.status === "HELD");
      setOrders(activeDrafts);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to load draft orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancelOrder = async (orderId: string) => {
    try {
      await orderApi.cancelOrder(orderId);
      loadOrders();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to cancel order");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172033]">Held & Draft Orders</h2>
              <p className="text-xs text-[#64748B]">Active pending orders stored in PostgreSQL</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadOrders}
              className="p-1.5 text-slate-400 hover:text-[#2563EB] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
              <p className="text-xs">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-14 text-center text-slate-500 space-y-2">
              <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-[#172033]">No pending or held orders</p>
              <p className="text-xs max-w-sm mx-auto">
                Orders saved as drafts or held at the counter will appear here for easy recall.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const totalItemQty = order.items.reduce((acc, i) => acc + i.quantity, 0);

                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl border border-[#E2E8F0] hover:border-slate-300 transition-all bg-[#F8FAFC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#2563EB]">
                          {order.orderNumber}
                        </span>
                        <Badge
                          variant={order.status === "HELD" ? "warning" : "info"}
                          size="sm"
                        >
                          {order.status}
                        </Badge>
                        <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          {order.orderType} {order.tableNumber ? `(${order.tableNumber})` : ""}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-3">
                        {order.customerName && (
                          <span className="flex items-center gap-1 font-medium text-[#172033]">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {order.customerName}
                          </span>
                        )}
                        <span>
                          {totalItemQty} {totalItemQty === 1 ? "item" : "items"}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="font-mono font-bold text-sm text-[#172033]">
                        {formatPaise(order.grandTotal)}
                      </span>

                      <button
                        onClick={() => {
                          onResumeOrder(order);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                        title="Resume into Cart"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>

                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Cancel Order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
