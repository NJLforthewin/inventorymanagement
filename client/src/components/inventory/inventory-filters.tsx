import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface InventoryFilters {
  search?: string;
  departmentId?: number;
  categoryId?: number;
  status?: string;
  expiring?: string;
}

interface InventoryFiltersProps {
  onFilter: (filters: InventoryFilters) => void;
}

export function InventoryFilters({ onFilter }: InventoryFiltersProps) {
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [expiring, setExpiring] = useState<string | undefined>(undefined);

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/departments");
      return response.json();
    }
  });
  
  // Fetch categories (removed duplicate)
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      return response.json();
    }
  });

  // Count active filters
  const activeFilterCount = [
    departmentId, 
    categoryId, 
    status, 
    expiring
  ].filter(Boolean).length;

  // Manual filter application with button instead of automatic useEffect
  const applyFilters = () => {
    const filters: InventoryFilters = {};
    
    if (search) filters.search = search;
    if (departmentId) filters.departmentId = departmentId;
    if (categoryId) filters.categoryId = categoryId;
    if (status) filters.status = status;
    if (expiring) filters.expiring = expiring;
    
    onFilter(filters);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearch("");
    setDepartmentId(undefined);
    setCategoryId(undefined);
    setStatus(undefined);
    setExpiring(undefined);
    
    // Call onFilter with empty object to reset all filters
    onFilter({});
  };

  // Update local state without triggering onFilter
  const updateSearch = (value: string) => {
    setSearch(value);
    if (value === "") {
      // Only apply filter reset if search is cleared
      const filters: InventoryFilters = {};
      if (departmentId) filters.departmentId = departmentId;
      if (categoryId) filters.categoryId = categoryId;
      if (status) filters.status = status;
      if (expiring) filters.expiring = expiring;
      onFilter(filters);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-end">
      <div className="w-full sm:max-w-xs flex">
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
          className="h-9 rounded-r-none"
        />
        <Button 
          onClick={applyFilters}
          className="h-9 rounded-l-none px-3"
        >
          Search
        </Button>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-primary w-4 h-4 text-[10px] flex items-center justify-center text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuLabel>Filter by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <div className="p-2">
            <label className="text-xs font-medium mb-1 block">Department</label>
            <Select 
              value={departmentId?.toString() || "all"} 
              onValueChange={(value) => setDepartmentId(value !== "all" ? Number(value) : undefined)}
            > 
              <SelectTrigger className="h-8 text-xs"> 
                <SelectValue placeholder="All Departments" /> 
              </SelectTrigger> 
              <SelectContent> 
                <SelectItem value="all">All Departments</SelectItem> 
                {departments.map((dept: any) => ( 
                  <SelectItem key={dept.id} value={dept.id.toString()}> 
                    {dept.name} 
                  </SelectItem> 
                ))} 
              </SelectContent> 
            </Select> 
          </div> 
          
          <div className="p-2"> 
            <label className="text-xs font-medium mb-1 block">Category</label> 
            <Select 
              value={categoryId?.toString() || "all"} 
              onValueChange={(value) => setCategoryId(value !== "all" ? Number(value) : undefined)}
            > 
              <SelectTrigger className="h-8 text-xs"> 
                <SelectValue placeholder="All Categories" /> 
              </SelectTrigger> 
              <SelectContent> 
                <SelectItem value="all">All Categories</SelectItem> 
                {categories.map((cat: any) => ( 
                  <SelectItem key={cat.id} value={cat.id.toString()}> 
                    {cat.name} 
                  </SelectItem> 
                ))} 
              </SelectContent> 
            </Select> 
          </div> 
          
          <div className="p-2"> 
            <label className="text-xs font-medium mb-1 block">Status</label> 
            <Select 
              value={status || "all"} 
              onValueChange={(value) => setStatus(value !== "all" ? value : undefined)}
            > 
              <SelectTrigger className="h-8 text-xs"> 
                <SelectValue placeholder="All Statuses" /> 
              </SelectTrigger> 
              <SelectContent> 
                <SelectItem value="all">All Statuses</SelectItem> 
                <SelectItem value="in_stock">In Stock</SelectItem> 
                <SelectItem value="low_stock">Low Stock</SelectItem> 
                <SelectItem value="out_of_stock">Out of Stock</SelectItem> 
              </SelectContent> 
            </Select> 
          </div>
         
          <div className="p-2">
            <label className="text-xs font-medium mb-1 block">Expiration</label>
            <Select
              value={expiring || "all"}
              onValueChange={(value) => setExpiring(value !== "all" ? value : undefined)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Any Expiration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Expiration</SelectItem>
                <SelectItem value="soon">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="no_expiration">No Expiration</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DropdownMenuSeparator />
          <div className="p-2 flex flex-col gap-2">
            <Button 
              variant="default" 
              size="sm" 
              className="h-8 w-full text-xs"
              onClick={applyFilters}
            >
              Apply Filters
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-full text-xs justify-start"
              onClick={resetFilters}
            >
              <X className="mr-2 h-3 w-3" />
              Reset Filters
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}