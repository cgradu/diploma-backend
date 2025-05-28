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

// Donation statistics routes
router.get('/charity/:charityId/stats', donationController.getCharityDonationStats);

// Webhook route (no authentication, relies on Stripe signature)
router.post('/webhook', express.raw({ type: 'application/json' }), donationController.handleWebhook);

// In donationRoutes.js
router.get('/:id/verification', authMiddleware.protect, donationController.getVerificationStatus);
router.post('/:id/verify', authMiddleware.protect, donationController.verifyDonationOnBlockchain);
router.get('/blockchain/stats', authMiddleware.protect, authMiddleware.restrictTo('admin'), donationController.getBlockchainStats);

export default router;