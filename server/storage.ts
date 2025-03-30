import { 
  users, departments, categories, inventoryItems, auditLogs,
  type User, type InsertUser, type Department, type InsertDepartment,
  type Category, type InsertCategory, type InventoryItem, type InsertInventoryItem,
  type UpdateInventoryItem, type AuditLog, type InsertAuditLog
} from "@shared/schema";
import { eq, and, like, gte, lte, desc, inArray } from "drizzle-orm";
import { db, executeSqlQuery } from "./db";
import session from "express-session";
import createMemoryStore from "memorystore";
import { sql } from "drizzle-orm";
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
  getLowStockItems(): Promise<InventoryItem[]>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, item: UpdateInventoryItem): Promise<InventoryItem | undefined>;
  updateInventoryStock(id: number, quantity: number): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: number): Promise<boolean>;
  
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
        const { Pool } = require('pg');
        this.sessionStore = new PostgresSessionStore({
          conObject: {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false } // Required for Render PostgreSQL
          },
          tableName: 'session',
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
    
    // Initialize database with seed data if needed
    this.initializeDatabase();
  }
  
  private async initializeDatabase() {
    try {
      console.log('Checking if database needs to be initialized...');
      
      // Check if users exist
      const { users, total } = await this.getUsers(1, 1);
      const departments = await this.getDepartments();
      
      if (total === 0 || departments.length === 0) {
        console.log('Database is empty, seeding initial data...');
        await this.seedInitialData();
        console.log('Initial data seeded successfully');
      } else {
        console.log('Database already contains data, skipping initialization');
      }
    } catch (error) {
      console.error('Error initializing database:', error);
    }
    
    // Initialize with default admin user if needed
    this.initializeDefaultAdmin();
  }
  private async seedInitialData(): Promise<void> {
    try {
      console.log('Starting to seed initial data...');
      
      // Import the hashPassword function
      const { hashPassword } = await import('./utils/password');
      
      // Create admin user
      console.log('Creating admin user...');
      const admin = await this.createUser({
        name: "Admin User",
        username: "admin",
        email: "admin@hospital.org",
        password: await hashPassword("admin123"),
        role: "admin",
        department: "Administration",
        active: true,
        confirmPassword: "admin123"
      });
      console.log('Admin user created:', admin.username);
      
      // Create staff user
      console.log('Creating staff user...');
      const staff = await this.createUser({
        name: "Staff User",
        username: "staff",
        email: "staff@hospital.org",
        password: await hashPassword("staff123"),
        role: "staff",
        department: "Emergency",
        active: true,
        confirmPassword: "staff123"
      });
      console.log('Staff user created:', staff.username);
      
      // Create departments
      console.log('Creating departments...');
      const emergency = await this.createDepartment({ name: "Emergency", description: "Emergency department" });
      const surgery = await this.createDepartment({ name: "Surgery", description: "Surgery department" });
      const pediatrics = await this.createDepartment({ name: "Pediatrics", description: "Pediatrics department" });
      const cardiology = await this.createDepartment({ name: "Cardiology", description: "Cardiology department" });    
      const general = await this.createDepartment({ name: "General", description: "General department" });
      console.log('Departments created successfully');
      
      // Create categories
      console.log('Creating categories...');
      const ppe = await this.createCategory({ name: "PPE", description: "Personal Protective Equipment" });
      const pharmaceuticals = await this.createCategory({ name: "Pharmaceuticals", description: "Medicines and drugs" });
      const equipment = await this.createCategory({ name: "Equipment", description: "Medical equipment" });
      const supplies = await this.createCategory({ name: "Supplies", description: "General medical supplies" });
      console.log('Categories created successfully');
      
      // Create inventory items
      console.log('Creating inventory items...');
      await this.createInventoryItem({
        itemId: "PPE-001",
        name: "N95 Masks",
        description: "N95 respirator masks",
        departmentId: emergency.id,
        categoryId: ppe.id,
        currentStock: 25,
        unit: "units",
        threshold: 50
      });
      
      await this.createInventoryItem({
        itemId: "PPE-002",
        name: "Surgical Gloves (S)",
        description: "Small surgical gloves",
        departmentId: surgery.id,
        categoryId: ppe.id,
        currentStock: 10,
        unit: "boxes",
        threshold: 20
      });
      
      await this.createInventoryItem({
        itemId: "MED-023",
        name: "IV Saline Solution",
        description: "Intravenous saline solution",
        departmentId: general.id,
        categoryId: pharmaceuticals.id,
        currentStock: 30,
        unit: "bags",
        threshold: 40
      });
      
      await this.createInventoryItem({
        itemId: "EQP-108",
        name: "Blood Pressure Monitor",
        description: "Digital blood pressure monitoring device",
        departmentId: cardiology.id,
        categoryId: equipment.id,
        currentStock: 15,
        unit: "units",
        threshold: 5
      });
      console.log('Inventory items created successfully');
      
    } catch (error) {
      console.error("Error seeding initial data:", error);
      throw error;
    }
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
  
  async getUser(id: number): Promise<User | undefined> {
    try {
      // Use the executeSqlQuery function from db-postgres.ts
      const result = await executeSqlQuery('SELECT * FROM users WHERE id = $1', [id]);
      
      if (result && result.length > 0) {
        return result[0] as User;
      }
      return undefined;
    } catch (error) {
      console.error("Error getting user by id:", error);
      throw error;
    }
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      console.log(`Looking up user by username: ${username}`);
      // Use the executeSqlQuery function from db-postgres.ts
      const result = await executeSqlQuery('SELECT * FROM users WHERE username = $1', [username]);
      
      console.log(`Result from database:`, result);
      
      if (result && result.length > 0) {
        console.log(`User found:`, result[0]);
        return result[0] as User;
      }
      console.log(`No user found with username: ${username}`);
      return undefined;
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
      
      // Use direct SQL for reliability
      const usersResult = await db.execute(sql`
        SELECT * FROM users
        LIMIT ${limit} OFFSET ${offset}
      `);
      
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
      `);
      
      return {
        users: (usersResult.rows || []) as User[],
        total: Number(countResult.rows?.[0]?.count || 0)
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
      let countQuery = db.select({ count: sql`count(*)` }).from(inventoryItems);

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
      return await db
        .select()
        .from(inventoryItems)
        .where(
          inArray(inventoryItems.status, ['low_stock', 'out_of_stock'])
        );
    } catch (error) {
      console.error("Error getting low stock items:", error);
      throw error;
    }
  }
  
  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    try {
      // Determine status based on quantity and threshold - add non-null assertions
      const status = item.currentStock === 0 
        ? 'out_of_stock' 
        : item.currentStock! <= item.threshold! 
          ? 'low_stock' 
          : 'in_stock';
      
      const [createdItem] = await db
        .insert(inventoryItems)
        .values({ ...item, status: status as any })
        .returning();
      
      return createdItem;
    } catch (error) {
      console.error("Error creating inventory item:", error);
      throw error;
    }
  }
  
  async updateInventoryItem(id: number, itemData: UpdateInventoryItem): Promise<InventoryItem | undefined> {
    try {
      const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
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
      
      const [updatedItem] = await db
        .update(inventoryItems)
        .set({ ...itemData, status: newStatus as any, updatedAt: new Date() })
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
let countQuery = db.select({ count: sql`count(*)` }).from(auditLogs);
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
}> {
  try {
    // Get total items count
    const [{ count: totalItems }] = await db
      .select({ count: sql`count(*)` })
      .from(inventoryItems);
    
    // Get low stock count
    const [{ count: lowStockCount }] = await db
      .select({ count: sql`count(*)` })
      .from(inventoryItems)
      .where(eq(inventoryItems.status, 'low_stock'));
    
    // Get out of stock count
    const [{ count: outOfStock }] = await db
      .select({ count: sql`count(*)` })
      .from(inventoryItems)
      .where(eq(inventoryItems.status, 'out_of_stock'));
    
    // Get recently added count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [{ count: recentlyAdded }] = await db
      .select({ count: sql`count(*)` })
      .from(inventoryItems)
      .where(gte(inventoryItems.createdAt, thirtyDaysAgo));
    
    return {
      totalItems: Number(totalItems),
      lowStockCount: Number(lowStockCount),
      recentlyAdded: Number(recentlyAdded),
      outOfStock: Number(outOfStock)
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

    }, 0);
  }

  // User operations
  // User operations
async getUser(id: number): Promise<User | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM users WHERE id = ${id}
    `);
    
    if (result.rows && result.rows.length > 0) {
      return result.rows[0] as User;
    }
    return undefined;
  } catch (error) {
    console.error("Error getting user by id:", error);
    throw error;
  }
}

async getUserByUsername(username: string): Promise<User | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM users WHERE username = ${username}
    `);
    
    if (result.rows && result.rows.length > 0) {
      return result.rows[0] as User;
    }
    return undefined;
  } catch (error) {
    console.error("Error getting user by username:", error);
    throw error; 
  }
}

async getUserByEmail(email: string): Promise<User | undefined> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM users WHERE email = ${email}
    `);
    
    if (result.rows && result.rows.length > 0) {
      return result.rows[0] as User;
    }
    return undefined;
  } catch (error) {
    console.error("Error getting user by email:", error);
    throw error;
  }
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
    return Array.from(this.inventory.values()).filter(
      item => item.status === 'low_stock' || item.status === 'out_of_stock'
    );
  }
  
  async createInventoryItem(itemData: InsertInventoryItem): Promise<InventoryItem> {
    const id = this.inventoryIdCounter++;
    
    // Determine status based on quantity and threshold
    const status = itemData.currentStock === 0 
      ? 'out_of_stock' 
      : itemData.currentStock! <= itemData.threshold! 
        ? 'low_stock' 
        : 'in_stock';
    
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
      updatedAt: new Date()
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
    
    const updatedItem: InventoryItem = {
      ...item,
      ...itemData,
      status: newStatus as any,
      updatedAt: new Date()
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
  }> {
    const allItems = Array.from(this.inventory.values());
    
    const totalItems = allItems.length;
    
    const lowStockCount = allItems.filter(
      item => item.status === 'low_stock'
    ).length;
    
    const outOfStock = allItems.filter(
      item => item.status === 'out_of_stock'
    ).length;
    
    // Items added in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentlyAdded = allItems.filter(
      item => item.createdAt && item.createdAt >= thirtyDaysAgo
    ).length;
    
    return {
      totalItems,
      lowStockCount,
      recentlyAdded,
      outOfStock
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

// Use MemStorage for now, can be replaced with DatabaseStorage when ready
// Use MemStorage for consistent setup while we troubleshoot
// Explicitly using MemStorage while debugging the server startup issues
export const storage = new MemStorage();
