import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_BASE_URL } from "./config";
import axios from "axios";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Try to parse JSON error response
      const errorData = await res.json();
      throw new Error(`${res.status}: ${errorData.message || JSON.stringify(errorData)}`);
    } catch (e) {
      // If not JSON, use text
      const text = await res.text() || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Use relative URLs for local development, absolute URLs for production
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    mode: "cors"
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Use relative URLs for local development, absolute URLs for production
    const url = queryKey[0] as string;
    const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
    
    try {
      // Using axios instead of fetch for better cookie handling
      const response = await axios.get(fullUrl, {
        withCredentials: true
      });
      return response.data;
    } catch (error: any) {
      if (unauthorizedBehavior === "returnNull" && error.response?.status === 401) {
        return null;
      }
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