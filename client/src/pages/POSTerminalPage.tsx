import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  UtensilsCrossed,
  ShoppingCart,
  Plus,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  X,
  CreditCard,
  Sliders,
  FileText,
} from "lucide-react";
import { posApi, POSCategory, POSMenuItem } from "../api/pos.api";
import { orderApi, OrderItemInput, CalculationResult, OrderRecord, SelectedModifierInput } from "../api/orders.api";
import { formatPaise } from "../utils/currency";
import { ConfirmModal } from "../components/Common/ConfirmModal";
import { POSCustomizerModal } from "../components/POS/POSCustomizerModal";
import { POSHeldOrdersModal } from "../components/POS/POSHeldOrdersModal";
import { POSPaymentModal } from "../components/POS/POSPaymentModal";
import { POSPaymentSuccessModal } from "../components/POS/POSPaymentSuccessModal";
import { PaymentResultResponse } from "../api/payments.api";
import { useAuth } from "../context/AuthContext";

interface CartLine {
  id: string; // Unique cart line ID
  item: POSMenuItem;
  selectedModifiers: SelectedModifierInput[];
  kitchenNotes: string;
  quantity: number;
}

export const POSTerminalPage: React.FC = () => {
  const { branch } = useAuth();
  const isNonGst = branch?.taxMode === "NON_GST";
  // POS Data
  const [categories, setCategories] = useState<POSCategory[]>([]);
  const [menuItems, setMenuItems] = useState<POSMenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<"TAKEAWAY" | "DINE_IN">("TAKEAWAY");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [activeDraftOrderId, setActiveDraftOrderId] = useState<string | null>(null);

  // Calculation State
  const [serverCalculation, setServerCalculation] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Modals State
  const [customizerItem, setCustomizerItem] = useState<POSMenuItem | null>(null);
  const [editingCartLine, setEditingCartLine] = useState<CartLine | null>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResultResponse | null>(null);
  const [activeOrderRecord, setActiveOrderRecord] = useState<OrderRecord | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // 1. Load Categories and Menu Items
  const loadMenuData = useCallback(async () => {
    setIsLoadingMenu(true);
    setMenuError(null);
    try {
      const [catsData, itemsData] = await Promise.all([
        posApi.getCategories(),
        posApi.getMenuItems(),
      ]);
      setCategories(catsData);
      setMenuItems(itemsData);
    } catch (err: any) {
      setMenuError(err.response?.data?.error?.message || "Failed to load restaurant POS catalog");
    } finally {
      setIsLoadingMenu(false);
    }
  }, []);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  // Toast Auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // 2. Server-Authoritative Price Recalculation on Cart Change
  useEffect(() => {
    if (cart.length === 0) {
      setServerCalculation(null);
      return;
    }

    let isSubscribed = true;
    const calculateTotals = async () => {
      setIsCalculating(true);
      try {
        const payloadItems: OrderItemInput[] = cart.map((c) => ({
          menuItemId: c.item.id,
          quantity: c.quantity,
          selectedModifiers: c.selectedModifiers,
          kitchenNotes: c.kitchenNotes || undefined,
        }));

        const calc = await orderApi.calculate({
          orderType,
          items: payloadItems,
          taxRateBasisPoints: isNonGst ? 0 : 500,
        });

        if (isSubscribed) {
          setServerCalculation(calc);
        }
      } catch (err: any) {
        console.error("Cart recalculation failed:", err);
      } finally {
        if (isSubscribed) {
          setIsCalculating(false);
        }
      }
    };

    const debounceTimer = setTimeout(calculateTotals, 100);
    return () => {
      isSubscribed = false;
      clearTimeout(debounceTimer);
    };
  }, [cart, orderType]);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategoryId === "ALL" || item.categoryId === selectedCategoryId;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.itemCode && item.itemCode.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategoryId, searchQuery]);

  // Handle Item Selection from Catalog Grid
  const handleSelectItem = (item: POSMenuItem) => {
    if (!item.isAvailable) {
      setToastMessage({ type: "error", text: `"${item.name}" is currently sold out.` });
      return;
    }

    // If item has modifier groups, open customizer modal
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setEditingCartLine(null);
      setCustomizerItem(item);
      setIsCustomizerOpen(true);
    } else {
      // Add directly to cart or increment if identical
      addItemDirectly(item);
    }
  };

  const addItemDirectly = (item: POSMenuItem) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (line) =>
          line.item.id === item.id &&
          line.selectedModifiers.length === 0 &&
          !line.kitchenNotes
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      } else {
        const newLine: CartLine = {
          id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          item,
          selectedModifiers: [],
          kitchenNotes: "",
          quantity: 1,
        };
        return [...prev, newLine];
      }
    });

    setToastMessage({ type: "success", text: `Added ${item.name} to cart.` });
  };

  // Handle Customizer Confirm (Add or Edit)
  const handleCustomizerConfirm = (customized: {
    item: POSMenuItem;
    selectedModifiers: SelectedModifierInput[];
    kitchenNotes: string;
    quantity: number;
  }) => {
    if (editingCartLine) {
      // Update existing line
      setCart((prev) =>
        prev.map((line) =>
          line.id === editingCartLine.id
            ? {
                ...line,
                selectedModifiers: customized.selectedModifiers,
                kitchenNotes: customized.kitchenNotes,
                quantity: customized.quantity,
              }
            : line
        )
      );
      setToastMessage({ type: "success", text: `Updated ${customized.item.name}.` });
    } else {
      // Add new cart line
      const newLine: CartLine = {
        id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        item: customized.item,
        selectedModifiers: customized.selectedModifiers,
        kitchenNotes: customized.kitchenNotes,
        quantity: customized.quantity,
      };
      setCart((prev) => [...prev, newLine]);
      setToastMessage({ type: "success", text: `Added ${customized.item.name} to cart.` });
    }

    setIsCustomizerOpen(false);
    setCustomizerItem(null);
    setEditingCartLine(null);
  };

  // Quantity Controls
  const handleUpdateQuantity = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.id === lineId) {
            const newQty = line.quantity + delta;
            return newQty > 0 ? { ...line, quantity: newQty } : null;
          }
          return line;
        })
        .filter(Boolean) as CartLine[]
    );
  };

  const handleRemoveLine = (lineId: string) => {
    setCart((prev) => prev.filter((line) => line.id !== lineId));
  };

  const handleEditLine = (line: CartLine) => {
    setEditingCartLine(line);
    setCustomizerItem(line.item);
    setIsCustomizerOpen(true);
  };

  const handleClearCart = () => {
    setCart([]);
    setActiveDraftOrderId(null);
    setCustomerName("");
    setCustomerPhone("");
    setTableNumber("");
    setOrderNotes("");
    setIsClearCartConfirmOpen(false);
  };

  // Save Order Draft to PostgreSQL
  const handleSaveDraft = async () => {
    if (cart.length === 0) return;
    setIsSavingDraft(true);
    try {
      const payload: any = {
        orderType,
        tableNumber: orderType === "DINE_IN" ? tableNumber || null : null,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        notes: orderNotes.trim() || null,
        items: cart.map((c) => ({
          menuItemId: c.item.id,
          quantity: c.quantity,
          selectedModifiers: c.selectedModifiers,
          kitchenNotes: c.kitchenNotes || undefined,
        })),
        taxRateBasisPoints: isNonGst ? 0 : 500,
      };

      let order: OrderRecord;
      if (activeDraftOrderId) {
        order = await orderApi.updateDraft(activeDraftOrderId, payload);
      } else {
        order = await orderApi.createDraft(payload);
        setActiveDraftOrderId(order.id);
      }

      setToastMessage({
        type: "success",
        text: `Order #${order.orderNumber} draft saved in PostgreSQL.`,
      });
      return order;
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err.response?.data?.error?.message || "Failed to save order draft",
      });
      return null;
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Hold Active Order
  const handleHoldOrder = async () => {
    if (cart.length === 0) return;
    setIsSavingDraft(true);
    try {
      // 1. Ensure draft exists
      const payload: any = {
        orderType,
        tableNumber: orderType === "DINE_IN" ? tableNumber || null : null,
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        notes: orderNotes.trim() || null,
        items: cart.map((c) => ({
          menuItemId: c.item.id,
          quantity: c.quantity,
          selectedModifiers: c.selectedModifiers,
          kitchenNotes: c.kitchenNotes || undefined,
        })),
        taxRateBasisPoints: isNonGst ? 0 : 500,
      };

      let orderId = activeDraftOrderId;
      if (!orderId) {
        const created = await orderApi.createDraft(payload);
        orderId = created.id;
      } else {
        await orderApi.updateDraft(orderId, payload);
      }

      // 2. Put order on hold
      await orderApi.holdOrder(orderId);

      setToastMessage({
        type: "success",
        text: `Order held successfully at counter.`,
      });

      // Clear terminal for next customer
      handleClearCart();
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: err.response?.data?.error?.message || "Failed to place order on hold",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Resume a held or draft order into POS cart
  const handleResumeOrder = (order: OrderRecord) => {
    setActiveDraftOrderId(order.id);
    setOrderType(order.orderType);
    setTableNumber(order.tableNumber || "");
    setCustomerName(order.customerName || "");
    setCustomerPhone(order.customerPhone || "");
    setOrderNotes(order.notes || "");

    // Reconstruct cart lines
    const reconstructed: CartLine[] = order.items.map((itemRecord) => {
      const foundMenuItem = menuItems.find((i) => i.id === itemRecord.menuItemId);
      const fallbackItem: POSMenuItem = foundMenuItem || {
        id: itemRecord.menuItemId || "archived",
        categoryId: "",
        category: { id: "", name: "Item", slug: "" },
        name: itemRecord.itemNameSnapshot,
        description: null,
        itemCode: null,
        imagePath: null,
        basePrice: itemRecord.basePriceSnapshot,
        taxCategory: "STANDARD",
        isAvailable: true,
        modifierGroups: [],
      };

      const selectedModifiers: SelectedModifierInput[] = [];
      if (itemRecord.modifierSnapshot && Array.isArray(itemRecord.modifierSnapshot)) {
        for (const mod of itemRecord.modifierSnapshot) {
          selectedModifiers.push({
            modifierGroupId: mod.modifierGroupId,
            optionId: mod.optionId,
          });
        }
      }

      return {
        id: `cart-resumed-${itemRecord.id}`,
        item: fallbackItem,
        selectedModifiers,
        kitchenNotes: itemRecord.kitchenNotes || "",
        quantity: itemRecord.quantity,
      };
    });

    setCart(reconstructed);
    setToastMessage({
      type: "success",
      text: `Resumed Order #${order.orderNumber} into cart.`,
    });
  };

  // Proceed to payment (Phase 4 checkout modal)
  const handleProceedToPayment = async () => {
    if (cart.length === 0) return;
    const saved = await handleSaveDraft();
    if (saved) {
      setActiveOrderRecord(saved);
      setIsPaymentModalOpen(true);
    }
  };

  // Helper to find modifier name from an option ID
  const getModifierOptionName = (item: POSMenuItem, optionId: string): string => {
    for (const group of item.modifierGroups) {
      const opt = group.options.find((o) => o.id === optionId);
      if (opt) return opt.name;
    }
    return "Custom Option";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] -m-4 sm:-m-6 md:-m-8 bg-[#F5F7FB] overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-fadeIn ${
            toastMessage.type === "success"
              ? "bg-[#172033] text-white border border-slate-700"
              : "bg-red-600 text-white"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* POS Three-Column Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Food Category Navigation (~180px)            */}
        {/* ========================================================= */}
        <aside className="w-full lg:w-48 bg-white border-r border-[#E2E8F0] flex flex-col shrink-0 overflow-y-auto shadow-xs">
          <div className="p-3 border-b border-[#E2E8F0] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Categories
            </span>
            <button
              onClick={loadMenuData}
              title="Refresh menu catalog"
              className="p-1 text-slate-400 hover:text-[#2563EB] rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMenu ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="p-2 space-y-1">
            {/* "All Items" tab */}
            <button
              onClick={() => setSelectedCategoryId("ALL")}
              className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                selectedCategoryId === "ALL"
                  ? "bg-[#EFF6FF] text-[#2563EB] font-bold shadow-xs border border-blue-200"
                  : "text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]"
              }`}
            >
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>All Items</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {menuItems.length}
              </span>
            </button>

            {/* Category tabs loaded from PostgreSQL */}
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#EFF6FF] text-[#2563EB] font-bold shadow-xs border border-blue-200"
                      : "text-[#64748B] hover:text-[#172033] hover:bg-[#F8FAFC]"
                  }`}
                >
                  <span className="truncate text-left">{cat.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0 ml-1">
                    {cat.availableItemCount}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ========================================================= */}
        {/* CENTER COLUMN: Food Items Catalog Grid (Flexible width)   */}
        {/* ========================================================= */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#F5F7FB] overflow-hidden">
          {/* Top Search & Filter Bar */}
          <div className="p-3.5 px-4 sm:px-6 bg-white border-b border-[#E2E8F0] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rolls, burgers, loaded fries, grill..."
                className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsHeldModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Held Orders</span>
              </button>
            </div>
          </div>

          {/* Product Cards Grid Area */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
            {menuError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{menuError}</span>
                </div>
                <button
                  onClick={loadMenuData}
                  className="px-2.5 py-1 bg-white hover:bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600 transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {isLoadingMenu ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#64748B] gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-[#2563EB]" />
                <p className="text-xs font-semibold">Loading menu catalog from PostgreSQL...</p>
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-[#64748B] space-y-2">
                <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-[#172033]">No dishes found</p>
                <p className="text-xs max-w-sm">
                  {searchQuery
                    ? `No items match "${searchQuery}".`
                    : "No available dishes found in this category."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                {filteredMenuItems.map((item) => {
                  const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className="bg-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-2xl p-3.5 shadow-card hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer relative select-none"
                    >
                      <div>
                        {/* Image / Placeholder */}
                        <div className="w-full h-28 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center relative mb-3 group-hover:scale-[1.02] transition-transform">
                          {item.imagePath && !failedImages[item.id] ? (
                            <img
                              src={item.imagePath}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
                            />
                          ) : (
                            <UtensilsCrossed className="w-8 h-8 text-slate-300" />
                          )}

                          {hasModifiers && (
                            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-[10px] font-bold text-[#2563EB] shadow-xs flex items-center gap-0.5">
                              <Sliders className="w-2.5 h-2.5" />
                              <span>Custom</span>
                            </span>
                          )}
                        </div>

                        {/* Title & Category */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                            {item.category?.name}
                          </span>
                          <h3 className="text-xs sm:text-sm font-bold text-[#172033] line-clamp-2 group-hover:text-[#2563EB] transition-colors">
                            {item.name}
                          </h3>
                        </div>
                      </div>

                      {/* Price & Add Indicator */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-[#172033]">
                          {formatPaise(item.basePrice)}
                        </span>

                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] border border-blue-200 flex items-center justify-center group-hover:bg-[#2563EB] group-hover:text-white transition-colors shadow-xs">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Current Order Cart & Checkout Summary (~360px)*/}
        {/* ========================================================= */}
        <aside className="w-full lg:w-96 bg-white border-l border-[#E2E8F0] flex flex-col shrink-0 shadow-sm overflow-hidden">
          {/* Order Type & Meta Header */}
          <div className="p-4 border-b border-[#E2E8F0] space-y-3 bg-[#F8FAFC]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-sm font-bold text-[#172033]">Current Order</h2>
              </div>

              {activeDraftOrderId && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                  Draft Active
                </span>
              )}

              {cart.length > 0 && (
                <button
                  onClick={() => setIsClearCartConfirmOpen(true)}
                  className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer"
                  title="Clear Cart"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Order Type Selector: Takeaway vs Dine-In */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrderType("TAKEAWAY")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  orderType === "TAKEAWAY"
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-white text-[#64748B] border-[#E2E8F0] hover:bg-slate-50"
                }`}
              >
                <span>Takeaway</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderType("DINE_IN")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  orderType === "DINE_IN"
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs"
                    : "bg-white text-[#64748B] border-[#E2E8F0] hover:bg-slate-50"
                }`}
              >
                <span>Dine-In</span>
              </button>
            </div>

            {/* Table Number if Dine-In */}
            {orderType === "DINE_IN" && (
              <div className="space-y-1">
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Table No. (e.g. T-04, Counter 2)"
                  className="w-full px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            )}

            {/* Optional Customer Name */}
            <div className="space-y-1">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name (optional)"
                className="w-full px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 p-3 space-y-2 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-[#172033]">Order cart is empty</p>
                <p className="text-[11px] max-w-xs mx-auto">
                  Select rolls, handcrafted burgers, or drinks from the catalog to begin billing.
                </p>
              </div>
            ) : (
              cart.map((line) => {
                const hasModifiers = line.selectedModifiers.length > 0;

                return (
                  <div
                    key={line.id}
                    className="p-3 bg-white border border-[#E2E8F0] rounded-2xl space-y-2 shadow-xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="text-xs font-bold text-[#172033] truncate">
                          {line.item.name}
                        </h4>
                        <span className="text-[11px] font-mono text-[#64748B]">
                          Base: {formatPaise(line.item.basePrice)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {hasModifiers && (
                          <button
                            onClick={() => handleEditLine(line)}
                            className="p-1 text-slate-400 hover:text-[#2563EB] rounded-lg transition-colors cursor-pointer"
                            title="Edit Customization"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveLine(line.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Remove Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Modifiers Snapshot Pills */}
                    {hasModifiers && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {line.selectedModifiers.map((mod) => (
                          <span
                            key={mod.optionId}
                            className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md font-medium"
                          >
                            {getModifierOptionName(line.item, mod.optionId)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Kitchen Note */}
                    {line.kitchenNotes && (
                      <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md italic">
                        Note: {line.kitchenNotes}
                      </p>
                    )}

                    {/* Quantity Stepper & Line Total */}
                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(line.id, -1)}
                          className="w-6 h-6 rounded-md bg-[#F8FAFC] border border-slate-300 text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer shadow-xs"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-xs text-[#172033] w-5 text-center">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(line.id, 1)}
                          className="w-6 h-6 rounded-md bg-[#F8FAFC] border border-slate-300 text-slate-700 hover:bg-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer shadow-xs"
                        >
                          +
                        </button>
                      </div>

                      {/* Server-verified or calculated line price */}
                      <span className="font-mono font-bold text-xs text-[#172033]">
                        {formatPaise(
                          (line.item.basePrice +
                            line.selectedModifiers.reduce((acc, m) => {
                              for (const g of line.item.modifierGroups) {
                                const o = g.options.find((opt) => opt.id === m.optionId);
                                if (o) return acc + o.extraPrice;
                              }
                              return acc;
                            }, 0)) *
                            line.quantity
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Checkout & Bill Summary Calculations */}
          <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#64748B]">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-[#172033]">
                  {formatPaise(serverCalculation?.subtotal || 0)}
                </span>
              </div>

              {serverCalculation && serverCalculation.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-mono font-semibold">
                    -{formatPaise(serverCalculation.discountTotal)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-[#64748B]">
                <span>Taxes {isNonGst ? "(Non-GST)" : "(5% GST)"}:</span>
                <span className="font-mono font-semibold text-[#172033]">
                  {formatPaise(serverCalculation?.taxTotal || 0)}
                </span>
              </div>

              <div className="flex justify-between text-base font-black text-[#172033] pt-1.5 border-t border-slate-200">
                <span>Payable Total:</span>
                <span className="font-mono text-[#2563EB]">
                  {formatPaise(serverCalculation?.grandTotal || 0)}
                </span>
              </div>
            </div>

            {/* Quick Actions (Draft / Hold) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={cart.length === 0 || isSavingDraft}
                className="py-2 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={handleHoldOrder}
                disabled={cart.length === 0 || isSavingDraft}
                className="py-2 px-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-bold text-amber-800 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Hold Order</span>
              </button>
            </div>

            {/* Primary Action Button: Proceed to Payment */}
            <button
              type="button"
              onClick={handleProceedToPayment}
              disabled={cart.length === 0 || isCalculating}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-3 px-4 rounded-xl text-xs shadow-sm hover:shadow transition-all active:scale-[0.99] disabled:opacity-40 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Proceed to Payment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>

      {/* POS Customizer Modal */}
      <POSCustomizerModal
        item={customizerItem}
        initialModifiers={editingCartLine?.selectedModifiers}
        initialKitchenNotes={editingCartLine?.kitchenNotes}
        initialQuantity={editingCartLine?.quantity}
        isOpen={isCustomizerOpen}
        onClose={() => {
          setIsCustomizerOpen(false);
          setCustomizerItem(null);
          setEditingCartLine(null);
        }}
        onConfirm={handleCustomizerConfirm}
      />

      {/* Held & Draft Orders Modal */}
      <POSHeldOrdersModal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
        onResumeOrder={handleResumeOrder}
      />

      {/* Clear Cart Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearCartConfirmOpen}
        title="Clear Current Cart"
        message="Are you sure you want to discard all items currently in this order cart?"
        confirmLabel="Clear Cart"
        variant="danger"
        onConfirm={handleClearCart}
        onCancel={() => setIsClearCartConfirmOpen(false)}
      />

      {/* Phase 4 Payment Modal */}
      {isPaymentModalOpen && activeOrderRecord && (
        <POSPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          orderId={activeOrderRecord.id}
          orderNumber={activeOrderRecord.orderNumber}
          orderType={activeOrderRecord.orderType}
          grandTotalPaise={activeOrderRecord.grandTotal}
          itemCount={cart.reduce((a, b) => a + b.quantity, 0)}
          onPaymentSuccess={(result) => {
            setIsPaymentModalOpen(false);
            setPaymentResult(result);
          }}
        />
      )}

      {/* Phase 4 Payment Success & Thermal Printing Modal */}
      {paymentResult && (
        <POSPaymentSuccessModal
          isOpen={!!paymentResult}
          onClose={() => setPaymentResult(null)}
          result={paymentResult}
          onStartNewOrder={() => {
            setPaymentResult(null);
            handleClearCart();
          }}
        />
      )}
    </div>
  );
};
