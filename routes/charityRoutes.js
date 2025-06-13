// routes/charityRoutes.js
import express from 'express';
import { 
  getAllCharities, 
  getCharityById, 
  createCharity, 
  updateCharity, 
  getCharityCategories,
  getCharityByManager,
  deleteCharity,
  reactivateCharity,
  getActiveCharities
} from '../controllers/charityController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllCharities); // This will match /charities
router.get('/categories', getCharityCategories); // This will match /charities/categories
router.get('/active', getActiveCharities); // This will match /charities/active
router.get('/managed', authenticate, getCharityByManager);
router.get('/:id', getCharityById); // This will match /charities/:id

// Protected routes
router.post('/', authenticate, createCharity);
router.put('/:id', authenticate, updateCharity);

router.delete('/:id', authenticate, deleteCharity);
router.put('/:id/reactivate', authenticate, reactivateCharity); // Add this route
// Add this route

export default router;