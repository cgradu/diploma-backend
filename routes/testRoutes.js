// backend/routes/testRoutes.js
import express from 'express';
import BlockchainService from '../services/blockchainService.js';
import BlockchainVerificationService from '../services/blockchainVerificationService.js';
import { testConnection, healthCheck } from '../blockchain/config.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Test blockchain connection
router.get('/blockchain/connection', async (req, res) => {
  try {
    console.log('🔍 Testing blockchain connection via API...');
    
    const result = await testConnection();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Blockchain connection successful',
        data: {
          network: result.network.name,
          walletAddress: result.wallet.address,
          blockNumber: await result.provider.getBlockNumber()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Blockchain connection failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('API blockchain test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Blockchain test failed',
      error: error.message
    });
  }
});

// Test recording a donation
router.post('/blockchain/test-donation', async (req, res) => {
  try {
    console.log('📝 Testing donation recording via API...');
    
    const blockchainService = new BlockchainService();
    await blockchainService.initialize();
    
    // Create test donation data
    const testDonation = {
      transactionId: `api_test_${Date.now()}`,
      donorId: req.body.donorId || 1,
      charityId: req.body.charityId || 1,
      projectId: req.body.projectId || null,
      amount: req.body.amount || 25.50,
      currency: req.body.currency || 'RON',
      anonymous: req.body.anonymous || false
    };
    
    console.log('Test donation data:', testDonation);
    
    const result = await blockchainService.recordDonation(testDonation);
    
    if (result && result.transactionHash) {
      res.json({
        success: true,
        message: 'Donation recorded on blockchain successfully',
        data: {
          transactionHash: result.transactionHash,
          blockNumber: result.blockNumber,
          gasUsed: result.gasUsed,
          testDonation: testDonation
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to record donation on blockchain',
        data: result
      });
    }
    
  } catch (error) {
    console.error('API donation test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Donation test failed',
      error: error.message
    });
  }
});

// Test getting donations by charity
router.get('/blockchain/test-charity/:charityId', async (req, res) => {
  try {
    console.log('🔍 Testing get donations by charity via API...');
    
    const blockchainService = new BlockchainService();
    await blockchainService.initialize();
    
    const charityId = req.params.charityId;
    const donations = await blockchainService.getDonationsByCharity(charityId);
    
    res.json({
      success: true,
      message: `Found ${donations.length} donations for charity ${charityId}`,
      data: {
        charityId: charityId,
        donationCount: donations.length,
        donations: donations
      }
    });
    
  } catch (error) {
    console.error('API get donations test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Get donations test failed',
      error: error.message
    });
  }
});

// Test getting charity flow
router.get('/blockchain/test-flow/:charityId', async (req, res) => {
  try {
    console.log('💰 Testing get charity flow via API...');
    
    const blockchainService = new BlockchainService();
    await blockchainService.initialize();
    
    const charityId = req.params.charityId;
    const flow = await blockchainService.getCharityFlow(charityId);
    
    res.json({
      success: true,
      message: `Retrieved charity flow for charity ${charityId}`,
      data: {
        charityId: charityId,
        flow: flow
      }
    });
    
  } catch (error) {
    console.error('API charity flow test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Charity flow test failed',
      error: error.message
    });
  }
});

// Health check endpoint
router.get('/blockchain/health', async (req, res) => {
  try {
    const health = await healthCheck();
    
    if (health.status === 'healthy') {
      res.json(health);
    } else {
      res.status(503).json(health);
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test full donation flow (with database integration)
router.post('/donation/test-full-flow', authenticate, async (req, res) => {
  try {
    console.log('🧪 Testing full donation flow with blockchain...');
    
    const { charityId, amount = 100, message = 'Test donation', anonymous = false } = req.body;
    
    // Validate charity exists
    const charity = await prisma.charity.findUnique({
      where: { id: parseInt(charityId) }
    });
    
    if (!charity) {
      return res.status(404).json({
        success: false,
        message: 'Charity not found'
      });
    }
    
    // Create test donation in database
    const donation = await prisma.donation.create({
      data: {
        amount: parseFloat(amount),
        transactionId: `test_full_${Date.now()}`,
        paymentIntentId: `pi_test_${Date.now()}`,
        paymentStatus: 'SUCCEEDED',
        message,
        anonymous,
        currency: 'RON',
        donorId: req.user.id,
        charityId: parseInt(charityId)
      }
    });
    
    console.log('✅ Test donation created in database:', donation.id);
    
    // Test blockchain verification
    const verificationService = new BlockchainVerificationService();
    await verificationService.initialize();
    
    const verification = await verificationService.verifyDonation(donation.id);
    
    console.log('✅ Blockchain verification completed');
    
    // Get complete donation data
    const completeDonation = await prisma.donation.findUnique({
      where: { id: donation.id },
      include: {
        charity: { select: { name: true, category: true } },
        donor: { select: { name: true, email: true } },
        blockchainVerification: true
      }
    });
    
    res.json({
      success: true,
      message: 'Full donation flow test completed successfully',
      data: {
        donation: completeDonation,
        verification: verification,
        steps: [
          'Database donation record created',
          'Blockchain transaction recorded',
          'Verification record created',
          'Flow completed successfully'
        ]
      }
    });
    
  } catch (error) {
    console.error('Full flow test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Full donation flow test failed',
      error: error.message
    });
  }
});

// Test verification service
router.get('/verification/test/:donationId', authenticate, async (req, res) => {
  try {
    const { donationId } = req.params;
    
    console.log(`🔍 Testing verification service for donation ${donationId}`);
    
    const verificationService = new BlockchainVerificationService();
    await verificationService.initialize();
    
    const status = await verificationService.getVerificationStatus(parseInt(donationId));
    
    res.json({
      success: true,
      message: 'Verification status retrieved successfully',
      data: status
    });
    
  } catch (error) {
    console.error('Verification test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Verification test failed',
      error: error.message
    });
  }
});

// Get verification statistics
router.get('/verification/stats', authenticate, async (req, res) => {
  try {
    const verificationService = new BlockchainVerificationService();
    await verificationService.initialize();
    
    const stats = await verificationService.getVerificationStats();
    
    res.json({
      success: true,
      message: 'Verification statistics retrieved successfully',
      data: stats
    });
    
  } catch (error) {
    console.error('Stats retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve verification statistics',
      error: error.message
    });
  }
});

// Get unverified donations
router.get('/verification/unverified', authenticate, async (req, res) => {
  try {
    const verificationService = new BlockchainVerificationService();
    await verificationService.initialize();
    
    const unverified = await verificationService.getUnverifiedDonations();
    
    res.json({
      success: true,
      message: `Found ${unverified.length} unverified donations`,
      data: unverified
    });
    
  } catch (error) {
    console.error('Unverified donations retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve unverified donations',
      error: error.message
    });
  }
});

// Comprehensive test suite endpoint
router.post('/blockchain/run-tests', async (req, res) => {
  try {
    console.log('🧪 Running comprehensive blockchain tests via API...');
    
    const results = {
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 },
      timestamp: new Date().toISOString()
    };
    
    // Test 1: Connection
    try {
      const connectionTest = await testConnection();
      results.tests.push({
        name: 'Blockchain Connection',
        status: connectionTest.success ? 'PASS' : 'FAIL',
        details: connectionTest.success ? 'Connected successfully' : connectionTest.error
      });
      if (connectionTest.success) results.summary.passed++;
      else results.summary.failed++;
    } catch (error) {
      results.tests.push({
        name: 'Blockchain Connection',
        status: 'FAIL',
        details: error.message
      });
      results.summary.failed++;
    }
    
    // Test 3: Record Donation
    try {
      const blockchainService = new BlockchainService();
      await blockchainService.initialize();
      
      const testDonation = {
        transactionId: `comprehensive_test_${Date.now()}`,
        donorId: 1,
        charityId: 1,
        amount: 15.75,
        currency: 'RON',
        anonymous: false
      };
      
      const donationResult = await blockchainService.recordDonation(testDonation);
      
      if (donationResult && donationResult.transactionHash) {
        results.tests.push({
          name: 'Record Donation',
          status: 'PASS',
          details: `TX: ${donationResult.transactionHash.substring(0, 20)}...`
        });
        results.summary.passed++;
      } else {
        results.tests.push({
          name: 'Record Donation',
          status: 'FAIL',
          details: 'No transaction hash returned'
        });
        results.summary.failed++;
      }
    } catch (error) {
      results.tests.push({
        name: 'Record Donation',
        status: 'FAIL',
        details: error.message
      });
      results.summary.failed++;
    }
    
    // Test 4: Verification Service
    try {
      const verificationService = new BlockchainVerificationService();
      await verificationService.initialize();
      
      const stats = await verificationService.getVerificationStats();
      
      results.tests.push({
        name: 'Verification Service',
        status: 'PASS',
        details: `Found ${stats.totalDonations} donations, ${stats.verifiedCount} verified`
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: 'Verification Service',
        status: 'FAIL',
        details: error.message
      });
      results.summary.failed++;
    }
    
    results.summary.total = results.tests.length;
    
    const statusCode = results.summary.failed === 0 ? 200 : 207; // 207 = Multi-Status
    
    res.status(statusCode).json({
      success: results.summary.failed === 0,
      message: `Tests completed: ${results.summary.passed}/${results.summary.total} passed`,
      results: results
    });
    
  } catch (error) {
    console.error('API test suite failed:', error);
    res.status(500).json({
      success: false,
      message: 'Test suite failed to run',
      error: error.message
    });
  }
});

export default router;