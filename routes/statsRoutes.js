// backend/routes/statsRoutes.js - FINAL FIXED VERSION
import express from 'express';
import { 
    getHomepageStats, 
    getDonorStats, 
    getCharityStats, 
    getBlockchainStats, 
    getVerificationStatus 
} from '../controllers/statsController.js';
import auth from '../middleware/authMiddleware.js';

const router = express.Router();

console.log('📊 Setting up statistics routes...');

// ==========================================
// PUBLIC ROUTES (no authentication needed)
// ==========================================

// Homepage statistics - for your main page
router.get('/homepage', getHomepageStats);

// Blockchain verification statistics - public transparency
router.get('/blockchain', getBlockchainStats);

// ==========================================
// PRIVATE ROUTES (authentication required)
// ==========================================

// Donor dashboard statistics
router.get('/donor/:donorId', auth.authenticate, getDonorStats);

// Charity dashboard statistics  
router.get('/charity/:charityId', auth.authenticate, getCharityStats);

// ==========================================
// BLOCKCHAIN VERIFICATION ROUTES
// ==========================================

// Get verification status for a specific donation
router.get('/verification/:donationId', auth.authenticate, getVerificationStatus);

// ==========================================
// ERROR HANDLING MIDDLEWARE
// ==========================================

router.use((error, req, res, next) => {
    console.error('❌ Stats route error:', error);
    res.status(500).json({ 
        success: false,
        error: 'Internal server error in statistics',
        message: error.message 
    });
});

export default router;