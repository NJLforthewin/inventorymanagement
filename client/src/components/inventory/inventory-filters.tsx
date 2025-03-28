import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import { Department, Category } from "@shared/schema";

export interface InventoryFilters {
  search?: string;
  departmentId?: number;
  categoryId?: number;
  status?: string;
}

interface InventoryFiltersProps {
  onFilter: (filters: InventoryFilters) => void;
}

export function InventoryFilters({ onFilter }: InventoryFiltersProps) {
  const [filters, setFilters] = useState<InventoryFilters>({});
  
  // Fetch departments for filter
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Fetch categories for filter
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const applyFilters = () => {
    onFilter(filters);
  };

  const resetFilters = () => {
    setFilters({});
    onFilter({});
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "") {
      const { search, ...rest } = filters;
      setFilters(rest);
    } else {
      setFilters({ ...filters, search: e.target.value });
    }
  };

  // Auto-apply filters for search with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      onFilter(filters);
    }, 300);

    return () => clearTimeout(handler);
  }, [filters.search, onFilter]);

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="flex flex-wrap gap-4">
        <div className="w-full sm:w-auto flex-1">
          <div className="relative">
            <Input 
              placeholder="Search inventory..." 
              className="pl-10" 
              value={filters.search || ""}
              onChange={handleSearchChange}
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-neutral-400" />
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <Select 
            onValueChange={(value) => 
              setFilters({ 
                ...filters, 
                departmentId: value !== "all_departments" ? parseInt(value) : undefined 
              })
            }
            value={filters.departmentId?.toString() || "all_departments"}
          >
            <SelectTrigger className="w-full min-w-[180px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_departments">All Departments</SelectItem>
              {departments?.map((department) => (
                <SelectItem key={department.id} value={department.id.toString()}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto">
          <Select 
            onValueChange={(value) => 
              setFilters({ 
                ...filters, 
                categoryId: value !== "all_categories" ? parseInt(value) : undefined 
              })
            }
            value={filters.categoryId?.toString() || "all_categories"}
          >
            <SelectTrigger className="w-full min-w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_categories">All Categories</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto">
          <Select 
            onValueChange={(value) => 
              setFilters({ 
                ...filters, 
                status: value !== "all_status" ? value : undefined 
              })
            }
            value={filters.status || "all_status"}
          >
            <SelectTrigger className="w-full min-w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_status">All Status</SelectItem>
              <SelectItem value="in_stock">In Stock</SelectItem>
              <SelectItem value="low_stock">Low Stock</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={applyFilters}
          >
            <Filter className="mr-2 h-4 w-4" />
            Apply Filters
          </Button>
          <Button
            variant="outline"
            onClick={resetFilters}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
