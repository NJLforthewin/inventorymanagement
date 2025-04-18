import { createContext, useContext, useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoginUser } from "@shared/schema";
import axios from "axios";

// Define environment variables
const API_URL = import.meta.env.VITE_API_URL || "";

// Create axios instance with token auth
const createApiInstance = (token?: string) => {
  return axios.create({
    baseURL: API_URL,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    }
  });
};

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
  token: string | null;
  loginMutation: any;
  logout: () => void;
  getAuthHeader: () => { Authorization: string } | {};
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const api = createApiInstance(token);
        const response = await api.get("/api/user");
        
        if (response.data) {
          setUser(response.data);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        // Clear invalid token
        localStorage.removeItem('auth_token');
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };
        
    checkAuth();
  }, [token]);
  
  // Login mutation with token auth
  const loginMutation = useMutation({
    mutationFn: async (loginData: LoginUser) => {
      const api = createApiInstance();
      const response = await api.post("/api/login", loginData);
      return response.data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
      setError(null);
      queryClient.invalidateQueries();
    },
    onError: (err: any) => {
      console.error("Login error:", err);
      setError(err.response?.data?.message || "Login failed");
    }
  });
  
  // Logout function
  const logout = async () => {
    try {
      if (token) {
        const api = createApiInstance(token);
        await api.post("/api/logout");
      }
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
      queryClient.clear();
    }
  };
  
  // Helper function to get auth header
  const getAuthHeader = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
  
  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      error, 
      token,
      loginMutation, 
      logout,
      getAuthHeader
    }}>
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