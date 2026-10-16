import React, { useState, useEffect } from "react";
import { X, Layers, AlertCircle, Loader2 } from "lucide-react";
import { Ingredient } from "../../api/inventory.api";

interface IngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  ingredient?: Ingredient | null; // null for create
}

const COMMON_CATEGORIES = [
  "Meat & Poultry",
  "Dairy & Cheese",
  "Produce & Vegetables",
  "Bakery & Breads",
  "Sauces & Condiments",
  "Oils & Cooking",
  "Beverages",
  "Packaging & Disposables",
  "Spices & Seasonings",
  "General",
];

const COMMON_UNITS = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "L", label: "Liters (L)" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "piece", label: "Pieces (piece)" },
  { value: "packet", label: "Packets (packet)" },
  { value: "bottle", label: "Bottles (bottle)" },
  { value: "box", label: "Boxes (box)" },
  { value: "can", label: "Cans (can)" },
];

export const IngredientModal: React.FC<IngredientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  ingredient,
}) => {
  const isEditing = Boolean(ingredient);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("kg");
  const [initialStock, setInitialStock] = useState("");
  const [minThreshold, setMinThreshold] = useState("");
  const [costPerUnitRupees, setCostPerUnitRupees] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ingredient) {
      setName(ingredient.name);
      setSku(ingredient.sku);
      setCategory(ingredient.category || "General");
      setDescription(ingredient.description || "");
      setUnit(ingredient.unit || "kg");
      setMinThreshold(ingredient.minThreshold ? String(ingredient.minThreshold) : "");
      setCostPerUnitRupees(
        ingredient.costPerUnit ? (ingredient.costPerUnit / 100).toFixed(2) : ""
      );
    } else {
      setName("");
      setSku(`ING-${Date.now().toString().slice(-6)}`);
      setCategory("General");
      setDescription("");
      setUnit("kg");
      setInitialStock("");
      setMinThreshold("1.0");
      setCostPerUnitRupees("");
    }
    setError(null);
  }, [ingredient, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Ingredient name is required");
      return;
    }
    if (!sku.trim()) {
      setError("SKU is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const costPaise = costPerUnitRupees
        ? Math.round(parseFloat(costPerUnitRupees) * 100)
        : 0;

      if (isEditing) {
        await onSave({
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          category,
          description: description.trim() || undefined,
          unit,
          minThreshold: minThreshold ? parseFloat(minThreshold) : 0,
          costPerUnit: costPaise,
        });
      } else {
        await onSave({
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          category,
          description: description.trim() || undefined,
          unit,
          currentStock: initialStock ? parseFloat(initialStock) : 0,
          minThreshold: minThreshold ? parseFloat(minThreshold) : 0,
          costPerUnit: costPaise,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || "Failed to save ingredient");
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
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172033]">
                {isEditing ? "Edit Ingredient" : "Add New Ingredient"}
              </h2>
              <p className="text-xs text-[#64748B]">
                {isEditing
                  ? "Update ingredient metadata and threshold configuration"
                  : "Register a raw material or packaging item into stock"}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Ingredient Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chicken Breast, Mozzarella, Burger Bun"
                className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-[#172033]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Internal SKU / Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="ING-CHK-01"
                className="w-full px-3 py-2 text-xs uppercase font-mono border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-[#172033]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033] bg-white"
              >
                {COMMON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Unit of Measurement <span className="text-red-500">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033] bg-white"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Cost Per Unit (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-[#64748B]">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPerUnitRupees}
                  onChange={(e) => setCostPerUnitRupees(e.target.value)}
                  placeholder="240.00"
                  className="w-full pl-7 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!isEditing && (
              <div>
                <label className="block text-xs font-semibold text-[#172033] mb-1">
                  Initial Stock ({unit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  placeholder="10.0"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033]"
                />
              </div>
            )}

            <div className={isEditing ? "col-span-2" : ""}>
              <label className="block text-xs font-semibold text-[#172033] mb-1">
                Low Stock Threshold ({unit}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                placeholder="2.5"
                className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033]"
              />
              <span className="text-[10px] text-[#64748B] mt-0.5 block">
                Triggers LOW STOCK alert when stock drops below this value.
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172033] mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Storage location, preferred supplier brand, or prep guidelines..."
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
              className="px-5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditing ? "Save Changes" : "Create Ingredient"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
