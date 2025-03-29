import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';  // Note the path change

// Use environment variables for connection
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create postgres client
const client = postgres(connectionString, { max: 1 });

// Create drizzle instance
export const db = drizzle(client, { schema });

// Add a function to execute raw SQL queries if needed
export async function executeSqlQuery(sql: string, params: any[] = []) {
  try {
    return await client.unsafe(sql, params);
  } catch (error) {
    console.error("Error executing SQL query:", error);
    throw error;
  }
}

export async function initDb() {
  console.log('Connecting to PostgreSQL database...');
  try {
    // Test the connection with a simple query
    const result = await client`SELECT NOW()`;
    console.log('PostgreSQL database connected successfully');
    return true;
  } catch (error) {
    console.error('Failed to connect to PostgreSQL database:', error);
    return false;
  }
}