import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User } from "@shared/schema";
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

export function setupAuth(app: Express) {
  // CRITICAL: Force secure cookies in production
  const isProduction = process.env.NODE_ENV === 'production';
  console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'hospital-inventory-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      // Always use secure cookies in production with proper cross-domain settings
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    }
  };
  
  console.log('Session cookie settings:', sessionSettings.cookie);
  
  // Trust the first proxy (required for secure cookies in production)
  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`Attempting to authenticate user: ${username}`);
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          console.log(`User not found: ${username}`);
          return done(null, false, { message: "Invalid username or password" });
        }
        
        const passwordMatch = await comparePasswords(password, user.password);
        if (!passwordMatch) {
          console.log(`Invalid password for user: ${username}`);
          return done(null, false, { message: "Invalid username or password" });
        }
        
        // Update last login time
        await storage.updateUserLastLogin(user.id);
        console.log(`User authenticated successfully: ${username}`);
        
        return done(null, user);
      } catch (error) {
        console.error('Authentication error:', error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user: Express.User, done) => {
    console.log(`Serializing user: ${user.username} (ID: ${user.id})`);
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log(`Deserializing user ID: ${id}`);
      const user = await storage.getUser(id);
      if (!user) {
        console.log(`User not found for ID: ${id}`);
        return done(null, false);
      }
      console.log(`User deserialized: ${user.username}`);
      done(null, user);
    } catch (err) {
      console.error('Deserialization error:', err);
      done(err);
    }
  });

  // Add a route to check session
  app.get("/api/session-check", (req, res) => {
    console.log("Session check request received");
    console.log("Session ID:", req.sessionID);
    console.log("Is authenticated:", req.isAuthenticated());
    
    res.json({
      authenticated: req.isAuthenticated(),
      sessionID: req.sessionID,
      user: req.isAuthenticated() ? req.user!.username : null
    });
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log('Register attempt:', req.body.username);
      
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

      req.login(user, (err: any) => {
        if (err) return next(err);
        
        // Don't send the password to the client
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log('Login attempt:', req.body.username);
    
    passport.authenticate('local', (err: any, user: Express.User | false | null, info: { message?: string } | undefined) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }
      
      if (!user) {
        console.log('Login failed:', info?.message || "Invalid credentials");
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      req.login(user, (err: any) => {
        if (err) {
          console.error('Session creation error:', err);
          return next(err);
        }
        
        console.log('User logged in successfully:', user.username);
        console.log('Session ID:', req.sessionID);
        
        // Don't send the password to the client
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    console.log('Logout attempt');
    req.logout((err: any) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    console.log('User data requested');
    console.log('Is authenticated:', req.isAuthenticated());
    console.log('Session ID:', req.sessionID);
    
    if (!req.isAuthenticated()) {
      console.log('Unauthorized access attempt to /api/user');
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    console.log(`User data requested for: ${req.user!.username}`);
    // Don't send the password to the client
    const { password, ...userWithoutPassword } = req.user!;
    res.json(userWithoutPassword);
  });
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  console.log('Unauthorized access attempt');
  res.status(401).json({ message: "Unauthorized" });
}

// Middleware to check if user is admin OR staff
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && (req.user!.role === 'admin' || req.user!.role === 'staff')) {
    return next();
  }
  console.log('Forbidden access attempt - admin/staff required');
  res.status(403).json({ message: "Forbidden - Admin or Staff access required" });
}