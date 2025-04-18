// config.ts
// Detect environment and set appropriate API base URL
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// API URL for production deployment on Render
const PRODUCTION_API_URL = 'https://stockwell-api.onrender.com';

// Use the environment variable if available, otherwise use the appropriate URL based on environment
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (isDevelopment ? "" : PRODUCTION_API_URL);