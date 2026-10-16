import React from "react";
import { Banknote, Smartphone, CreditCard, PieChart } from "lucide-react";
import { formatPaise } from "../../utils/currency";

interface PaymentDonutChartProps {
  payments: {
    cash: number;
    upi: number;
    card: number;
    total: number;
    splitOrderCount: number;
  };
}

export const PaymentDonutChart: React.FC<PaymentDonutChartProps> = ({ payments }) => {
  const total = payments.total || 0;

  const cashPct = total > 0 ? (payments.cash / total) * 100 : 0;
  const upiPct = total > 0 ? (payments.upi / total) * 100 : 0;
  const cardPct = total > 0 ? (payments.card / total) * 100 : 0;

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-[#172033] uppercase tracking-wider">
              Tender Distribution
            </h3>
            <p className="text-[11px] text-[#64748B]">Revenue share across payment methods</p>
          </div>
        </div>

        {payments.splitOrderCount > 0 && (
          <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
            {payments.splitOrderCount} Split Orders
          </span>
        )}
      </div>

      {/* Progress Bar Breakdown */}
      <div className="space-y-2">
        <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${cashPct}%` }}
            className="bg-emerald-500 h-full transition-all duration-300"
            title={`Cash: ${cashPct.toFixed(1)}%`}
          />
          <div
            style={{ width: `${upiPct}%` }}
            className="bg-cyan-500 h-full transition-all duration-300"
            title={`UPI: ${upiPct.toFixed(1)}%`}
          />
          <div
            style={{ width: `${cardPct}%` }}
            className="bg-purple-500 h-full transition-all duration-300"
            title={`Card: ${cardPct.toFixed(1)}%`}
          />
        </div>

        <div className="flex justify-between text-[10px] text-[#64748B] font-mono">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Legend & Amounts */}
      <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
        {/* Cash */}
        <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
            <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Cash</span>
            <span className="ml-auto text-[10px] opacity-75">{cashPct.toFixed(0)}%</span>
          </div>
          <span className="text-xs font-bold font-mono text-emerald-700 block truncate">
            {formatPaise(payments.cash)}
          </span>
          <span className="text-[9px] text-emerald-800/70 block">Physical Drawer</span>
        </div>

        {/* UPI */}
        <div className="p-2.5 bg-cyan-50/50 border border-cyan-100 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-cyan-800 font-bold text-[11px]">
            <Smartphone className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
            <span>UPI</span>
            <span className="ml-auto text-[10px] opacity-75">{upiPct.toFixed(0)}%</span>
          </div>
          <span className="text-xs font-bold font-mono text-cyan-700 block truncate">
            {formatPaise(payments.upi)}
          </span>
          <span className="text-[9px] text-cyan-800/70 block">Bank Transfer</span>
        </div>

        {/* Card */}
        <div className="p-2.5 bg-purple-50/50 border border-purple-100 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-purple-800 font-bold text-[11px]">
            <CreditCard className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Card</span>
            <span className="ml-auto text-[10px] opacity-75">{cardPct.toFixed(0)}%</span>
          </div>
          <span className="text-xs font-bold font-mono text-purple-700 block truncate">
            {formatPaise(payments.card)}
          </span>
          <span className="text-[9px] text-purple-800/70 block">POS Terminal</span>
        </div>
      </div>
    </div>
  );
};
