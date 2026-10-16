import React, { useState } from "react";
import { TrendingUp, Calendar } from "lucide-react";
import { formatPaise } from "../../utils/currency";

interface SalesTrendItem {
  date: string;
  ordersCount: number;
  grossSales: number;
  netSales: number;
}

interface SalesTrendChartProps {
  data: SalesTrendItem[];
  isLoading?: boolean;
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({ data, isLoading }) => {
  const [metric, setMetric] = useState<"sales" | "orders">("sales");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs h-72 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <div className="w-6 h-6 border-2 border-blue-200 border-t-[#2563EB] rounded-full animate-spin" />
          <span className="text-xs font-semibold">Loading Sales Trend...</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs h-72 flex items-center justify-center text-center">
        <div className="space-y-1">
          <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-[#172033]">No Sales Data For This Period</p>
          <p className="text-[11px] text-[#64748B]">Try selecting a different date range above.</p>
        </div>
      </div>
    );
  }

  const values = data.map((d) => (metric === "sales" ? d.netSales : d.ordersCount));
  const maxValue = Math.max(...values, metric === "sales" ? 10000 : 5);

  const chartHeight = 180;
  const chartWidth = 550;
  const barWidth = Math.max(12, Math.min(36, Math.floor((chartWidth - 40) / data.length) - 8));

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
      {/* Header & Metric Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-[#172033] uppercase tracking-wider">
              Sales & Order Velocity Trend
            </h3>
            <p className="text-[11px] text-[#64748B]">Daily transaction volume in Asia/Kolkata</p>
          </div>
        </div>

        {/* Metric Switch */}
        <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setMetric("sales")}
            className={`px-3 py-1 rounded-lg transition-all ${
              metric === "sales"
                ? "bg-white text-[#2563EB] shadow-xs"
                : "text-[#64748B] hover:text-[#172033]"
            }`}
          >
            Net Sales (₹)
          </button>
          <button
            type="button"
            onClick={() => setMetric("orders")}
            className={`px-3 py-1 rounded-lg transition-all ${
              metric === "orders"
                ? "bg-white text-[#2563EB] shadow-xs"
                : "text-[#64748B] hover:text-[#172033]"
            }`}
          >
            Orders Count
          </button>
        </div>
      </div>

      {/* SVG Bar Chart Visualization */}
      <div className="relative pt-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
          className="w-full h-56 overflow-visible"
        >
          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = chartHeight - pct * chartHeight + 10;
            return (
              <g key={pct}>
                <line
                  x1="30"
                  y1={y}
                  x2={chartWidth - 10}
                  y2={y}
                  stroke="#F1F5F9"
                  strokeDasharray="4 4"
                />
                <text
                  x="24"
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#94A3B8"
                  className="font-mono font-medium"
                >
                  {metric === "sales"
                    ? formatPaise(Math.round(maxValue * pct))
                    : Math.round(maxValue * pct)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((item, idx) => {
            const val = metric === "sales" ? item.netSales : item.ordersCount;
            const barH = maxValue > 0 ? (val / maxValue) * chartHeight : 0;
            const totalBarsWidth = data.length * (barWidth + 8);
            const startX = 40 + (chartWidth - 50 - totalBarsWidth) / 2;
            const x = startX + idx * (barWidth + 8);
            const y = chartHeight - barH + 10;
            const isHovered = hoveredIndex === idx;

            // Short date label: DD/MM
            const parts = item.date.split("-");
            const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date;

            return (
              <g
                key={item.date}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(4, barH)}
                  rx="4"
                  fill={isHovered ? "#1D4ED8" : metric === "sales" ? "#2563EB" : "#06B6D4"}
                  className="transition-all duration-150"
                />

                {/* X Axis Date Label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 26}
                  textAnchor="middle"
                  fontSize="9"
                  fill={isHovered ? "#172033" : "#64748B"}
                  fontWeight={isHovered ? "bold" : "normal"}
                  className="font-mono"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div className="absolute top-1 right-2 bg-slate-900 text-white px-3 py-1.5 rounded-xl shadow-lg text-[11px] pointer-events-none animate-in fade-in duration-100 font-mono">
            <span className="font-sans font-bold text-slate-300 block">
              {data[hoveredIndex].date}
            </span>
            <span className="text-white font-bold">
              Net Sales: {formatPaise(data[hoveredIndex].netSales)}
            </span>
            <span className="text-cyan-300 block">
              Orders: {data[hoveredIndex].ordersCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
