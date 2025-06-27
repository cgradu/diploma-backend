// Create this file: debug-db.js
// Run it with: node debug-db.js

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

async function debugDatabaseConnection() {
  console.log('🔍 Debugging Database Connection...\n');
  
  // 1. Check environment variables
  console.log('1. Environment Variables:');
  console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'undefined');
  console.log('   PORT:', process.env.PORT || 'undefined');
  console.log('');
  
  // 2. Test raw MySQL connection
  console.log('2. Testing Raw MySQL Connection:');
  try {
    // Extract connection details from DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not found');
    }
    
    // Parse DATABASE_URL (format: mysql://user:password@host:port/database)
    const url = new URL(dbUrl);
    const connectionConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading '/'
      connectTimeout: 10000,
      acquireTimeout: 10000
    };
    
    console.log('   Connection Config:');
    console.log('   - Host:', connectionConfig.host);
    console.log('   - Port:', connectionConfig.port);
    console.log('   - User:', connectionConfig.user);
    console.log('   - Database:', connectionConfig.database);
    
    const connection = await mysql.createConnection(connectionConfig);
    const [rows] = await connection.execute('SELECT 1+1 as result');
    await connection.end();
    
    console.log('   ✅ Raw MySQL connection successful');
    console.log('   Result:', rows[0]);
    console.log('');
    
  } catch (error) {
    console.log('   ❌ Raw MySQL connection failed:', error.message);
    console.log('   Error Code:', error.code);
    console.log('   Error Details:', error);
    console.log('');
    return;
  }
  
  // 3. Test Prisma connection
  console.log('3. Testing Prisma Connection:');
  let prisma;
  try {
    prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
      errorFormat: 'pretty'
    });
    
    const result = await prisma.$queryRaw`SELECT 1+1 AS result`;
    console.log('   ✅ Prisma connection successful');
    console.log('   Result:', result);
    console.log('');
    
  } catch (error) {
    console.log('   ❌ Prisma connection failed:', error.message);
    console.log('   Error Code:', error.code);
    console.log('   Error Meta:', error.meta);
    console.log('');
    return;
  }
  
  // 4. Test database operations
  console.log('4. Testing Database Operations:');
  try {
    // Test if tables exist
    const tables = await prisma.$queryRaw`SHOW TABLES`;
    console.log('   ✅ Database tables found:', tables.length);
    console.log('   Tables:', tables.map(t => Object.values(t)[0]));
    
    // Test a simple query on User table if it exists
    const userCount = await prisma.user.count();
    console.log('   ✅ User table accessible, count:', userCount);
    console.log('');
    
  } catch (error) {
    console.log('   ❌ Database operations failed:', error.message);
    console.log('   This might indicate schema issues or missing migrations');
    console.log('');
  }
  
  // 5. Test connection pool
  console.log('5. Testing Connection Pool:');
  try {
    const promises = Array.from({ length: 5 }, async (_, i) => {
      const result = await prisma.$queryRaw`SELECT ${i} as connection_test`;
      return result[0];
    });
    
    const results = await Promise.all(promises);
    console.log('   ✅ Connection pool working');
    console.log('   Concurrent connections test passed:', results.length);
    console.log('');
    
  } catch (error) {
    console.log('   ❌ Connection pool failed:', error.message);
    console.log('   This might indicate too many connections or pool issues');
    console.log('');
  }
  
  // Cleanup
  if (prisma) {
    await prisma.$disconnect();
    console.log('✅ Cleanup completed');
  }
}

// Additional helper functions
async function checkMySQLStatus() {
  console.log('\n🔧 MySQL Server Status Check:');
  
  // Try to connect to different common configurations
  const configs = [
    { host: 'localhost', port: 3306 },
    { host: '127.0.0.1', port: 3306 },
    { host: '0.0.0.0', port: 3306 }
  ];
  
  for (const config of configs) {
    try {
      const connection = await mysql.createConnection({
        ...config,
        user: 'root', // Try with root user
        connectTimeout: 5000
      });
      await connection.ping();
      await connection.end();
      console.log(`   ✅ MySQL accessible at ${config.host}:${config.port}`);
    } catch (error) {
      console.log(`   ❌ MySQL not accessible at ${config.host}:${config.port} - ${error.message}`);
    }
  }
}

// Run the debug
debugDatabaseConnection()
  .then(() => checkMySQLStatus())
  .then(() => {
    console.log('\n🎯 Debug completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Debug failed:', error);
    process.exit(1);
  });