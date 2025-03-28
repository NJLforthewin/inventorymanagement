import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { AlertTriangle, PlusCircle } from "lucide-react";
import { InventoryItem, Department, Category } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function StockAlertsPage() {
  const { toast } = useToast();
  const [stockItemId, setStockItemId] = useState<number | undefined>(undefined);
  const [stockQuantity, setStockQuantity] = useState<number>(0);

  // Fetch departments for mapping names
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Fetch categories for mapping names
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch low stock items
  const { data: lowStockItems, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/dashboard/low-stock"],
  });

  // Mutation for updating stock
  const updateStockMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: number, quantity: number }) => {
      return (await apiRequest("POST", `/api/inventory/${id}/stock`, { quantity })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Stock has been updated",
      });
      setStockItemId(undefined);
      setStockQuantity(0);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stock",
        variant: "destructive",
      });
    },
  });

  // Confirm stock update
  const confirmStockUpdate = () => {
    if (stockItemId) {
      updateStockMutation.mutate({ id: stockItemId, quantity: stockQuantity });
    }
  };

  // Find department and category names by ID
  const getDepartmentName = (id: number) => {
    const dept = departments?.find(d => d.id === id);
    return dept ? dept.name : `Department ${id}`;
  };

  const getCategoryName = (id: number) => {
    const cat = categories?.find(c => c.id === id);
    return cat ? cat.name : `Category ${id}`;
  };

  // Table columns
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
      cell: (row: InventoryItem) => getDepartmentName(row.departmentId),
    },
    {
      header: "Category",
      accessorKey: "categoryId" as keyof InventoryItem,
      cell: (row: InventoryItem) => getCategoryName(row.categoryId),
    },
    {
      header: "Current Stock",
      accessorKey: "currentStock" as keyof InventoryItem,
      cell: (row: InventoryItem) => `${row.currentStock} ${row.unit}`
    },
    {
      header: "Threshold",
      accessorKey: "threshold" as keyof InventoryItem,
      cell: (row: InventoryItem) => `${row.threshold} ${row.unit}`
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
    },
    {
      header: "Actions",
      accessorKey: "id" as keyof InventoryItem,
      cell: (row: InventoryItem) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStockItemId(row.id);
              setStockQuantity(0);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Stock
          </Button>
        </div>
      )
    }
  ];

  const criticalItems = lowStockItems?.filter(item => item.status === "out_of_stock") || [];
  const lowItems = lowStockItems?.filter(item => item.status === "low_stock") || [];

  return (
    <AppLayout title="Stock Alerts">
      <div className="grid gap-6 mb-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <h3 className="text-lg font-semibold text-red-600">Critical Stock Alert</h3>
            </div>
            <CardDescription className="text-red-600">
              {criticalItems.length} items are currently out of stock. These items require immediate attention.
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center mb-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
              <h3 className="text-lg font-semibold text-yellow-600">Low Stock Warning</h3>
            </div>
            <CardDescription className="text-yellow-600">
              {lowItems.length} items are below their minimum threshold. Consider restocking these items soon.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium">All Low Stock Items</h3>
        </div>
        <DataTable
          columns={columns}
          data={lowStockItems || []}
          page={1}
          totalPages={1}
          onPageChange={() => {}}
          isLoading={isLoading}
        />
      </div>

      {/* Stock Update Dialog */}
      <Dialog open={!!stockItemId} onOpenChange={() => setStockItemId(undefined)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Stock</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <p>Enter the quantity to add to the current stock.</p>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(Number(e.target.value))}
                  placeholder="Enter quantity to add"
                  min="1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStockItemId(undefined)}
              disabled={updateStockMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStockUpdate}
              disabled={updateStockMutation.isPending || stockQuantity <= 0}
            >
              {updateStockMutation.isPending ? "Adding..." : "Add Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
