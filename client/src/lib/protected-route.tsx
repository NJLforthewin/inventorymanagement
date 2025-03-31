// protected-route.tsx
import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Route, Redirect } from "wouter";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  requiredRole?: 'admin' | 'staff';
}

export function ProtectedRoute({ path, component: Component, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  
  return (
    <Route
      path={path}
      component={() => {
        // Show loading state while checking authentication
        if (isLoading) {
          return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
        }
        
        // Redirect to login if not authenticated
        if (!user) {
          return <Redirect to="/login" />;
        }
        
        // Check role requirements if specified
        if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
          return <Redirect to="/unauthorized" />;
        }
        
        // User is authenticated and has required role
        return <Component />;
      }}
    />
  );
}