import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum('role', ['admin', 'staff']);
export const itemStatusEnum = pgEnum('item_status', ['in_stock', 'low_stock', 'out_of_stock']);
export const activityTypeEnum = pgEnum('activity_type', ['created', 'updated', 'deleted', 'stock_added', 'stock_removed']);

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default('staff'),
  department: text("department"),
  lastLogin: timestamp("last_login"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Departments Table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Categories Table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory Items Table
export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  itemId: text("item_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  currentStock: integer("current_stock").notNull().default(0),
  unit: text("unit").notNull(),
  threshold: integer("threshold").notNull(),
  status: itemStatusEnum("status").notNull().default('in_stock'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  expirationDate: timestamp('expiration_date'), // Add this line
});

// Audit Log Table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  activityType: activityTypeEnum("activity_type").notNull(),
  itemId: integer("item_id").references(() => inventoryItems.id),
  details: text("details").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  auditLogs: many(auditLogs),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  inventoryItems: many(inventoryItems),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  inventoryItems: many(inventoryItems),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  department: one(departments, {
    fields: [inventoryItems.departmentId],
    references: [departments.id],
  }),
  category: one(categories, {
    fields: [inventoryItems.categoryId],
    references: [categories.id],
  }),
  auditLogs: many(auditLogs),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  inventoryItem: one(inventoryItems, {
    fields: [auditLogs.itemId],
    references: [inventoryItems.id],
  }),
}));

// Schema Validation
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, lastLogin: true })
  .extend({
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginUserSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  status: true
}).extend({
  expirationDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
  ),
});

export const updateInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  expirationDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
  ),
}).partial();

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type UpdateInventoryItem = z.infer<typeof updateInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;