// Detect environment and set appropriate API base URL
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Use the environment variable if available, otherwise use the appropriate URL based on environment
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (isDevelopment ? "" : "https://stockwell.onrender.com");