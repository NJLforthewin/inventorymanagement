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

// Add health check endpoint FIRST so it's available immediately
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Add debug endpoint to check database connection
app.get("/api/debug/db-connection", (req, res) => {
  // Mask password in URL for security
  const dbUrl = process.env.DATABASE_URL || 'not set';
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
  
  res.json({
    database_url: maskedUrl,
    ssl_enabled: true,
    ssl_mode: 'with rejectUnauthorized: false',
    node_env: process.env.NODE_ENV || 'not set',
    timestamp: new Date().toISOString()
  });
});

// Add debug endpoint to test database connection directly
app.get("/api/debug/db-test", async (req, res) => {
  try {
    // Import the db module
    const { db } = await import('./db-postgres');
    
    // Use initDb directly
    const dbInitResult = await import('./db-postgres').then(module => module.initDb());
    
    res.json({
      success: true,
      message: "Database connection successful",
      init_result: dbInitResult,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // Cast the unknown error to Error type
    const error = err as Error & { code?: string };
    
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Add debug endpoint to create users
app.post("/api/direct-seed", async (req, res) => {
  try {
    console.log('Creating admin and staff users directly...');
    
    // Import necessary modules
    const { db } = await import('./db-postgres');
    const { hashPassword } = await import('./utils/password');
    const { sql } = await import('drizzle-orm');
    
    // Generate passwords
    const adminPassword = await hashPassword('admin123');
    const staffPassword = await hashPassword('staff123');
    
    // Insert admin user
    await db.execute(sql`
      INSERT INTO users (name, username, email, password, role, department, active, created_at)
      VALUES ('Admin User', 'admin', 'admin@hospital.org', ${adminPassword}, 'admin', 'Administration', true, NOW())
      ON CONFLICT (username) DO UPDATE SET password = ${adminPassword}
    `);
    
    // Insert staff user
    await db.execute(sql`
      INSERT INTO users (name, username, email, password, role, department, active, created_at)
      VALUES ('Staff User', 'staff', 'staff@hospital.org', ${staffPassword}, 'staff', 'Emergency', true, NOW())
      ON CONFLICT (username) DO UPDATE SET password = ${staffPassword}
    `);
    
    // Insert departments
    await db.execute(sql`
      INSERT INTO departments (name, description, created_at)
      VALUES 
        ('Emergency', 'Emergency department', NOW()),
        ('Surgery', 'Surgery department', NOW()),
        ('Pediatrics', 'Pediatrics department', NOW()),
        ('Cardiology', 'Cardiology department', NOW()),
        ('General', 'General department', NOW())
      ON CONFLICT (name) DO NOTHING
    `);
    
    // Verify users were created
    const userCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    
    res.status(200).json({
      success: true,
      message: "Users created successfully",
      userCount: userCount[0].count
    });
  } catch (err) {
    const error = err as Error;
    console.error('User creation error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create users",
      error: error.message
    });
  }
});

// Add a GET endpoint to verify users exist
app.get("/api/check-users", async (req, res) => {
  try {
    const { db } = await import('./db-postgres');
    const { sql } = await import('drizzle-orm');
    
    const users = await db.execute(sql`SELECT id, username, name, role FROM users`);
    
    res.status(200).json({
      success: true,
      userCount: users.length,
      users: users
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start the server FIRST, before database connection
const port = parseInt(process.env.PORT || "5000", 10);
const httpServer = app.listen(port, "0.0.0.0", () => {
  log(`API server started on port ${port}. Now connecting to database...`);
});

// THEN connect to database and register routes
(async () => {
  try {
    // Initialize database with a timeout
    const dbConnectPromise = initDb();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Database connection timeout")), 15000)
    );
    
    try {
      await Promise.race([dbConnectPromise, timeoutPromise]);
      log('Database connected successfully');
    } catch (err) {
      const error = err as Error;
      log(`WARNING: ${error.message}. Server will continue running with limited functionality.`);
    }
    
    // Register routes AFTER server is listening
    await registerRoutes(app);

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

    log(`API server fully initialized with routes`);
    log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    log(`Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
    log(`Session Secret: ${process.env.SESSION_SECRET ? 'Configured' : 'Using default'}`);
  } catch (error) {
    console.error('Server initialization error:', error);
  }
})();