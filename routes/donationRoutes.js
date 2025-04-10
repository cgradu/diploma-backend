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

// Public routes
router.get('/charity/:charityId/stats', donationController.getCharityDonationStats);

export default router;