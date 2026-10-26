import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  X,
  Sliders,
  FileText,
  Phone,
  User,
  MessageSquare,
  ArrowUpDown,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { posApi, POSCategory, POSMenuItem } from "../api/pos.api";
import { orderApi, OrderItemInput, CalculationResult, OrderRecord, SelectedModifierInput } from "../api/orders.api";
import { customersApi, CustomerRecord } from "../api/customers.api";
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

// Visual theme helper for food categories (emojis, gourmet gradients, accents)
const getCategoryVisual = (categoryName: string) => {
  const name = (categoryName || "").toLowerCase();
  if (name.includes("roll")) {
    return {
      emoji: "🌯",
      gradient: "from-amber-500 via-orange-500 to-amber-600",
      accent: "text-amber-600",
      bgLight: "bg-amber-50",
    };
  }
  if (name.includes("burger")) {
    return {
      emoji: "🍔",
      gradient: "from-orange-500 via-red-500 to-rose-600",
      accent: "text-orange-600",
      bgLight: "bg-orange-50",
    };
  }
  if (name.includes("fries") || name.includes("loaded")) {
    return {
      emoji: "🍟",
      gradient: "from-amber-400 via-yellow-500 to-orange-500",
      accent: "text-yellow-600",
      bgLight: "bg-yellow-50",
    };
  }
  if (name.includes("grill")) {
    return {
      emoji: "🔥",
      gradient: "from-red-600 via-rose-600 to-orange-600",
      accent: "text-red-600",
      bgLight: "bg-red-50",
    };
  }
  if (name.includes("kebab") || name.includes("tikka") || name.includes("seekh")) {
    return {
      emoji: "🍢",
      gradient: "from-rose-600 via-red-600 to-amber-700",
      accent: "text-rose-600",
      bgLight: "bg-rose-50",
    };
  }
  if (name.includes("beverage") || name.includes("drink") || name.includes("coffee") || name.includes("lemonade") || name.includes("tea") || name.includes("shake")) {
    return {
      emoji: "🥤",
      gradient: "from-cyan-500 via-blue-500 to-indigo-600",
      accent: "text-cyan-600",
      bgLight: "bg-cyan-50",
    };
  }
  if (name.includes("sandwich")) {
    return {
      emoji: "🥪",
      gradient: "from-amber-500 via-yellow-600 to-amber-700",
      accent: "text-amber-600",
      bgLight: "bg-amber-50",
    };
  }
  if (name.includes("starter") || name.includes("appetizer")) {
    return {
      emoji: "🥟",
      gradient: "from-emerald-500 via-teal-500 to-emerald-700",
      accent: "text-emerald-600",
      bgLight: "bg-emerald-50",
    };
  }
  if (name.includes("combo")) {
    return {
      emoji: "🍱",
      gradient: "from-purple-500 via-violet-600 to-indigo-600",
      accent: "text-purple-600",
      bgLight: "bg-purple-50",
    };
  }
  return {
    emoji: "🍽️",
    gradient: "from-blue-600 via-indigo-600 to-slate-800",
    accent: "text-blue-600",
    bgLight: "bg-blue-50",
  };
};

// Check if a dish is non-vegetarian based on keywords
const isNonVegDish = (item: POSMenuItem): boolean => {
  const text = `${item.name} ${item.category?.name || ""} ${item.description || ""}`.toLowerCase();
  const nonVegKeywords = [
    "chicken",
    "mutton",
    "seekh",
    "kebab",
    "fish",
    "prawn",
    "egg",
    "meat",
    "beef",
    "wings",
    "fajita",
    "zinger",
    "shawarma",
    "pepperoni",
  ];
  return nonVegKeywords.some((kw) => text.includes(kw));
};

export const POSTerminalPage: React.FC = () => {
  const { branch } = useAuth();
  const isNonGst = branch?.taxMode === "NON_GST" || localStorage.getItem("rollz_pos_tax_mode") === "NON_GST";
  // POS Data
  const [categories, setCategories] = useState<POSCategory[]>([]);
  const [menuItems, setMenuItems] = useState<POSMenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [posSortBy, setPosSortBy] = useState<"CODE" | "NAME">("CODE");
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<"TAKEAWAY" | "DINE_IN">("TAKEAWAY");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerRecord[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState<CustomerRecord | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [activeDraftOrderId, setActiveDraftOrderId] = useState<string | null>(null);

  // Customer phone lookup debounce
  useEffect(() => {
    const cleanDigits = customerPhone.replace(/\D/g, "");
    if (cleanDigits.length < 3) {
      setCustomerSuggestions([]);
      setShowCustomerDropdown(false);
      if (cleanDigits.length === 0) setMatchedCustomer(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const matches = await customersApi.searchCustomers(cleanDigits);
        setCustomerSuggestions(matches);
        setShowCustomerDropdown(matches.length > 0);

        const exact = matches.find((m) => m.phone === cleanDigits || m.phone.endsWith(cleanDigits));
        if (exact) {
          setMatchedCustomer(exact);
          if (!customerName) {
            setCustomerName(exact.name);
          }
        } else {
          setMatchedCustomer(null);
        }
      } catch {
        // Ignore search error
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [customerPhone]);

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

  // Filtered Menu Items (Default sorted by Code / ID, or Alphabetical A-Z)
  const filteredMenuItems = useMemo(() => {
    return menuItems
      .filter((item) => {
        const matchesCategory =
          selectedCategoryId === "ALL" || item.categoryId === selectedCategoryId;

        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.itemCode && item.itemCode.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q));

        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (posSortBy === "NAME") {
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        }
        // Default: Sort by Code / ID (#BGR-01, #BGR-02, etc.)
        const codeA = a.itemCode || a.id;
        const codeB = b.itemCode || b.id;
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
      });
  }, [menuItems, selectedCategoryId, searchQuery, posSortBy]);

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

  // Helper to get total quantity of an item currently in the cart
  const getCartQuantityForItem = (itemId: string): number => {
    return cart
      .filter((line) => line.item.id === itemId)
      .reduce((sum, line) => sum + line.quantity, 0);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#F5F7FB] overflow-hidden select-none">
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

      {/* POS Main Workspace (Full width, no cramped vertical aside) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* ========================================================= */}
        {/* CENTER/MAIN COLUMN: Food Catalog Grid with Horizontal Tabs */}
        {/* ========================================================= */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#F5F7FB] overflow-hidden border-r border-[#E2E8F0] min-h-0">
          {/* Top Search & Action Bar */}
          <div className="p-3 px-4 sm:px-6 bg-white border-b border-[#E2E8F0] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs shrink-0">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rolls, burgers, loaded fries, grill, drinks..."
                className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all font-medium"
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
                onClick={() => setPosSortBy((prev) => (prev === "CODE" ? "NAME" : "CODE"))}
                title={posSortBy === "CODE" ? "Currently sorted by Code / ID (#01-#99). Click for Alphabetical (A-Z)" : "Currently sorted Alphabetically (A-Z). Click for Code / ID (#01-#99)"}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#F8FAFC] hover:bg-slate-100 text-[#64748B] hover:text-[#172033] border border-[#E2E8F0] rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                <span>{posSortBy === "CODE" ? "Sort: Code" : "Sort: A-Z"}</span>
              </button>

              <button
                onClick={loadMenuData}
                title="Refresh menu catalog"
                className="p-2 text-slate-500 hover:text-[#2563EB] bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMenu ? "animate-spin" : ""}`} />
              </button>

              <button
                onClick={() => setIsHeldModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Held Orders</span>
              </button>
            </div>
          </div>

          {/* Horizontal Category Carousel Bar */}
          <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto shadow-xs shrink-0 select-none">
            {/* All Dishes Tab */}
            <button
              onClick={() => setSelectedCategoryId("ALL")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                selectedCategoryId === "ALL"
                  ? "bg-[#2563EB] text-white shadow-md ring-2 ring-blue-500/20 scale-[1.02]"
                  : "bg-[#F8FAFC] text-[#64748B] hover:text-[#172033] hover:bg-slate-100 border border-[#E2E8F0]"
              }`}
            >
              <span>🍽️</span>
              <span>All Dishes</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                  selectedCategoryId === "ALL" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {menuItems.length}
              </span>
            </button>

            {/* Dynamic Categories */}
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              const visual = getCategoryVisual(cat.name);

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#2563EB] text-white shadow-md ring-2 ring-blue-500/20 scale-[1.02]"
                      : "bg-white text-[#475569] hover:text-[#0F172A] hover:bg-slate-50 border border-[#E2E8F0]"
                  }`}
                >
                  <span>{visual.emoji}</span>
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {cat.availableItemCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Product Cards Grid Area */}
          <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto">
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
                <p className="text-xs font-semibold">Loading menu catalog...</p>
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
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
                {filteredMenuItems.map((item) => {
                  const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0;
                  const nonVeg = isNonVegDish(item);
                  const cartQty = getCartQuantityForItem(item.id);
                  const hasImage = Boolean(item.imagePath && !failedImages[item.id]);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className="bg-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-2xl p-3 shadow-card transition-all flex flex-col justify-between group cursor-pointer relative select-none"
                    >
                      <div>
                        {hasImage ? (
                          /* Real Uploaded Photo */
                          <div className="w-full h-32 sm:h-36 rounded-xl overflow-hidden relative mb-2.5 shadow-xs bg-slate-100">
                            <img
                              src={item.imagePath!}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
                            />

                            {/* FSSAI Veg / Non-Veg Indicator Badge */}
                            <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs px-1.5 py-1 rounded-md shadow-xs flex items-center gap-1 border border-black/5 z-10">
                              <div
                                className={`w-3 h-3 rounded-xs border-2 flex items-center justify-center ${
                                  nonVeg ? "border-red-600" : "border-emerald-600"
                                }`}
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    nonVeg ? "bg-red-600" : "bg-emerald-600"
                                  }`}
                                />
                              </div>
                              <span
                                className={`text-[9px] font-black uppercase tracking-wider ${
                                  nonVeg ? "text-red-700" : "text-emerald-700"
                                }`}
                              >
                                {nonVeg ? "Non-Veg" : "Veg"}
                              </span>
                            </div>

                            {/* Customisable indicator */}
                            {hasModifiers && (
                              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-[10px] font-black text-[#2563EB] shadow-xs flex items-center gap-1 border border-blue-200 z-10">
                                <Sliders className="w-2.5 h-2.5" />
                                <span>Customize</span>
                              </span>
                            )}

                            {/* In-cart count badge */}
                            {cartQty > 0 && (
                              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-[#2563EB] text-white text-[11px] font-black shadow-md flex items-center gap-1 z-10">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{cartQty} in cart</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Clean Dish Header without dummy photos/emojis */
                          <div className="flex items-center justify-between gap-1 mb-2.5">
                            {/* FSSAI Veg / Non-Veg Indicator Badge */}
                            <div className="bg-[#F8FAFC] px-2 py-1 rounded-md flex items-center gap-1.5 border border-slate-200">
                              <div
                                className={`w-3 h-3 rounded-xs border-2 flex items-center justify-center ${
                                  nonVeg ? "border-red-600" : "border-emerald-600"
                                }`}
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    nonVeg ? "bg-red-600" : "bg-emerald-600"
                                  }`}
                                />
                              </div>
                              <span
                                className={`text-[9px] font-black uppercase tracking-wider ${
                                  nonVeg ? "text-red-700" : "text-emerald-700"
                                }`}
                              >
                                {nonVeg ? "Non-Veg" : "Veg"}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {hasModifiers && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[10px] font-black text-[#2563EB] border border-blue-200 flex items-center gap-1">
                                  <Sliders className="w-2.5 h-2.5" />
                                  <span>Customize</span>
                                </span>
                              )}

                              {cartQty > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-[#2563EB] text-white text-[10px] font-black flex items-center gap-1 shadow-xs">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>{cartQty} in cart</span>
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Dish Title & Category Tag */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                            {item.category?.name}
                          </span>
                          <h3 className="text-xs sm:text-sm font-extrabold text-[#172033] leading-snug group-hover:text-[#2563EB] transition-colors line-clamp-2">
                            {item.name}
                          </h3>
                        </div>
                      </div>

                      {/* Price & Add Button */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Price</span>
                          <span className="font-mono font-black text-sm sm:text-base text-[#172033]">
                            {formatPaise(item.basePrice)}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="px-2.5 py-1.5 rounded-xl bg-blue-50 text-[#2563EB] hover:bg-[#2563EB] hover:text-white border border-blue-200 font-bold text-xs flex items-center gap-1 transition-all shadow-xs group-hover:bg-[#2563EB] group-hover:text-white cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Current Order Cart & Checkout Summary (~380px)*/}
        {/* ========================================================= */}
        <aside className="w-full lg:w-[380px] xl:w-[410px] h-full bg-white border-l border-[#E2E8F0] flex flex-col shrink-0 shadow-sm overflow-hidden min-h-0">
          {/* Order Type & Meta Header - PINNED TO TOP */}
          <div className="p-4 border-b border-[#E2E8F0] space-y-3 bg-[#F8FAFC] shrink-0 z-10">
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

            {/* Customer CRM & WhatsApp Integration */}
            <div className="space-y-2 pt-1">
              {/* Phone Input with Autocomplete */}
              <div className="relative">
                <div className="relative flex items-center">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    onFocus={() => {
                      if (customerSuggestions.length > 0) setShowCustomerDropdown(true);
                    }}
                    placeholder="Customer Mobile (WhatsApp Bill)"
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB]"
                  />
                  {customerPhone && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerPhone("");
                        setMatchedCustomer(null);
                        setShowCustomerDropdown(false);
                      }}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showCustomerDropdown && customerSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {customerSuggestions.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setCustomerPhone(cust.phone);
                          setCustomerName(cust.name);
                          setMatchedCustomer(cust);
                          setShowCustomerDropdown(false);
                        }}
                        className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{cust.name}</span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            +91 {cust.phone}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 block">
                            {cust.totalVisits} visits
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatPaise(cust.totalSpent)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Name Input */}
              <div className="relative flex items-center">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#172033] placeholder-slate-400 focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              {/* Returning Customer Loyalty Badge */}
              {matchedCustomer && (
                <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-[11px] text-amber-900">
                  <span className="font-semibold flex items-center gap-1">
                    <span>⭐</span>
                    <span>Visit #{matchedCustomer.totalVisits + 1}</span>
                  </span>
                  <span className="font-mono text-amber-800 text-[10px]">
                    Past Spend: {formatPaise(matchedCustomer.totalSpent)}
                  </span>
                </div>
              )}

              {/* WhatsApp Notification Indicator */}
              {customerPhone.replace(/\D/g, "").length >= 10 && (
                <div className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 text-[10px] text-emerald-800 font-medium">
                  <MessageSquare className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Free WhatsApp Bill & Welcome will be sent on payment</span>
                </div>
              )}
            </div>
          </div>

          {/* Cart Item List - ONLY THIS SECTION SCROLLS */}
          <div className="flex-1 min-h-0 p-3 space-y-2 overflow-y-auto overscroll-contain">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4 my-auto select-none">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-50 via-indigo-50 to-orange-50 border border-blue-100 flex items-center justify-center shadow-inner">
                  <span className="text-4xl">🌯</span>
                </div>
                <div className="space-y-1.5 max-w-xs">
                  <h3 className="text-base font-extrabold text-[#172033]">
                    Welcome to ROLLZ!
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    Select any freshly prepared roll, handcrafted burger, or chilled beverage from the catalog to build your order.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Fresh & Hot • Made to Order</span>
                </div>
              </div>
            ) : (
              cart.map((line) => {
                const hasModifiers = line.selectedModifiers.length > 0;
                const nonVeg = isNonVegDish(line.item);

                return (
                  <div
                    key={line.id}
                    className="p-3 bg-white border border-[#E2E8F0] rounded-2xl space-y-2 shadow-xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0 flex items-start gap-2">
                        {/* Veg / Non-Veg dot */}
                        <div
                          className={`w-3.5 h-3.5 rounded-xs border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                            nonVeg ? "border-red-600" : "border-emerald-600"
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              nonVeg ? "bg-red-600" : "bg-emerald-600"
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-[#172033] truncate">
                            {line.item.name}
                          </h4>
                          <span className="text-[11px] font-mono text-[#64748B]">
                            Base: {formatPaise(line.item.basePrice)}
                          </span>
                        </div>
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

          {/* Checkout & Bill Summary Calculations - PINNED TO BOTTOM */}
          <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-3 shrink-0 z-10">
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

              <div className="flex justify-between items-baseline text-base pt-2 border-t-2 border-slate-200">
                <span className="font-extrabold text-[#172033]">Payable Total:</span>
                <span className="font-mono text-2xl font-black text-[#2563EB]">
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
          taxTotalPaise={activeOrderRecord.taxTotal}
          taxRateBasisPoints={activeOrderRecord.taxRate}
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
