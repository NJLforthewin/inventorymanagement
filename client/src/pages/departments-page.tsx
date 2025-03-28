import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Department } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Edit, Trash, Building } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

export default function DepartmentsPage() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editDepartmentId, setEditDepartmentId] = useState<number | undefined>(undefined);
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<number | undefined>(undefined);

  // Form setup
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Fetch departments
  const { data: departments, isLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Fetch department details if editing
  const { data: departmentDetails } = useQuery({
    queryKey: ["/api/departments", editDepartmentId],
    enabled: !!editDepartmentId,
  });

  // Mutation for creating a department
  const createMutation = useMutation({
    mutationFn: async (data: DepartmentFormValues) => {
      return (await apiRequest("POST", "/api/departments", data)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Success",
        description: "Department has been created",
      });
      setIsFormOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create department",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating a department
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: DepartmentFormValues }) => {
      return (await apiRequest("PUT", `/api/departments/${id}`, data)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Success",
        description: "Department has been updated",
      });
      setIsFormOpen(false);
      setEditDepartmentId(undefined);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update department",
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting a department
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Success",
        description: "Department has been deleted",
      });
      setDeleteDepartmentId(undefined);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete department",
        variant: "destructive",
      });
    },
  });

  // Open the form for editing
  const handleEdit = (department: Department) => {
    setEditDepartmentId(department.id);
    form.reset({
      name: department.name,
      description: department.description || "",
    });
    setIsFormOpen(true);
  };

  // Handle form submission
  const onSubmit = (data: DepartmentFormValues) => {
    if (editDepartmentId) {
      updateMutation.mutate({ id: editDepartmentId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Confirm delete department
  const confirmDelete = () => {
    if (deleteDepartmentId) {
      deleteMutation.mutate(deleteDepartmentId);
    }
  };

  // Close form and reset
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditDepartmentId(undefined);
    form.reset();
  };

  // Table columns
  const columns = [
    {
      header: "Name",
      accessorKey: "name" as keyof Department,
      cell: (row: Department) => (
        <div className="flex items-center">
          <Building className="h-5 w-5 text-gray-400 mr-2" />
          <span className="font-medium">{row.name}</span>
        </div>
      )
    },
    {
      header: "Description",
      accessorKey: "description" as keyof Department,
      cell: (row: Department) => row.description || "—"
    },
    {
      header: "Created At",
      accessorKey: "createdAt" as keyof Department,
      cell: (row: Department) => row.createdAt ? format(new Date(row.createdAt), "PPp") : 'No date'    },
    {
      header: "Actions",
      accessorKey: "id" as keyof Department,
      cell: (row: Department) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row)}
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteDepartmentId(row.id)}
            title="Delete"
          >
            <Trash className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <AppLayout title="Department Management">
      <div className="flex justify-between mb-6">
        <div>
          {/* Search could be added here */}
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Department
        </Button>
      </div>

      {/* Departments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <DataTable
          columns={columns}
          data={departments || []}
          page={1}
          totalPages={1}
          onPageChange={() => {}}
          isLoading={isLoading}
        />
      </div>

      {/* Department Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editDepartmentId ? "Edit Department" : "Add New Department"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Emergency, Surgery, etc." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Enter department description..." 
                        className="resize-none h-20"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseForm}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editDepartmentId ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDepartmentId} onOpenChange={() => setDeleteDepartmentId(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this department and may affect related inventory items.
              This action cannot be undone.
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
    </AppLayout>
  );
}
