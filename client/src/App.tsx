import { Route, Switch } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './hooks/use-auth';
import { Toaster } from './components/ui/toaster';
import { ProtectedRoute } from './lib/protected-route';

// Pages
import LoginPage from './pages/auth-page';
import RegisterPage from './pages/auth-page-new';
import DashboardPage from './pages/dashboard-page';
import InventoryPage from './pages/inventory-page';
import NotFoundPage from './pages/not-found';
import StockAlertsPage from './pages/stock-alerts-page';
import ReportsPage from './pages/reports-page';
import DepartmentsPage from './pages/departments-page';
import UserManagementPage from './pages/user-management-page';
import SqlServerPage from './pages/sql-server-page';
import AuditLogPage from './pages/audit-log-page';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          
          <ProtectedRoute path="/" component={DashboardPage} />
          <ProtectedRoute path="/dashboard" component={DashboardPage} />
          <ProtectedRoute path="/inventory" component={InventoryPage} />
          <ProtectedRoute path="/stock-alerts" component={StockAlertsPage} />
          <ProtectedRoute path="/reports" component={ReportsPage} />
          
          <ProtectedRoute path="/departments" component={DepartmentsPage} requiredRole="admin" />
          <ProtectedRoute path="/users" component={UserManagementPage} requiredRole="admin" />
          <ProtectedRoute path="/sql-server" component={SqlServerPage} requiredRole="admin" />
          <ProtectedRoute path="/audit-log" component={AuditLogPage} requiredRole="admin" />
          
          <Route component={NotFoundPage} />
        </Switch>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;