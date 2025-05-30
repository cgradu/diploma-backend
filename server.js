// server.js - Updated with admin routes
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

// Prisma client
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Import blockchain services
import BlockchainService from './services/blockchainService.js';
import BlockchainVerificationService from './services/blockchainVerificationService.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import charityRoutes from './routes/charityRoutes.js';
import donationRoutes from './routes/donationRoutes.js';
import donationController from './controllers/donationController.js';
import projectRoutes from './routes/projectRoutes.js';
import testRoutes from './routes/testRoutes.js';
import adminRoutes from './routes/adminRoutes.js'; // Add admin routes

const PORT = process.env.PORT || 4700;
const app = express();

// Initialize blockchain services
let blockchainService;
let blockchainVerificationService;

async function initializeBlockchainServices() {
  try {
    console.log('🔗 Initializing blockchain services...');
    
    blockchainService = new BlockchainService();
    await blockchainService.initialize();
    
    blockchainVerificationService = new BlockchainVerificationService();
    await blockchainVerificationService.initialize();
    
    console.log('✅ Blockchain services initialized successfully');
  } catch (error) {
    console.error('⚠️ Blockchain services initialization failed:', error.message);
    console.log('🔄 Application will continue in fallback mode');
  }
}

// Webhook middleware (must be before express.json())
app.use('/donations/webhook', express.raw({ type: 'application/json' }), donationController.handleWebhook);

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/charities', charityRoutes);
app.use('/donations', donationRoutes);
app.use('/projects', projectRoutes);
app.use('/api/test', testRoutes);
app.use('/admin', adminRoutes); // Add admin routes

// Root route with blockchain status
app.get('/', async (req, res) => {
  try {
    let blockchainStatus = 'Not initialized';
    
    if (blockchainService) {
      try {
        // Test blockchain connection
        await blockchainService.initialize();
        blockchainStatus = 'Connected and operational';
      } catch (error) {
        blockchainStatus = `Error: ${error.message}`;
      }
    }
    
    res.json({
      message: 'Charity Transparency Blockchain Platform API',
      status: 'running',
      blockchain: blockchainStatus,
      endpoints: {
        auth: '/auth',
        charities: '/charities',
        donations: '/donations',
        projects: '/projects',
        admin: '/admin',
        tests: '/api/test'
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'API running with errors',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1+1 AS result`;
    
    // Test blockchain connection
    let blockchainHealth = 'disconnected';
    if (blockchainService) {
      try {
        await blockchainService.initialize();
        blockchainHealth = 'connected';
      } catch (error) {
        blockchainHealth = 'error';
      }
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        blockchain: blockchainHealth
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: ['/auth', '/charities', '/donations', '/projects', '/admin', '/api/test']
  });
});

// Test database connection
async function testDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1+1 AS result`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  
  try {
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
  
  process.exit(0);
});

// Start server with all initializations
async function startServer() {
  try {
    console.log('🚀 Starting Charity Transparency Platform...');
    console.log('=' .repeat(50));
    
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      console.error('❌ Cannot start server without database connection');
      process.exit(1);
    }
    
    // Initialize blockchain services (non-blocking)
    await initializeBlockchainServices();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log('=' .repeat(50));
      console.log('✅ Server running successfully!');
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/health`);
      console.log(`🔐 Admin Dashboard: http://localhost:${PORT}/admin`);
      console.log(`🧪 Test Interface: http://localhost:${PORT}/api/test`);
      console.log('=' .repeat(50));
    });
    
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

// Export services for use in other modules
export { blockchainService, blockchainVerificationService };

// Start the server
startServer();