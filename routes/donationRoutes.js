import express from 'express';
const router = express.Router();

// Import controllers with named imports
import donationController from '../controllers/donationController.js';

// Import your existing auth middleware
import { authenticate, authorize, authMiddleware } from '../middleware/authMiddleware.js';

// Routes that require authentication
router.post('/create-payment-intent', authenticate, donationController.createPaymentIntent);
router.post('/confirm-payment', authenticate, donationController.confirmPayment);
router.get('/history', authenticate, donationController.getDonationHistory);
router.get('/:id', authenticate, donationController.getDonationDetails);

// Donation statistics routes// In routes/donationRoutes.js - Add a route for donation with pre-filled data
router.get('/create/:type/:id', authenticate, donationController.getDonationContext);
router.get('/charity/:charityId/stats', donationController.getCharityDonationStats);

// Webhook route (no authentication, relies on Stripe signature)
router.post('/webhook', express.raw({ type: 'application/json' }), donationController.handleWebhook);

// In donationRoutes.js
router.get('/:id/verification', authMiddleware.protect, donationController.getVerificationStatus);
router.post('/:id/verify', authMiddleware.protect, donationController.verifyDonationOnBlockchain);
/**
 * @route   GET /donations/blockchain/insights
 * @desc    Get blockchain-specific donation insights and transparency data
 * @access  Authenticated users only
 * @returns Blockchain verification status, transaction hashes, and transparency metrics
 */
router.get('/blockchain/insights', authenticate, donationController.getBlockchainInsights);
router.get('/blockchain/stats', authMiddleware.protect, authMiddleware.restrictTo('admin'), donationController.getBlockchainStats);
router.get('/donor/dashboard-stats', authenticate, donationController.getDonorDashboardStats);

export default router;