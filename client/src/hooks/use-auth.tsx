import { createContext, useContext, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoginUser } from "@shared/schema";
import axios from "axios";

// Define environment variables
const API_URL = import.meta.env.VITE_API_URL || "";

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Define User type
interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  department?: string;
  active: boolean;
}

// Define Auth Context
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  loginMutation: any;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        const response = await api.get("/api/user");
        
        if (response.data) {
          setUser(response.data);
          // Clear the expiration alert flag to ensure it shows on fresh login
          sessionStorage.removeItem('expirationAlertShown');
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
        
    checkAuth();
  }, []);
  
  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (loginData: LoginUser) => {
      const response = await api.post("/api/login", loginData);
      return response.data;
    },
    onSuccess: (data) => {
      setUser(data);
      setError(null);
      // Clear the expiration alert flag to ensure it shows on login
      sessionStorage.removeItem('expirationAlertShown');
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || "Login failed");
    }
  });
  
  // Logout function
  const logout = async () => {
    try {
      await api.post("/api/logout");
      setUser(null);
      // Clear the expiration alert flag when logging out
      sessionStorage.removeItem('expirationAlertShown');
      queryClient.clear();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };
  
  return (
    <AuthContext.Provider value={{ user, isLoading, error, loginMutation, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}