// server/prisma/test-crud.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCrud() {
  try {
    // Create a test user (adjust fields based on your schema)
    const testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'test-password-hash',
        role: 'donor'
      },
    });
    
    console.log('✅ Created test user:', testUser);
    
    // Read the user back
    const foundUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    
    console.log('✅ Found user:', foundUser);
    
    // Clean up - delete the test user
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    
    console.log('✅ Deleted test user');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error during CRUD operations:', error);
  }
}

testCrud();