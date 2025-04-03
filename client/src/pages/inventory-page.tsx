import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { InventoryFilters, type InventoryFilters as Filters } from "@/components/inventory/inventory-filters";
import { InventoryItem, Department, Category } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Plus, Edit, PlusCircle, Trash, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";
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
  totalItems: number; // Make sure this is included
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
  const [restockItemId, setRestockItemId] = useState<number | undefined>(undefined);
  const [restockQuantity, setRestockQuantity] = useState<number>(10); // Default to 10

  // Fetch departments for mapping names
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/departments");
      return response.json();
    }
  });

  // Fetch categories for mapping names
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      return response.json();
    }
  });

  // Fetch inventory items with pagination and filters
  const { data: inventoryData, isLoading } = useQuery<InventoryResponse>({
    queryKey: ["/api/inventory", page, JSON.stringify(filters)], // Use stringified filters for proper cache key
    queryFn: async () => {
      console.log(`Fetching page ${page} with filters:`, filters);
      let url = `/api/inventory?page=${page}`;
      
      if (filters.departmentId) url += `&departmentId=${filters.departmentId}`;
      if (filters.categoryId) url += `&categoryId=${filters.categoryId}`;
      if (filters.status) url += `&status=${filters.status}`;
      if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
      if (filters.expiring) url += `&expiring=${filters.expiring}`;
      
      const response = await apiRequest("GET", url);
      return response.json();
    },
    refetchOnWindowFocus: false,
  });
  
  // Mutation for deleting an item
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/inventory/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/soon-to-expire"] });
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
      const response = await apiRequest("POST", `/api/inventory/${id}/stock`, { quantity });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/soon-to-expire"] });
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

  // Mutation for restocking out-of-stock items
  const restockMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: number, quantity: number }) => {
      const response = await apiRequest("POST", `/api/inventory/${id}/restock`, { quantity });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/soon-to-expire"] });
      toast({
        title: "Success",
        description: "Item has been restocked successfully",
      });
      setRestockItemId(undefined);
      setRestockQuantity(10); // Reset to default
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restock item",
        variant: "destructive",
      });
    },
  });

  // Handle filter changes
  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    console.log("Changing to page:", newPage);
    setPage(newPage);
    window.scrollTo(0, 0); // Scroll to top when changing pages
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

  // Confirm restock
  const confirmRestock = () => {
    if (restockItemId) {
      restockMutation.mutate({ id: restockItemId, quantity: restockQuantity });
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
  
  // Check if item is expiring soon (within 30 days)
  const isExpiringSoon = (date: string | Date | null): boolean => {
    if (!date) return false;
    
    const expDate = new Date(date);
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    return expDate > today && expDate <= thirtyDaysFromNow;
  };

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      header: "Item Name",
      accessorKey: "name",
      cell: (row: InventoryItem) => row.name
    },
    {
      header: "ID",
      accessorKey: "itemId",
      cell: (row: InventoryItem) => row.itemId
    },
    {
      header: "Department",
      accessorKey: "departmentId" as const,
      cell: (row: InventoryItem) => getDepartmentName(row.departmentId)
    },
    {
      header: "Category",
      accessorKey: "categoryId" as const,
      cell: (row: InventoryItem) => getCategoryName(row.categoryId)
    },
    {
      header: "Current Stock",
      accessorKey: "currentStock" as const,
      cell: (row: InventoryItem) => `${row.currentStock} ${row.unit}`
    },
    {
      header: "Status",
      accessorKey: "status" as const,
      cell: (row: InventoryItem) => {
        if (row.status === "out_of_stock") {
          return (
            <div className="flex items-center space-x-2">
              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                Out of Stock
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                onClick={() => setRestockItemId(row.id)}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Restock
              </Button>
            </div>
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
      header: "Expiration Date",
      accessorKey: "expirationDate" as const,
      cell: (row: InventoryItem) => {
        if (!row.expirationDate) {
          return <span className="text-muted-foreground text-xs">No expiration</span>;
        }
        
        if (isExpiringSoon(row.expirationDate)) {
          return (
            <span className="text-amber-600 flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {format(new Date(row.expirationDate), 'MMM dd, yyyy')}
            </span>
          );
        }
        
        return format(new Date(row.expirationDate), 'MMM dd, yyyy');
      }
    },
    {
      header: "Last Updated",
      accessorKey: "updatedAt" as const,
      cell: (row: InventoryItem) => row.updatedAt ? format(new Date(row.updatedAt), 'MMM dd, yyyy') : "N/A"
    },
    {
      header: "Actions",
      accessorKey: "id",
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
      {/* Header section with add button */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex-1">
          <InventoryFilters onFilter={handleFilterChange} />
        </div>
        <Button 
          onClick={() => setIsAddFormOpen(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>
      
      {/* Main content - inventory table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={inventoryData?.items || []}
          page={page}
          totalPages={inventoryData?.totalPages || 1}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      </div>
      
      {/* Add/Edit Form Dialog */}
      <InventoryForm
        open={isAddFormOpen}
        onClose={() => {
          setIsAddFormOpen(false);
          setEditItemId(undefined);
        }}
        editItemId={editItemId}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the inventory item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Update Stock Dialog */}
      <Dialog open={!!stockItemId} onOpenChange={() => setStockItemId(undefined)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Stock Quantity</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              min="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
              placeholder="Enter quantity to add"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockItemId(undefined)}>
              Cancel
            </Button>
            <Button onClick={confirmStockUpdate}>
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Restock Dialog for out-of-stock items */}
      <Dialog open={!!restockItemId} onOpenChange={() => setRestockItemId(undefined)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Restock Item</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              min="1"
              value={restockQuantity}
              onChange={(e) => setRestockQuantity(parseInt(e.target.value) || 10)}
              placeholder="Enter quantity to restock"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockItemId(undefined)}>
              Cancel
            </Button>
            <Button onClick={confirmRestock}>
              Restock Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}