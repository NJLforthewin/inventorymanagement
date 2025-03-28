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
  insertUserSchema
} from "@shared/schema";
import { ZodError, z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Log requests to /api routes
  app.use('/api', (req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  // API routes
  
  // Dashboard stats
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
  
  // Department routes
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
      
      // Create audit log
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
      
      // Create audit log
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
        // Create audit log
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
  
  // Category routes
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
      
      // Create audit log
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
      
      // Hash the password before storing
      const user = await storage.createUser({
        ...validatedData,
        password: await hashPassword(validatedData.password)
      });
      
      // Create audit log
      await storage.createAuditLog({
        userId: req.user!.id,
        activityType: "created",
        details: `Created user: ${user.username} (${user.role})`
      });
      
      // Don't send the password back
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      handleZodError(error, req, res, next);
    }
  });
  
  app.put("/api/users/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      // Parse the data using z.object to validate only the fields we want to update
      const updateUserSchema = z.object({
        name: z.string().optional(),
        username: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(['admin', 'staff']).optional(),
        department: z.string().nullable().optional(),
        active: z.boolean().optional()
      });
      const userData = updateUserSchema.parse(req.body);
      
      if (userData.username) {
        const existingUser = await storage.getUserByUsername(userData.username);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }
      
      if (userData.email) {
        const existingEmail = await storage.getUserByEmail(userData.email);
        if (existingEmail && existingEmail.id !== id) {
          return res.status(400).json({ message: "Email already exists" });
        }
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
      
      // Don't send the password back
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      handleZodError(error, req, res, next);
    }
  });
  
  app.put("/api/users/:id/toggle-active", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Prevent deactivating yourself
      if (id === req.user!.id) {
        return res.status(400).json({ message: "Cannot deactivate your own account" });
      }
      
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
      
      // Don't send the password back
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });
  
  // Audit log routes (admin only)
  app.get("/api/audit-logs", isAdmin, async (req, res, next) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const filters: any = {};
      
      if (req.query.userId) filters.userId = parseInt(req.query.userId as string);
      if (req.query.itemId) filters.itemId = parseInt(req.query.itemId as string);
      if (req.query.activityType) filters.activityType = req.query.activityType;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      
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
  
  // SQL Server connection test endpoint
  app.get("/api/sql-connection-test", isAdmin, async (req, res, next) => {
    try {
      const isConnected = await testSqlConnection();
      if (isConnected) {
        res.json({ 
          status: "success", 
          message: "Successfully connected to SQL Server"
        });
      } else {
        res.status(500).json({ 
          status: "error", 
          message: "Failed to connect to SQL Server"
        });
      }
    } catch (error) {
      console.error("SQL Server connection test error:", error);
      res.status(500).json({ 
        status: "error", 
        message: "An error occurred while testing the SQL Server connection",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // SQL Server query execution endpoint
  app.post("/api/sql-query", isAdmin, async (req, res, next) => {
    try {
      const { query, params } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
          status: "error", 
          message: "Query is required and must be a string" 
        });
      }
      
      // Execute the query
      const result = await executeSqlQuery(query, params);
      res.json({ 
        status: "success", 
        data: result 
      });
    } catch (error) {
      console.error("SQL query execution error:", error);
      res.status(500).json({ 
        status: "error", 
        message: "An error occurred while executing the SQL query",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  console.log("Creating HTTP server...");
  const httpServer = createServer(app);
  console.log("HTTP server created successfully");
  return httpServer;
}
