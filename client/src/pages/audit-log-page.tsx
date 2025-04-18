import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Filter, 
  User,
  Calendar,
  Box,
  Plus,
  Edit,
  Trash,
  History,
  Download
} from "lucide-react";
import { AuditLog, User as UserType } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { useAuth } from "@/hooks/use-auth"; // Import useAuth hook
import axios from "axios"; // Import axios
import { API_BASE_URL } from "@/lib/config"; // Import API_BASE_URL
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface AuditLogResponse {
  logs: AuditLog[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AuditLogFilters {
  userId?: number;
  activityType?: string;
  itemId?: number;
  startDate?: Date;
  endDate?: Date;
}

export default function AuditLogPage() {
  const { token, getAuthHeader } = useAuth(); // Get token and auth header helper
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditLogFilters>({});

  // Fetch users for filter with token auth
  const { data: users } = useQuery<UserType[]>({
    queryKey: ["/api/users", { limit: 100 }],
    enabled: !!token, // Only run if token exists
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/users?limit=100`, {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data.users || [];
    },
  });

  // Fetch audit logs with token auth
  const { data: auditLogData, isLoading } = useQuery<AuditLogResponse>({
    queryKey: ["/api/audit-logs", page, filters],
    enabled: !!token, // Only run if token exists
    queryFn: async () => {
      let url = `${API_BASE_URL}/api/audit-logs?page=${page}`;
      
      if (filters.userId) url += `&userId=${filters.userId}`;
      if (filters.activityType) url += `&activityType=${filters.activityType}`;
      if (filters.itemId) url += `&itemId=${filters.itemId}`;
      // Using optional chaining to ensure startDate and endDate are defined before calling toISOString
      if (filters.startDate) url += `&startDate=${filters.startDate?.toISOString()}`;
      if (filters.endDate) url += `&endDate=${filters.endDate?.toISOString()}`;
      
      const response = await axios.get(url, {
        headers: {
          ...getAuthHeader()
        }
      });
      return response.data;
    },
  });

  // Handle filter changes
  const applyFilters = () => {
    setPage(1); // Reset to first page when filters change
  };

  const resetFilters = () => {
    setFilters({});
    setPage(1);
  };

  // Handle export
  const handleExport = () => {
    // In a real app, this would generate a CSV/Excel file with token auth
    console.log("Exporting audit logs");
  };

  // Get user name by ID with safe access
  const getUserName = (id: number) => {
    const user = users?.find(u => u.id === id);
    return user ? user.name : `User #${id}`;
  };

  // Get activity type display name
  const getActivityTypeDisplay = (type: string) => {
    switch (type) {
      case "created": return "Created";
      case "updated": return "Updated";
      case "deleted": return "Deleted";
      case "stock_added": return "Stock Added";
      case "stock_removed": return "Stock Removed";
      default: return type;
    }
  };

  // Get activity icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "created": return <Plus className="h-4 w-4 text-green-500" />;
      case "updated": return <Edit className="h-4 w-4 text-blue-500" />;
      case "deleted": return <Trash className="h-4 w-4 text-red-500" />;
      case "stock_added": return <Plus className="h-4 w-4 text-green-500" />;
      case "stock_removed": return <Minus className="h-4 w-4 text-orange-500" />;
      default: return <History className="h-4 w-4 text-gray-500" />;
    }
  };

  // Safe access to logs
  const logs = auditLogData?.logs || [];

  // Table columns
  const columns = [
    {
      header: "Activity",
      accessorKey: "activityType" as keyof AuditLog,
      cell: (row: AuditLog) => (
        <div className="flex items-center">
          <div className="mr-2">
            {getActivityIcon(row.activityType)}
          </div>
          <span className="font-medium">{getActivityTypeDisplay(row.activityType)}</span>
        </div>
      )
    },
    {
      header: "User",
      accessorKey: "userId" as keyof AuditLog,
      cell: (row: AuditLog) => (
        <div className="flex items-center">
          <User className="h-4 w-4 text-gray-400 mr-2" />
          <span>{getUserName(row.userId)}</span>
        </div>
      )
    },
    {
      header: "Details",
      accessorKey: "details" as keyof AuditLog,
      cell: (row: AuditLog) => (
        <div className="max-w-md truncate" title={row.details}>
          {row.details}
        </div>
      )
    },  {
      header: "Item ID",
      accessorKey: "itemId" as keyof AuditLog,
      cell: (row: AuditLog) => {
        return row.itemId ? (
          <div className="flex items-center">
            <Box className="h-4 w-4 text-gray-400 mr-2" />
            <span>#{row.itemId}</span>
          </div>
        ) : "—";
      }
    },
    {
      header: "Date & Time",
      accessorKey: "createdAt" as keyof AuditLog,
      cell: (row: AuditLog) => {
        if (!row.createdAt) {
          return <div className="text-sm">-</div>;
        }
        
        try {
          const date = new Date(row.createdAt);
          return (
            <div>
              <div className="text-sm">{format(date, "PPp")}</div>
              <div className="text-xs text-gray-500">
                {formatDistanceToNow(date, { addSuffix: true })}
              </div>
            </div>
          );
        } catch (error) {
          console.error("Error formatting date:", error);
          return <div className="text-sm">Invalid date</div>;
        }
      }
    }
  ];

  return (
    <AppLayout title="Audit Log">
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filter Audit Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
                <div className="w-full sm:w-auto">
              <Select 
                value={filters.userId?.toString() ||"all" }
                onValueChange={(value) => 
                  setFilters({ 
                    ...filters, 
                    userId: value !== "all" ? parseInt(value) : undefined 
                  })
                }
              >
                <SelectTrigger className="w-full min-w-[200px]">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}
                  </SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full sm:w-auto">
            <Select 
                value={filters.activityType || "all"}
                onValueChange={(value) => 
                  setFilters({ 
                    ...filters, 
                    activityType: value !== "all" ? value : undefined 
                  })
                }
              >
                <SelectTrigger className="w-full min-w-[200px]">
                  <SelectValue placeholder="All Activities" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                  <SelectItem value="stock_added">Stock Added</SelectItem>
                  <SelectItem value="stock_removed">Stock Removed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full min-w-[200px] justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {filters.startDate ? (
                      <span>
                        {format(filters.startDate, "PP")}
                        {filters.endDate ? ` - ${format(filters.endDate, "PP")}` : ""}
                      </span>
                    ) : (
                      <span>Select date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex">
                    <div>
                      <p className="p-2 text-sm font-medium">Start Date</p>
                      <CalendarComponent
                        mode="single"
                        selected={filters.startDate}
                        onSelect={(date) => 
                          setFilters({ 
                            ...filters, 
                            startDate: date || undefined 
                          })
                        }
                        initialFocus
                    />
                    </div>
                    <div className="border-l">
                      <p className="p-2 text-sm font-medium">End Date</p>
                      <CalendarComponent
                        mode="single"
                        selected={filters.endDate}
                        onSelect={(date) => 
                          setFilters({ 
                            ...filters, 
                            endDate: date || undefined 
                          })
                        }
                        initialFocus
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex gap-2 items-end ml-auto">
              <Button onClick={applyFilters} variant="secondary">
                <Filter className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
              <Button onClick={resetFilters} variant="outline">
                Clear Filters
              </Button>
              <Button onClick={handleExport} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <DataTable
        columns={columns}
        data={logs}
        page={page}
        totalPages={auditLogData?.totalPages || 1}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </AppLayout>
  );
}

// Adding the Minus icon which wasn't imported at the top
function Minus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}