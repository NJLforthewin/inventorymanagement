import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { UserForm } from "@/components/user/user-form";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Edit, User as UserIcon, UserX, CheckCircle, XCircle } from "lucide-react";
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

interface UsersResponse {
  users: User[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function UserManagementPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | undefined>(undefined);
  const [deactivateUserId, setDeactivateUserId] = useState<number | undefined>(undefined);

  // Fetch users
  const { data: usersData, isLoading } = useQuery<UsersResponse>({
    queryKey: ["/api/users", page],
    queryFn: async () => {
      return (await fetch(`/api/users?page=${page}`)).json();
    },
  });

  // Mutation for toggling user active status
  const toggleActiveMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await apiRequest("PUT", `/api/users/${id}/toggle-active`, {})).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User status has been updated",
      });
      setDeactivateUserId(undefined);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  // Confirm deactivate/activate user
  const confirmToggleActive = () => {
    if (deactivateUserId) {
      toggleActiveMutation.mutate(deactivateUserId);
    }
  };

  // Table columns
  const columns = [
    {
      header: "Name",
      accessorKey: "name" as keyof User,
      cell: (row: User) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
            <UserIcon className="h-5 w-5 text-gray-500" />
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{row.name}</div>
          </div>
        </div>
      )
    },
    {
      header: "Username",
      accessorKey: "username" as keyof User,
    },
    {
      header: "Email",
      accessorKey: "email" as keyof User,
    },
    {
      header: "Role",
      accessorKey: "role" as keyof User,
      cell: (row: User) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          row.role === "admin" 
            ? "bg-purple-100 text-purple-800" 
            : "bg-blue-100 text-blue-800"
        }`}>
          {row.role.charAt(0).toUpperCase() + row.role.slice(1)}
        </span>
      )
    },
    {
      header: "Department",
      accessorKey: "department" as keyof User,
    },
    {
      header: "Status",
      accessorKey: "active" as keyof User,
      cell: (row: User) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          row.active 
            ? "bg-green-100 text-green-800" 
            : "bg-red-100 text-red-800"
        }`}>
          {row.active ? "Active" : "Inactive"}
        </span>
      )
    },
    {
      header: "Last Login",
      accessorKey: "lastLogin" as keyof User,
      cell: (row: User) => row.lastLogin ? format(new Date(row.lastLogin), "PPpp") : "Never"
    },
    {
      header: "Actions",
      accessorKey: "id" as keyof User,
      cell: (row: User) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditUserId(row.id);
              setIsAddFormOpen(true);
            }}
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeactivateUserId(row.id)}
            title={row.active ? "Deactivate" : "Activate"}
            disabled={isLoading || false} // Can't deactivate admin users
          >
            {row.active ? (
              <UserX className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </Button>
        </div>
      )
    }
  ];

  return (
    <AppLayout title="User Management">
      <div className="flex justify-between mb-6">
        <div>
          {/* Search could be added here */}
        </div>
        <Button
          onClick={() => {
            setEditUserId(undefined);
            setIsAddFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <DataTable
          columns={columns}
          data={usersData?.users || []}
          page={page}
          totalPages={usersData?.totalPages || 1}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>

      {/* Add/Edit User Form */}
      <UserForm
        open={isAddFormOpen}
        onClose={() => {
          setIsAddFormOpen(false);
          setEditUserId(undefined);
        }}
        editUserId={editUserId}
      />

      {/* Toggle Active Confirmation */}
      <AlertDialog open={!!deactivateUserId} onOpenChange={() => setDeactivateUserId(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {usersData?.users.find(u => u.id === deactivateUserId)?.active
                ? "This will deactivate the user account. The user will no longer be able to log in."
                : "This will reactivate the user account. The user will be able to log in again."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleActive}
              className={usersData?.users.find(u => u.id === deactivateUserId)?.active
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
              }
            >
              {usersData?.users.find(u => u.id === deactivateUserId)?.active
                ? "Deactivate"
                : "Activate"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
