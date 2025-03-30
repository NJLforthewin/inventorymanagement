import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from './db-postgres';  // Correct import
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple logging function
function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const app = express();

// Set trust proxy
app.set("trust proxy", 1);

// CORS middleware with expanded configuration
app.use(cors({
  origin: [
    "https://stockwell.netlify.app", 
    "http://localhost:3000", 
    "http://localhost:5000", 
    "http://localhost:5173"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware with enhanced debugging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  
  // Log request headers for debugging
  console.log(`${new Date().toISOString()} Request: ${req.method} ${req.path}`);
  console.log('Request headers:', {
    origin: req.headers.origin,
    referer: req.headers.referer,
    cookie: req.headers.cookie ? '[PRESENT]' : '[ABSENT]'
  });
  
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Ensure CORS headers are set correctly
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.headers.origin) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const respStr = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${respStr.length > 100 ? respStr.slice(0, 100) + '...' : respStr}`;
      }

      log(logLine);
      
      // Log response headers for debugging
      console.log('Response headers:', {
        'set-cookie': res.getHeader('set-cookie') ? '[PRESENT]' : '[ABSENT]',
        'access-control-allow-origin': res.getHeader('access-control-allow-origin'),
        'access-control-allow-credentials': res.getHeader('access-control-allow-credentials')
      });
    }
  });

  next();
});

(async () => {
  // Initialize database
  await initDb();
  
  const server = await registerRoutes(app);

  // Add health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ 
      status: "healthy",
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development'
    });
  });

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error(`Error [${status}]:`, err);
  });

  // API-only server - no static file serving in production
  app.use("*", (req, res) => {
    if (req.originalUrl.startsWith("/api")) {
      return res.status(404).json({ message: "API endpoint not found" });
    }
    
    res.status(200).json({ 
      message: "Stock Well API Server", 
      status: "running",
      environment: process.env.NODE_ENV || 'development',
      frontend: "https://stockwell.netlify.app"
    });
  });

  const port = process.env.PORT || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`API server running on port ${port} with PostgreSQL database`);
    log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    log(`Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
    log(`Session Secret: ${process.env.SESSION_SECRET ? 'Configured' : 'Using default'}`);
  });
})();