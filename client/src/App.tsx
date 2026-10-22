import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/Layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { MenuItemsPage } from "./pages/MenuItemsPage";
import { POSTerminalPage } from "./pages/POSTerminalPage";
import { ModifiersPage } from "./pages/ModifiersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { InventoryPage } from "./pages/InventoryPage";
import { CashManagementPage } from "./pages/CashManagementPage";
import { ReportsPage } from "./pages/ReportsPage";
import { CRMPage } from "./pages/CRMPage";
import { RefreshCw } from "lucide-react";

const AuthenticatedApp: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center text-[#64748B] gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[#2563EB]" />
        <span className="text-xs font-semibold text-[#172033]">Starting ROLLZ POS Terminal...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/menu-items" element={<MenuItemsPage />} />
        <Route path="/modifiers" element={<ModifiersPage />} />
        <Route path="/pos" element={<POSTerminalPage />} />
        <Route path="/orders" element={<InvoicesPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/cash-management" element={<CashManagementPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/crm" element={<CRMPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
