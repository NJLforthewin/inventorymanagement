import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';

// Log database connection attempt
console.log('Initializing database connection...');

// Make sure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Clean up the connection string if needed
let connectionString = process.env.DATABASE_URL;

// Add SSL parameters if not present
if (!connectionString.includes('sslmode=') && !connectionString.includes('?ssl=')) {
  connectionString += connectionString.includes('?') 
    ? '&sslmode=require' 
    : '?sslmode=require';
}

console.log('Using connection string (masked):', 
  connectionString.replace(/:[^:@]+@/, ':***@'));

// Create postgres client with special handling for Render
const client = postgres(connectionString, { 
  max: 3,
  ssl: {
    rejectUnauthorized: false
  },
  idle_timeout: 30,
  connect_timeout: 30,
  debug: process.env.NODE_ENV !== 'production' // Only in dev/test
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Add a retry mechanism for database connections
export async function initDb(retries = 3) {
  console.log('Connecting to PostgreSQL database...');
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Connection attempt ${attempt}/${retries}...`);
      // Test the connection with a simple query
      await client`SELECT 1 as connection_test`;
      console.log('PostgreSQL database connected successfully');
      return true;
    } catch (error) {
      console.error(`Connection attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        console.error('All connection attempts failed');
        return false;
      }
      
      // Wait before retrying
      const waitTime = 2000; // 2 seconds
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  return false;
}