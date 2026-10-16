import React, { useState, useEffect } from "react";
import { X, ArrowDownRight, AlertCircle, Loader2 } from "lucide-react";
import { Ingredient } from "../../api/inventory.api";

interface StockIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecord: (data: any) => Promise<void>;
  ingredients: Ingredient[];
  preselectedIngredient?: Ingredient | null;
}

export const StockIntakeModal: React.FC<StockIntakeModalProps> = ({
  isOpen,
  onClose,
  onRecord,
  ingredients,
  preselectedIngredient,
}) => {
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [purchaseCostRupees, setPurchaseCostRupees] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedIngredient) {
      setSelectedIngredientId(preselectedIngredient.id);
      setUnit(preselectedIngredient.unit);
    } else if (ingredients.length > 0 && !selectedIngredientId) {
      setSelectedIngredientId(ingredients[0].id);
      setUnit(ingredients[0].unit);
    }
    const today = new Date().toISOString().split("T")[0];
    setReceivedDate(today);
    setQuantity("");
    setPurchaseCostRupees("");
    setSupplierName("");
    setInvoiceRef("");
    setNotes("");
    setError(null);
  }, [isOpen, preselectedIngredient, ingredients]);

  const activeIngredient = ingredients.find((i) => i.id === selectedIngredientId);

  const handleIngredientChange = (id: string) => {
    setSelectedIngredientId(id);
    const ing = ingredients.find((i) => i.id === id);
    if (ing) {
      setUnit(ing.unit);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Quantity received must be greater than zero");
      return;
    }

    const costRupees = parseFloat(purchaseCostRupees);
    if (isNaN(costRupees) || costRupees < 0) {
      setError("Purchase cost must be a valid non-negative amount");
      return;
    }

    try {
      setIsSubmitting(true);
      const purchaseCostPaise = Math.round(costRupees * 100);

      await onRecord({
        ingredientId: selectedIngredientId,
        quantity: qty,
        unit: unit || activeIngredient?.unit || "kg",
        purchaseCost: purchaseCostPaise,
        supplierName: supplierName.trim() || undefined,
        invoiceRef: invoiceRef.trim() || undefined,
        receivedDate: receivedDate || undefined,
        notes: notes.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || "Failed to record stock intake");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172033]">Record Stock Intake</h2>
              <p className="text-xs text-[#64748B]">
                Receive ingredients purchased from suppliers and increase stock
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
              onChange={(e) => handleIngredientChange(e.target.value)}
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
                Quantity Received <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 5.0"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-l-lg focus:outline-none focus:border-[#2563EB] text-[#172033]"
                />
                <span className="bg-[#F5F7FB] border border-l-0 border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] rounded-r-lg">
                  {activeIngredient?.unit || unit || "unit"}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Total Purchase Cost (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-[#64748B]">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={purchaseCostRupees}
                  onChange={(e) => setPurchaseCostRupees(e.target.value)}
                  placeholder="1250.00"
                  className="w-full pl-7 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Supplier Name (Optional)
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Metro Cash & Carry, Local Mart"
                className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Supplier Invoice Ref (Optional)
              </label>
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="e.g. BILL-9824"
                className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1">
              Received Date
            </label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033] bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Batch number, expiry date, or quality inspection notes..."
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
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Stock Intake</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
