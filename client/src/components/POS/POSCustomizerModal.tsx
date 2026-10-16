import React, { useState, useEffect } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { POSMenuItem, POSModifierGroup } from "../../api/pos.api";
import { SelectedModifierInput } from "../../api/orders.api";
import { formatPaise } from "../../utils/currency";
import { Badge } from "../Common/Badge";

interface POSCustomizerModalProps {
  item: POSMenuItem | null;
  initialModifiers?: SelectedModifierInput[];
  initialKitchenNotes?: string;
  initialQuantity?: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customized: {
    item: POSMenuItem;
    selectedModifiers: SelectedModifierInput[];
    kitchenNotes: string;
    quantity: number;
  }) => void;
}

export const POSCustomizerModal: React.FC<POSCustomizerModalProps> = ({
  item,
  initialModifiers = [],
  initialKitchenNotes = "",
  initialQuantity = 1,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [kitchenNotes, setKitchenNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize modal state on open or item change
  useEffect(() => {
    if (item && isOpen) {
      const initialMap: Record<string, string[]> = {};
      for (const sm of initialModifiers) {
        const current = initialMap[sm.modifierGroupId] || [];
        current.push(sm.optionId);
        initialMap[sm.modifierGroupId] = current;
      }
      setSelectedModifiers(initialMap);
      setKitchenNotes(initialKitchenNotes);
      setQuantity(initialQuantity > 0 ? initialQuantity : 1);
      setValidationError(null);
    }
  }, [item, isOpen, initialModifiers, initialKitchenNotes, initialQuantity]);

  if (!isOpen || !item) return null;

  const handleToggleOption = (
    group: POSModifierGroup,
    optionId: string
  ) => {
    setValidationError(null);
    setSelectedModifiers((prev) => {
      const current = prev[group.id] || [];

      if (group.selectionType === "SINGLE") {
        return { ...prev, [group.id]: [optionId] };
      } else {
        // MULTIPLE
        if (current.includes(optionId)) {
          return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
        } else {
          if (group.maxSelections > 0 && current.length >= group.maxSelections) {
            setValidationError(`Maximum ${group.maxSelections} choices allowed for "${group.name}"`);
            return prev;
          }
          return { ...prev, [group.id]: [...current, optionId] };
        }
      }
    });
  };

  // Calculate live item unit price
  let modifierExtraPriceSum = 0;
  for (const group of item.modifierGroups) {
    const selectedIds = selectedModifiers[group.id] || [];
    for (const opt of group.options) {
      if (selectedIds.includes(opt.id)) {
        modifierExtraPriceSum += opt.extraPrice;
      }
    }
  }

  const unitPrice = item.basePrice + modifierExtraPriceSum;
  const lineTotal = unitPrice * quantity;

  // Validate required rules before confirming
  const handleConfirm = () => {
    setValidationError(null);

    for (const group of item.modifierGroups) {
      const selectedIds = selectedModifiers[group.id] || [];

      if (group.isRequired && selectedIds.length === 0) {
        setValidationError(`Please select a choice for "${group.name}"`);
        return;
      }

      if (group.selectionType === "MULTIPLE" && group.minSelections > 0 && selectedIds.length < group.minSelections) {
        setValidationError(`Please select at least ${group.minSelections} choices for "${group.name}"`);
        return;
      }
    }

    const flatModifiers: SelectedModifierInput[] = [];
    for (const [groupId, optionIds] of Object.entries(selectedModifiers)) {
      for (const optionId of optionIds) {
        flatModifiers.push({ modifierGroupId: groupId, optionId });
      }
    }

    onConfirm({
      item,
      selectedModifiers: flatModifiers,
      kitchenNotes: kitchenNotes.trim(),
      quantity,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {item.category?.name}
              </span>
              <h2 className="text-base font-bold text-[#172033]">{item.name}</h2>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Base Price: <strong className="font-mono text-[#172033]">{formatPaise(item.basePrice)}</strong>
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Modifier Groups */}
          {item.modifierGroups.map((group) => {
            const selectedIds = selectedModifiers[group.id] || [];

            return (
              <div
                key={group.id}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-[#172033]">{group.name}</h3>
                      <Badge variant="neutral" size="sm">
                        {group.selectionType === "SINGLE" ? "Single Choice" : `Multiple (Max ${group.maxSelections})`}
                      </Badge>
                    </div>
                    {group.description && (
                      <p className="text-[11px] text-[#64748B] mt-0.5">{group.description}</p>
                    )}
                  </div>

                  {group.isRequired ? (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      Required
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Optional
                    </span>
                  )}
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.options.map((option) => {
                    const isSelected = selectedIds.includes(option.id);

                    return (
                      <div
                        key={option.id}
                        onClick={() => handleToggleOption(group, option.id)}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-50/80 border-[#2563EB] text-[#2563EB] font-bold shadow-xs"
                            : "bg-white border-slate-200 text-[#172033] hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
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
                          {option.extraPrice === 0 ? "Free" : `+${formatPaise(option.extraPrice)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Kitchen Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#172033]">
              Special Kitchen Instructions
            </label>
            <input
              type="text"
              value={kitchenNotes}
              onChange={(e) => setKitchenNotes(e.target.value)}
              placeholder="e.g. Extra spicy, sauce on side, no onions"
              className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center justify-between p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl">
            <span className="text-xs font-semibold text-[#172033]">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs"
              >
                -
              </button>
              <span className="font-mono font-bold text-sm text-[#172033] w-6 text-center">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#64748B] block">Item Total</span>
            <span className="text-xl font-black font-mono text-[#2563EB]">
              {formatPaise(lineTotal)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-6 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-all shadow-sm hover:shadow cursor-pointer"
            >
              Add to Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
