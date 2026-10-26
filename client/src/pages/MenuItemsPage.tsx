import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  Layers,
  Edit2,
  Trash2,
  Sliders,
  Eye,
  AlertCircle,
  RefreshCw,
  Upload,
  X,
  UtensilsCrossed,
  Image as ImageIcon,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { menuItemApi, MenuItem } from "../api/menuItems.api";
import { categoryApi, Category } from "../api/categories.api";
import { modifierApi, ModifierGroup } from "../api/modifiers.api";
import { Badge } from "../components/Common/Badge";
import { ConfirmModal } from "../components/Common/ConfirmModal";
import { ItemPreviewModal } from "./ItemPreviewModal";
import { formatPaise, paiseToRupees, rupeesToPaise } from "../utils/currency";

export type SortOption =
  | "CODE_ASC"
  | "CODE_DESC"
  | "NAME_ASC"
  | "NAME_DESC"
  | "PRICE_ASC"
  | "PRICE_DESC";

export const MenuItemsPage: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("CODE_ASC");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add / Edit Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priceRupees, setPriceRupees] = useState<number | string>("");
  const [description, setDescription] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [taxCategory, setTaxCategory] = useState("STANDARD");
  const [isAvailable, setIsAvailable] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Assign Modifiers Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetItem, setAssignTargetItem] = useState<MenuItem | null>(null);
  const [assignGroupIds, setAssignGroupIds] = useState<string[]>([]);
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  // Preview Modal
  const [previewItem, setPreviewItem] = useState<MenuItem | null>(null);

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemsData, catsData, groupsData] = await Promise.all([
        menuItemApi.list({ includeInactive: true }),
        categoryApi.list({ includeInactive: true }),
        modifierApi.listGroups({ includeInactive: false }),
      ]);
      setItems(itemsData);
      setCategories(catsData);
      setModifierGroups(groupsData);
      if (catsData.length > 0 && !categoryId) {
        setCategoryId(catsData[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to load menu items");
    } finally {
      setIsLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setName("");
    setCategoryId(categories.length > 0 ? categories[0].id : "");
    setPriceRupees("");
    setDescription("");
    setItemCode("");
    setTaxCategory("STANDARD");
    setIsAvailable(true);
    setIsActive(true);
    setSelectedGroupIds([]);
    setImageFile(null);
    setImagePreviewUrl(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategoryId(item.categoryId);
    setPriceRupees(paiseToRupees(item.basePrice));
    setDescription(item.description || "");
    setItemCode(item.itemCode || "");
    setTaxCategory(item.taxCategory);
    setIsAvailable(item.isAvailable);
    setIsActive(item.isActive);
    setSelectedGroupIds(item.modifierGroups ? item.modifierGroups.map((g) => g.modifierGroupId) : []);
    setImageFile(null);
    setImagePreviewUrl(item.imagePath || null);
    setError(null);
    setIsModalOpen(true);
  };

  const [pendingLargeFile, setPendingLargeFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Client-side auto-optimizer to convert large photos to crisp WebP under 1MB
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
                type: "image/webp",
                lastModified: Date.now(),
              });
              resolve(compressed);
            } else {
              resolve(file);
            }
          },
          "image/webp",
          0.85
        );
      };
      img.onerror = () => resolve(file);
    });
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check if file is larger than 2MB
      if (file.size > 2 * 1024 * 1024) {
        setPendingLargeFile(file);
      } else {
        setImageFile(file);
        setImagePreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleConfirmLargeFile = async (optimize: boolean) => {
    if (!pendingLargeFile) return;

    if (optimize) {
      setIsCompressing(true);
      try {
        const compressed = await compressImage(pendingLargeFile);
        setImageFile(compressed);
        setImagePreviewUrl(URL.createObjectURL(compressed));
      } catch {
        setImageFile(pendingLargeFile);
        setImagePreviewUrl(URL.createObjectURL(pendingLargeFile));
      } finally {
        setIsCompressing(false);
        setPendingLargeFile(null);
      }
    } else {
      // Upload full original file
      setImageFile(pendingLargeFile);
      setImagePreviewUrl(URL.createObjectURL(pendingLargeFile));
      setPendingLargeFile(null);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;

    const numPrice = typeof priceRupees === "string" ? parseFloat(priceRupees) : priceRupees;
    if (isNaN(numPrice) || numPrice < 0) {
      setError("Please specify a valid base price");
      return;
    }

    const basePricePaise = rupeesToPaise(numPrice);

    setIsSaving(true);
    setError(null);

    try {
      let savedItemId: string;

      if (editingItem) {
        await menuItemApi.update(editingItem.id, {
          categoryId,
          name: name.trim(),
          description: description.trim() || null,
          itemCode: itemCode.trim() || null,
          basePrice: basePricePaise,
          taxCategory,
          isAvailable,
          isActive,
        });
        savedItemId = editingItem.id;

        // Also update modifier assignments if editing
        await menuItemApi.assignModifiers(savedItemId, selectedGroupIds);
      } else {
        const created = await menuItemApi.create({
          categoryId,
          name: name.trim(),
          description: description.trim() || undefined,
          itemCode: itemCode.trim() || undefined,
          basePrice: basePricePaise,
          taxCategory,
          isAvailable,
          isActive,
          modifierGroupIds: selectedGroupIds,
        });
        savedItemId = created.menuItem.id;
      }

      // If a new image was chosen, upload it
      if (imageFile) {
        await menuItemApi.uploadImage(savedItemId, imageFile);
      } else if (editingItem && editingItem.imagePath && !imagePreviewUrl) {
        // Image was cleared
        await menuItemApi.deleteImage(savedItemId);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to save menu item");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await menuItemApi.toggleAvailability(item.id, !item.isAvailable);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to toggle item availability");
    }
  };

  const handleToggleActiveStatus = async (item: MenuItem) => {
    try {
      await menuItemApi.toggleStatus(item.id, !item.isActive);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to toggle item active status");
    }
  };

  const handleOpenAssignModal = (item: MenuItem) => {
    setAssignTargetItem(item);
    setAssignGroupIds(item.modifierGroups ? item.modifierGroups.map((g) => g.modifierGroupId) : []);
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignments = async () => {
    if (!assignTargetItem) return;
    setIsSavingAssign(true);
    try {
      await menuItemApi.assignModifiers(assignTargetItem.id, assignGroupIds);
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to update modifier assignments");
    } finally {
      setIsSavingAssign(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await menuItemApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to delete item");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const matchesSearch =
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          (item.itemCode && item.itemCode.toLowerCase().includes(search.toLowerCase())) ||
          (item.description && item.description.toLowerCase().includes(search.toLowerCase()));

        const matchesCategory =
          selectedCategoryFilter === "ALL" || item.categoryId === selectedCategoryFilter;

        const matchesAvailability =
          availabilityFilter === "ALL" ||
          (availabilityFilter === "AVAILABLE" && item.isAvailable) ||
          (availabilityFilter === "UNAVAILABLE" && !item.isAvailable);

        return matchesSearch && matchesCategory && matchesAvailability;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "CODE_ASC": {
            const codeA = a.itemCode || a.id;
            const codeB = b.itemCode || b.id;
            return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
          }
          case "CODE_DESC": {
            const codeA = a.itemCode || a.id;
            const codeB = b.itemCode || b.id;
            return codeB.localeCompare(codeA, undefined, { numeric: true, sensitivity: "base" });
          }
          case "NAME_ASC": // "in abcd order"
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          case "NAME_DESC":
            return b.name.localeCompare(a.name, undefined, { sensitivity: "base" });
          case "PRICE_ASC":
            return a.basePrice - b.basePrice;
          case "PRICE_DESC":
            return b.basePrice - a.basePrice;
          default:
            return 0;
        }
      });
  }, [items, search, selectedCategoryFilter, availabilityFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[#2563EB]" />
            <span>Menu Items</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            Manage food products, prices, and availability.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Food Item</span>
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

      {/* Toolbar: Search, Filters & Counters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white border border-[#E2E8F0] p-3.5 rounded-2xl shadow-card">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name, code, or description..."
            className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Category, Availability & Sort Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] font-medium focus:outline-none focus:border-[#2563EB] cursor-pointer"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Availability Filter */}
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] font-medium focus:outline-none focus:border-[#2563EB] cursor-pointer"
          >
            <option value="ALL">All Availability</option>
            <option value="AVAILABLE">Available Only</option>
            <option value="UNAVAILABLE">Unavailable Only</option>
          </select>

          {/* Sort Order Selector (ABCD / Code ID / Price) */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 py-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-[#172033] font-medium text-xs focus:outline-none cursor-pointer py-1"
            >
              <option value="CODE_ASC">Sort: Code / ID (#01 → #99)</option>
              <option value="NAME_ASC">Sort: Name (A → Z / ABCD)</option>
              <option value="NAME_DESC">Sort: Name (Z → A)</option>
              <option value="PRICE_ASC">Sort: Price (Low → High)</option>
              <option value="PRICE_DESC">Sort: Price (High → Low)</option>
              <option value="CODE_DESC">Sort: Code / ID (#99 → #01)</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            title="Refresh menu items"
            className="p-2 text-slate-500 hover:text-[#2563EB] hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Items Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-14 bg-white border border-[#E2E8F0] rounded-2xl text-[#64748B] gap-3 shadow-card">
          <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
          <p className="text-xs font-semibold">Loading food items from PostgreSQL...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-14 bg-white border border-[#E2E8F0] rounded-2xl text-[#64748B] gap-3 text-center shadow-card">
          <UtensilsCrossed className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-bold text-[#172033]">No menu items found</p>
          <p className="text-xs text-[#64748B] max-w-sm">
            {search || selectedCategoryFilter !== "ALL" || availabilityFilter !== "ALL"
              ? "No food items match the selected criteria."
              : "Get started by adding your first food item using the button above."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold uppercase tracking-wider text-[11px] select-none">
                <tr>
                  <th className="py-3.5 px-4 w-16">Image</th>
                  <th
                    onClick={() =>
                      setSortBy((prev) => (prev === "NAME_ASC" ? "NAME_DESC" : "NAME_ASC"))
                    }
                    className="py-3.5 px-4 cursor-pointer hover:text-[#2563EB] transition-colors"
                    title="Click to sort by Name (A-Z / ABCD)"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Item Name</span>
                      {sortBy === "NAME_ASC" ? (
                        <ArrowUp className="w-3 h-3 text-[#2563EB]" />
                      ) : sortBy === "NAME_DESC" ? (
                        <ArrowDown className="w-3 h-3 text-[#2563EB]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Category</th>
                  <th
                    onClick={() =>
                      setSortBy((prev) => (prev === "PRICE_ASC" ? "PRICE_DESC" : "PRICE_ASC"))
                    }
                    className="py-3.5 px-4 font-mono cursor-pointer hover:text-[#2563EB] transition-colors"
                    title="Click to sort by Price"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Price</span>
                      {sortBy === "PRICE_ASC" ? (
                        <ArrowUp className="w-3 h-3 text-[#2563EB]" />
                      ) : sortBy === "PRICE_DESC" ? (
                        <ArrowDown className="w-3 h-3 text-[#2563EB]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center">Availability</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Modifiers</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredItems.map((item) => {
                  const modifierGroupCount = item.modifierGroups?.length || 0;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#F8FAFC] transition-colors group"
                    >
                      {/* Image Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {item.imagePath && !failedImages[item.id] ? (
                            <img
                              src={item.imagePath}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Name & Code */}
                      <td className="py-3 px-4 font-semibold text-[#172033]">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#172033] group-hover:text-[#2563EB] transition-colors">
                            {item.name}
                          </span>
                          {item.itemCode && (
                            <span className="text-[10px] font-mono text-slate-400">
                              #{item.itemCode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {item.category?.name || "Uncategorized"}
                        </span>
                      </td>

                      {/* Price (paise to INR) */}
                      <td className="py-3 px-4 font-mono font-bold text-[#172033]">
                        {formatPaise(item.basePrice)}
                      </td>

                      {/* Availability Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          title="Click to toggle availability"
                          className="cursor-pointer inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                        >
                          <Badge variant={item.isAvailable ? "success" : "warning"} size="sm">
                            {item.isAvailable ? "Available" : "Unavailable"}
                          </Badge>
                        </button>
                      </td>

                      {/* Active / Inactive Status */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleActiveStatus(item)}
                          title="Click to toggle active state"
                          className="cursor-pointer inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                        >
                          <Badge variant={item.isActive ? "success" : "neutral"} size="sm">
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                      </td>

                      {/* Modifiers Pill */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleOpenAssignModal(item)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#2563EB] border border-slate-200 hover:border-blue-200 transition-all cursor-pointer"
                        >
                          <Sliders className="w-3 h-3 text-[#2563EB]" />
                          <span>
                            {modifierGroupCount === 0
                              ? "None"
                              : `${modifierGroupCount} ${
                                  modifierGroupCount === 1 ? "group" : "groups"
                                }`}
                          </span>
                        </button>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* POS Preview */}
                          <button
                            onClick={() => setPreviewItem(item)}
                            title="Interactive POS Preview"
                            className="p-1.5 text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            title="Edit Item"
                            className="p-1.5 text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(item)}
                            title="Delete Item"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table summary bar */}
          <div className="p-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
            <span>
              Showing <strong className="text-[#172033]">{filteredItems.length}</strong> of{" "}
              <strong className="text-[#172033]">{items.length}</strong> items
            </span>
            <span className="font-mono text-[11px]">Prices strictly calculated in INR paise</span>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal (Clean Two-Column Layout) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-5 px-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#172033]">
                  {editingItem ? "Edit Food Item" : "Add Food Item"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveItem} className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT SECTION: Basic info */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172033]">Item Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Chicken Shawarma Roll, Classic Burger"
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172033]">Category *</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#172033]">
                        Base Price (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={priceRupees}
                        onChange={(e) => setPriceRupees(e.target.value)}
                        placeholder="e.g. 150.00"
                        className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-mono font-bold text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#172033]">Item Code</label>
                      <input
                        type="text"
                        value={itemCode}
                        onChange={(e) => setItemCode(e.target.value)}
                        placeholder="e.g. ROL-01"
                        className="w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-mono text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172033]">Description</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ingredients, preparation details, allergens..."
                      className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                    />
                  </div>
                </div>

                {/* RIGHT SECTION: Image & Toggles */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172033]">Food Item Image</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center bg-[#F8FAFC] hover:bg-slate-50 transition-colors relative min-h-[140px]">
                      {imagePreviewUrl ? (
                        <div className="relative group w-full h-32 flex items-center justify-center">
                          <img
                            src={imagePreviewUrl}
                            alt="Preview"
                            className="max-h-full max-w-full rounded-xl object-contain shadow-xs"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors cursor-pointer"
                            title="Remove image"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2 p-2 w-full">
                          <Upload className="w-6 h-6 text-slate-400" />
                          <span className="text-xs font-semibold text-[#2563EB]">
                            Click to upload photo
                          </span>
                          <span className="text-[10px] text-slate-400">
                            PNG, JPG or WEBP (Max 2MB)
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Availability & Active Toggles */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#172033]">Availability</label>
                      <button
                        type="button"
                        onClick={() => setIsAvailable(!isAvailable)}
                        className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isAvailable
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isAvailable ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        ></span>
                        <span>{isAvailable ? "In Stock" : "Sold Out"}</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#172033]">Active State</label>
                      <button
                        type="button"
                        onClick={() => setIsActive(!isActive)}
                        className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isActive
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isActive ? "bg-blue-500" : "bg-slate-400"
                          }`}
                        ></span>
                        <span>{isActive ? "Active" : "Archived"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Modifier Groups Assignment in Add Form */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-semibold text-[#172033]">
                      Assigned Modifier Groups
                    </label>
                    <div className="max-h-28 overflow-y-auto bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2.5 space-y-1">
                      {modifierGroups.length === 0 ? (
                        <p className="text-[11px] text-slate-400">No modifier groups created yet.</p>
                      ) : (
                        modifierGroups.map((group) => {
                          const isChecked = selectedGroupIds.includes(group.id);
                          return (
                            <label
                              key={group.id}
                              className="flex items-center gap-2 text-xs text-[#172033] hover:bg-white p-1 rounded-lg cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGroupIds([...selectedGroupIds, group.id]);
                                  } else {
                                    setSelectedGroupIds(
                                      selectedGroupIds.filter((id) => id !== group.id)
                                    );
                                  }
                                }}
                                className="rounded text-[#2563EB] focus:ring-blue-100"
                              />
                              <span className="font-medium">{group.name}</span>
                              <span className="text-[10px] text-slate-400 ml-auto font-mono">
                                ({group.selectionType})
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
                  {isSaving ? "Saving..." : editingItem ? "Update Food Item" : "Save Food Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modifiers Modal */}
      {isAssignModalOpen && assignTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#172033]">Customize Modifiers</h3>
                  <p className="text-[11px] text-[#64748B]">{assignTargetItem.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {modifierGroups.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  No modifier groups exist. Create groups in the Modifiers page first.
                </p>
              ) : (
                modifierGroups.map((group) => {
                  const isChecked = assignGroupIds.includes(group.id);
                  return (
                    <div
                      key={group.id}
                      onClick={() => {
                        if (isChecked) {
                          setAssignGroupIds(assignGroupIds.filter((id) => id !== group.id));
                        } else {
                          setAssignGroupIds([...assignGroupIds, group.id]);
                        }
                      }}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                        isChecked
                          ? "bg-blue-50/70 border-blue-200 text-[#172033]"
                          : "bg-[#F8FAFC] border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold block">{group.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {group.selectionType} Choice • {group.options.length} options
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-[#2563EB] focus:ring-blue-100"
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                disabled={isSavingAssign}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAssignments}
                disabled={isSavingAssign}
                className="px-5 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSavingAssign ? "Saving..." : "Save Assignments"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Item Preview Modal */}
      <ItemPreviewModal
        item={previewItem}
        isOpen={!!previewItem}
        onClose={() => setPreviewItem(null)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Food Item"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete Item"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Large File Warning & Optimizer Modal (> 2MB) */}
      {pendingLargeFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Large Image Detected</h3>
                <p className="text-xs text-slate-500">File is larger than standard 2MB limit</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-900">
              <p>
                Selected file: <strong className="font-mono text-slate-800">{pendingLargeFile.name}</strong>
              </p>
              <p>
                Size: <strong className="text-amber-800">{(pendingLargeFile.size / (1024 * 1024)).toFixed(2)} MB</strong>
              </p>
              <p className="text-[11px] text-amber-700 pt-1">
                High-resolution images can slow down POS catalog loading. We recommend auto-optimizing to high-quality WebP.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isCompressing}
                onClick={() => handleConfirmLargeFile(true)}
                className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{isCompressing ? "Optimizing..." : "Auto-Optimize & Upload (< 1MB) - Recommended"}</span>
              </button>

              <button
                type="button"
                disabled={isCompressing}
                onClick={() => handleConfirmLargeFile(false)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Original Full File ({(pendingLargeFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
              </button>

              <button
                type="button"
                disabled={isCompressing}
                onClick={() => setPendingLargeFile(null)}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-center"
              >
                Cancel Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
