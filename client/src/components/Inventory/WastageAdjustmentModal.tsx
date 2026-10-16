import React, { useState, useEffect } from "react";
import { X, Trash2, SlidersHorizontal, AlertCircle, Loader2 } from "lucide-react";
import { Ingredient } from "../../api/inventory.api";

interface WastageAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordWastage: (data: any) => Promise<void>;
  onRecordAdjustment: (data: any) => Promise<void>;
  ingredients: Ingredient[];
  preselectedIngredient?: Ingredient | null;
  initialMode?: "WASTAGE" | "ADJUSTMENT";
}

const WASTAGE_REASONS = [
  { value: "SPOILED", label: "Spoiled / Overripe" },
  { value: "EXPIRED", label: "Expired Shelf Life" },
  { value: "DAMAGED", label: "Damaged Package / Dropped" },
  { value: "SPILLAGE", label: "Spillage during Prep" },
  { value: "BURNT", label: "Cooking / Kitchen Error" },
  { value: "OTHER", label: "Other Documented Reason" },
];

const ADJUSTMENT_REASONS = [
  { value: "PHYSICAL_COUNT", label: "Physical Stock-Take Audit" },
  { value: "CORRECTION", label: "Data Entry Error Correction" },
  { value: "SYSTEM_RECONCILIATION", label: "End of Week Reconciliation" },
  { value: "OTHER", label: "Other Authorized Adjustment" },
];

export const WastageAdjustmentModal: React.FC<WastageAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onRecordWastage,
  onRecordAdjustment,
  ingredients,
  preselectedIngredient,
  initialMode = "WASTAGE",
}) => {
  const [activeTab, setActiveTab] = useState<"WASTAGE" | "ADJUSTMENT">(initialMode);
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialMode);
    if (preselectedIngredient) {
      setSelectedIngredientId(preselectedIngredient.id);
    } else if (ingredients.length > 0 && !selectedIngredientId) {
      setSelectedIngredientId(ingredients[0].id);
    }
    setQuantity("");
    setReason(initialMode === "WASTAGE" ? "SPOILED" : "PHYSICAL_COUNT");
    setNotes("");
    setError(null);
  }, [isOpen, preselectedIngredient, ingredients, initialMode]);

  const activeIngredient = ingredients.find((i) => i.id === selectedIngredientId);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numVal = parseFloat(quantity);
    if (isNaN(numVal) || numVal < 0) {
      setError("Please specify a valid non-negative quantity");
      return;
    }

    if (activeTab === "WASTAGE" && numVal === 0) {
      setError("Wastage quantity must be greater than zero");
      return;
    }

    if (activeTab === "WASTAGE" && activeIngredient && numVal > activeIngredient.currentStock) {
      setError(
        `Wastage quantity (${numVal} ${activeIngredient.unit}) cannot exceed available stock (${activeIngredient.currentStock} ${activeIngredient.unit})`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      if (activeTab === "WASTAGE") {
        await onRecordWastage({
          ingredientId: selectedIngredientId,
          quantity: numVal,
          unit: activeIngredient?.unit || "kg",
          reason: reason || "SPOILED",
          notes: notes.trim() || undefined,
        });
      } else {
        await onRecordAdjustment({
          ingredientId: selectedIngredientId,
          newQuantity: numVal,
          unit: activeIngredient?.unit || "kg",
          reason: reason || "PHYSICAL_COUNT",
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "Failed to record inventory change"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewDelta = () => {
    if (!activeIngredient || !quantity) return null;
    const num = parseFloat(quantity);
    if (isNaN(num)) return null;

    if (activeTab === "WASTAGE") {
      const remaining = activeIngredient.currentStock - num;
      return {
        stockBefore: activeIngredient.currentStock,
        stockAfter: Math.max(0, remaining),
        delta: -num,
      };
    } else {
      const delta = num - activeIngredient.currentStock;
      return {
        stockBefore: activeIngredient.currentStock,
        stockAfter: num,
        delta,
      };
    }
  };

  const deltaInfo = previewDelta();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                activeTab === "WASTAGE"
                  ? "bg-rose-50 border border-rose-100 text-rose-600"
                  : "bg-amber-50 border border-amber-100 text-amber-600"
              }`}
            >
              {activeTab === "WASTAGE" ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <SlidersHorizontal className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172033]">
                {activeTab === "WASTAGE" ? "Record Stock Wastage" : "Adjust Stock Count"}
              </h2>
              <p className="text-xs text-[#64748B]">
                {activeTab === "WASTAGE"
                  ? "Document spoiled, expired, or discarded ingredients"
                  : "Update actual counted physical inventory during stock-taking"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#172033] p-1 rounded-lg hover:bg-[#F5F7FB] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 pt-3 flex border-b border-[#E2E8F0] gap-4 bg-[#F8FAFC]">
          <button
            type="button"
            onClick={() => {
              setActiveTab("WASTAGE");
              setReason("SPOILED");
              setError(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "WASTAGE"
                ? "border-rose-600 text-rose-600"
                : "border-transparent text-[#64748B] hover:text-[#172033]"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Wastage Logging</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("ADJUSTMENT");
              setReason("PHYSICAL_COUNT");
              setError(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "ADJUSTMENT"
                ? "border-amber-600 text-amber-600"
                : "border-transparent text-[#64748B] hover:text-[#172033]"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Stock-Take Adjustment</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1">
              Select Ingredient <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedIngredientId}
              onChange={(e) => setSelectedIngredientId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033] bg-white font-medium"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name} ({ing.sku}) — Available: {ing.currentStock} {ing.unit}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                {activeTab === "WASTAGE"
                  ? "Wasted Quantity"
                  : "New Actual Stock Count"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={activeTab === "WASTAGE" ? "e.g. 1.5" : "e.g. 12.0"}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-l-lg focus:outline-none focus:border-[#2563EB] text-[#172033]"
                />
                <span className="bg-[#F5F7FB] border border-l-0 border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] rounded-r-lg">
                  {activeIngredient?.unit || "unit"}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Reason / Category <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033] bg-white font-medium"
              >
                {(activeTab === "WASTAGE" ? WASTAGE_REASONS : ADJUSTMENT_REASONS).map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Real-time Delta Impact Preview Card */}
          {deltaInfo && activeIngredient && (
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex items-center justify-between text-xs">
              <span className="text-[#64748B]">Impact on Inventory:</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-[#64748B]">
                  {deltaInfo.stockBefore} {activeIngredient.unit}
                </span>
                <span>→</span>
                <span className="font-bold text-[#172033]">
                  {deltaInfo.stockAfter} {activeIngredient.unit}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    deltaInfo.delta < 0
                      ? "bg-rose-100 text-rose-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {deltaInfo.delta > 0 ? "+" : ""}
                  {deltaInfo.delta} {activeIngredient.unit}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1">
              Notes / Audit Justification
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide context for manager approval and audit logs..."
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033]"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#172033] bg-[#F5F7FB] hover:bg-[#E2E8F0] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 ${
                activeTab === "WASTAGE"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {activeTab === "WASTAGE" ? "Record Wastage" : "Apply Stock Count"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
