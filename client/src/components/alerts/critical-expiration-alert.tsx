import { useState, useEffect } from "react";
import { format } from "date-fns";
import { AlertTriangle, Clock } from "lucide-react";
import { InventoryItem } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";

export function CriticalExpirationAlert() {
  const [open, setOpen] = useState(false);
  
  const { data: criticalItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/alerts/critical-expirations"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Show alert dialog when critical items are found and on fresh login
  useEffect(() => {
    // Check if this is a fresh login session
    const hasShownAlert = sessionStorage.getItem('expirationAlertShown');
    
    // Only show alert if there are critical items and it hasn't been shown yet
    if (criticalItems.length > 0 && !hasShownAlert) {
      setOpen(true);
      // Mark alert as shown for this session
      sessionStorage.setItem('expirationAlertShown', 'true');
    }
  }, [criticalItems]);

  // Don't render anything if no critical items
  if (criticalItems.length === 0) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center text-amber-600">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Critical Expiration Alert
          </AlertDialogTitle>
          <AlertDialogDescription>
            The following items will expire within 2 weeks and require immediate attention:
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 p-1">
            {criticalItems.map((item) => (
              <div 
                key={item.id} 
                className="border rounded-lg p-3 bg-amber-50 border-amber-200"
              >
                <div className="font-semibold text-amber-900">{item.name}</div>
                <div className="text-sm text-muted-foreground mb-1">
                  ID: {item.itemId} • Stock: {item.currentStock} {item.unit}
                </div>
                <div className="text-sm font-medium text-amber-600 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Expires: {item.expirationDate ? format(new Date(item.expirationDate), 'MMM dd, yyyy') : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel>Dismiss</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link href="/inventory?expiring=soon">
              <Button className="bg-amber-600 hover:bg-amber-700">
                View All Expiring Items
              </Button>
            </Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}