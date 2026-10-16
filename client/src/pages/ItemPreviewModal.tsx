import React, { useState } from "react";
import { X, Sparkles, UtensilsCrossed, Check } from "lucide-react";
import { MenuItem } from "../api/menuItems.api";
import { formatPaise } from "../utils/currency";
import { Badge } from "../components/Common/Badge";

interface ItemPreviewModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ItemPreviewModal: React.FC<ItemPreviewModalProps> = ({ item, isOpen, onClose }) => {
  if (!isOpen || !item) return null;

  // Local state to simulate selecting modifiers in POS preview
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [kitchenNote, setKitchenNote] = useState("");
  const [imageError, setImageError] = useState(false);

  const handleToggleOption = (
    groupId: string,
    optionId: string,
    selectionType: "SINGLE" | "MULTIPLE"
  ) => {
    setSelectedModifiers((prev) => {
      const current = prev[groupId] || [];
      if (selectionType === "SINGLE") {
        return { ...prev, [groupId]: [optionId] };
      } else {
        if (current.includes(optionId)) {
          return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
        } else {
          return { ...prev, [groupId]: [...current, optionId] };
        }
      }
    });
  };

  // Calculate live preview total
  let extraPaiseTotal = 0;
  if (item.modifierGroups) {
    for (const rel of item.modifierGroups) {
      const selectedIds = selectedModifiers[rel.modifierGroupId] || [];
      for (const opt of rel.modifierGroup.options) {
        if (selectedIds.includes(opt.id)) {
          extraPaiseTotal += opt.extraPrice;
        }
      }
    }
  }

  const livePreviewTotal = item.basePrice + extraPaiseTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 relative">
        {/* Banner */}
        <div className="bg-[#F8FAFC] px-6 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2563EB]" />
            <span className="text-xs font-bold text-[#172033] uppercase tracking-wider">
              POS Terminal Item Preview
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Header Card: Image & Item info */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
              {item.imagePath && !imageError ? (
                <img
                  src={item.imagePath}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <UtensilsCrossed className="w-8 h-8 text-slate-400" />
              )}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {item.category?.name || "Category"}
                </span>
                <Badge variant={item.isAvailable ? "success" : "warning"} size="sm">
                  {item.isAvailable ? "Available" : "Sold Out"}
                </Badge>
              </div>

              <h2 className="text-lg font-black text-[#172033] truncate">{item.name}</h2>
              {item.description && (
                <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              )}

              <div className="text-sm font-mono font-black text-[#2563EB] pt-0.5">
                Base Price: {formatPaise(item.basePrice)}
              </div>
            </div>
          </div>

          {/* Modifier Groups Customization */}
          {item.modifierGroups && item.modifierGroups.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#172033]">
                Customize Modifiers & Options
              </h3>

              <div className="space-y-4">
                {item.modifierGroups.map((rel) => {
                  const group = rel.modifierGroup;
                  const selectedIds = selectedModifiers[group.id] || [];

                  return (
                    <div
                      key={group.id}
                      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#172033]">{group.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({group.selectionType})
                            </span>
                          </div>
                          {group.description && (
                            <p className="text-[11px] text-[#64748B]">{group.description}</p>
                          )}
                        </div>

                        {group.isRequired && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            Required
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.options.map((option) => {
                          const isSelected = selectedIds.includes(option.id);

                          return (
                            <div
                              key={option.id}
                              onClick={() =>
                                handleToggleOption(group.id, option.id, group.selectionType)
                              }
                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-blue-50/80 border-[#2563EB] text-[#2563EB] font-bold shadow-xs"
                                  : "bg-white border-slate-200 text-[#172033] hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 rounded-${
                                    group.selectionType === "SINGLE" ? "full" : "md"
                                  } border flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? "bg-[#2563EB] border-[#2563EB] text-white"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                                <span>{option.name}</span>
                              </div>

                              <span className="font-mono text-[11px] text-[#16A34A] shrink-0 ml-2">
                                {option.extraPrice === 0
                                  ? "₹0"
                                  : `+${formatPaise(option.extraPrice)}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kitchen Note Simulation */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-[#172033]">
              Kitchen Special Instructions
            </label>
            <input
              type="text"
              value={kitchenNote}
              onChange={(e) => setKitchenNote(e.target.value)}
              placeholder="e.g. Extra crispy, sauce on the side, no onions"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>

        {/* Modal Footer: Live Total & Close */}
        <div className="bg-[#F8FAFC] px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B] block font-medium">Calculated Total:</span>
            <span className="text-xl font-black font-mono text-[#2563EB]">
              {formatPaise(livePreviewTotal)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
