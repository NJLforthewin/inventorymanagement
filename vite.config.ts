import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to copy files after build
const copyHeadersAndRedirects = () => {
  return {
    name: 'copy-headers-redirects',
    closeBundle: async () => {
      const publicDir = path.resolve(__dirname, "dist/public");
      
      // Ensure the public directory exists
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      // Copy _headers
      const headersSource = path.resolve(__dirname, "client/public/_headers");
      const headersDest = path.resolve(publicDir, "_headers");
      
      if (fs.existsSync(headersSource)) {
        fs.copyFileSync(headersSource, headersDest);
        console.log('Copied _headers file to build output');
      } else {
        // Create _headers if it doesn't exist
        const headersContent = `/*
  Cache-Control: public, max-age=0, must-revalidate
/*.css
  Content-Type: text/css
/*.js
  Content-Type: application/javascript
/*.svg
  Content-Type: image/svg+xml`;
        
        fs.writeFileSync(headersDest, headersContent);
        console.log('Created _headers file in build output');
      }
      
      // Copy _redirects
      const redirectsSource = path.resolve(__dirname, "client/public/_redirects");
      const redirectsDest = path.resolve(publicDir, "_redirects");
      
      if (fs.existsSync(redirectsSource)) {
        fs.copyFileSync(redirectsSource, redirectsDest);
        console.log('Copied _redirects file to build output');
      } else {
        // Create _redirects if it doesn't exist
        fs.writeFileSync(redirectsDest, "/*    /index.html   200");
        console.log('Created _redirects file in build output');
      }
    }
  };
};

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
    copyHeadersAndRedirects(), // Add our custom plugin
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});