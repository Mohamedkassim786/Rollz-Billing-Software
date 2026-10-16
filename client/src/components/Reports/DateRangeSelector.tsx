import React, { useState } from "react";
import { Calendar, ChevronDown, Check } from "lucide-react";

export interface DateRangeSelectorValue {
  preset: string;
  startDate?: string;
  endDate?: string;
}

interface DateRangeSelectorProps {
  value: DateRangeSelectorValue;
  onChange: (val: DateRangeSelectorValue) => void;
  isLoading?: boolean;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  value,
  onChange,
  isLoading,
}) => {
  const [isCustomOpen, setIsCustomOpen] = useState(value.preset === "custom");
  const [customStart, setCustomStart] = useState(value.startDate || "");
  const [customEnd, setCustomEnd] = useState(value.endDate || "");

  const presets = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "last7days", label: "Last 7 Days" },
    { id: "last30days", label: "Last 30 Days" },
    { id: "thismonth", label: "This Month" },
    { id: "prevmonth", label: "Prev Month" },
  ];

  const handlePresetSelect = (presetId: string) => {
    setIsCustomOpen(false);
    onChange({ preset: presetId });
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      onChange({
        preset: "custom",
        startDate: customStart,
        endDate: customEnd,
      });
    }
  };

  return (
    <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-wrap items-center justify-between gap-3">
      {/* Preset Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1.5 text-slate-400 mr-1 text-xs">
          <Calendar className="w-4 h-4 text-[#2563EB]" />
          <span className="font-bold text-[#172033] hidden sm:inline">Period:</span>
        </div>

        {presets.map((p) => {
          const isActive = value.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={isLoading}
              onClick={() => handlePresetSelect(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-[#2563EB] text-white shadow-xs"
                  : "bg-[#F8FAFC] text-[#64748B] hover:text-[#172033] hover:bg-slate-100 border border-[#E2E8F0]"
              }`}
            >
              {p.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIsCustomOpen(!isCustomOpen)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
            value.preset === "custom" || isCustomOpen
              ? "bg-blue-50 text-[#2563EB] border-blue-200"
              : "bg-[#F8FAFC] text-[#64748B] hover:text-[#172033] hover:bg-slate-100 border-[#E2E8F0]"
          }`}
        >
          <span>Custom Range</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${isCustomOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Custom Date Form (Collapsible) */}
      {isCustomOpen && (
        <form
          onSubmit={handleApplyCustom}
          className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 w-full sm:w-auto border-t sm:border-t-0 border-slate-100"
        >
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#64748B] font-medium">From:</span>
            <input
              type="date"
              required
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#64748B] font-medium">To:</span>
            <input
              type="date"
              required
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#172033] bg-[#F8FAFC] focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>

          <button
            type="submit"
            className="px-3 py-1 bg-[#2563EB] text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply</span>
          </button>
        </form>
      )}
    </div>
  );
};
