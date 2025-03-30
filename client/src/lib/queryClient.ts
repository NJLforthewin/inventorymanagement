import { QueryClient, QueryFunction } from "@tanstack/react-query";
import axios from 'axios';

axios.defaults.withCredentials = true; 
// Add this API_URL constant at the top of the file
const API_URL = import.meta.env.PROD 
  ? "https://stockwell.onrender.com/api"
  : "/api";

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
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Use the getFullUrl helper to ensure the URL is properly prefixed
    const fullUrl = getFullUrl(queryKey[0] as string);
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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