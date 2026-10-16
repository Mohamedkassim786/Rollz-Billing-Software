import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Download,
  RefreshCw,
  ShoppingBag,
  Percent,
  Receipt,
  Coins,
  CreditCard,
  Boxes,
  Lock,
  Layers,
  ArrowUpDown,
  UtensilsCrossed,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import {
  reportsApi,
  DashboardSummaryData,
  DetailedSalesReportData,
  TopSellingItemsData,
  CategoryPerformanceData,
  PaymentMethodReportData,
  DiscountsAndTaxesData,
  InventoryReportData,
  CashReportData,
  ReportDateParams,
} from "../api/reports.api";
import { formatPaise } from "../utils/currency";
import { DateRangeSelector, DateRangeSelectorValue } from "../components/Reports/DateRangeSelector";
import { SalesTrendChart } from "../components/Reports/SalesTrendChart";
import { PaymentDonutChart } from "../components/Reports/PaymentDonutChart";

export const ReportsPage: React.FC = () => {
  // Date Range filter
  const [dateFilter, setDateFilter] = useState<DateRangeSelectorValue>({ preset: "today" });

  // Tab State
  const [activeTab, setActiveTab] = useState<
    "SALES" | "ITEMS" | "CATEGORIES" | "PAYMENTS" | "TAXES" | "INVENTORY" | "CASH"
  >("SALES");

  // Data States
  const [dashboard, setDashboard] = useState<DashboardSummaryData | null>(null);
  const [salesReport, setSalesReport] = useState<DetailedSalesReportData | null>(null);
  const [topItems, setTopItems] = useState<TopSellingItemsData | null>(null);
  const [categories, setCategories] = useState<CategoryPerformanceData | null>(null);
  const [payments, setPayments] = useState<PaymentMethodReportData | null>(null);
  const [taxes, setTaxes] = useState<DiscountsAndTaxesData | null>(null);
  const [inventory, setInventory] = useState<InventoryReportData | null>(null);
  const [cash, setCash] = useState<CashReportData | null>(null);

  // Sorting for top items
  const [itemsSortBy, setItemsSortBy] = useState<"value" | "quantity">("value");

  // Loading States
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export dropdown state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const queryParams: ReportDateParams = {
    preset: dateFilter.preset,
    startDate: dateFilter.startDate,
    endDate: dateFilter.endDate,
  };

  // Fetch dashboard summary on filter change
  useEffect(() => {
    fetchDashboard();
  }, [dateFilter]);

  // Fetch active tab data
  useEffect(() => {
    fetchActiveTabData();
  }, [dateFilter, activeTab, itemsSortBy]);

  const fetchDashboard = async () => {
    setIsLoadingDashboard(true);
    setError(null);
    try {
      const data = await reportsApi.getDashboardSummary(queryParams);
      setDashboard(data);
    } catch (err: any) {
      console.error("Failed to load analytics dashboard", err);
      setError(err?.response?.data?.error?.message || "Failed to load reports data");
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  const fetchActiveTabData = async () => {
    setIsLoadingTab(true);
    try {
      if (activeTab === "SALES") {
        const data = await reportsApi.getDetailedSalesReport(queryParams);
        setSalesReport(data);
      } else if (activeTab === "ITEMS") {
        const data = await reportsApi.getTopSellingItems({ ...queryParams, sortBy: itemsSortBy });
        setTopItems(data);
      } else if (activeTab === "CATEGORIES") {
        const data = await reportsApi.getCategoryPerformance(queryParams);
        setCategories(data);
      } else if (activeTab === "PAYMENTS") {
        const data = await reportsApi.getPaymentMethodReport(queryParams);
        setPayments(data);
      } else if (activeTab === "TAXES") {
        const data = await reportsApi.getDiscountsAndTaxesReport(queryParams);
        setTaxes(data);
      } else if (activeTab === "INVENTORY") {
        const data = await reportsApi.getInventoryReport(queryParams);
        setInventory(data);
      } else if (activeTab === "CASH") {
        const data = await reportsApi.getCashReport(queryParams);
        setCash(data);
      }
    } catch (err: any) {
      console.error("Failed to load tab report", err);
    } finally {
      setIsLoadingTab(false);
    }
  };

  const handleExport = async (type: string) => {
    setIsExporting(true);
    setIsExportOpen(false);
    try {
      await reportsApi.downloadCSV(type, queryParams);
    } catch (err: any) {
      alert("Failed to export report CSV: " + (err?.response?.data?.error?.message || err?.message));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-xs">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#172033]">
              Sales Reports & Business Analytics
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Live executive KPIs, product popularity velocity, tender reconciliation, and inventory consumption
            </p>
          </div>
        </div>

        {/* Global Header Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              fetchDashboard();
              fetchActiveTabData();
            }}
            title="Refresh analytics data"
            className="p-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#172033] hover:bg-slate-100 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoadingDashboard || isLoadingTab ? "animate-spin text-[#2563EB]" : ""}`}
            />
          </button>

          {/* Export CSV Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              disabled={isExporting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#172033] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-slate-100 transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-[#2563EB]" />
              <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-[#E2E8F0] p-1.5 z-50 animate-in fade-in zoom-in-95 text-xs font-semibold text-[#172033]">
                <button
                  onClick={() => handleExport("sales")}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F8FAFC] hover:text-[#2563EB] transition-colors"
                >
                  Export Daily Sales
                </button>
                <button
                  onClick={() => handleExport("top-items")}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F8FAFC] hover:text-[#2563EB] transition-colors"
                >
                  Export Top-Selling Items
                </button>
                <button
                  onClick={() => handleExport("categories")}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F8FAFC] hover:text-[#2563EB] transition-colors"
                >
                  Export Category Performance
                </button>
                <button
                  onClick={() => handleExport("payments")}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F8FAFC] hover:text-[#2563EB] transition-colors"
                >
                  Export Payment Tenders
                </button>
                <button
                  onClick={() => handleExport("inventory")}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F8FAFC] hover:text-[#2563EB] transition-colors"
                >
                  Export Inventory Movements
                </button>
                <button
                  onClick={() => handleExport("shifts")}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F8FAFC] hover:text-[#2563EB] transition-colors"
                >
                  Export Cashier Shifts
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Date Range Selector Bar */}
      <DateRangeSelector
        value={dateFilter}
        onChange={(val) => setDateFilter(val)}
        isLoading={isLoadingDashboard}
      />

      {/* Primary KPI Overview Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Finalized Orders */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
            <div className="flex items-center justify-between text-[#64748B] mb-1">
              <span className="text-[11px] font-semibold">Orders Finalized</span>
              <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-xl font-extrabold font-mono text-[#172033]">
              {dashboard.overview.finalizedOrdersCount}
            </p>
            <span className="text-[10px] text-slate-400">Excludes drafts & unpaid</span>
          </div>

          {/* Gross Sales */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
            <div className="flex items-center justify-between text-[#64748B] mb-1">
              <span className="text-[11px] font-semibold">Gross Item Sales</span>
              <Receipt className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-base font-bold font-mono text-[#172033]">
              {formatPaise(dashboard.overview.grossSales)}
            </p>
            <span className="text-[10px] text-slate-400">Pre-discount subtotal</span>
          </div>

          {/* Discounts */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
            <div className="flex items-center justify-between text-amber-700 mb-1">
              <span className="text-[11px] font-semibold">Discounts Given</span>
              <Percent className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="text-base font-bold font-mono text-amber-700">
              -{formatPaise(dashboard.overview.discountsTotal)}
            </p>
            <span className="text-[10px] text-slate-400">Promotions & manual</span>
          </div>

          {/* Taxes Collected */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
            <div className="flex items-center justify-between text-[#64748B] mb-1">
              <span className="text-[11px] font-semibold">Taxes (5% GST)</span>
              <Coins className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-base font-bold font-mono text-[#172033]">
              {formatPaise(dashboard.overview.taxesTotal)}
            </p>
            <span className="text-[10px] text-slate-400">CGST + SGST liability</span>
          </div>

          {/* Net Finalized Sales (Hero KPI) */}
          <div className="bg-blue-50/70 p-4 rounded-xl border-2 border-[#2563EB] shadow-xs">
            <div className="flex items-center justify-between text-blue-900 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Net Finalized Sales
              </span>
              <TrendingUp className="w-4 h-4 text-[#2563EB]" />
            </div>
            <p className="text-xl font-extrabold font-mono text-[#2563EB]">
              {formatPaise(dashboard.overview.netSales)}
            </p>
            <span className="text-[10px] text-blue-700 font-medium">
              Gross - Disc + Tax
            </span>
          </div>

          {/* Average Order Value (AOV) */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
            <div className="flex items-center justify-between text-[#64748B] mb-1">
              <span className="text-[11px] font-semibold">Average Order Value</span>
              <UtensilsCrossed className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-base font-bold font-mono text-[#172033]">
              {formatPaise(dashboard.overview.averageOrderValue)}
            </p>
            <span className="text-[10px] text-slate-400">Net Sales / Order Count</span>
          </div>
        </div>
      )}

      {/* Visual Charts Row */}
      {dashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SalesTrendChart data={dashboard.salesTrend} isLoading={isLoadingDashboard} />
          </div>
          <div>
            <PaymentDonutChart payments={dashboard.paymentsBreakdown} />
          </div>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div className="border-b border-[#E2E8F0] flex items-center justify-between overflow-x-auto">
        <div className="flex items-center gap-1 sm:gap-2">
          {[
            { id: "SALES", label: "Sales Ledger", icon: Receipt },
            { id: "ITEMS", label: "Top-Selling Items", icon: UtensilsCrossed },
            { id: "CATEGORIES", label: "Categories", icon: Layers },
            { id: "PAYMENTS", label: "Payment Tenders", icon: CreditCard },
            { id: "TAXES", label: "Discounts & Taxes", icon: Percent },
            { id: "INVENTORY", label: "Inventory Consumption", icon: Boxes },
            { id: "CASH", label: "Cash & Shifts", icon: Lock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
                  isActive
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-[#64748B] hover:text-[#172033]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: SALES LEDGER */}
      {activeTab === "SALES" && salesReport && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                Periodic Sales Summary & Invoices
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Daily financial breakdown with gross sales, discounts, GST taxes, and net revenue
              </p>
            </div>
            <button
              onClick={() => handleExport("sales")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {salesReport.dailyBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] font-semibold">
                    <th className="py-3 px-4">Date (IST)</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-right">Gross Sales</th>
                    <th className="py-3 px-4 text-right">Discounts</th>
                    <th className="py-3 px-4 text-right">Taxes (GST)</th>
                    <th className="py-3 px-4 text-right">Net Sales</th>
                    <th className="py-3 px-4 text-right">AOV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {salesReport.dailyBreakdown.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#172033] whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                        {row.orderCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#172033]">
                        {formatPaise(row.grossSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-700">
                        {row.discounts > 0 ? `-${formatPaise(row.discounts)}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#64748B]">
                        {formatPaise(row.taxes)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-[#2563EB]">
                        {formatPaise(row.netSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatPaise(row.orderCount > 0 ? Math.round(row.netSales / row.orderCount) : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No finalized sales found for the selected period.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TOP-SELLING ITEMS */}
      {activeTab === "ITEMS" && topItems && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 px-6 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC]">
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                Product Sales Velocity & Popularity
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Ranked item quantities and revenue share from finalized order line snapshots
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] font-medium">Sort by:</span>
              <button
                type="button"
                onClick={() => setItemsSortBy(itemsSortBy === "value" ? "quantity" : "value")}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#172033] transition-colors flex items-center gap-1.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>{itemsSortBy === "value" ? "Sales Value (₹)" : "Quantity Sold"}</span>
              </button>
              <button
                onClick={() => handleExport("top-items")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {topItems.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] font-semibold">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Menu Item</th>
                    <th className="py-3 px-4 text-center">Quantity Sold</th>
                    <th className="py-3 px-4 text-right">Gross Sales</th>
                    <th className="py-3 px-4 text-right">Discounts</th>
                    <th className="py-3 px-4 text-right">Net Sales</th>
                    <th className="py-3 px-4 text-right">Sales Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {topItems.items.map((it, idx) => (
                    <tr key={it.name} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-[#172033]">{it.name}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                        {it.quantitySold}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#172033]">
                        {formatPaise(it.grossSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-700">
                        {it.discountsAllocated > 0 ? `-${formatPaise(it.discountsAllocated)}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#2563EB]">
                        {formatPaise(it.netSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB] text-[10px]">
                          {it.percentageOfSales}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No item sales recorded for the selected period.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CATEGORIES */}
      {activeTab === "CATEGORIES" && categories && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                Category Sales Contribution
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Distribution of orders and turnover across menu departments
              </p>
            </div>
            <button
              onClick={() => handleExport("categories")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {categories.categories.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] font-semibold">
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-4 text-center">Items Sold</th>
                    <th className="py-3 px-4 text-right">Sales Turnover</th>
                    <th className="py-3 px-4 w-48 text-right">Turnover Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {categories.categories.map((c) => (
                    <tr key={c.categoryName} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#172033]">{c.categoryName}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                        {c.quantitySold}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#2563EB]">
                        {formatPaise(c.salesValue)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${c.percentageOfSales}%` }}
                              className="bg-[#2563EB] h-full rounded-full"
                            />
                          </div>
                          <span className="font-mono font-bold text-[11px] text-[#172033] w-12 text-right">
                            {c.percentageOfSales}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              No category sales recorded for the selected period.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PAYMENTS */}
      {activeTab === "PAYMENTS" && payments && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                Confirmed Tender Reconciliation
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Authoritative transaction breakdown of cash, UPI QR, card terminal, and split orders
              </p>
            </div>
            <button
              onClick={() => handleExport("payments")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] font-semibold">
                  <th className="py-3 px-4">Tender Method</th>
                  <th className="py-3 px-4 text-center">Transactions</th>
                  <th className="py-3 px-4 text-right">Total Collected</th>
                  <th className="py-3 px-4 text-right">Tender Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {payments.methods.map((m) => (
                  <tr key={m.method} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-[#172033]">{m.label}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                      {m.count}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#2563EB]">
                      {formatPaise(m.amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10px]">
                        {m.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: TAXES */}
      {activeTab === "TAXES" && taxes && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                Discounts & GST Tax Compliance
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Taxable turnover, discounts given, and Central + State GST tax audit breakdown
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] text-[#64748B] block">Total Discounts</span>
                <span className="text-base font-bold font-mono text-amber-700 block mt-0.5">
                  {formatPaise(taxes.summary.discountsTotal)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {taxes.summary.discountedOrdersCount} discounted orders
                </span>
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] text-[#64748B] block">Taxable Sales</span>
                <span className="text-base font-bold font-mono text-[#172033] block mt-0.5">
                  {formatPaise(taxes.summary.taxableSales)}
                </span>
                <span className="text-[10px] text-slate-400">Gross minus discounts</span>
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] text-[#64748B] block">Total GST Taxes</span>
                <span className="text-base font-bold font-mono text-[#2563EB] block mt-0.5">
                  {formatPaise(taxes.summary.totalTaxesRecorded)}
                </span>
                <span className="text-[10px] text-slate-400">Total liability</span>
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] text-[#64748B] block">Avg Discount / Order</span>
                <span className="text-base font-bold font-mono text-slate-700 block mt-0.5">
                  {formatPaise(taxes.summary.averageDiscountPerDiscountedOrder)}
                </span>
                <span className="text-[10px] text-slate-400">On applied orders</span>
              </div>
            </div>

            {/* Tax Breakdown Table */}
            <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] font-semibold">
                    <th className="py-2.5 px-4">Tax Component</th>
                    <th className="py-2.5 px-4 text-center">Effective Rate</th>
                    <th className="py-2.5 px-4 text-right">Tax Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {taxes.taxBreakdown.map((t) => (
                    <tr key={t.taxName}>
                      <td className="py-2.5 px-4 font-bold text-[#172033]">{t.taxName}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-600">
                        {t.ratePercentage}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#2563EB]">
                        {formatPaise(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: INVENTORY */}
      {activeTab === "INVENTORY" && inventory && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden space-y-0">
          <div className="p-4 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                Inventory Consumption & Stock Movements
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Ingredient depletion from finalized POS sales, intakes, and wastage
              </p>
            </div>
            <button
              onClick={() => handleExport("inventory")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                <span className="text-[11px] text-blue-900 block font-medium">Order Consumptions</span>
                <span className="text-base font-bold font-mono text-[#2563EB] block mt-0.5">
                  {inventory.movementCounts.orderConsumption}
                </span>
                <span className="text-[10px] text-blue-700">Automated recipe deductions</span>
              </div>

              <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
                <span className="text-[11px] text-emerald-900 block font-medium">Purchase Intakes</span>
                <span className="text-base font-bold font-mono text-emerald-700 block mt-0.5">
                  {inventory.movementCounts.purchaseIntake}
                </span>
                <span className="text-[10px] text-emerald-700">Stock acquisitions</span>
              </div>

              <div className="bg-red-50/50 p-3.5 rounded-xl border border-red-100">
                <span className="text-[11px] text-red-900 block font-medium">Wastage Incidents</span>
                <span className="text-base font-bold font-mono text-red-700 block mt-0.5">
                  {inventory.movementCounts.wastage}
                </span>
                <span className="text-[10px] text-red-700">Spoilage & spills recorded</span>
              </div>

              <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
                <span className="text-[11px] text-amber-900 block font-medium">Low Stock Items</span>
                <span className="text-base font-bold font-mono text-amber-700 block mt-0.5">
                  {inventory.lowStockCount}
                </span>
                <span className="text-[10px] text-amber-700">Below minimum threshold</span>
              </div>
            </div>

            {/* Ingredient Usage Table */}
            {inventory.ingredientUsage.length > 0 && (
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] font-semibold">
                      <th className="py-2.5 px-4">Ingredient</th>
                      <th className="py-2.5 px-4 text-center">Unit</th>
                      <th className="py-2.5 px-4 text-right">Consumed in Orders</th>
                      <th className="py-2.5 px-4 text-right">Wastage</th>
                      <th className="py-2.5 px-4 text-right">Stock Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {inventory.ingredientUsage.map((u) => (
                      <tr key={u.ingredientName}>
                        <td className="py-2.5 px-4 font-bold text-[#172033]">{u.ingredientName}</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-500">{u.unit}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700">
                          {u.consumedQty}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-red-700">
                          {u.wastedQty > 0 ? u.wastedQty : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                          {u.intakeQty > 0 ? u.intakeQty : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: CASH */}
      {activeTab === "CASH" && cash && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 px-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <div>
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                Cash Management & Shift Audits
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Drawer float operations, petty expenses, and closing cash discrepancies
              </p>
            </div>
            <button
              onClick={() => handleExport("shifts")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2563EB] bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] text-[#64748B] block">Total Shifts</span>
                <span className="text-base font-bold font-mono text-[#172033] block mt-0.5">
                  {cash.shiftSummary.totalShifts}
                </span>
                <span className="text-[10px] text-slate-400">
                  {cash.shiftSummary.openedCount} Open, {cash.shiftSummary.closedCount} Closed
                </span>
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] text-[#64748B] block">Cash Float Added</span>
                <span className="text-base font-bold font-mono text-emerald-700 block mt-0.5">
                  +{formatPaise(cash.movementsSummary.totalCashAdded)}
                </span>
                <span className="text-[10px] text-slate-400">Drawer replenishments</span>
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] text-[#64748B] block">Cash Expenses Paid</span>
                <span className="text-base font-bold font-mono text-red-700 block mt-0.5">
                  -{formatPaise(cash.movementsSummary.totalCashExpenses)}
                </span>
                <span className="text-[10px] text-slate-400">Petty cash withdrawals</span>
              </div>

              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                <span className="text-[11px] text-[#64748B] block">Net Closing Discrepancy</span>
                <span
                  className={`text-base font-bold font-mono block mt-0.5 ${
                    cash.shiftSummary.totalNetClosingDifference === 0
                      ? "text-emerald-700"
                      : cash.shiftSummary.totalNetClosingDifference > 0
                      ? "text-amber-700"
                      : "text-red-700"
                  }`}
                >
                  {cash.shiftSummary.totalNetClosingDifference > 0 ? "+" : ""}
                  {formatPaise(cash.shiftSummary.totalNetClosingDifference)}
                </span>
                <span className="text-[10px] text-slate-400">Cumulative difference</span>
              </div>
            </div>

            {cash.shifts.length > 0 && (
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden mt-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] font-semibold">
                      <th className="py-2.5 px-4">Shift #</th>
                      <th className="py-2.5 px-4">Cashier</th>
                      <th className="py-2.5 px-4 text-right">Opening Float</th>
                      <th className="py-2.5 px-4 text-right">Expected Drawer</th>
                      <th className="py-2.5 px-4 text-right">Actual Count</th>
                      <th className="py-2.5 px-4 text-center">Difference</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {cash.shifts.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2.5 px-4 font-mono font-bold text-[#2563EB]">
                          {s.shiftNumber}
                        </td>
                        <td className="py-2.5 px-4 text-slate-800 font-medium">
                          {s.cashier?.displayName || "Cashier"}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[#172033]">
                          {formatPaise(s.openingCash)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#172033]">
                          {s.expectedCash !== null ? formatPaise(s.expectedCash) : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-[#172033]">
                          {s.actualCash !== null ? formatPaise(s.actualCash) : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {s.cashDifference !== null ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                s.cashDifference === 0
                                  ? "bg-emerald-100 text-emerald-800"
                                  : s.cashDifference > 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {s.cashDifference > 0 ? "+" : ""}
                              {formatPaise(s.cashDifference)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              s.status === "CLOSED"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
