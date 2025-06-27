// prisma/client.js
import { PrismaClient } from '@prisma/client';

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error'],
    errorFormat: 'minimal'
  });
} else {
  // In development, use a global variable to avoid multiple instances
  if (!globalThis.prisma) {
    globalThis.prisma = new PrismaClient({
      log: ['error', 'warn'],
      errorFormat: 'pretty'
    });
  }
  prisma = globalThis.prisma;
}

// Add connection error handling
prisma.$connect()
  .then(() => {
    console.log('✅ Prisma client connected successfully');
  })
  .catch((error) => {
    console.error('❌ Prisma client connection failed:', error);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export { prisma };