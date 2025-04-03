import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Add the export keyword here
export interface DataTableColumn<T> {
  header: string;
  accessorKey: keyof T | ((row: T) => any);
  cell?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  page,
  totalPages,
  onPageChange,
  isLoading = false,
}: DataTableProps<T>) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="relative w-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead key={index} className="bg-neutral-100 px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-4">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-4">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="border-t border-neutral-200">
                  {columns.map((column, colIndex) => (
                    <TableCell key={colIndex} className="px-6 py-4 whitespace-nowrap">
                      {column.cell
                        ? column.cell(row)
                        : typeof column.accessorKey === "function"
                        ? column.accessorKey(row)
                        : (row[column.accessorKey] as React.ReactNode)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-neutral-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
          >
            Next
          </Button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-neutral-500">
              Showing page <span className="font-medium">{page}</span> of{" "}
              <span className="font-medium">{totalPages}</span>
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <Button
                variant="outline"
                size="icon"
                className="rounded-l-md"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum = page;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "default" : "outline"}
                    size="icon"
                    className="h-9 w-9 rounded-none"
                    onClick={() => onPageChange(pageNum)}
                    disabled={isLoading}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="icon"
                className="rounded-r-md"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}