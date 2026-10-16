import React, { useState, useEffect } from "react";
import { X, ChefHat, Plus, Trash2, AlertCircle, Loader2 } from "lucide-react";
import {
  Ingredient,
  inventoryApi,
  MenuItemRecipeResponse,
  RecipeItem,
} from "../../api/inventory.api";

interface RecipeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItem: { id: string; name: string; basePrice: number; category?: any } | null;
  availableIngredients: Ingredient[];
  onRecipeSaved: () => void;
}

interface DraftRecipeItem {
  ingredientId: string;
  quantity: string;
  unit: string;
  notes?: string;
}

export const RecipeEditorModal: React.FC<RecipeEditorModalProps> = ({
  isOpen,
  onClose,
  menuItem,
  availableIngredients,
  onRecipeSaved,
}) => {
  const [items, setItems] = useState<DraftRecipeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && menuItem) {
      loadRecipe(menuItem.id);
    }
  }, [isOpen, menuItem]);

  const loadRecipe = async (menuItemId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const res: MenuItemRecipeResponse = await inventoryApi.getMenuItemRecipe(menuItemId);
      if (res.recipeItems && res.recipeItems.length > 0) {
        setItems(
          res.recipeItems.map((ri: RecipeItem) => ({
            ingredientId: ri.ingredientId,
            quantity: String(ri.recipeQuantity),
            unit: ri.recipeUnit,
            notes: ri.notes || "",
          }))
        );
      } else {
        setItems([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load recipe");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !menuItem) return null;

  const handleAddItem = () => {
    const firstIng = availableIngredients[0];
    setItems([
      ...items,
      {
        ingredientId: firstIng ? firstIng.id : "",
        quantity: "1",
        unit: firstIng ? firstIng.unit : "piece",
        notes: "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof DraftRecipeItem, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    // If ingredient changed, auto-update unit to ingredient unit
    if (field === "ingredientId") {
      const ing = availableIngredients.find((i) => i.id === value);
      if (ing) {
        updated[index].unit = ing.unit;
      }
    }
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate draft items
    const payload = [];
    for (const item of items) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        setError("All recipe ingredient quantities must be greater than zero");
        return;
      }
      if (!item.ingredientId) {
        setError("Please select an ingredient for all recipe rows");
        return;
      }
      payload.push({
        ingredientId: item.ingredientId,
        quantity: qty,
        unit: item.unit,
        notes: item.notes?.trim() || undefined,
      });
    }

    try {
      setIsSubmitting(true);
      await inventoryApi.saveMenuItemRecipe(menuItem.id, payload);
      onRecipeSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || "Failed to save recipe");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live estimated cost calculation
  const calculateEstimatedCost = () => {
    let totalCostPaise = 0;
    for (const item of items) {
      const ing = availableIngredients.find((i) => i.id === item.ingredientId);
      const qty = parseFloat(item.quantity);
      if (ing && !isNaN(qty) && qty > 0) {
        // Simple direct calculation if units match
        if (ing.unit.toLowerCase() === item.unit.toLowerCase()) {
          totalCostPaise += Math.round(qty * ing.costPerUnit);
        } else if (item.unit === "g" && ing.unit === "kg") {
          totalCostPaise += Math.round((qty / 1000) * ing.costPerUnit);
        } else if (item.unit === "ml" && ing.unit === "L") {
          totalCostPaise += Math.round((qty / 1000) * ing.costPerUnit);
        }
      }
    }
    return totalCostPaise;
  };

  const estimatedCost = calculateEstimatedCost();
  const sellingPrice = menuItem.basePrice;
  const foodCostPercentage =
    sellingPrice > 0 ? ((estimatedCost / sellingPrice) * 100).toFixed(1) : "0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172033]">
                Recipe Configuration: {menuItem.name}
              </h2>
              <p className="text-xs text-[#64748B]">
                Define ingredients deducted automatically when this item is ordered and finalized
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

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Pricing & Food Cost KPI strip */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-center">
            <div>
              <span className="text-[11px] text-[#64748B] block">Menu Selling Price</span>
              <span className="text-sm font-bold text-[#172033]">
                ₹{(sellingPrice / 100).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#64748B] block">Est. Ingredient Cost</span>
              <span className="text-sm font-bold text-[#2563EB]">
                ₹{(estimatedCost / 100).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#64748B] block">Food Cost Ratio</span>
              <span
                className={`text-sm font-bold ${
                  parseFloat(foodCostPercentage) > 40
                    ? "text-rose-600"
                    : "text-emerald-600"
                }`}
              >
                {foodCostPercentage}%
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-[#64748B] gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
              <span className="text-xs">Loading configured recipe...</span>
            </div>
          ) : (
            <form id="recipe-form" onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#172033]">
                  Required Ingredients ({items.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Ingredient</span>
                </button>
              </div>

              {items.length === 0 ? (
                <div className="py-10 border-2 border-dashed border-[#E2E8F0] rounded-xl text-center">
                  <ChefHat className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                  <p className="text-xs font-medium text-[#172033]">No ingredients assigned yet</p>
                  <p className="text-[11px] text-[#64748B] max-w-sm mx-auto mt-1">
                    Click "Add Ingredient" to configure chicken, sauces, wraps, or packaging items
                    consumed per portion.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-[#E2E8F0] rounded-lg shadow-sm flex items-center gap-2.5"
                    >
                      {/* Ingredient selector */}
                      <div className="flex-1">
                        <select
                          value={item.ingredientId}
                          onChange={(e) =>
                            handleUpdateItem(idx, "ingredientId", e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-[#E2E8F0] rounded-lg text-[#172033] bg-white font-medium"
                        >
                          {availableIngredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} ({ing.sku})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity input */}
                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(idx, "quantity", e.target.value)
                          }
                          placeholder="Qty"
                          className="w-full px-2.5 py-1.5 text-xs border border-[#E2E8F0] rounded-lg text-[#172033]"
                        />
                      </div>

                      {/* Unit selector */}
                      <div className="w-24">
                        <input
                          type="text"
                          required
                          value={item.unit}
                          onChange={(e) => handleUpdateItem(idx, "unit", e.target.value)}
                          placeholder="Unit"
                          className="w-full px-2.5 py-1.5 text-xs border border-[#E2E8F0] rounded-lg text-[#172033]"
                        />
                      </div>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-[#64748B] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remove ingredient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-end gap-2 bg-[#F8FAFC] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#172033] bg-white border border-[#E2E8F0] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="recipe-form"
            disabled={isSubmitting || isLoading}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Recipe Mapping</span>
          </button>
        </div>
      </div>
    </div>
  );
};
