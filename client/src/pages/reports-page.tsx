// client/src/pages/reports-page.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { 
  Download, 
  BarChart4,
  PieChart as PieChartIcon,
  Filter
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { InventoryItem, Department, Category } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type TimeRange = "7days" | "30days" | "90days" | "1year" | "all";

interface ChartFilter {
  departmentId?: number;
  categoryId?: number;
  timeRange: TimeRange;
}

interface InventoryResponse {
  items: InventoryItem[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export default function ReportsPage() {
  const [chartFilter, setChartFilter] = useState<ChartFilter>({
    timeRange: "30days",
  });
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const pageSize = 10; // Items per page for the report table

  // Fetch departments
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Fetch categories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  // Fetch chart data (all items, since we need them for the charts)
  const { data: allInventoryData } = useQuery<InventoryResponse>({
    queryKey: ["/api/inventory", 1, { limit: 1000 }],
    queryFn: async () => {
      const url = `/api/inventory?page=1&limit=1000`;
      return (await fetch(url)).json();
    },
  });

  // Fetch paginated data for the report table
  const { data: reportInventoryData, isLoading: isReportLoading } = useQuery<InventoryResponse>({
    queryKey: ["/api/inventory/report", page, pageSize],
    queryFn: async () => {
      const url = `/api/inventory?page=${page}&limit=${pageSize}`;
      console.log(`Fetching report data: ${url}`);
      const response = await fetch(url);
      const data = await response.json();
      console.log("Report API response:", data);
      return data;
    },
  });

  // Data for charts
  const allItems = allInventoryData?.items || [];
  
  // Data for report table
  const reportItems = reportInventoryData?.items || [];
  const totalPages = reportInventoryData?.totalPages || 1;
  const currentPage = reportInventoryData?.page || page;

  console.log(`Current page: ${currentPage}, Total pages: ${totalPages}, Items: ${reportItems.length}`);

  // Process data for department distribution chart
  const departmentData = departments?.map(dept => {
    const itemCount = allItems.filter(item => item.departmentId === dept.id).length;
    return {
      name: dept.name,
      count: itemCount
    };
  }).sort((a, b) => b.count - a.count) || [];

  // Process data for status distribution chart
  const statusData = [
    {
      name: "In Stock",
      value: allItems.filter(item => item.status === "in_stock").length,
      color: "#4caf50" // green
    },
    {
      name: "Low Stock",
      value: allItems.filter(item => item.status === "low_stock").length,
      color: "#ff9800" // amber
    },
    {
      name: "Out of Stock",
      value: allItems.filter(item => item.status === "out_of_stock").length,
      color: "#f44336" // red
    }
  ];

  // Process data for category distribution chart
  const categoryData = categories?.map(cat => {
    const itemCount = allItems.filter(item => item.categoryId === cat.id).length;
    return {
      name: cat.name,
      count: itemCount
    };
  }).sort((a, b) => b.count - a.count) || [];

  // Table columns for inventory report
  const columns = [
    {
      header: "Item Name",
      accessorKey: "name" as keyof InventoryItem,
    },
    {
      header: "ID",
      accessorKey: "itemId" as keyof InventoryItem,
    },
    {
      header: "Department",
      accessorKey: "departmentId" as keyof InventoryItem,
      cell: (row: InventoryItem) => {
        const dept = departments?.find(d => d.id === row.departmentId);
        return dept ? dept.name : `Department ${row.departmentId}`;
      }
    },
    {
      header: "Category",
      accessorKey: "categoryId" as keyof InventoryItem,
      cell: (row: InventoryItem) => {
        const cat = categories?.find(c => c.id === row.categoryId);
        return cat ? cat.name : `Category ${row.categoryId}`;
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

  // Filter chart data based on selected filters
  const applyChartFilters = () => {
    // In a real implementation, this would trigger API requests with the selected filters
    console.log("Applying filters:", chartFilter);
  };

  // Handle export report
  const handleExportReport = () => {
    // In a real implementation, this would generate a CSV/PDF report
    toast({
      title: "Export started",
      description: "Your report is being prepared for download",
    });
  };

  return (
    <AppLayout title="Reports & Analytics">
      {/* Report controls */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-auto flex-1">
            <h3 className="text-sm font-semibold mb-2">Filter Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                value={chartFilter.departmentId?.toString() || "all_departments"}
                onValueChange={(value) => 
                  setChartFilter({ 
                    ...chartFilter, 
                    departmentId: value !== "all_departments" ? parseInt(value) : undefined 
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_departments">All Departments</SelectItem>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id.toString()}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={chartFilter.categoryId?.toString() || "all_categories"}
                onValueChange={(value) => 
                  setChartFilter({ 
                    ...chartFilter, 
                    categoryId: value !== "all_categories" ? parseInt(value) : undefined 
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_categories">All Categories</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={chartFilter.timeRange}
                onValueChange={(value) => 
                  setChartFilter({ 
                    ...chartFilter, 
                    timeRange: value as TimeRange 
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                  <SelectItem value="1year">Last Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={applyChartFilters} variant="secondary">
              <Filter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
            <Button onClick={handleExportReport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <BarChart4 className="mr-2 h-5 w-5" />
              Inventory by Department
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={departmentData}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 60,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={60}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0078D4" name="Item Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <PieChartIcon className="mr-2 h-5 w-5" />
              Inventory Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Report Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Inventory Report</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={reportItems}
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            isLoading={isReportLoading}
          />
        </CardContent>
      </Card>
    </AppLayout>
  );
}