import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { StatsCard } from "@/components/ui/stats-card";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { InventoryItem, AuditLog } from "@shared/schema";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  Boxes, 
  AlertTriangle, 
  PlusCircle, 
  XCircle,
  Edit,
  Plus,
  Trash
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DashboardStats {
  totalItems: number;
  lowStockCount: number;
  recentlyAdded: number;
  outOfStock: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });
  
  // Fetch low stock items
  const { data: lowStockItems, isLoading: lowStockLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/dashboard/low-stock"],
  });
  
  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/dashboard/activity"],
  });

  // Table columns for low stock items
  const lowStockColumns = [
    {
      header: "Item",
      accessorKey: "name" as keyof InventoryItem,
    },
    {
      header: "Department",
      accessorKey: "departmentId" as keyof InventoryItem,
      cell: (row: InventoryItem) => {
        const departmentNames: { [key: number]: string } = {
          1: "Emergency",
          2: "Surgery",
          3: "Pediatrics",
          4: "Cardiology",
          5: "General"
        };
        return departmentNames[row.departmentId] || `Department ${row.departmentId}`;
      }
    },
    {
      header: "Current Stock",
      accessorKey: "currentStock" as keyof InventoryItem,
      cell: (row: InventoryItem) => `${row.currentStock} ${row.unit}`
    },
    {
      header: "Status",
      accessorKey: "status" as keyof InventoryItem,
      cell: (row: InventoryItem) => {
        if (row.status === "out_of_stock") {
          return (
            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
              Out of Stock
            </span>
          );
        } else if (row.status === "low_stock") {
          return (
            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
              Low Stock
            </span>
          );
        }
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            In Stock
          </span>
        );
      }
    }
  ];

  return (
    <AppLayout title="Dashboard">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Inventory Items"
          value={statsLoading ? "Loading..." : stats?.totalItems || 0}
          icon={<Boxes className="h-6 w-6" />}
          iconBgColor="bg-primary/10"
          iconColor="text-primary"
          changeDirection="up"
          changeValue="3.2%"
          changeText="from last month"
        />
        
        <StatsCard
          title="Low Stock Items"
          value={statsLoading ? "Loading..." : stats?.lowStockCount || 0}
          icon={<AlertTriangle className="h-6 w-6" />}
          iconBgColor="bg-yellow-100"
          iconColor="text-yellow-800"
          changeDirection="up"
          changeValue="12.5%"
          changeText="from last week"
        />
        
        <StatsCard
          title="Recently Added"
          value={statsLoading ? "Loading..." : stats?.recentlyAdded || 0}
          icon={<PlusCircle className="h-6 w-6" />}
          iconBgColor="bg-green-100"
          iconColor="text-green-800"
          changeDirection="up"
          changeValue="18.7%"
          changeText="from last month"
        />
        
        <StatsCard
          title="Out of Stock"
          value={statsLoading ? "Loading..." : stats?.outOfStock || 0}
          icon={<XCircle className="h-6 w-6" />}
          iconBgColor="bg-red-100"
          iconColor="text-red-800"
          changeDirection="down"
          changeValue="5.3%"
          changeText="from last week"
        />
      </div>

      {/* Recent Activity and Low Stock Tables */}
      {user?.role === 'admin' ? (
        // For admin users, show both activity and low stock in a 2-column layout
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Recent Activity - Only visible to admin */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="max-h-80 overflow-y-auto">
              <div className="space-y-4">
                {activityLoading ? (
                  <div className="text-center py-4">Loading recent activity...</div>
                ) : recentActivity && recentActivity.length > 0 ? (
                  recentActivity.map((activity) => {
                    // Determine icon and color based on activity type
                    let icon;
                    let bgColor;

                    switch (activity.activityType) {
                      case "created":
                        icon = <Plus className="h-4 w-4 text-green-600" />;
                        bgColor = "bg-green-100";
                        break;
                      case "updated":
                        icon = <Edit className="h-4 w-4 text-primary" />;
                        bgColor = "bg-primary/10";
                        break;
                      case "deleted":
                        icon = <Trash className="h-4 w-4 text-red-600" />;
                        bgColor = "bg-red-100";
                        break;
                      case "stock_added":
                        icon = <Plus className="h-4 w-4 text-green-600" />;
                        bgColor = "bg-green-100";
                        break;
                      case "stock_removed":
                        icon = <Minus className="h-4 w-4 text-yellow-600" />;
                        bgColor = "bg-yellow-100";
                        break;
                      default:
                        icon = <Edit className="h-4 w-4 text-primary" />;
                        bgColor = "bg-primary/10";
                    }

                    return (
                      <div key={activity.id} className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className={`h-10 w-10 rounded-full ${bgColor} flex items-center justify-center`}>
                            {icon}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-neutral-600">
                            {activity.details}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">
                            {activity.userId === user?.id ? "You" : `User #${activity.userId}`} • {formatDistanceToNow(new Date(activity.createdAt || Date.now()), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-4">No recent activity</div>
                )}
              </div>
            </CardContent>
            <CardFooter className="bg-neutral-50 border-t">
              <Link href="/audit-log" className="text-sm text-primary hover:text-primary/80 font-medium">
                View all activity
              </Link>
            </CardFooter>
          </Card>

          {/* Low Stock Items */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Low Stock Items</CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockLoading ? (
                <div className="text-center py-4">Loading low stock items...</div>
              ) : lowStockItems && lowStockItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <DataTable
                    columns={lowStockColumns}
                    data={lowStockItems.slice(0, 5)}
                    page={1}
                    totalPages={1}
                    onPageChange={() => {}}
                  />
                </div>
              ) : (
                <div className="text-center py-4">No low stock items</div>
              )}
            </CardContent>
            <CardFooter className="bg-neutral-50 border-t">
              <Link href="/stock-alerts" className="text-sm text-primary hover:text-primary/80 font-medium">
                View all low stock items
              </Link>
            </CardFooter>
          </Card>
        </div>
      ) : (
        // For non-admin users, show only low stock items in a single column
        <div className="mt-8">
          {/* Low Stock Items */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Low Stock Items</CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockLoading ? (
                <div className="text-center py-4">Loading low stock items...</div>
              ) : lowStockItems && lowStockItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <DataTable
                    columns={lowStockColumns}
                    data={lowStockItems.slice(0, 5)}
                    page={1}
                    totalPages={1}
                    onPageChange={() => {}}
                  />
                </div>
              ) : (
                <div className="text-center py-4">No low stock items</div>
              )}
            </CardContent>
            <CardFooter className="bg-neutral-50 border-t">
              <Link href="/stock-alerts" className="text-sm text-primary hover:text-primary/80 font-medium">
                View all low stock items
              </Link>
            </CardFooter>
          </Card>
        </div>
      )}
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
