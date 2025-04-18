// Updated server/server-prod.ts with proper TypeScript types
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { registerRoutes } from './routes.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Configure CORS for production
app.use(cors({
  // Allow requests from your Netlify frontend domain or any origin during development
  origin: process.env.FRONTEND_URL || 'https://stockwell.netlify.app',
  credentials: true,
}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: 'production', 
    timestamp: new Date().toISOString() 
  });
});

// Register all routes
registerRoutes(app);

// Error handling middleware with proper types
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running in production mode on port ${PORT}`);
});

export default app;