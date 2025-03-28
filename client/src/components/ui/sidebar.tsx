import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  BarChart3,
  Clipboard,
  AlertTriangle,
  FileText,
  Users,
  Building,
  History,
  X,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
}

export function Sidebar({ isMobileSidebarOpen, setMobileSidebarOpen }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Close sidebar on route change on mobile
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location, setMobileSidebarOpen]);

  const navItems = [
    { href: "/", label: "Dashboard", icon: <BarChart3 className="w-6" /> },
    { href: "/inventory", label: "Inventory", icon: <Clipboard className="w-6" /> },
    { href: "/stock-alerts", label: "Stock Alerts", icon: <AlertTriangle className="w-6" /> },
    { href: "/reports", label: "Reports", icon: <FileText className="w-6" /> },
  ];

  const adminNavItems = [
    { href: "/users", label: "User Management", icon: <Users className="w-6" /> },
    { href: "/departments", label: "Departments", icon: <Building className="w-6" /> },
    { href: "/audit-log", label: "Audit Log", icon: <History className="w-6" /> },
  ];

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-neutral-600 bg-opacity-50 z-30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={cn(
          "sidebar w-64 bg-white shadow-md fixed inset-y-0 left-0 transform lg:translate-x-0 lg:static lg:inset-auto transition duration-300 ease-in-out z-40 pt-16",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="lg:hidden absolute right-4 top-4">
          <button 
            onClick={() => setMobileSidebarOpen(false)}
            className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 focus:outline-none"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="mt-5 px-2">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "sidebar-item flex items-center pl-3 pr-4 py-3 text-base font-medium rounded-md text-neutral-600 hover:bg-neutral-100",
                  location === item.href && "active border-l-4 border-primary bg-primary/10"
                )}
              >
                <span className="w-6 text-center">{item.icon}</span>
                <span className="ml-3">{item.label}</span>
                {item.href === "/stock-alerts" && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    5
                  </span>
                )}
              </Link>
            ))}
            
            {/* Admin-only menu items */}
            {isAdmin && (
              <>
                <div className="border-t border-neutral-200 my-2"></div>
                <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Admin Area
                </div>
                {adminNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "sidebar-item flex items-center pl-3 pr-4 py-3 text-base font-medium rounded-md text-neutral-600 hover:bg-neutral-100",
                      location === item.href && "active border-l-4 border-primary bg-primary/10"
                    )}
                  >
                    <span className="w-6 text-center">{item.icon}</span>
                    <span className="ml-3">{item.label}</span>
                  </Link>
                ))}
              </>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}

export function MobileSidebarToggle({ setMobileSidebarOpen }: { setMobileSidebarOpen: (open: boolean) => void }) {
  return (
    <button 
      onClick={() => setMobileSidebarOpen(true)}
      className="lg:hidden p-2 rounded-md text-neutral-500 hover:bg-neutral-200 focus:outline-none"
    >
      <Menu />
    </button>
  );
}
