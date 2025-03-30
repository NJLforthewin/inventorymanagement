import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import { testSqlConnection, executeSqlQuery } from "./db";
import { 
  insertDepartmentSchema, 
  insertCategorySchema, 
  insertInventoryItemSchema,
  updateInventoryItemSchema,
  insertAuditLogSchema,
  insertUserSchema,
  users,
  departments,
  categories
} from "@shared/schema";
import { sql } from "drizzle-orm";
import { ZodError, z } from "zod";
import { fromZodError } from "zod-validation-error";
import { db } from './db-postgres';  // Add this import

export async function registerRoutes(app: Express): Promise<Server> {
  // Debug endpoint to check database status
  app.get("/api/debug/db-status", async (req, res) => {
    try {
      // Check database connection
      console.log('Database URL:', process.env.DATABASE_URL ? '[CONFIGURED]' : '[NOT CONFIGURED]');
      
      // Try to query the users table
      const { users, total } = await storage.getUsers(1, 10);
      console.log(`Found ${total} users in database`);
      
      // Check if tables exist by trying to query them
      const departments = await storage.getDepartments();
      console.log(`Found ${departments.length} departments in database`);
      
      // Return status
      res.status(200).json({
        databaseConnected: true,
        usersCount: total,
        departmentsCount: departments.length,
        seedingNeeded: total === 0 || departments.length === 0
      });
    } catch (error: any) {
      console.error('Database check error:', error);
      res.status(500).json({
        databaseConnected: false,
        error: error.message || String(error)
      });
    }
  });

  // Debug endpoint to force database seeding
  app.post("/api/debug/force-seed", async (req, res) => {
    try {
      console.log('Force seeding database...');
      
      // Import necessary functions
      const { hashPassword } = await import('./utils/password');
      
      // Create admin user
      const adminPassword = await hashPassword('admin123');
      const staffPassword = await hashPassword('staff123');
      
      // Use direct SQL approach with db.execute
      
      // Insert users
      await db.execute(sql`
        INSERT INTO users (name, username, email, password, role, department, active, created_at)
        VALUES ('Admin User', 'admin', 'admin@hospital.org', ${adminPassword}, 'admin', 'Administration', true, NOW())
        ON CONFLICT (username) DO NOTHING
      `);
      
      await db.execute(sql`
        INSERT INTO users (name, username, email, password, role, department, active, created_at)
        VALUES ('Staff User', 'staff', 'staff@hospital.org', ${staffPassword}, 'staff', 'Emergency', true, NOW())
        ON CONFLICT (username) DO NOTHING
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
      
      // Insert categories
      await db.execute(sql`
        INSERT INTO categories (name, description, created_at)
        VALUES 
          ('PPE', 'Personal Protective Equipment', NOW()),
          ('Pharmaceuticals', 'Medicines and drugs', NOW()),
          ('Equipment', 'Medical equipment', NOW()),
          ('Supplies', 'General medical supplies', NOW())
        ON CONFLICT (name) DO NOTHING
      `);
      
      // Check if it worked
      const usersResult = await db.select({ count: sql`count(*)` }).from(users);
      const departmentsResult = await db.select({ count: sql`count(*)` }).from(departments);
      
      res.status(200).json({
        success: true,
        usersCount: Number(usersResult[0]?.count || 0),
        departmentsCount: Number(departmentsResult[0]?.count || 0)
      });
    } catch (error: any) {
      console.error('Force seed error:', error);
      res.status(500).json({
        success: false,
        error: error.message || String(error)
      });
    }
  });

  // Add a basic seeding endpoint that doesn't rely on the storage implementation
  app.post("/api/debug/manual-seed", async (req, res) => {
    try {
      console.log('Manual seeding initiated...');
      
      // Import the hashPassword function
      const { hashPassword } = await import('./utils/password');
      
      // Create admin user
      const adminPassword = await hashPassword('admin123');
      const staffPassword = await hashPassword('staff123');
      
      // Use db.execute with sql`` instead of db.insert
      await db.execute(sql`
        INSERT INTO users (name, username, email, password, role, department, active, created_at)
        VALUES ('Admin User', 'admin', 'admin@hospital.org', ${adminPassword}, 'admin', 'Administration', true, NOW())
        ON CONFLICT (username) DO NOTHING
      `);
      
      await db.execute(sql`
        INSERT INTO users (name, username, email, password, role, department, active, created_at)
        VALUES ('Staff User', 'staff', 'staff@hospital.org', ${staffPassword}, 'staff', 'Emergency', true, NOW())
        ON CONFLICT (username) DO NOTHING
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
      
      // Insert categories
      await db.execute(sql`
        INSERT INTO categories (name, description, created_at)
        VALUES 
          ('PPE', 'Personal Protective Equipment', NOW()),
          ('Pharmaceuticals', 'Medicines and drugs', NOW()),
          ('Equipment', 'Medical equipment', NOW()),
          ('Supplies', 'General medical supplies', NOW())
        ON CONFLICT (name) DO NOTHING
      `);
      
      // Check if it worked using sql count
      const usersResult = await db.select({ count: sql`count(*)` }).from(users);
      const departmentsResult = await db.select({ count: sql`count(*)` }).from(departments);
      
      res.status(200).json({
        success: true,
        usersCount: Number(usersResult[0]?.count || 0),
        departmentsCount: Number(departmentsResult[0]?.count || 0)
      });
    } catch (error: any) {
      console.error('Manual seed error:', error);
      res.status(500).json({
        success: false,
        error: error.message || String(error)
      });
    }
  });

  // Setup authentication
  setupAuth(app);

  // Error handling middleware for Zod validation errors
  const handleZodError = (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ZodError) {
      const validationError = fromZodError(err);
      return res.status(400).json({ 
        message: "Validation error", 
        errors: validationError.details 
      });
    }
    next(err);
  };
  
  app.post("/api/debug/create-tables", async (req, res) => {
    try {
      console.log('Creating database tables...');
      
      // Create users table
      await executeSqlQuery(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          department TEXT,
          active BOOLEAN DEFAULT true,
          last_login TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create departments table
      await executeSqlQuery(`
        CREATE TABLE IF NOT EXISTS departments (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Create categories table
      await executeSqlQuery(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      // Check if it worked
      const tables = await executeSqlQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema='public'
      `);
      
      
      res.status(200).json({
        success: true,
        tables: Array.isArray(tables) ? tables.map(t => t.table_name) : tables
      });
    } catch (error: any) {
      console.error('Create tables error:', error);
      res.status(500).json({
        success: false,
        error: error.message || String(error)
      });
    }
  });

  app.get("/api/debug/check-tables", async (req, res) => {
    try {
      // Try to query if tables exist
      const results = await executeSqlQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema='public'
      `);
      const userTableExists = Array.isArray(results) 
         ? results.some(r => r.table_name === 'users')
          : false;

    } catch (error: any) {
      console.error('Table check error:', error);
      res.status(500).json({
        success: false,
        error: error.message || String(error)
      });
    }
  });


  app.use('/api', (req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res, next) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/dashboard/activity", isAuthenticated, async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const activity = await storage.getRecentActivity(limit);
      res.json(activity);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/dashboard/low-stock", isAuthenticated, async (req, res, next) => {
    try {
      const items = await storage.getLowStockItems();
      res.json(items);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/departments", isAuthenticated, async (req, res, next) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/departments/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const department = await storage.getDepartment(id);
      
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      res.json(department);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/departments", isAdmin, async (req, res, next) => {
    try {
      const validatedData = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(validatedData);
      
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: "created",
        details: `Created department: ${department.name}`
      });
      
      res.status(201).json(department);
    } catch (error) {
      handleZodError(error, req, res, next);
    }
  });
  
  app.put("/api/departments/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertDepartmentSchema.partial().parse(req.body);
      
      const department = await storage.updateDepartment(id, validatedData);
      
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: "updated",
        details: `Updated department: ${department.name}`
      });
      
      res.json(department);
    } catch (error) {
      handleZodError(error, req, res, next);
    }
  });
  
  app.delete("/api/departments/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const department = await storage.getDepartment(id);
      
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      const deleted = await storage.deleteDepartment(id);
      
      if (deleted) {
        await storage.createAuditLog({
          userId: req.user!.id,
          activityType: "deleted",
          details: `Deleted department: ${department.name}`
        });
      }
      
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/categories", isAuthenticated, async (req, res, next) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/categories/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/categories", isAdmin, async (req, res, next) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: "created",
        details: `Created category: ${category.name}`
      });
      
      res.status(201).json(category);
    } catch (error) {
      handleZodError(error, req, res, next);
    }
  });
  
  app.put("/api/categories/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCategorySchema.partial().parse(req.body);
      
      const category = await storage.updateCategory(id, validatedData);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: "updated",
        details: `Updated category: ${category.name}`
      });
      
      res.json(category);
    } catch (error) {
      handleZodError(error, req, res, next);
    }
  });
  
  app.delete("/api/categories/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      const deleted = await storage.deleteCategory(id);
      
      if (deleted) {
        // Create audit log
        await storage.createAuditLog({
          userId: req.user!.id,
          activityType: "deleted",
          details: `Deleted category: ${category.name}`
        });
      }
      
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  
  // Inventory routes
  app.get("/api/inventory", isAuthenticated, async (req, res, next) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const filters: any = {};
      
      if (req.query.status) filters.status = req.query.status;
      if (req.query.departmentId) filters.departmentId = parseInt(req.query.departmentId as string);
      if (req.query.categoryId) filters.categoryId = parseInt(req.query.categoryId as string);
      if (req.query.search) filters.search = req.query.search;
      
      const { items, total } = await storage.getInventoryItems(page, limit, filters);
      
      res.json({
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/inventory/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getInventoryItem(id);
      
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      
      res.json(item);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/inventory", isAuthenticated, async (req, res, next) => {
    try {
      const validatedData = insertInventoryItemSchema.parse(req.body);
      const item = await storage.createInventoryItem(validatedData);
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: "created",
        itemId: item.id,
        details: `Created inventory item: ${item.name}`
      });
      
      res.status(201).json(item);
    } catch (error) {
      handleZodError(error, req, res, next);
    }
  });
  
  app.put("/api/inventory/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = updateInventoryItemSchema.parse(req.body);
      
      const item = await storage.updateInventoryItem(id, validatedData);
      
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: "updated",
        itemId: item.id,
        details: `Updated inventory item: ${item.name}`
      });
      
      res.json(item);
    } catch (error) {
      handleZodError(error, req, res, next);
    }
  });
  
  app.post("/api/inventory/:id/stock", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const { quantity } = req.body;
      
      if (typeof quantity !== 'number') {
        return res.status(400).json({ message: "Quantity must be a number" });
      }
      
      const item = await storage.updateInventoryStock(id, quantity);
      
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      
      // Create audit log
      const activityType = quantity > 0 ? "stock_added" : "stock_removed";
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: activityType as any,
        itemId: item.id,
        details: `${quantity > 0 ? 'Added' : 'Removed'} ${Math.abs(quantity)} ${item.unit} of ${item.name}`
      });
      
      res.json(item);
    } catch (error) {
      next(error);
    }
  });
  
  app.delete("/api/inventory/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getInventoryItem(id);
      
      if (!item) {
        return res.status(404).json({ message: "Inventory item not found" });
      }
      
      const deleted = await storage.deleteInventoryItem(id);
      
      if (deleted) {
        // Create audit log
        await storage.createAuditLog({
          userId: req.user!.id,
          activityType: "deleted",
          details: `Deleted inventory item: ${item.name}`
        });
      }
      
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  
  // User routes (admin only)
  app.get("/api/users", isAdmin, async (req, res, next) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const { users, total } = await storage.getUsers(page, limit);
      
      // Don't send passwords
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json({
        users: usersWithoutPasswords,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/users", isAdmin, async (req, res, next) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Import the hashPassword function
      const { hashPassword } = await import('./utils/password');
      
      const user = await storage.createUser({
        ...validatedData,
        password: await hashPassword(validatedData.password),
      });
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: "created",
        details: `Created user: ${user.username}`
      });
      
      // Don't send the password to the client
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      handleZodError(error, req, res, next);
    }
  });
  
  app.get("/api/users/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't send the password to the client
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });
  
  app.put("/api/users/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Use a simpler approach - directly parse without trying to use partial()
      const userData = req.body;
      
      // If password is being updated, hash it
      if (userData.password) {
        // Import the hashPassword function
        const { hashPassword } = await import('./utils/password');
        
        userData.password = await hashPassword(userData.password);
      }
      
      // Delete confirmPassword if present
      if ('confirmPassword' in userData) {
        delete userData.confirmPassword;
      }
      
      const user = await storage.updateUser(id, userData);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: "updated",
        details: `Updated user: ${user.username}`
      });
      
      // Don't send the password to the client
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/users/:id/toggle-active", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      const user = await storage.toggleUserActive(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: "updated",
        details: `${user.active ? 'Activated' : 'Deactivated'} user: ${user.username}`
      });
      
      // Don't send the password to the client
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });
  
  // Audit logs (admin only)
  app.get("/api/audit-logs", isAdmin, async (req, res, next) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const filters: any = {};
      
      if (req.query.userId) filters.userId = parseInt(req.query.userId as string);
      if (req.query.itemId) filters.itemId = parseInt(req.query.itemId as string);
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      if (req.query.activityType) filters.activityType = req.query.activityType;
      
      const { logs, total } = await storage.getAuditLogs(page, limit, filters);
      
      res.json({
        logs,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Create server
  const server = createServer(app);
  
  return server;
}