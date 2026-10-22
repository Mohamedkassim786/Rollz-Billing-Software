import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Tags,
  Layers,
  Sliders,
  Database,
  ArrowRight,
  Settings,
  UtensilsCrossed,
  CheckCircle2,
} from "lucide-react";
import { categoryApi } from "../api/categories.api";
import { menuItemApi } from "../api/menuItems.api";
import { modifierApi } from "../api/modifiers.api";
import { apiClient } from "../api/client";

export const DashboardPage: React.FC = () => {
  const [catCount, setCatCount] = useState<number>(0);
  const [itemCount, setItemCount] = useState<number>(0);
  const [groupCount, setGroupCount] = useState<number>(0);
  const [healthData, setHealthData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [cats, items, groups, health] = await Promise.all([
          categoryApi.list({ includeInactive: true }),
          menuItemApi.list({ includeInactive: true }),
          modifierApi.listGroups({ includeInactive: true }),
          apiClient.get("/health").then((r) => r.data).catch(() => null),
        ]);
        setCatCount(cats.length);
        setItemCount(items.length);
        setGroupCount(groups.length);
        setHealthData(health);
      } catch (err) {
        console.error("Failed to load dashboard metrics", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome & Overview Header Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-card relative overflow-hidden">
        {/* Subtle decorative accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50/50 via-cyan-50/30 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none"></div>

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-black text-[#172033] tracking-tight">
              ROLLZ Restaurant Management System
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
              Manage your restaurant's menu, food categories, customizations, and daily operations from one place.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/menu-items"
              className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-5 py-3 rounded-xl text-xs shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Manage Menu</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* STATISTIC CARDS */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">
          Overview Statistics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* 1. Menu Categories */}
          <Link
            to="/categories"
            className="bg-white border border-[#E2E8F0] hover:border-[#2563EB]/40 p-5 rounded-2xl space-y-3 transition-all shadow-card hover:shadow-md block group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">Menu Categories</span>
              <div className="p-2.5 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100 group-hover:scale-105 transition-transform">
                <Tags className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#172033]">
              {isLoading ? "—" : catCount}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span>Rolls, Burgers, Grill, Fries...</span>
              <span className="text-[#2563EB] font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                View &rarr;
              </span>
            </div>
          </Link>

          {/* 2. Menu Items */}
          <Link
            to="/menu-items"
            className="bg-white border border-[#E2E8F0] hover:border-[#2563EB]/40 p-5 rounded-2xl space-y-3 transition-all shadow-card hover:shadow-md block group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">Menu Items</span>
              <div className="p-2.5 rounded-xl bg-cyan-50 text-[#06B6D4] border border-cyan-100 group-hover:scale-105 transition-transform">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#172033]">
              {isLoading ? "—" : itemCount}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span>Dishes in active catalog</span>
              <span className="text-[#06B6D4] font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                View &rarr;
              </span>
            </div>
          </Link>

          {/* 3. Modifier Groups */}
          <Link
            to="/modifiers"
            className="bg-white border border-[#E2E8F0] hover:border-[#2563EB]/40 p-5 rounded-2xl space-y-3 transition-all shadow-card hover:shadow-md block group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">Modifier Groups</span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-[#D97706] border border-amber-100 group-hover:scale-105 transition-transform">
                <Sliders className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#172033]">
              {isLoading ? "—" : groupCount}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span>Spice, Sauces, Add-ons</span>
              <span className="text-[#D97706] font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                View &rarr;
              </span>
            </div>
          </Link>

          {/* 4. Local Database Status */}
          <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B]">Local Database Status</span>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-[#16A34A] border border-emerald-100">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#16A34A] flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <span>{healthData?.database?.connected ? "Online" : "Connecting"}</span>
            </div>
            <div className="text-[11px] text-[#64748B] flex items-center justify-between">
              <span className="font-mono">{healthData?.database?.version || "PostgreSQL 18.3"}</span>
              <span className="text-emerald-700 font-semibold font-mono">
                {healthData?.database?.latencyMs ? `${healthData.database.latencyMs}ms` : "Active"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">
          Quick Management Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Action 1: Manage Categories */}
          <Link
            to="/categories"
            className="bg-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-2xl p-6 space-y-3 shadow-card hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="p-3 w-fit rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100 group-hover:scale-105 transition-transform">
                <Tags className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172033] group-hover:text-[#2563EB] transition-colors">
                  Manage Categories
                </h3>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                  Configure food sections, adjust sequence, and set display order for fast POS browsing.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] pt-2">
              <span>Open Categories</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Action 2: Manage Menu Items */}
          <Link
            to="/menu-items"
            className="bg-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-2xl p-6 space-y-3 shadow-card hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="p-3 w-fit rounded-xl bg-cyan-50 text-[#06B6D4] border border-cyan-100 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172033] group-hover:text-[#2563EB] transition-colors">
                  Manage Menu Items
                </h3>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                  Add wraps, burgers, and fries with exact INR minor paise prices, images, and daily availability.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] pt-2">
              <span>Open Catalog</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Action 3: Manage Modifiers */}
          <Link
            to="/modifiers"
            className="bg-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-2xl p-6 space-y-3 shadow-card hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="p-3 w-fit rounded-xl bg-amber-50 text-[#D97706] border border-amber-100 group-hover:scale-105 transition-transform">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172033] group-hover:text-[#2563EB] transition-colors">
                  Manage Modifiers
                </h3>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                  Set single/multiple choices for spices, sauces, cheese upgrades, and assign them to dishes.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] pt-2">
              <span>Open Modifiers</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Action 4: Restaurant Settings */}
          <Link
            to="/settings"
            className="bg-white border border-[#E2E8F0] hover:border-[#2563EB] rounded-2xl p-6 space-y-3 shadow-card hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="p-3 w-fit rounded-xl bg-slate-100 text-slate-700 border border-slate-200 group-hover:scale-105 transition-transform">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#172033] group-hover:text-[#2563EB] transition-colors">
                  Restaurant Settings
                </h3>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                  Review branch profile, tax configurations, and system security credentials.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] pt-2">
              <span>Open Settings</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
