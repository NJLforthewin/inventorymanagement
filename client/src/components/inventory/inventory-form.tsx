import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertInventoryItemSchema, type Category, type Department, type InventoryItem } from "@shared/schema";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export type InventoryItemFormType = z.infer<typeof inventoryItemSchema>;

const inventoryItemSchema = insertInventoryItemSchema.extend({
  departmentId: z.coerce.number(),
  categoryId: z.coerce.number(),
  currentStock: z.coerce.number().nonnegative(),
  threshold: z.coerce.number().positive(),
  expirationDate: z.string().optional() // Add expirationDate to schema
});

interface InventoryFormProps {
  open: boolean;
  onClose: () => void;
  editItemId?: number;
}

export function InventoryForm({ open, onClose, editItemId }: InventoryFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(undefined);

  // Fetch departments
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: open
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: open
  });

  // Fetch item details if in edit mode
  const { data: itemDetails } = useQuery<InventoryItem>({
    queryKey: ["/api/inventory", editItemId],
    enabled: !!editItemId && open,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/inventory/${editItemId}`);
      return response.json();
    }
  });

  const form = useForm<InventoryItemFormType>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      itemId: "",
      name: "",
      description: "",
      departmentId: 0,
      categoryId: 0,
      currentStock: 0,
      unit: "units",
      threshold: 10,
      expirationDate: "" // Default empty string for expiration date
    }
  });

  // Reset form when dialog opens/closes or when edit item changes
  useEffect(() => {
    if (open) {
      if (editItemId && itemDetails) {
        // Type assertion to make TypeScript happy
        const item = itemDetails as unknown as InventoryItem;
        
        // Set expiration date if it exists
        if (item.expirationDate) {
          setExpirationDate(new Date(item.expirationDate));
        } else {
          setExpirationDate(undefined);
        }
        
        form.reset({
          itemId: item.itemId,
          name: item.name,
          description: item.description || "",
          departmentId: item.departmentId,
          categoryId: item.categoryId,
          currentStock: item.currentStock,
          unit: item.unit,
          threshold: item.threshold,
          expirationDate: item.expirationDate ? new Date(item.expirationDate).toISOString() : ""
        });
      } else if (!editItemId) {
        setExpirationDate(undefined);
        form.reset({
          itemId: "",
          name: "",
          description: "",
          departmentId: 0,
          categoryId: 0,
          currentStock: 0,
          unit: "units",
          threshold: 10,
          expirationDate: ""
        });
      }
    }
  }, [open, editItemId, itemDetails, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: InventoryItemFormType) => {
      return (await apiRequest("POST", "/api/inventory", data)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/soon-to-expire"] });
      toast({
        title: "Success",
        description: "Inventory item has been created",
      });
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create inventory item",
        variant: "destructive",
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: InventoryItemFormType) => {
      return (await apiRequest("PUT", `/api/inventory/${editItemId}`, data)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/soon-to-expire"] });
      toast({
        title: "Success",
        description: "Inventory item has been updated",
      });
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update inventory item",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: InventoryItemFormType) => {
    setIsLoading(true);
    if (editItemId) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editItemId ? "Edit Inventory Item" : "Add New Inventory Item"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. PPE-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. N95 Masks" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value?.toString() || ""}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id.toString()}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value?.toString() || ""}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currentStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Stock</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="units">Units</SelectItem>
                        <SelectItem value="boxes">Boxes</SelectItem>
                        <SelectItem value="packages">Packages</SelectItem>
                        <SelectItem value="bags">Bags</SelectItem>
                        <SelectItem value="bottles">Bottles</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Low Stock Threshold</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => {
                // Ensure value is never null
                const safeValue = typeof field.value === 'string' ? field.value : '';
                return (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter item description"
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        name={field.name}
                        value={safeValue}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            
            {/* Add expiration date field */}
            <FormField
              control={form.control}
              name="expirationDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Expiration Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={expirationDate}
                        onSelect={(date) => {
                          setExpirationDate(date);
                          field.onChange(date ? date.toISOString() : "");
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Leave empty if the item does not expire
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading || createMutation.isPending || updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || createMutation.isPending || updateMutation.isPending}
              >
                {editItemId ? "Update Item" : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}