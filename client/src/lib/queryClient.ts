import { QueryClient, QueryFunction } from "@tanstack/react-query";
import axios from 'axios';

// Define API URL based on environment
const API_URL = import.meta.env.PROD 
  ? "https://stockwell.onrender.com/api"
  : "/api";

// Configure axios defaults for all requests
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Add axios interceptors for debugging
axios.interceptors.request.use(
  config => {
    console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  error => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
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
    
    // Special handling for 401 errors (unauthorized)
    if (error.response && error.response.status === 401) {
      console.log('Authentication error - user not logged in');
    }
    
    return Promise.reject(error);
  }
);

// Create dedicated API client
const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

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

  // For debugging
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
      // Use the getFullUrl helper to ensure the URL is properly prefixed
      const fullUrl = getFullUrl(queryKey[0] as string);
      console.log(`Query: Fetching ${fullUrl}`);
      
      const res = await fetch(fullUrl, {
        credentials: "include",
      });

      console.log(`Query response: ${res.status} ${res.statusText}`);
      
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