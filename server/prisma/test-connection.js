// server/prisma/test-connection.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    // Attempt to connect to the database
    await prisma.$connect();
    console.log('✅ Successfully connected to the database');
    
    // Run a simple query to test further
    // This assumes you have at least one table defined in your schema
    // Replace "user" with a model that exists in your schema
    const count = await prisma.user.count();
    console.log(`User count: ${count}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error connecting to the database:', error);
  }
}

testConnection();