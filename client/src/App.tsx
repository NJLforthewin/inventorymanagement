import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import InventoryPage from "@/pages/inventory-page";
import StockAlertsPage from "@/pages/stock-alerts-page";
import ReportsPage from "@/pages/reports-page";
import UserManagementPage from "@/pages/user-management-page";
import DepartmentsPage from "@/pages/departments-page";
import AuditLogPage from "@/pages/audit-log-page";
import SqlServerPage from "@/pages/sql-server-page";
import { ProtectedRoute } from "@/lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/inventory" component={InventoryPage} />
      <ProtectedRoute path="/stock-alerts" component={StockAlertsPage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/users" component={UserManagementPage} adminOnly />
      <ProtectedRoute path="/departments" component={DepartmentsPage} adminOnly />
      <ProtectedRoute path="/audit-log" component={AuditLogPage} adminOnly />
      <ProtectedRoute path="/sql-server" component={SqlServerPage} adminOnly />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <>
      <Router />
      <Toaster />
    </>
  );
}

export default App;
