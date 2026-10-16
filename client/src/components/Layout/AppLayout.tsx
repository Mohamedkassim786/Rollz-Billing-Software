import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Tags,
  Layers,
  Sliders,
  Receipt,
  Boxes,
  Banknote,
  BarChart3,
  Settings,
  LogOut,
  User as UserIcon,
  Clock,
  Menu,
  X,
  Database,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, branch, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; latencyMs?: number }>({
    connected: true,
  });
  const [currentTime, setCurrentTime] = useState("");

  // Live Asia/Kolkata Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Real Database Health Check
  useEffect(() => {
    let isMounted = true;
    const checkDbHealth = async () => {
      try {
        const start = Date.now();
        const res = await apiClient.get("/health");
        const latency = Date.now() - start;
        if (isMounted) {
          setDbStatus({
            connected: res.data?.database?.connected ?? true,
            latencyMs: res.data?.database?.latencyMs ?? latency,
          });
        }
      } catch {
        if (isMounted) {
          setDbStatus({ connected: false });
        }
      }
    };
    checkDbHealth();
    const interval = setInterval(checkDbHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard },
    { label: "POS Terminal", path: "/pos", icon: UtensilsCrossed, badge: "Active" },
    { label: "Menu Categories", path: "/categories", icon: Tags },
    { label: "Menu Items", path: "/menu-items", icon: Layers },
    { label: "Modifiers & Add-ons", path: "/modifiers", icon: Sliders },
    { label: "Orders & Receipts", path: "/orders", icon: Receipt, badge: "Active" },
    { label: "Inventory", path: "/inventory", icon: Boxes, badge: "Active" },
    { label: "Cash Management", path: "/cash-management", icon: Banknote, badge: "Active" },
    { label: "Reports & Sales", path: "/reports", icon: BarChart3, badge: "Active" },
    { label: "Restaurant Settings", path: "/settings", icon: Settings },
  ];

  // Derive current page title for top header
  const getCurrentPageTitle = () => {
    const current = navItems.find((n) => n.path === location.pathname);
    return current ? current.label : "Management";
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#172033] flex flex-col md:flex-row font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky md:top-0 md:h-screen md:self-start inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-[#1E40AF] via-[#1E3A8A] to-[#172554] border-r border-blue-900/40 flex flex-col shrink-0 shadow-lg transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 px-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-white/95 p-1 rounded-xl shadow-xs">
              <img
                src="/rollz-logo.png"
                alt="ROLLZ Restaurant POS"
                className="h-9 w-auto object-contain group-hover:scale-105 transition-transform"
              />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-white flex items-center gap-1">
                <span>ROLLZ</span>
                <span className="text-blue-300">POS</span>
              </div>
              <p className="text-[11px] text-blue-200/80 font-medium truncate max-w-[120px]">
                {branch?.name || "ROLLZ Main Branch"}
              </p>
            </div>
          </Link>

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-blue-200 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white text-[#1E40AF] shadow-md font-bold"
                    : "text-blue-100 hover:text-white hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? "text-[#1E40AF]" : "text-blue-200"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      isActive
                        ? "bg-blue-100 text-[#1E40AF]"
                        : "bg-white/15 text-blue-100 border border-white/20"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Authenticated User Profile & Branch Details */}
        <div className="p-3.5 border-t border-white/10 bg-black/15 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4 text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {user?.displayName || "Admin User"}
                </p>
                <span className="text-[10px] font-semibold text-blue-200 uppercase tracking-wider block">
                  {user?.role || "OWNER"}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-blue-200 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-blue-200/80 pt-2 border-t border-white/10">
            <span>Branch Code:</span>
            <span className="font-mono text-white font-bold">
              {branch?.code || "ROLLZ-001"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-[#E2E8F0] px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          {/* Left: Mobile hamburger & breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5 text-xs">
              <Link to="/" className="text-slate-400 hover:text-[#2563EB] font-medium">
                ROLLZ POS
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="font-bold text-[#172033]">{getCurrentPageTitle()}</span>
            </div>
          </div>

          {/* Right: Local IST Time & Real Database Status */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs">
            {/* Live Clock Asia/Kolkata */}
            <div className="hidden sm:flex items-center gap-1.5 text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 rounded-xl font-medium">
              <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
              <span className="font-mono text-[11px]">{currentTime || "IST"}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">(IST)</span>
            </div>

            {/* Database indicator */}
            <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 rounded-xl">
              <span
                className={`h-2 w-2 rounded-full ${
                  dbStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                }`}
              ></span>
              <span className="text-[#172033] font-semibold text-[11px] flex items-center gap-1">
                <Database className="w-3 h-3 text-slate-400 inline" />
                <span>{dbStatus.connected ? "Local DB Online" : "DB Offline"}</span>
                {dbStatus.latencyMs !== undefined && (
                  <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                    ({dbStatus.latencyMs}ms)
                  </span>
                )}
              </span>
            </div>

            {/* User pill */}
            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-[#2563EB] font-bold text-xs flex items-center justify-center border border-slate-200">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "A"}
              </div>
              <span className="text-xs font-semibold text-[#172033]">{user?.displayName}</span>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
