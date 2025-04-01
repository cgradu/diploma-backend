// prisma/client.js
import { PrismaClient } from '@prisma/client';

// Declare global variable for prisma
let prisma;

// Check if we are in production
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, use a global variable to avoid multiple instances
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export { prisma };