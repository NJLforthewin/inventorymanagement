// use-auth.tsx
import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser, LoginUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient, apiClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<Omit<SelectUser, "password">, Error, LoginUser>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<Omit<SelectUser, "password">, Error, InsertUser>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        // Try the standard endpoint first
        const response = await apiClient.get('/user');
        return response.data;
      } catch (error) {
        console.log('Standard user endpoint failed, trying direct user');
        try {
          // Fall back to the direct endpoint
          const directResponse = await apiClient.get('/direct-user');
          if (directResponse.data.success && directResponse.data.user) {
            return directResponse.data.user;
          }
          throw new Error('Not authenticated');
        } catch (directError) {
          console.log('Direct user endpoint failed');
          throw new Error('Not authenticated');
        }
      }
    },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user && location !== '/login' && location !== '/register') {
      console.log('User not authenticated, redirecting to login');
      setLocation('/login');
    }
  }, [user, isLoading, location, setLocation]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginUser) => {
      try {
        // Try standard login first
        console.log(`Making POST request to login endpoint`);
        const response = await apiClient.post('/login', credentials);
        return response.data;
      } catch (error) {
        console.log('Standard login failed, trying direct login');
        // If standard login fails, try direct login
        const directResponse = await apiClient.post('/direct-login', credentials);
        if (directResponse.data.success && directResponse.data.user) {
          return directResponse.data.user;
        }
        throw new Error('Login failed');
      }
    },
    onSuccess: (user: Omit<SelectUser, "password">) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name}!`,
        variant: "default",
      });
      setLocation('/dashboard');
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || 'Invalid username or password',
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: Omit<SelectUser, "password">) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.name}!`,
        variant: "default",
      });
      setLocation('/dashboard');
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        // Try standard logout
        await apiRequest("POST", "/api/logout");
      } catch (error) {
        console.log('Standard logout failed, clearing cookies manually');
        // Clear all cookies as fallback
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
        variant: "default",
      });
      setLocation('/login');
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
      // Force logout anyway
      queryClient.setQueryData(["/api/user"], null);
      setLocation('/login');
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}