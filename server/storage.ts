import { 
  users, departments, categories, inventoryItems, auditLogs,
  type User, type InsertUser, type Department, type InsertDepartment,
  type Category, type InsertCategory, type InventoryItem, type InsertInventoryItem,
  type UpdateInventoryItem, type AuditLog, type InsertAuditLog
} from "@shared/schema";
import { eq, and, like, gte, lte, desc, inArray, lt, gt, isNotNull, asc, or, count } 
from "drizzle-orm";import { db, executeSqlQuery } from "./db";
import session from "express-session";
import createMemoryStore from "memorystore";
import * as mssql from 'mssql';
import connectPg from "connect-pg-simple";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Interface for storage operations
export interface IStorage {
  // Session store
  sessionStore: session.Store;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  updateUserLastLogin(id: number): Promise<void>;
  getUsers(page?: number, limit?: number): Promise<{ users: User[], total: number }>;
  toggleUserActive(id: number): Promise<User | undefined>;
  
  // Department operations
  getDepartment(id: number): Promise<Department | undefined>;
  getDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, department: Partial<Department>): Promise<Department | undefined>;
  deleteDepartment(id: number): Promise<boolean>;
  
  // Category operations
  getCategory(id: number): Promise<Category | undefined>;
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<Category>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  
  // Inventory operations
  getInventoryItem(id: number): Promise<InventoryItem | undefined>;
  getInventoryItems(
    page?: number, 
    limit?: number,
    filters?: {
      status?: string;
      departmentId?: number;
      categoryId?: number;
      search?: string;
    }
  ): Promise<{ items: InventoryItem[], total: number }>;
  getOutOfStockItems(): Promise<InventoryItem[]>;
  getLowStockItems(): Promise<InventoryItem[]>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, item: UpdateInventoryItem): Promise<InventoryItem | undefined>;
  updateInventoryStock(id: number, quantity: number): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: number): Promise<boolean>;
  getSoonToExpireItems(): Promise<InventoryItem[]>;
  getCriticalExpirationItems(): Promise<InventoryItem[]>;
  
  // Audit log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(
    page?: number, 
    limit?: number,
    filters?: {
      userId?: number;
      itemId?: number;
      startDate?: Date;
      endDate?: Date;
      activityType?: string;
    }
  ): Promise<{ logs: AuditLog[], total: number }>;
  
  // Dashboard statistics
  getDashboardStats(): Promise<{
    totalItems: number;
    lowStockCount: number;
    recentlyAdded: number;
    outOfStock: number;
    expiringSoon: number;
  }>;
  
  // Recent activity
  getRecentActivity(limit?: number): Promise<AuditLog[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Use PostgreSQL session store if DATABASE_URL is available, otherwise use memory store
    if (process.env.DATABASE_URL) {
      try {
        const pool = require('pg').Pool;
        this.sessionStore = new PostgresSessionStore({
          pool: new pool({
            host: process.env.PGHOST || 'localhost',
            port: 6000,
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || 'postgres',
            database: process.env.PGDATABASE || 'postgres',
            ssl: false
          }),
          createTableIfMissing: true
        });
        console.log("Using PostgreSQL session store");
      } catch (error) {
        console.error("Failed to initialize PostgreSQL session store:", error);
        this.sessionStore = new MemoryStore({
          checkPeriod: 86400000, // prune expired entries every 24h
        });
        console.log("Falling back to memory session store");
      }
    } else {
      this.sessionStore = new MemoryStore({
        checkPeriod: 86400000, // prune expired entries every 24h
      });
      console.log("Using memory session store");
    }
    
    // Initialize with default admin user if needed
    this.initializeDefaultAdmin();
  }
  
  private async initializeDefaultAdmin() {
    try {
      // Check if admin user exists
      const adminUser = await this.getUserByUsername('admin');
      
      if (!adminUser) {
        console.log('Creating default admin user...');
        // Import the hashPassword function from utils/password
        const { hashPassword } = await import('./utils/password');
        
        // Create admin user
        await this.createUser({
          name: "Admin User",
          username: "admin",
          email: "admin@hospital.org",
          password: await hashPassword("admin123"),
          role: "admin",
          department: "Administration",
          active: true,
          confirmPassword: "admin123"
        });
        console.log('Default admin user created successfully');
      }
    } catch (error) {
      console.error('Error initializing default admin:', error);
    }
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      throw error;
    }
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error("Error getting user by username:", error);
      throw error;
    }
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error("Error getting user by email:", error);
      throw error;
    }
  }
  
  async createUser(user: InsertUser): Promise<User> {
    try {
      const [createdUser] = await db.insert(users).values(user).returning();
      return createdUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    try {
      const [updatedUser] = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }
  
  async updateUserLastLogin(id: number): Promise<void> {
    try {
      await db
        .update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, id));
    } catch (error) {
      console.error("Error updating user last login:", error);
      throw error;
    }
  }
  
  async getUsers(page = 1, limit = 10): Promise<{ users: User[], total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      const usersResult = await db
        .select()
        .from(users)
        .limit(limit)
        .offset(offset);
      
      const [{ count }] = await db
        .select({ count: db.fn.count() })
        .from(users);
        
      return {
        users: usersResult,
        total: Number(count)
      };
    } catch (error) {
      console.error("Error getting users:", error);
      throw error;
    }
  }
  
  async toggleUserActive(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      if (!user) return undefined;
      
      const [updatedUser] = await db
        .update(users)
        .set({ active: !user.active })
        .where(eq(users.id, id))
        .returning();
        
      return updatedUser;
    } catch (error) {
      console.error("Error toggling user active status:", error);
      throw error;
    }
  }
  
  // Department operations
  async getDepartment(id: number): Promise<Department | undefined> {
    try {
      const [department] = await db.select().from(departments).where(eq(departments.id, id));
      return department;
    } catch (error) {
      console.error("Error getting department:", error);
      throw error;
    }
  }
  
  async getDepartments(): Promise<Department[]> {
    try {
      return await db.select().from(departments);
    } catch (error) {
      console.error("Error getting departments:", error);
      throw error;
    }
  }
  
  async createDepartment(department: InsertDepartment): Promise<Department> {
    try {
      const [createdDepartment] = await db.insert(departments).values(department).returning();
      return createdDepartment;
    } catch (error) {
      console.error("Error creating department:", error);
      throw error;
    }
  }
  
  async updateDepartment(id: number, departmentData: Partial<Department>): Promise<Department | undefined> {
    try {
      const [updatedDepartment] = await db
        .update(departments)
        .set(departmentData)
        .where(eq(departments.id, id))
        .returning();
      return updatedDepartment;
    } catch (error) {
      console.error("Error updating department:", error);
      throw error;
    }
  }
  
  async deleteDepartment(id: number): Promise<boolean> {
    try {
      const result = await db.delete(departments).where(eq(departments.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting department:", error);
      throw error;
    }
  }
  
  // Category operations
  async getCategory(id: number): Promise<Category | undefined> {
    try {
      const [category] = await db.select().from(categories).where(eq(categories.id, id));
      return category;
    } catch (error) {
      console.error("Error getting category:", error);
      throw error;
    }
  }
  
  async getCategories(): Promise<Category[]> {
    try {
      return await db.select().from(categories);
    } catch (error) {
      console.error("Error getting categories:", error);
      throw error;
    }
  }
  
  async createCategory(category: InsertCategory): Promise<Category> {
    try {
      const [createdCategory] = await db.insert(categories).values(category).returning();
      return createdCategory;
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  }
  
  async updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined> {
    try {
      const [updatedCategory] = await db
        .update(categories)
        .set(categoryData)
        .where(eq(categories.id, id))
        .returning();
      return updatedCategory;
    } catch (error) {
      console.error("Error updating category:", error);
      throw error;
    }
  }

  async getCriticalExpirationItems(): Promise<InventoryItem[]> {
    const today = new Date();
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(today.getDate() + 14); // 2 weeks
    
    const items = await db.select()
      .from(inventoryItems)
      .where(
        and(
          isNotNull(inventoryItems.expirationDate),
          gt(inventoryItems.expirationDate, today),
          lte(inventoryItems.expirationDate, twoWeeksFromNow)
        )
      )
      .orderBy(inventoryItems.expirationDate);
    
    return items;
  }
  
  async deleteCategory(id: number): Promise<boolean> {
    try {
      await db.delete(categories).where(eq(categories.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  }
  
  // Inventory operations
  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    try {
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
      return item;
    } catch (error) {
      console.error("Error getting inventory item:", error);
      throw error;
    }
  }
  
  async getInventoryItems(
    page = 1, 
    limit = 10,
    filters?: {
      status?: string;
      departmentId?: number;
      categoryId?: number;
      search?: string;
    }
  ): Promise<{ items: InventoryItem[], total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      // Using a base query with proper type handling
      let query = db.select().from(inventoryItems);
      
      // Create a function to handle filter conditions
      const applyFilters = (baseQuery: any) => {
        let filteredQuery = baseQuery;
        
        if (filters) {
          if (filters.status) {
            filteredQuery = filteredQuery.where(eq(inventoryItems.status, filters.status as any));
          }
          
          if (filters.departmentId) {
            filteredQuery = filteredQuery.where(eq(inventoryItems.departmentId, filters.departmentId));
          }
          
          if (filters.categoryId) {
            filteredQuery = filteredQuery.where(eq(inventoryItems.categoryId, filters.categoryId));
          }
          
          if (filters.search) {
            filteredQuery = filteredQuery.where(
              like(inventoryItems.name, `%${filters.search}%`)
            );
          }
        }
        
        return filteredQuery;
      };
      
      // Apply filters to the query
      const filteredQuery = applyFilters(query);
      const items = await filteredQuery.limit(limit).offset(offset);
      
      // Build count query with same filters
      let countQuery = db.select({ count: db.fn.count() }).from(inventoryItems);
      const filteredCountQuery = applyFilters(countQuery);
      
      const [{ count }] = await filteredCountQuery;
      
      return {
        items,
        total: Number(count)
      };
    } catch (error) {
      console.error("Error getting inventory items:", error);
      throw error;
    }
  }
  
  async getLowStockItems(): Promise<InventoryItem[]> {
    try {
      const items = await db
        .select()
        .from(inventoryItems)
        .where(
          and(
            lt(inventoryItems.currentStock, inventoryItems.threshold),
            gt(inventoryItems.currentStock, 0) // This excludes items with 0 quantity
          )
        )
        .orderBy(desc(inventoryItems.updatedAt))
        .limit(5);
      
      return items;
    } catch (error) {
      console.error("Error getting low stock items:", error);
      throw error;
    }
  }

// For DatabaseStorage class
async getOutOfStockItems(): Promise<InventoryItem[]> {
  try {
    // Use currentStock instead of quantity
    const items = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.currentStock, 0))
      .orderBy(desc(inventoryItems.updatedAt))
      .limit(5);
    
    return items;
  } catch (error) {
    console.error("Error getting out of stock items:", error);
    throw error;
  }
}
  

async getSoonToExpireItems(): Promise<InventoryItem[]> {
  try {
    // Get items expiring in the next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const today = new Date();
    
    const items = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          isNotNull(inventoryItems.expirationDate),
          lte(inventoryItems.expirationDate, thirtyDaysFromNow),
          gt(inventoryItems.expirationDate, today)
        )
      )
      .orderBy(asc(inventoryItems.expirationDate))
      .limit(5);
    
    return items;
  } catch (error) {
    console.error("Error getting soon to expire items:", error);
    throw error;
  }
}

// Method to create an inventory item
async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
  try {
    // Determine status based on quantity and threshold
    // Fix: Use item, not itemData (variable name mismatch)
    const currentStock = item.currentStock ?? 0; // Use nullish coalescing
    const threshold = item.threshold ?? 10; // Use nullish coalescing
    
    const status = currentStock === 0 
      ? 'out_of_stock' 
      : currentStock <= threshold 
        ? 'low_stock' 
        : 'in_stock';
    
    // Convert expirationDate string to Date object if it exists
    let expirationDate = null; // Use null as default
    if (item.expirationDate && item.expirationDate.trim() !== '') {
      expirationDate = new Date(item.expirationDate);
    }
    
    // Create the item
    const [createdItem] = await db.insert(inventoryItems).values({
      itemId: item.itemId,
      name: item.name,
      description: item.description || null,
      departmentId: item.departmentId,
      categoryId: item.categoryId,
      currentStock: currentStock,
      unit: item.unit,
      threshold: threshold,
      status: status,
      expirationDate: expirationDate
    }).returning();
    
    return createdItem;
  } catch (error) {
    console.error("Error creating inventory item:", error);
    throw error;
  }
}

// Method to update an inventory item
async updateInventoryItem(id: number, item: UpdateInventoryItem): Promise<InventoryItem | undefined> {
  try {
    // Prepare update data
    const updateData: any = { ...item, updatedAt: new Date() };
    
    // Handle status if currentStock is provided
    if (typeof item.currentStock !== 'undefined' && typeof item.threshold !== 'undefined') {
      updateData.status = item.currentStock === 0 
        ? 'out_of_stock' 
        : (item.currentStock < item.threshold ? 'low_stock' : 'in_stock');
    } else if (typeof item.currentStock !== 'undefined') {
      // Get the current item to check threshold
      const currentItem = await this.getInventoryItem(id);
      if (currentItem) {
        updateData.status = item.currentStock === 0 
          ? 'out_of_stock' 
          : (item.currentStock < currentItem.threshold ? 'low_stock' : 'in_stock');
      }
    }
    
    // Handle expirationDate conversion
    if (typeof item.expirationDate === 'string') {
      if (item.expirationDate.trim() === '') {
        updateData.expirationDate = null;
      } else {
        updateData.expirationDate = new Date(item.expirationDate);
      }
    }
    
    // Update the item
    const [updatedItem] = await db
      .update(inventoryItems)
      .set(updateData)
      .where(eq(inventoryItems.id, id))
      .returning();
      
    return updatedItem;
  } catch (error) {
    console.error("Error updating inventory item:", error);
    throw error;
  }
}
  async updateInventoryStock(id: number, quantity: number): Promise<InventoryItem | undefined> {
    try {
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
      if (!item) return undefined;
      
      const newStock = item.currentStock + quantity;
      if (newStock < 0) throw new Error("Cannot reduce stock below zero");
      
      // Determine new status
      const newStatus = newStock === 0 
        ? 'out_of_stock' 
        : newStock <= item.threshold 
          ? 'low_stock' 
          : 'in_stock';
      
      const [updatedItem] = await db
        .update(inventoryItems)
        .set({ 
          currentStock: newStock, 
          status: newStatus as any, 
          updatedAt: new Date() 
        })
        .where(eq(inventoryItems.id, id))
        .returning();
      
      return updatedItem;
    } catch (error) {
      console.error("Error updating inventory stock:", error);
      throw error;
    }
  }
  
  async deleteInventoryItem(id: number): Promise<boolean> {
    try {
      await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      throw error;
    }
  }
  
  // Audit log operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    try {
      const [createdLog] = await db.insert(auditLogs).values(log).returning();
      return createdLog;
    } catch (error) {
      console.error("Error creating audit log:", error);
      throw error;
    }
  }
  
  async getAuditLogs(
    page = 1, 
    limit = 10,
    filters?: {
      userId?: number;
      itemId?: number;
      startDate?: Date;
      endDate?: Date;
      activityType?: string;
    }
  ): Promise<{ logs: AuditLog[], total: number }> {
    try {
      const offset = (page - 1) * limit;
      
      // Using a base query with proper type handling
      let baseQuery = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
      
      // Create a function to handle filter conditions
      const applyFilters = (query: any) => {
        let filteredQuery = query;
        
        if (filters) {
          if (filters.userId) {
            filteredQuery = filteredQuery.where(eq(auditLogs.userId, filters.userId));
          }
          
          if (filters.itemId) {
            filteredQuery = filteredQuery.where(eq(auditLogs.itemId, filters.itemId));
          }
          
          if (filters.activityType) {
            filteredQuery = filteredQuery.where(eq(auditLogs.activityType, filters.activityType as any));
          }
          
          if (filters.startDate) {
            filteredQuery = filteredQuery.where(gte(auditLogs.createdAt, filters.startDate!)); // Non-null assertion
          }
          
          if (filters.endDate) {
            filteredQuery = filteredQuery.where(lte(auditLogs.createdAt, filters.endDate!)); // Non-null assertion
          }
        }
        
        return filteredQuery;
      };
      
      // Apply filters to the main query
      const filteredQuery = applyFilters(baseQuery);
      const logs = await filteredQuery.limit(limit).offset(offset);
      
      // Build count query with same filters
      let countQuery = db.select({ count: db.fn.count() }).from(auditLogs);
      const filteredCountQuery = applyFilters(countQuery);
      
      const [{ count }] = await filteredCountQuery;
      
      return {
        logs,
        total: Number(count)
      };
    } catch (error) {
      console.error("Error getting audit logs:", error);
      throw error;
    }
  }
  
  // Dashboard statistics
  async getDashboardStats(): Promise<{
    totalItems: number;
    lowStockCount: number;
    recentlyAdded: number;
    outOfStock: number;
    expiringSoon: number;
  }> {
    try {
      // Get total items count
      const [{ count: totalItems }] = await db
        .select({ count: count() })
        .from(inventoryItems);
      
      // Get low stock count
      const [{ count: lowStockCount }] = await db
        .select({ count: count() })
        .from(inventoryItems)
        .where(
          and(
            lt(inventoryItems.currentStock, inventoryItems.threshold),
            gt(inventoryItems.currentStock, 0)
          )
        );
      
      // Get out of stock count
      const [{ count: outOfStock }] = await db
        .select({ count: count() })
        .from(inventoryItems)
        .where(eq(inventoryItems.currentStock, 0));
      
      // Get recently added count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const [{ count: recentlyAdded }] = await db
        .select({ count: count() })
        .from(inventoryItems)
        .where(gte(inventoryItems.createdAt, thirtyDaysAgo));
      
      // Get expiring soon count (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const today = new Date();
      
      const [{ count: expiringSoon }] = await db
        .select({ count: count() })
        .from(inventoryItems)
        .where(
          and(
            isNotNull(inventoryItems.expirationDate),
            lte(inventoryItems.expirationDate, thirtyDaysFromNow),
            gt(inventoryItems.expirationDate, today)
          )
        );
      
      return {
        totalItems: Number(totalItems),
        lowStockCount: Number(lowStockCount),
        recentlyAdded: Number(recentlyAdded),
        outOfStock: Number(outOfStock),
        expiringSoon: Number(expiringSoon)
      };
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      throw error;
    }
  }
  // Recent activity
  async getRecentActivity(limit = 5): Promise<AuditLog[]> {
    try {
      return await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);
    } catch (error) {
      console.error("Error getting recent activity:", error);
      throw error;
    }
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private departments: Map<number, Department>;
  private categories: Map<number, Category>;
  private inventory: Map<number, InventoryItem>;
  private auditLogs: Map<number, AuditLog>;
  sessionStore: session.Store;
  private userIdCounter: number;
  private departmentIdCounter: number;
  private categoryIdCounter: number;
  private inventoryIdCounter: number;
  private auditLogIdCounter: number;

  constructor() {
    this.users = new Map();
    this.departments = new Map();
    this.categories = new Map();
    this.inventory = new Map();
    this.auditLogs = new Map();
    this.userIdCounter = 1;
    this.departmentIdCounter = 1;
    this.categoryIdCounter = 1;
    this.inventoryIdCounter = 1;
    this.auditLogIdCounter = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Seed some initial data
    setTimeout(() => {
      this.seedInitialData();
    }, 0);
  }

 // In your MemStorage class in storage.ts
async getCriticalExpirationItems(): Promise<InventoryItem[]> {
  const today = new Date();
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(today.getDate() + 14); // 2 weeks
  
  return Array.from(this.inventory.values()).filter(item => {
    if (!item.expirationDate) return false;
    const expDate = new Date(item.expirationDate);
    return expDate > today && expDate <= twoWeeksFromNow;
  });
}
  
 private async seedInitialData(): Promise<void> {
  try {
    // Import the hashPassword function
    const { hashPassword } = await import('./utils/password');
    
    // Create admin user
    this.createUser({
      name: "Admin User",
      username: "admin",
      email: "admin@hospital.org",
      password: await hashPassword("admin123"),
      role: "admin",
      department: "Administration",
      active: true,
      confirmPassword: "admin123"
    });
    
    // Create staff user
    this.createUser({
      name: "Staff User",
      username: "staff",
      email: "staff@hospital.org",
      password: await hashPassword("staff123"),
      role: "staff",
      department: "Emergency",
      active: true,
      confirmPassword: "staff123"
    });
  } catch (error) {
    console.error("Error seeding initial data:", error);
  }
  
  // Create departments
  const emergency = await this.createDepartment({ name: "Emergency", description: "Emergency department" });
  const surgery = await this.createDepartment({ name: "Surgery", description: "Surgery department" });
  const pediatrics = await this.createDepartment({ name: "Pediatrics", description: "Pediatrics department" });
  const cardiology = await this.createDepartment({ name: "Cardiology", description: "Cardiology department" });    
  const general = await this.createDepartment({ name: "General", description: "General department" });

  // Create categories
  const ppe = await this.createCategory({ name: "PPE", description: "Personal Protective Equipment" });
  const pharmaceuticals = await this.createCategory({ name: "Pharmaceuticals", description: "Medicines and drugs" });
  const equipment = await this.createCategory({ name: "Equipment", description: "Medical equipment" });
  const supplies = await this.createCategory({ name: "Supplies", description: "General medical supplies" });
  
  // Helper functions for dates that return strings
  const getDateInFuture = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  };
  const getDateInPast = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  };
  
  // --- 10 IN-STOCK ITEMS ---
  
  // In-stock item 1
  this.createInventoryItem({
    itemId: "PPE-001",
    name: "N95 Masks",
    description: "N95 respirator masks",
    departmentId: emergency.id,
    categoryId: ppe.id,
    currentStock: 65,
    unit: "units",
    threshold: 50,
    expirationDate: getDateInFuture(120) // 4 months from now
  });
  
  // In-stock item 2
  this.createInventoryItem({
    itemId: "MED-103",
    name: "Paracetamol 500mg",
    description: "Pain and fever medication",
    departmentId: general.id,
    categoryId: pharmaceuticals.id,
    currentStock: 85,
    unit: "boxes",
    threshold: 30,
    expirationDate: getDateInFuture(180) // 6 months from now
  });
  
  this.createInventoryItem({
    itemId: "EQP-108",
    name: "Blood Pressure Monitor",
    description: "Digital blood pressure monitoring device",
    departmentId: cardiology.id,
    categoryId: equipment.id,
    currentStock: 15,
    unit: "units",
    threshold: 5,
    expirationDate: getDateInFuture(365) // Calibration date 1 year from now
  });
  
  // In-stock item 4
  this.createInventoryItem({
    itemId: "SUP-201",
    name: "Gauze Pads",
    description: "Sterile gauze pads for wound dressing",
    departmentId: surgery.id,
    categoryId: supplies.id,
    currentStock: 120,
    unit: "packs",
    threshold: 50,
    expirationDate: getDateInFuture(250) // ~8 months from now
  });
  
  // In-stock item 5
  this.createInventoryItem({
    itemId: "PPE-005",
    name: "Face Shields",
    description: "Protective face shields",
    departmentId: emergency.id,
    categoryId: ppe.id,
    currentStock: 35,
    unit: "units",
    threshold: 20,
    expirationDate: getDateInFuture(365) // 1 year from now
  });
  
  // In-stock item 6
  this.createInventoryItem({
    itemId: "MED-104",
    name: "Hydrocortisone Cream",
    description: "Anti-inflammatory skin cream",
    departmentId: pediatrics.id,
    categoryId: pharmaceuticals.id,
    currentStock: 40,
    unit: "tubes",
    threshold: 15,
    expirationDate: getDateInFuture(150) // 5 months from now
  });
  
  // In-stock item 7
  this.createInventoryItem({
    itemId: "EQP-110",
    name: "Stethoscope",
    description: "Standard stethoscope",
    departmentId: general.id,
    categoryId: equipment.id,
    currentStock: 25,
    unit: "units",
    threshold: 10,
    expirationDate: getDateInFuture(180)  // No expiration (equipment)
  });

  this.createInventoryItem({
    itemId: "PPE-005",
    name: "Face Shields",
    description: "Protective face shields",
    departmentId: emergency.id,
    categoryId: ppe.id,
    currentStock: 0,
    unit: "units",
    threshold: 20,
    expirationDate: getDateInFuture(365) // 1 year from now
  });

  this.createInventoryItem({
    itemId: "PPE-005",
    name: "Face Shields",
    description: "Protective face shields",
    departmentId: emergency.id,
    categoryId: ppe.id,
    currentStock: 0,
    unit: "units",
    threshold: 20,
    expirationDate: getDateInFuture(365) // 1 year from now
  });

  this.createInventoryItem({
    itemId: "PPE-005",
    name: "Face Shields",
    description: "Protective face shields",
    departmentId: emergency.id,
    categoryId: ppe.id,
    currentStock: 0,
    unit: "units",
    threshold: 20,
    expirationDate: getDateInFuture(365) // 1 year from now
  });
  
  // In-stock item 8
  this.createInventoryItem({
    itemId: "SUP-205",
    name: "Syringes 10ml",
    description: "Disposable syringes",
    departmentId: emergency.id,
    categoryId: supplies.id,
    currentStock: 200,
    unit: "units",
    threshold: 100,
    expirationDate: getDateInFuture(300) // 10 months from now
  });
  
  // In-stock item 9
  this.createInventoryItem({
    itemId: "MED-105",
    name: "Multivitamin Tablets",
    description: "General multivitamins",
    departmentId: general.id,
    categoryId: pharmaceuticals.id,
    currentStock: 55,
    unit: "bottles",
    threshold: 20,
    expirationDate: getDateInFuture(200) // ~6.5 months from now
  });
  
  // In-stock item 10
  this.createInventoryItem({
    itemId: "PPE-008",
    name: "Isolation Gowns",
    description: "Disposable isolation gowns",
    departmentId: surgery.id,
    categoryId: ppe.id,
    currentStock: 70,
    unit: "units",
    threshold: 40,
    expirationDate: getDateInFuture(180) // 6 months from now
  });
  
  // --- 5 LOW-STOCK ITEMS ---
  
  // Low-stock item 1
  this.createInventoryItem({
    itemId: "PPE-002",
    name: "Surgical Gloves (S)",
    description: "Small surgical gloves",
    departmentId: surgery.id,
    categoryId: ppe.id,
    currentStock: 10,
    unit: "boxes",
    threshold: 20,
    expirationDate: getDateInFuture(90) // 3 months from now
  });
  
  // Low-stock item 2
  this.createInventoryItem({
    itemId: "MED-106",
    name: "Aspirin 81mg",
    description: "Low-dose aspirin",
    departmentId: cardiology.id,
    categoryId: pharmaceuticals.id,
    currentStock: 12,
    unit: "bottles",
    threshold: 25,
    expirationDate: getDateInFuture(100) // ~3.3 months from now
  });
  
  // Low-stock item 3
  this.createInventoryItem({
    itemId: "SUP-210",
    name: "Surgical Sutures",
    description: "Sterile surgical sutures",
    departmentId: surgery.id,
    categoryId: supplies.id,
    currentStock: 8,
    unit: "boxes",
    threshold: 15,
    expirationDate: getDateInFuture(180) // 6 months from now
  });
  
  // Low-stock item 4
  this.createInventoryItem({
    itemId: "PPE-009",
    name: "Surgical Caps",
    description: "Disposable surgical caps",
    departmentId: surgery.id,
    categoryId: ppe.id,
    currentStock: 15,
    unit: "packs",
    threshold: 30,
    expirationDate: getDateInFuture(150) // 5 months from now
  });
  
  // Low-stock item 5
  this.createInventoryItem({
    itemId: "MED-108",
    name: "Antibiotic Ointment",
    description: "Topical antibiotic ointment",
    departmentId: pediatrics.id,
    categoryId: pharmaceuticals.id,
    currentStock: 7,
    unit: "tubes",
    threshold: 20,
    expirationDate: getDateInFuture(75) // 2.5 months from now
  });
  
  // --- 3 SOON-TO-EXPIRE ITEMS (WITHIN 2 WEEKS) ---
  
  // Soon-to-expire item 1
  this.createInventoryItem({
    itemId: "MED-101",
    name: "Amoxicillin 500mg",
    description: "Antibiotic medication",
    departmentId: general.id,
    categoryId: pharmaceuticals.id,
    currentStock: 45,
    unit: "boxes",
    threshold: 20,
    expirationDate: getDateInFuture(10) // 10 days from now
  });
  
  // Soon-to-expire item 2
  this.createInventoryItem({
    itemId: "MED-102",
    name: "Ibuprofen 200mg",
    description: "Pain relief medication",
    departmentId: emergency.id,
    categoryId: pharmaceuticals.id,
    currentStock: 30,
    unit: "bottles",
    threshold: 15,
    expirationDate: getDateInFuture(5) // 5 days from now
  });
  
  // Soon-to-expire item 3
  this.createInventoryItem({
    itemId: "SUP-200",
    name: "Bandages (Sterile)",
    description: "Sterile adhesive bandages",
    departmentId: emergency.id,
    categoryId: supplies.id,
    currentStock: 5, // Also low stock!
    unit: "boxes",
    threshold: 15,
    expirationDate: getDateInFuture(12) // 12 days from now
  });
  
  // --- 5 ALREADY EXPIRED ITEMS ---
  
  // Expired item 1
  this.createInventoryItem({
    itemId: "MED-050",
    name: "Acetaminophen 500mg",
    description: "Pain relief medication",
    departmentId: pediatrics.id,
    categoryId: pharmaceuticals.id,
    currentStock: 12,
    unit: "boxes",
    threshold: 10,
    expirationDate: getDateInPast(10) // 10 days ago
  });
  
  // Expired item 2
  this.createInventoryItem({
    itemId: "MED-051",
    name: "Cough Syrup",
    description: "Cough suppressant",
    departmentId: pediatrics.id,
    categoryId: pharmaceuticals.id,
    currentStock: 8,
    unit: "bottles",
    threshold: 12,
    expirationDate: getDateInPast(5) // 5 days ago
  });
  
  // Expired item 3
  this.createInventoryItem({
    itemId: "MED-055",
    name: "Diphenhydramine",
    description: "Antihistamine medication",
    departmentId: general.id,
    categoryId: pharmaceuticals.id,
    currentStock: 4,
    unit: "boxes",
    threshold: 10,
    expirationDate: getDateInPast(15) // 15 days ago
  });
  
  // Expired item 4
  this.createInventoryItem({
    itemId: "SUP-220",
    name: "Sterile Wipes",
    description: "Alcohol-based sterile wipes",
    departmentId: surgery.id,
    categoryId: supplies.id,
    currentStock: 3,
    unit: "packs",
    threshold: 10,
    expirationDate: getDateInPast(30) // 30 days ago
  });
  
  // Expired item 5
  this.createInventoryItem({
    itemId: "MED-056",
    name: "Topical Anesthetic",
    description: "Local anesthetic gel",
    departmentId: emergency.id,
    categoryId: pharmaceuticals.id,
    currentStock: 6,
    unit: "tubes",
    threshold: 8,
    expirationDate: getDateInPast(3) // 3 days ago
  });
}
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = {
      id,
      name: userData.name,
      username: userData.username,
      email: userData.email,
      password: userData.password,
      role: userData.role || "staff",
      department: userData.department || null, // Handle possibly undefined
      active: true,
      lastLogin: new Date(),
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async updateUserLastLogin(id: number): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastLogin = new Date();
      this.users.set(id, user);
    }
  }
  
  async getUsers(page = 1, limit = 10): Promise<{ users: User[], total: number }> {
    const allUsers = Array.from(this.users.values());
    const offset = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(offset, offset + limit);
    
    return {
      users: paginatedUsers,
      total: allUsers.length
    };
  }
  
  async toggleUserActive(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    user.active = !user.active;
    this.users.set(id, user);
    return user;
  }
  
  // Department operations
  async getDepartment(id: number): Promise<Department | undefined> {
    return this.departments.get(id);
  }
  
  async getDepartments(): Promise<Department[]> {
    return Array.from(this.departments.values());
  }
  
  async createDepartment(departmentData: InsertDepartment): Promise<Department> {
    const id = this.departmentIdCounter++;
    const department: Department = {
      id,
      name: departmentData.name,
      description: departmentData.description || null, // Handle possibly undefined
      createdAt: new Date()
    };
    this.departments.set(id, department);
    return department;
  }
  
  async updateDepartment(id: number, departmentData: Partial<Department>): Promise<Department | undefined> {
    const department = this.departments.get(id);
    if (!department) return undefined;
    
    const updatedDepartment = { ...department, ...departmentData };
    this.departments.set(id, updatedDepartment);
    return updatedDepartment;
  }
  
  async deleteDepartment(id: number): Promise<boolean> {
    return this.departments.delete(id);
  }
  
  // Category operations
  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }
  
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }
  
  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const id = this.categoryIdCounter++;
    const category: Category = {
      id,
      name: categoryData.name,
      description: categoryData.description || null, // Handle possibly undefined
      createdAt: new Date()
    };
    this.categories.set(id, category);
    return category;
  }
  
  async updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined> {
    const category = this.categories.get(id);
    if (!category) return undefined;
    
    const updatedCategory = { ...category, ...categoryData };
    this.categories.set(id, updatedCategory);
    return updatedCategory;
  }
  
  async deleteCategory(id: number): Promise<boolean> {
    return this.categories.delete(id);
  }
  
  // Inventory operations
  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    return this.inventory.get(id);
  }
  
  async getInventoryItems(
    page = 1, 
    limit = 10,
    filters?: {
      status?: string;
      departmentId?: number;
      categoryId?: number;
      search?: string;
    }
  ): Promise<{ items: InventoryItem[], total: number }> {
    let allItems = Array.from(this.inventory.values());
    
    // Apply filters
    if (filters) {
      if (filters.status) {
        allItems = allItems.filter(item => item.status === filters.status);
      }
      
      if (filters.departmentId) {
        allItems = allItems.filter(item => item.departmentId === filters.departmentId);
      }
      
      if (filters.categoryId) {
        allItems = allItems.filter(item => item.categoryId === filters.categoryId);
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        allItems = allItems.filter(item => 
          item.name.toLowerCase().includes(searchLower) || 
          item.itemId.toLowerCase().includes(searchLower)
        );
      }
    }
    
    const offset = (page - 1) * limit;
    const paginatedItems = allItems.slice(offset, offset + limit);
    
    return {
      items: paginatedItems,
      total: allItems.length
    };
  }
  
  async getLowStockItems(): Promise<InventoryItem[]> {
    // Get all inventory items, filter for low stock but not out of stock
    const lowStockItems = Array.from(this.inventory.values())
      .filter(item => 
        item.currentStock < item.threshold && 
        item.currentStock > 0 // This excludes items with 0 quantity
      )
      .sort((a, b) => {
        // Sort by updatedAt (newest first)
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5); // Limit to 5 items
    
    return lowStockItems;
  }

  // Add this method to your MemStorage class
async getOutOfStockItems(): Promise<InventoryItem[]> {
  // Get all inventory items
  const allItems = Array.from(this.inventory.values());
  
  // Filter for items with currentStock = 0
  const outOfStockItems = allItems
    .filter(item => item.currentStock === 0)
    .sort((a, b) => {
      // Sort by updatedAt (newest first)
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5); // Limit to 5 items
  
  return outOfStockItems;
}
  
async createInventoryItem(itemData: InsertInventoryItem): Promise<InventoryItem> {
  const id = this.inventoryIdCounter++;
  
  // Determine status based on quantity and threshold
  const status = itemData.currentStock === 0 
    ? 'out_of_stock' 
    : itemData.currentStock! <= itemData.threshold! 
      ? 'low_stock' 
      : 'in_stock';
  
  // Handle expirationDate conversion
  let expirationDate = null;
  if (itemData.expirationDate && itemData.expirationDate.trim() !== '') {
    expirationDate = new Date(itemData.expirationDate);
  }
  
  const item: InventoryItem = {
    id,
    itemId: itemData.itemId,
    name: itemData.name,
    description: itemData.description || null, // Handle possibly undefined
    departmentId: itemData.departmentId,
    categoryId: itemData.categoryId,
    currentStock: itemData.currentStock!,       // Non-null assertion
    unit: itemData.unit,
    threshold: itemData.threshold!,             // Non-null assertion
    status: status as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    expirationDate: expirationDate              // Add expirationDate
  };
  
  this.inventory.set(id, item);
  return item;
}

async updateInventoryItem(id: number, itemData: UpdateInventoryItem): Promise<InventoryItem | undefined> {
  const item = this.inventory.get(id);
  if (!item) return undefined;
  
  // Determine new status if stock or threshold changed
  let newStatus = item.status;
  
  if ('currentStock' in itemData || 'threshold' in itemData) {
    const newStock = itemData.currentStock ?? item.currentStock;
    const newThreshold = itemData.threshold ?? item.threshold;
    
    newStatus = newStock === 0 
      ? 'out_of_stock' 
      : newStock <= newThreshold 
        ? 'low_stock' 
        : 'in_stock';
  }
  
  // Handle expirationDate conversion
  let expirationDate = item.expirationDate;
  if (typeof itemData.expirationDate === 'string') {
    if (itemData.expirationDate.trim() === '') {
      expirationDate = null;
    } else {
      expirationDate = new Date(itemData.expirationDate);
    }
  }
  
  const updatedItem: InventoryItem = {
    ...item,
    ...itemData,
    status: newStatus as any,
    updatedAt: new Date(),
    expirationDate: expirationDate  // Use the processed expirationDate
  };
  
  this.inventory.set(id, updatedItem);
  return updatedItem;
}
  async updateInventoryStock(id: number, quantity: number): Promise<InventoryItem | undefined> {
    const item = this.inventory.get(id);
    if (!item) return undefined;
    
    const newStock = item.currentStock + quantity;
    if (newStock < 0) throw new Error("Cannot reduce stock below zero");
    
    // Determine new status
    const newStatus = newStock === 0 
      ? 'out_of_stock' 
      : newStock <= item.threshold 
        ? 'low_stock' 
        : 'in_stock';
    
    const updatedItem: InventoryItem = {
      ...item,
      currentStock: newStock,
      status: newStatus as any,
      updatedAt: new Date()
    };
    
    this.inventory.set(id, updatedItem);
    return updatedItem;
  }
  
  async getSoonToExpireItems(): Promise<InventoryItem[]> {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    // Get all inventory items, filter for those expiring soon
    const soonToExpireItems = Array.from(this.inventory.values())
      .filter(item => {
        if (!item.expirationDate) return false;
        
        // Use type guard to check if expirationDate is a Date object
        let expDate: Date;
        if (item.expirationDate instanceof Date) {
          expDate = item.expirationDate;
        } else {
          // It's a string or number at this point
          expDate = new Date(item.expirationDate); // Safe to call now
        }
        
        return expDate > today && expDate <= thirtyDaysFromNow;
      })
      .sort((a, b) => {
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        
        // Same type checking pattern for sorting
        const dateA = a.expirationDate instanceof Date 
          ? a.expirationDate 
          : new Date(a.expirationDate); // Now safe
          
        const dateB = b.expirationDate instanceof Date 
          ? b.expirationDate 
          : new Date(b.expirationDate); // Now safe
          
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 5); // Limit to 5 items
    
    return soonToExpireItems;
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    return this.inventory.delete(id);
  }
  
  // Audit log operations
  async createAuditLog(logData: InsertAuditLog): Promise<AuditLog> {
    const id = this.auditLogIdCounter++;
    const log: AuditLog = {
      id,
      userId: logData.userId,
      activityType: logData.activityType,
      itemId: logData.itemId || null, // Handle potentially undefined itemId
      details: logData.details,
      createdAt: new Date()
    };
    
    this.auditLogs.set(id, log);
    return log;
  }
  
  async getAuditLogs(
    page = 1, 
    limit = 10,
    filters?: {
      userId?: number;
      itemId?: number;
      startDate?: Date;
      endDate?: Date;
      activityType?: string;
    }
  ): Promise<{ logs: AuditLog[], total: number }> {
    let allLogs = Array.from(this.auditLogs.values())
      .sort((a, b) => {
        // Handle null dates by treating them as older than any real date
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    
    // Apply filters
    if (filters) {
      if (filters.userId) {
        allLogs = allLogs.filter(log => log.userId === filters.userId);
      }
      
      if (filters.itemId) {
        allLogs = allLogs.filter(log => log.itemId === filters.itemId);
      }
      
      if (filters.activityType) {
        allLogs = allLogs.filter(log => log.activityType === filters.activityType);
      }
      
      if (filters.startDate) {
        allLogs = allLogs.filter(log => {
          if (!log.createdAt) return false;
          return log.createdAt >= filters.startDate!; // Non-null assertion
        });
      }
      
      if (filters.endDate) {
        allLogs = allLogs.filter(log => {
          if (!log.createdAt) return false;
          return log.createdAt <= filters.endDate!; // Non-null assertion
        });
      }
    }
    
    const offset = (page - 1) * limit;
    const paginatedLogs = allLogs.slice(offset, offset + limit);
    
    return {
      logs: paginatedLogs,
      total: allLogs.length
    };
  }
  // Dashboard statistics
async getDashboardStats(): Promise<{
  totalItems: number;
  lowStockCount: number;
  recentlyAdded: number;
  outOfStock: number;
  expiringSoon: number;
}> {
  const allItems = Array.from(this.inventory.values());
  const today = new Date();
  
  // Calculate dates for filtering
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  
  // Count items
  const totalItems = allItems.length;
  
  const lowStockCount = allItems.filter(
    item => (item.currentStock ?? 0) < (item.threshold ?? 10) && (item.currentStock ?? 0) > 0
  ).length;
  
  const outOfStock = allItems.filter(
    item => (item.currentStock ?? 0) === 0
  ).length;
  
  // Fix: Count the number of recently added items, not return the array
  const recentlyAdded = allItems.filter(item => {
    const createdAt = item.createdAt instanceof Date 
      ? item.createdAt 
      : new Date(item.createdAt ?? new Date());
    return createdAt >= thirtyDaysAgo;
  }).length; // Add .length to get the count
  
  const expiringSoon = allItems.filter(item => {
    if (!item.expirationDate) return false;
    
    // Use type guard to safely handle Date conversion
    let expDate: Date;
    if (item.expirationDate instanceof Date) {
      expDate = item.expirationDate;
    } else {
      // It's a string or number at this point
      expDate = new Date(item.expirationDate as string | number);
    }
    
    return expDate > today && expDate <= thirtyDaysFromNow;
  }).length;
  
  return {
    totalItems,
    lowStockCount,
    recentlyAdded,
    outOfStock,
    expiringSoon
  };
}
  // Recent activity
  async getRecentActivity(limit = 5): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values())
      .sort((a, b) => {
        // Handle null dates by treating them as older than any real date
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
