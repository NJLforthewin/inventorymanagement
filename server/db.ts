import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
const { Client } = pg;

// For use with Drizzle ORM
export const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Connect the client
export const connectToDb = async () => {
  try {
    await client.connect();
    console.log("PostgreSQL database connected");
  } catch (err) {
    console.error("Failed to connect to PostgreSQL database:", err);
    return false;
  }
};

// Create Drizzle instance
export const db = drizzle(client);

// Export SQL for use with count() and other functions
export { sql };

// Test connection
export async function testSqlConnection() {
  try {
    await connectToDb();
    const result = await client.query('SELECT NOW()');
    console.log('PostgreSQL connection successful:', result.rows[0]);
    return true;
  } catch (err) {
    console.error('Error connecting to PostgreSQL:', err);
    return false;
  }
}

// Add this function to db.ts
export async function initDb() {
  try {
    await connectToDb();
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return false;
  }
}

// Execute SQL query
export async function executeSqlQuery(query: string, params: any[] = []) {
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error executing SQL query:", error);
    throw error;
  }
}