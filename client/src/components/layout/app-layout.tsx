import { useState, ReactNode } from "react";
import { Sidebar, MobileSidebarToggle } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Import logo images
import logoFull from "@/assets/logo.png";
import logoIcon from "@/assets/logo-icon.png.png";
import { CriticalExpirationAlert } from "@/components/alerts/critical-expiration-alert";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Removed the isMenuOpen state as we don't need it anymore
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  const handleLogout = () => {
    logout();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Check if user role is admin (case-insensitive)
  const isAdmin = user?.role && user.role.toLowerCase() === "admin";

  return (
    <div className="min-h-screen flex flex-col bg-neutral-200 no-scrollbar">
      {/* Header */}
      <header className="bg-white shadow-sm z-10 fixed top-0 left-0 right-0">
        <div className="flex justify-between items-center px-4 py-3">
          <div className="flex items-center">
            <MobileSidebarToggle setMobileSidebarOpen={setMobileSidebarOpen} />
            <div className="ml-2 flex items-center">
              {/* Desktop view - show full logo */}
              <div className="hidden md:flex items-center">
                <img src={logoFull} alt="Stock Well" className="h-7" />
              </div>
              
              {/* Mobile view - show only icon */}
              <div className="flex md:hidden items-center">
                <img src={logoIcon} alt="Stock Well" className="h-8 w-auto" />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center">
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                {isAdmin ? "Admin" : "Staff"}
              </div>
            </div>
            {/* Fixed DropdownMenu - removed controlled state */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-1 text-neutral-600 hover:text-primary focus:outline-none">
                  <span className="hidden md:block">{user?.name}</span>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{user?.name ? getInitials(user.name) : "U"}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        <Sidebar
          isMobileSidebarOpen={isMobileSidebarOpen}
          setMobileSidebarOpen={setMobileSidebarOpen}
        />

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-neutral-600">{title}</h2>
            </div>
            {children}
          </div>
        </main>
      </div>
      {/* Add the Critical Expiration Alert */}
      <CriticalExpirationAlert />
    </div>
  );
}