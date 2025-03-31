import { QueryClient, QueryFunction } from "@tanstack/react-query";
import axios from 'axios';

// Define API URL based on environment
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? "https://stockwell.onrender.com/api" 
    : "/api");
    
console.log("API URL configured as:", API_URL);

// Create dedicated API client
const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add axios interceptors for debugging
apiClient.interceptors.request.use(
  config => {
    console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  error => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  response => {
    console.log(`Response: ${response.status} ${response.config.url}`);
    return response;
  },
  error => {
    if (error.response) {
      console.error(`Response error ${error.response.status}: ${error.response.data?.message || error.message}`);
    } else {
      console.error('Response error:', error.message);
    }
    return Promise.reject(error);
  }
);

// API functions
export const authAPI = {
  login: async (username: string, password: string) => {
    try {
      console.log(`Making POST request to ${API_URL}/login`);
      const response = await apiClient.post('/login', { username, password });
      return response.data;
    } catch (error) {
      console.log('Standard login failed, trying direct login');
      const directResponse = await apiClient.post('/direct-login', { username, password });
      return directResponse.data;
    }
  },
  
  logout: async () => {
    const response = await apiClient.post('/logout');
    return response.data;
  },
  
  getCurrentUser: async () => {
    try {
      const response = await apiClient.get('/user');
      return response.data;
    } catch (error) {
      console.log('Standard user endpoint failed, trying direct user');
      const directResponse = await apiClient.get('/direct-user');
      return directResponse.data.user;
    }
  }
};

// Helper to prefix API paths
function getFullUrl(path: string): string {
  // If the path already includes http(s), don't prefix it
  if (path.startsWith('http')) {
    return path;
  }
  
  // Make sure path starts with / for consistency
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // If path already starts with /api, don't add it again
  if (normalizedPath.startsWith('/api')) {
    return `${API_URL.replace('/api', '')}${normalizedPath}`;
  }
  
  return `${API_URL}${normalizedPath}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    console.error(`API Error: ${res.status} - ${text}`);
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Use the getFullUrl helper to ensure the URL is properly prefixed
  const fullUrl = getFullUrl(url);
  
  console.log(`Making ${method} request to ${fullUrl}`);
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  console.log(`Response status: ${res.status} ${res.statusText}`);
  
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const fullUrl = getFullUrl(queryKey[0] as string);
      console.log(`Query: Fetching ${fullUrl}`);
      
      const res = await fetch(fullUrl, {
        credentials: "include",
      });

      console.log(`Query response: ${res.status}`);
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log("Unauthorized request - returning null as configured");
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error("Query error:", error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Export the API client for direct usage
export { apiClient };