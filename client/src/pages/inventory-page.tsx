import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { InventoryFilters, type InventoryFilters as Filters } from "@/components/inventory/inventory-filters";
import { InventoryItem, Department, Category } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Plus, Edit, PlusCircle, Trash, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface InventoryResponse {
  items: InventoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function InventoryPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({});
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<number | undefined>(undefined);
  const [deleteItemId, setDeleteItemId] = useState<number | undefined>(undefined);
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

  // Fetch inventory items with pagination and filters
  const { data: inventoryData, isLoading } = useQuery<InventoryResponse>({
    queryKey: ["/api/inventory", page, filters],
    queryFn: async () => {
      let url = `/api/inventory?page=${page}`;
      
      if (filters.departmentId) url += `&departmentId=${filters.departmentId}`;
      if (filters.categoryId) url += `&categoryId=${filters.categoryId}`;
      if (filters.status) url += `&status=${filters.status}`;
      if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
      
      return (await apiRequest("GET", url)).json();
    },
  });

  // Mutation for deleting an item
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/inventory/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Inventory item has been deleted",
      });
      setDeleteItemId(undefined);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete inventory item",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating stock
  const updateStockMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: number, quantity: number }) => {
      return (await apiRequest("POST", `/api/inventory/${id}/stock`, { quantity })).json();
    },
    onSuccess: () => {
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

  // Handle filter changes
  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  // Confirm delete item
  const confirmDelete = () => {
    if (deleteItemId) {
      deleteMutation.mutate(deleteItemId);
    }
  };

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
      header: "Last Updated",
      accessorKey: "updatedAt" as keyof InventoryItem,
      cell: (row: InventoryItem) => row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "N/A"
    },
    {
      header: "Actions",
      accessorKey: "id" as keyof InventoryItem,
      cell: (row: InventoryItem) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditItemId(row.id);
              setIsAddFormOpen(true);
            }}
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setStockItemId(row.id);
              setStockQuantity(0);
            }}
            title="Adjust Stock"
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteItemId(row.id)}
            title="Delete"
          >
            <Trash className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <AppLayout title="Inventory Management">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="w-full md:w-auto flex-1">
          <InventoryFilters onFilter={handleFilterChange} />
        </div>
        <div className="w-full md:w-auto">
          <Button
            onClick={() => {
              setEditItemId(undefined);
              setIsAddFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Inventory Table */}
      <DataTable
        columns={columns}
        data={inventoryData?.items || []}
        page={page}
        totalPages={inventoryData?.totalPages || 1}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {/* Add/Edit Item Form */}
      <InventoryForm
        open={isAddFormOpen}
        onClose={() => {
          setIsAddFormOpen(false);
          setEditItemId(undefined);
        }}
        editItemId={editItemId}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this inventory item. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stock Update Dialog */}
      <Dialog open={!!stockItemId} onOpenChange={() => setStockItemId(undefined)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock Quantity</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />
                <p>Enter a positive number to add stock, or a negative number to remove stock.</p>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(Number(e.target.value))}
                  placeholder="Enter quantity to adjust"
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
              disabled={updateStockMutation.isPending}
            >
              {updateStockMutation.isPending ? "Updating..." : "Update Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}