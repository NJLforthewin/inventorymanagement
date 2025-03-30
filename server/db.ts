import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as mssql from 'mssql';

// Create a type extension for NodePgDatabase to fix TypeScript errors in VS Code
declare module 'drizzle-orm/node-postgres' {
  interface NodePgDatabase {
    // Add the missing fn property that TypeScript complains about
    fn: {
      count: () => any;
    };
  }
}
const { Client } = pg;

// Configuration for MSSQL connection
const sqlConfig = {
  user: process.env.SQL_USER || 'sa',
  password: process.env.SQL_PASSWORD || 'sancija2256!',
  database: process.env.SQL_DATABASE || 'HospitalInventory',
  server: process.env.SQL_SERVER || 'localhost',
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true, // for azure
    trustServerCertificate: true // change to false for production
  }
};

// Check if SQLServer connection pool is working
export async function testSqlConnection() {
  try {
    const pool = await mssql.connect(sqlConfig);
    const result = await pool.request().query('SELECT 1 as value');
    console.log('SQL Server connection successful');
    return true;
  } catch (err) {
    console.error('Error connecting to SQL Server:', err);
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

// For use with Drizzle ORM
export const client = new Client({

  host: process.env.PGHOST || 'localhost',
  port: 5432, // Using the port you specified
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  ssl: false
});

// Connect the client
export const connectToDb = async () => {
  try {
    await client.connect();
    console.log("Postgres database connected");
  } catch (err) {
    console.error("Failed to connect to database:", err);
    process.exit(1);
  }
};

// Create Drizzle instance
export const db = drizzle(client);

// Create mssql pool
export const createMssqlPool = async () => {
  try {
    return await mssql.connect(sqlConfig);
  } catch (err) {
    console.error('Error creating SQL Server pool:', err);
    throw err;
  }
};

// Execute MSSQL query
export const executeSqlQuery = async (query: string, params?: any[]) => {
  const pool = await createMssqlPool();
  try {
    const request = pool.request();
    
    if (params) {
      params.forEach((param, index) => {
        request.input(`param${index}`, param);
      });
    }
    
    return await request.query(query);
  } finally {
    pool.close();
  }
};
