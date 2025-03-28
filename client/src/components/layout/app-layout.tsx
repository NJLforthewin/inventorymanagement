import { useState, ReactNode } from "react";
import { Sidebar, MobileSidebarToggle } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, User, Settings, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-200">
      {/* Header */}
      <header className="bg-white shadow-sm z-10 fixed top-0 left-0 right-0">
        <div className="flex justify-between items-center px-4 py-3">
          <div className="flex items-center">
            <MobileSidebarToggle setMobileSidebarOpen={setMobileSidebarOpen} />
            <h1 className="ml-2 text-xl font-semibold text-neutral-600">Hospital Inventory System</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center">
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                {user?.role === "admin" ? "Admin" : "Staff"}
              </div>
            </div>
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
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
    </div>
  );
}
