import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import crypto from 'crypto';
import { storage } from "./storage";
import { comparePasswords, hashPassword } from "./utils/password";

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      password: string;
      name: string;
      email: string;
      role: 'admin' | 'staff';
      department: string | null;
      active: boolean | null;
      lastLogin: Date | null;
      createdAt: Date | null;
    }
  }
}

// A simple in-memory token store
const tokenStore: Record<string, number> = {};

export function setupAuth(app: Express) {
  // Simple token-based authentication
  app.use((req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token && tokenStore[token]) {
      const userId = tokenStore[token];
      
      // Get user from storage
      storage.getUser(userId)
        .then(user => {
          if (user) {
            // Attach user to request
            (req as any).user = user;
          }
          next();
        })
        .catch(err => {
          console.error('Error finding user by token:', err);
          next();
        });
    } else {
      next();
    }
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        // Update last login time
        await storage.updateUserLastLogin(user.id);
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      // Generate token
      const token = crypto.randomBytes(32).toString('hex');
      tokenStore[token] = user.id;
      
      // Don't send the password to the client
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ 
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("Login attempt for:", req.body.username);
    
    passport.authenticate('local', async (err: any, user: Express.User | false | null, info: { message?: string } | undefined) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      
      if (!user) {
        console.log("Login failed:", info?.message);
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      // Generate token
      const token = crypto.randomBytes(32).toString('hex');
      tokenStore[token] = user.id;
      
      console.log(`User ${user.username} logged in. Token: ${token.substring(0, 8)}...`);
      
      // Update last login time
      await storage.updateUserLastLogin(user.id);
      
      // Don't send the password to the client
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json({
        user: userWithoutPassword,
        token
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      delete tokenStore[token];
    }
    
    res.sendStatus(200);
  });

  app.get("/api/user", (req, res) => {
    if (!(req as any).user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Don't send the password to the client
    const { password, ...userWithoutPassword } = (req as any).user;
    res.json(userWithoutPassword);
  });
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  // This will work with our new token system
  if ((req as any).user) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}
// Middleware to check if user is admin with token auth
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as any).user && (req as any).user.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Admin access required" });
}