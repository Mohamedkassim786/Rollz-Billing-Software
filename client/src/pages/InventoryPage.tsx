import React, { useState, useEffect } from "react";
import {
  Boxes,
  Plus,
  Search,
  ArrowDownRight,
  Trash2,
  SlidersHorizontal,
  ChefHat,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  RefreshCw,
  Edit2,
  Power,
  TrendingDown,
  Coins,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  inventoryApi,
  Ingredient,
  InventoryDashboardSummary,
  StockMovement,
  StockIntakeRecord,
  StockStatus,
} from "../api/inventory.api";
import { menuItemApi, MenuItem } from "../api/menuItems.api";
import { useAuth } from "../context/AuthContext";
import { IngredientModal } from "../components/Inventory/IngredientModal";
import { StockIntakeModal } from "../components/Inventory/StockIntakeModal";
import { WastageAdjustmentModal } from "../components/Inventory/WastageAdjustmentModal";
import { RecipeEditorModal } from "../components/Inventory/RecipeEditorModal";

export const InventoryPage: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrOwner = user?.role === "OWNER" || user?.role === "MANAGER";

  // Active top tab
  const [activeTab, setActiveTab] = useState<
    "INGREDIENTS" | "RECIPES" | "MOVEMENTS" | "INTAKES"
  >("INGREDIENTS");

  // Summary & Data States
  const [summary, setSummary] = useState<InventoryDashboardSummary | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [intakes, setIntakes] = useState<StockIntakeRecord[]>([]);

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState<StockStatus | "ALL">("ALL");

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [preselectedIntakeIngredient, setPreselectedIntakeIngredient] =
    useState<Ingredient | null>(null);

  const [isWastageModalOpen, setIsWastageModalOpen] = useState(false);
  const [wastageInitialMode, setWastageInitialMode] = useState<
    "WASTAGE" | "ADJUSTMENT"
  >("WASTAGE");
  const [preselectedAdjustIngredient, setPreselectedAdjustIngredient] =
    useState<Ingredient | null>(null);

  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [selectedMenuItemForRecipe, setSelectedMenuItemForRecipe] =
    useState<MenuItem | null>(null);

  // Load all initial data
  const loadData = async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const [summaryRes, ingredientsRes, menuItemsRes] = await Promise.all([
        inventoryApi.getDashboard(),
        inventoryApi.getIngredients(),
        menuItemApi.list(),
      ]);

      setSummary(summaryRes);
      setIngredients(ingredientsRes);
      setMenuItems(menuItemsRes);

      if (activeTab === "MOVEMENTS") {
        const movRes = await inventoryApi.getMovements({ limit: 50 });
        setMovements(movRes.movements);
      } else if (activeTab === "INTAKES") {
        const intRes = await inventoryApi.getIntakes({ limit: 50 });
        setIntakes(intRes.intakes);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || "Failed to load inventory data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Derived filter categories from ingredients
  const categories = Array.from(new Set(ingredients.map((i) => i.category || "General")));

  // Filtered ingredients
  const filteredIngredients = ingredients.filter((ing) => {
    const matchesSearch =
      !searchTerm ||
      ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ing.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === "ALL" || ing.category === selectedCategory;

    const matchesStatus =
      selectedStatus === "ALL" || ing.stockStatus === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Action handlers
  const handleSaveIngredient = async (data: any) => {
    if (editingIngredient) {
      await inventoryApi.updateIngredient(editingIngredient.id, data);
    } else {
      await inventoryApi.createIngredient(data);
    }
    await loadData(true);
  };

  const handleToggleStatus = async (ing: Ingredient) => {
    if (!confirm(`Are you sure you want to ${ing.isActive ? "deactivate" : "activate"} "${ing.name}"?`)) {
      return;
    }
    try {
      await inventoryApi.toggleIngredientStatus(ing.id, !ing.isActive);
      await loadData(true);
    } catch (err: any) {
      alert(err.message || "Failed to update ingredient status");
    }
  };

  const handleRecordIntake = async (data: any) => {
    await inventoryApi.recordStockIntake(data);
    await loadData(true);
  };

  const handleRecordWastage = async (data: any) => {
    await inventoryApi.recordWastage(data);
    await loadData(true);
  };

  const handleRecordAdjustment = async (data: any) => {
    await inventoryApi.recordAdjustment(data);
    await loadData(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#172033]">Inventory & Stock Management</h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              Phase 6 Active
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Real-time stock ledger, recipes, supplier intake, wastage tracking, and automatic sale deduction
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="p-2 text-[#64748B] hover:text-[#172033] bg-white border border-[#E2E8F0] hover:bg-[#F5F7FB] rounded-lg transition-colors shadow-sm"
            title="Refresh inventory"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#2563EB]" : ""}`} />
          </button>

          {isManagerOrOwner && (
            <>
              <button
                onClick={() => {
                  setPreselectedIntakeIngredient(null);
                  setIsIntakeModalOpen(true);
                }}
                className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Stock Intake</span>
              </button>

              <button
                onClick={() => {
                  setPreselectedAdjustIngredient(null);
                  setWastageInitialMode("WASTAGE");
                  setIsWastageModalOpen(true);
                }}
                className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Log Wastage</span>
              </button>

              <button
                onClick={() => {
                  setEditingIngredient(null);
                  setIsIngredientModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Ingredient</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="py-12 bg-white rounded-xl border border-[#E2E8F0] flex flex-col items-center justify-center text-[#64748B] gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
          <span className="text-xs font-medium">Loading inventory records & metrics...</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Total Active Ingredients */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-[#64748B] block">Active Items</span>
            <span className="text-lg font-bold text-[#172033]">
              {summary ? summary.totalActiveIngredients : "-"}
            </span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-[#64748B] block">Low Stock</span>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-amber-600">
                {summary ? summary.lowStockCount : "-"}
              </span>
              {summary && summary.lowStockCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                  Alert
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Out of Stock */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-[#64748B] block">Out of Stock</span>
            <span className="text-lg font-bold text-rose-600">
              {summary ? summary.outOfStockCount : "-"}
            </span>
          </div>
        </div>

        {/* Total Wastage Recorded */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-[#64748B] block">Wastage Events</span>
            <span className="text-lg font-bold text-[#172033]">
              {summary ? summary.totalWastageCount : "-"}
            </span>
          </div>
        </div>

        {/* Total Inventory Valuation */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-[#64748B] block">Inventory Value</span>
            <span className="text-lg font-bold text-[#172033]">
              ₹{summary ? (summary.totalInventoryValuation / 100).toLocaleString("en-IN") : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-[#E2E8F0] flex items-center gap-6">
        <button
          onClick={() => setActiveTab("INGREDIENTS")}
          className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "INGREDIENTS"
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-[#64748B] hover:text-[#172033]"
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Ingredients Stock ({ingredients.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("RECIPES")}
          className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "RECIPES"
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-[#64748B] hover:text-[#172033]"
          }`}
        >
          <ChefHat className="w-4 h-4" />
          <span>Recipe Mappings ({menuItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("MOVEMENTS")}
          className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "MOVEMENTS"
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-[#64748B] hover:text-[#172033]"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Stock Movement Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab("INTAKES")}
          className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "INTAKES"
              ? "border-[#2563EB] text-[#2563EB]"
              : "border-transparent text-[#64748B] hover:text-[#172033]"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Supplier Purchase Logs</span>
        </button>
      </div>

      {/* TAB 1: INGREDIENTS STOCK TABLE */}
      {activeTab === "INGREDIENTS" && (
        <div className="space-y-4">
          {/* Filters strip */}
          <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search ingredient by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2563EB] text-[#172033]"
              />
            </div>

            {/* Category and Status Dropdowns */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg text-[#172033] bg-white font-medium"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Status filter buttons */}
              <div className="flex bg-[#F5F7FB] p-0.5 rounded-lg border border-[#E2E8F0]">
                <button
                  onClick={() => setSelectedStatus("ALL")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    selectedStatus === "ALL"
                      ? "bg-white text-[#172033] shadow-sm"
                      : "text-[#64748B] hover:text-[#172033]"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedStatus("IN_STOCK")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    selectedStatus === "IN_STOCK"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-[#64748B] hover:text-[#172033]"
                  }`}
                >
                  In Stock
                </button>
                <button
                  onClick={() => setSelectedStatus("LOW_STOCK")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    selectedStatus === "LOW_STOCK"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-[#64748B] hover:text-[#172033]"
                  }`}
                >
                  Low Stock
                </button>
                <button
                  onClick={() => setSelectedStatus("OUT_OF_STOCK")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    selectedStatus === "OUT_OF_STOCK"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-[#64748B] hover:text-[#172033]"
                  }`}
                >
                  Out
                </button>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                    <th className="py-3 px-4">Ingredient & SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-right">Threshold</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-center">Stock Status</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredIngredients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#64748B]">
                        <Boxes className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                        <p className="font-semibold text-[#172033]">No ingredients found</p>
                        <p className="text-[11px] mt-0.5">
                          {searchTerm || selectedCategory !== "ALL" || selectedStatus !== "ALL"
                            ? "Try adjusting your search filters"
                            : "Click 'New Ingredient' to begin tracking inventory"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredIngredients.map((ing) => (
                      <tr key={ing.id} className="hover:bg-[#F8FAFC] transition-colors">
                        {/* Name & SKU */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#172033] block">{ing.name}</span>
                          <span className="font-mono text-[11px] text-[#64748B]">{ing.sku}</span>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F1F5F9] text-[#475569]">
                            {ing.category || "General"}
                          </span>
                        </td>

                        {/* Current Stock */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#172033]">
                          {ing.currentStock}{" "}
                          <span className="text-[#64748B] font-normal text-[11px]">
                            {ing.unit}
                          </span>
                        </td>

                        {/* Threshold */}
                        <td className="py-3 px-4 text-right font-mono text-[#64748B]">
                          {ing.minThreshold}{" "}
                          <span className="text-[10px] text-[#94A3B8]">{ing.unit}</span>
                        </td>

                        {/* Unit Cost */}
                        <td className="py-3 px-4 text-right font-mono text-[#172033]">
                          ₹{(ing.costPerUnit / 100).toFixed(2)}
                          <span className="text-[#64748B] text-[10px]">/{ing.unit}</span>
                        </td>

                        {/* Stock Status Badge */}
                        <td className="py-3 px-4 text-center">
                          {ing.stockStatus === "IN_STOCK" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>IN STOCK</span>
                            </span>
                          )}
                          {ing.stockStatus === "LOW_STOCK" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              <span>LOW STOCK</span>
                            </span>
                          )}
                          {ing.stockStatus === "OUT_OF_STOCK" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" />
                              <span>OUT OF STOCK</span>
                            </span>
                          )}
                        </td>

                        {/* Active toggle */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              ing.isActive
                                ? "bg-blue-50 text-blue-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {ing.isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isManagerOrOwner && (
                              <>
                                <button
                                  onClick={() => {
                                    setPreselectedIntakeIngredient(ing);
                                    setIsIntakeModalOpen(true);
                                  }}
                                  className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Record stock intake"
                                >
                                  <ArrowDownRight className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setPreselectedAdjustIngredient(ing);
                                    setWastageInitialMode("ADJUSTMENT");
                                    setIsWastageModalOpen(true);
                                  }}
                                  className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="Adjust or log wastage"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setEditingIngredient(ing);
                                    setIsIngredientModalOpen(true);
                                  }}
                                  className="p-1.5 text-[#64748B] hover:text-[#172033] hover:bg-[#F5F7FB] rounded-lg transition-colors"
                                  title="Edit ingredient"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleToggleStatus(ing)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    ing.isActive
                                      ? "text-[#64748B] hover:text-rose-600 hover:bg-rose-50"
                                      : "text-emerald-600 hover:bg-emerald-50"
                                  }`}
                                  title={ing.isActive ? "Deactivate" : "Activate"}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECIPE MANAGEMENT */}
      {activeTab === "RECIPES" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#172033]">
                Menu Item Recipes & Food Cost Calculation
              </h2>
              <p className="text-xs text-[#64748B]">
                Configure the ingredient bills of materials for each menu item to automate deduction during sale finalization
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#172033] line-clamp-1">{item.name}</h3>
                    <span className="font-mono font-bold text-xs text-[#2563EB] shrink-0">
                      ₹{(item.basePrice / 100).toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#64748B] block mt-0.5">
                    Category: {item.category?.name || "General"}
                  </span>
                  <p className="text-xs text-[#64748B] mt-2 line-clamp-2">
                    {item.description || "No description provided."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-[11px] text-[#64748B] flex items-center gap-1">
                    <ChefHat className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Auto Stock Deduction</span>
                  </span>

                  {isManagerOrOwner && (
                    <button
                      onClick={() => {
                        setSelectedMenuItemForRecipe(item);
                        setIsRecipeModalOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Configure Recipe</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STOCK MOVEMENTS AUDIT LEDGER */}
      {activeTab === "MOVEMENTS" && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#2563EB]" />
              <h2 className="text-xs font-bold text-[#172033]">
                Immutable Stock Movement Audit Ledger
              </h2>
            </div>
            <span className="text-[11px] text-[#64748B]">Showing recent transaction events</span>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Ingredient</th>
                    <th className="py-3 px-4 text-center">Movement Type</th>
                    <th className="py-3 px-4 text-right">Quantity Changed</th>
                    <th className="py-3 px-4 text-right">Stock Impact</th>
                    <th className="py-3 px-4">Reference / Order</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#64748B]">
                        No stock movement records found
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 px-4 text-[#64748B] font-mono whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString("en-IN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#172033] block">{m.ingredient.name}</span>
                          <span className="font-mono text-[10px] text-[#64748B]">{m.ingredient.sku}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {m.type === "STOCK_IN" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              STOCK_IN
                            </span>
                          )}
                          {m.type === "SALE_DEDUCTION" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              SALE_DEDUCTION
                            </span>
                          )}
                          {m.type === "WASTAGE" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              WASTAGE
                            </span>
                          )}
                          {m.type === "STOCK_ADJUSTMENT" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              STOCK_ADJUSTMENT
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {m.type === "STOCK_IN" ? "+" : "-"}
                          {m.quantity} {m.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#64748B]">
                          {m.stockBefore} → <span className="font-bold text-[#172033]">{m.stockAfter}</span>
                        </td>
                        <td className="py-3 px-4">
                          {m.order ? (
                            <span className="font-mono text-[11px] font-semibold text-[#2563EB]">
                              Order #{m.order.orderNumber}
                            </span>
                          ) : m.invoice ? (
                            <span className="font-mono text-[11px] font-semibold text-[#2563EB]">
                              {m.invoice.invoiceNumber}
                            </span>
                          ) : (
                            <span className="text-[#64748B] text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#172033]">
                          {m.user?.displayName || "System"}
                        </td>
                        <td className="py-3 px-4 text-[#64748B] max-w-xs truncate">
                          {m.reason || m.notes || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SUPPLIER PURCHASE INTAKE LOGS */}
      {activeTab === "INTAKES" && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-[#172033]">
                Supplier Purchase & Intake History
              </h2>
            </div>
            <span className="text-[11px] text-[#64748B]">
              Historical records of ingredients received from vendors
            </span>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                    <th className="py-3 px-4">Received Date</th>
                    <th className="py-3 px-4">Ingredient</th>
                    <th className="py-3 px-4 text-right">Qty Received</th>
                    <th className="py-3 px-4 text-right">Purchase Cost (₹)</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Invoice / Ref</th>
                    <th className="py-3 px-4">Received By</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {intakes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#64748B]">
                        No purchase intake records recorded yet
                      </td>
                    </tr>
                  ) : (
                    intakes.map((itk) => (
                      <tr key={itk.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 px-4 font-mono text-[#64748B]">
                          {new Date(itk.receivedDate).toLocaleDateString("en-IN")}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#172033] block">{itk.ingredient.name}</span>
                          <span className="font-mono text-[10px] text-[#64748B]">{itk.ingredient.sku}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          +{itk.quantity} {itk.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#172033]">
                          ₹{(itk.purchaseCost / 100).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-[#172033]">
                          {itk.supplierName || "—"}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#64748B]">
                          {itk.invoiceRef || "—"}
                        </td>
                        <td className="py-3 px-4 text-[#172033]">
                          {itk.user.displayName}
                        </td>
                        <td className="py-3 px-4 text-[#64748B] max-w-xs truncate">
                          {itk.notes || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <IngredientModal
        isOpen={isIngredientModalOpen}
        onClose={() => setIsIngredientModalOpen(false)}
        onSave={handleSaveIngredient}
        ingredient={editingIngredient}
      />

      <StockIntakeModal
        isOpen={isIntakeModalOpen}
        onClose={() => setIsIntakeModalOpen(false)}
        onRecord={handleRecordIntake}
        ingredients={ingredients}
        preselectedIngredient={preselectedIntakeIngredient}
      />

      <WastageAdjustmentModal
        isOpen={isWastageModalOpen}
        onClose={() => setIsWastageModalOpen(false)}
        onRecordWastage={handleRecordWastage}
        onRecordAdjustment={handleRecordAdjustment}
        ingredients={ingredients}
        preselectedIngredient={preselectedAdjustIngredient}
        initialMode={wastageInitialMode}
      />

      <RecipeEditorModal
        isOpen={isRecipeModalOpen}
        onClose={() => setIsRecipeModalOpen(false)}
        menuItem={selectedMenuItemForRecipe}
        availableIngredients={ingredients}
        onRecipeSaved={() => loadData(true)}
      />
    </div>
  );
};
