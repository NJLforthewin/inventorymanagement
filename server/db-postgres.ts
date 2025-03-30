import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';  // Note the path change

// Set default connection string for development if not provided
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not set, using default local connection');
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/stockwell';
}

// Use environment variables for connection
const connectionString = process.env.DATABASE_URL;

// Create postgres client with improved SSL configuration for Render
const client = postgres(connectionString, { 
  max: 3,
  ssl: {
    rejectUnauthorized: false  // Important for connecting to Render PostgreSQL
  },
  idle_timeout: 30,
  connect_timeout: 30,  // Increased timeout for initial connection
  debug: true  // Enable debug logging for connection issues
});

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

// Add a retry mechanism for database connections
export async function initDb(retries = 3) {
  console.log('Connecting to PostgreSQL database...');
  
  let attempts = 0;
  while (attempts < retries) {
    try {
      attempts++;
      console.log(`Connection attempt ${attempts}/${retries}...`);
      // Test the connection with a simple query
      const result = await client`SELECT NOW()`;
      console.log('PostgreSQL database connected successfully');
      return true;
    } catch (error) {
      console.error(`Failed connection attempt ${attempts}/${retries}:`, error);
      
      if (attempts >= retries) {
        console.error('Failed to connect to PostgreSQL database after all retry attempts');
        return false;
      }
      
      // Wait before retrying
      console.log(`Waiting 2 seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return false;
}