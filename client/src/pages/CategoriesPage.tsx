import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Tag,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  X,
  UtensilsCrossed,
  Layers,
} from "lucide-react";
import { categoryApi, Category } from "../api/categories.api";
import { Badge } from "../components/Common/Badge";
import { ConfirmModal } from "../components/Common/ConfirmModal";

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryDisplayOrder, setCategoryDisplayOrder] = useState<number>(0);
  const [isCategoryActive, setIsCategoryActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await categoryApi.list({ includeInactive: true });
      setCategories(data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to load food categories");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryDisplayOrder(categories.length);
    setIsCategoryActive(true);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDescription(cat.description || "");
    setCategoryDisplayOrder(cat.displayOrder);
    setIsCategoryActive(cat.isActive);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      if (editingCategory) {
        await categoryApi.update(editingCategory.id, {
          name: categoryName.trim(),
          description: categoryDescription.trim() || null,
          displayOrder: categoryDisplayOrder,
          isActive: isCategoryActive,
        });
      } else {
        await categoryApi.create({
          name: categoryName.trim(),
          description: categoryDescription.trim() || undefined,
          displayOrder: categoryDisplayOrder,
          isActive: isCategoryActive,
        });
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to save category");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (cat: Category) => {
    try {
      await categoryApi.toggleStatus(cat.id, !cat.isActive);
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to update category status");
    }
  };

  const handleMoveOrder = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const reordered = [...categories];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const itemsToUpdate = reordered.map((cat, idx) => ({
      id: cat.id,
      displayOrder: idx,
    }));

    setCategories(reordered);

    try {
      await categoryApi.reorder(itemsToUpdate);
    } catch (err: any) {
      setError("Failed to persist category order");
      fetchCategories();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await categoryApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to delete category");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCategories = categories.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()));

    if (statusFilter === "ACTIVE") return matchesSearch && c.isActive;
    if (statusFilter === "INACTIVE") return matchesSearch && !c.isActive;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight flex items-center gap-2.5">
            <Tag className="w-5 h-5 text-[#2563EB]" />
            <span>Menu Categories</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Organize the food categories available in ROLLZ.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-[#E2E8F0] p-3.5 rounded-2xl shadow-card">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories (e.g. Rolls, Burgers, Grill)..."
            className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Status Filter Tabs & Refresh */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white text-[#172033] shadow-xs"
                  : "text-[#64748B] hover:text-[#172033]"
              }`}
            >
              All ({categories.length})
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === "ACTIVE"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-[#64748B] hover:text-[#172033]"
              }`}
            >
              Active ({categories.filter((c) => c.isActive).length})
            </button>
            <button
              onClick={() => setStatusFilter("INACTIVE")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === "INACTIVE"
                  ? "bg-white text-slate-700 shadow-xs"
                  : "text-[#64748B] hover:text-[#172033]"
              }`}
            >
              Inactive ({categories.filter((c) => !c.isActive).length})
            </button>
          </div>

          <button
            onClick={fetchCategories}
            title="Refresh from PostgreSQL"
            className="p-2 text-slate-500 hover:text-[#2563EB] hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Category Grid Section */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-14 bg-white border border-[#E2E8F0] rounded-2xl text-[#64748B] gap-3 shadow-card">
          <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
          <p className="text-xs font-semibold">Loading categories from PostgreSQL...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-14 bg-white border border-[#E2E8F0] rounded-2xl text-[#64748B] gap-3 text-center shadow-card">
          <FolderOpen className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-bold text-[#172033]">No categories found</p>
          <p className="text-xs text-[#64748B] max-w-sm">
            {search
              ? "No categories match your search filter."
              : "No categories currently exist. Add your first category using the button above."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredCategories.map((cat, index) => {
            const itemCount = cat.itemCount ?? 0;

            return (
              <div
                key={cat.id}
                className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-card hover:shadow-md hover:border-[#2563EB]/40 transition-all flex flex-col justify-between group relative"
              >
                <div>
                  {/* Card Header: Icon & Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shrink-0 group-hover:scale-105 transition-transform">
                      <UtensilsCrossed className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        onClick={() => handleToggleStatus(cat)}
                        title="Click to toggle active status"
                        className="cursor-pointer"
                      >
                        <Badge variant={cat.isActive ? "success" : "neutral"} size="sm">
                          {cat.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                      <span className="text-[10px] font-mono text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full">
                        Seq #{index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="mt-4 space-y-1">
                    <h3 className="text-base font-bold text-[#172033] group-hover:text-[#2563EB] transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed min-h-[32px]">
                      {cat.description || "No description provided."}
                    </p>
                  </div>
                </div>

                {/* Card Footer: Item Count, Reorder & Actions */}
                <div className="mt-5 pt-3.5 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#64748B]">
                    <Layers className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span className="font-semibold text-[#172033] font-mono">{itemCount}</span>
                    <span>{itemCount === 1 ? "item" : "items"}</span>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1">
                    {/* Reorder Up */}
                    <button
                      onClick={() => handleMoveOrder(index, "up")}
                      disabled={index === 0}
                      title="Move Up"
                      className="p-1.5 text-slate-400 hover:text-[#172033] hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    {/* Reorder Down */}
                    <button
                      onClick={() => handleMoveOrder(index, "down")}
                      disabled={index === categories.length - 1}
                      title="Move Down"
                      className="p-1.5 text-slate-400 hover:text-[#172033] hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => handleOpenEditModal(cat)}
                      title="Edit Category"
                      className="p-1.5 text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer ml-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => setDeleteTarget(cat)}
                      title="Delete Category"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#172033]">
                  {editingCategory ? "Edit Category" : "Add Food Category"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Category Name *</label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Rolls, Handcrafted Burgers, Loaded Fries"
                  className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172033]">Description</label>
                <textarea
                  rows={3}
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  placeholder="Short description for menus and POS displays"
                  className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172033]">Display Order</label>
                  <input
                    type="number"
                    min="0"
                    value={categoryDisplayOrder}
                    onChange={(e) => setCategoryDisplayOrder(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172033]">Status</label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryActive(!isCategoryActive)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isCategoryActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isCategoryActive ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    ></span>
                    <span>{isCategoryActive ? "Active" : "Inactive"}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? "Saving..." : editingCategory ? "Update Category" : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Food Category"
        message={`Are you sure you want to delete category "${deleteTarget?.name}"? Items linked to this category must be reassigned first.`}
        confirmLabel="Delete Category"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
