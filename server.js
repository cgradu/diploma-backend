// server.js - Updated with enhanced donation routes and blockchain integration
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
import donationRoutes from './routes/donationRoutes.js'; // Enhanced donation routes
import donationController from './controllers/donationController.js';
import projectRoutes from './routes/projectRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import statsRoutes from './routes/statsRoutes.js'; // Statistics routes

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
    
    // Start background verification process for pending donations
    startBackgroundVerification();
    
  } catch (error) {
    console.error('⚠️ Blockchain services initialization failed:', error.message);
    console.log('🔄 Application will continue in fallback mode');
  }
}

// // Background process to verify pending donations
// async function startBackgroundVerification() {
//   setInterval(async () => {
//     try {
//       console.log('🔍 Running background blockchain verification...');
      
//       // Get unverified donations
//       const unverifiedDonations = await prisma.donation.findMany({
//         where: {
//           paymentStatus: 'SUCCEEDED',
//           OR: [
//             { blockchainVerification: null },
//             { 
//               blockchainVerification: {
//                 verified: false,
//                 transactionHash: {
//                   startsWith: 'pending_'
//                 }
//               }
//             }
//           ]
//         },
//         take: 5 // Process 5 at a time to avoid overwhelming the system
//       });

//       if (unverifiedDonations.length > 0) {
//         console.log(`📝 Found ${unverifiedDonations.length} donations to verify`);
        
//         for (const donation of unverifiedDonations) {
//           try {
//             await blockchainVerificationService.verifyDonation(donation.id);
//             console.log(`✅ Verified donation ${donation.id}`);
//           } catch (error) {
//             console.error(`❌ Failed to verify donation ${donation.id}:`, error.message);
//           }
//         }
//       }
//     } catch (error) {
//       console.error('Background verification error:', error);
//     }
//   }, 5 * 60 * 1000); // Run every 5 minutes
// }

// Webhook middleware (must be before express.json())
app.use('/donations/webhook', express.raw({ type: 'application/json' }), donationController.handleWebhook);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/charities', charityRoutes);
app.use('/donations', donationRoutes);
app.use('/projects', projectRoutes);
app.use('/admin', adminRoutes);
app.use('/api/stats', statsRoutes); 

app.get('/', async (req, res) => {
  try {
    let blockchainStatus = 'Not initialized';
    let verificationStats = null;
    
    if (blockchainService && blockchainVerificationService) {
      try {
        // Test blockchain connection
        await blockchainService.initialize();
        blockchainStatus = 'Connected and operational';
        
        // Get verification statistics
        verificationStats = await blockchainVerificationService.getVerificationStats();
      } catch (error) {
        blockchainStatus = `Error: ${error.message}`;
      }
    }
    
    // Get platform statistics
    const [totalUsers, totalCharities, totalDonations, totalVerified] = await Promise.all([
      prisma.user.count(),
      prisma.charity.count(),
      prisma.donation.count({ where: { paymentStatus: 'SUCCEEDED' } }),
      prisma.blockchainVerification.count({ where: { verified: true } })
    ]);
    
    res.json({
      message: 'Charitrace - Charity Transparency Blockchain Platform API',
      status: 'running',
      version: '2.0.0',
      blockchain: {
        status: blockchainStatus,
        verification: verificationStats
      },
      platform: {
        users: totalUsers,
        charities: totalCharities,
        donations: totalDonations,
        verifiedDonations: totalVerified,
        transparencyRate: totalDonations > 0 ? Math.round((totalVerified / totalDonations) * 100) : 0
      },
      endpoints: {
        auth: '/auth',
        charities: '/charities',
        donations: '/donations',
        projects: '/projects',
        admin: '/admin',
        stats: '/api/stats',
      },
      features: {
        blockchainVerification: true,
        impactTracking: true,
        transparencyScoring: true,
        donationHistory: true
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'API running with errors',
      error: error.message
    });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Handle Prisma errors
  if (error.code === 'P2002') {
    return res.status(400).json({
      message: 'A record with this information already exists',
      field: error.meta?.target?.[0]
    });
  }
  
  if (error.code === 'P2025') {
    return res.status(404).json({
      message: 'Record not found'
    });
  }
  
  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: error.errors
    });
  }
  
  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      details: error 
    })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      '/auth - Authentication endpoints',
      '/charities - Charity management',
      '/donations - Donation processing with blockchain verification',
      '/projects - Project management',
      '/admin - Administrative functions',
      '/api/test - Testing and debugging'
    ],
    documentation: 'https://docs.charitrace.org'
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
  console.log('\n🛑 Shutting down server gracefully...');
  
  try {
    // Close database connection
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
    
    // Clean up blockchain services
    if (blockchainService) {
      console.log('✅ Blockchain service cleaned up');
    }
    
    console.log('✅ Server shutdown complete');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  
  process.exit(0);
});

// Enhanced startup sequence
async function startServer() {
  try {
    console.log('🚀 Starting Charitrace Platform...');
    console.log('=' .repeat(60));
    
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
      console.log('=' .repeat(60));
      console.log('✅ Charitrace Platform running successfully!');
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log('');
      console.log('🔗 Blockchain Features:');
      console.log('   • Donation verification');
      console.log('   • Impact tracking');
      console.log('   • Transparency scoring');
      console.log('   • Transaction history');
      console.log('=' .repeat(60));
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