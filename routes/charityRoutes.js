// routes/charityRoutes.js
import express from 'express';
import { 
  getAllCharities, 
  getCharityById, 
  createCharity, 
  updateCharity, 
  getCharityCategories,
  getCharityByManager
} from '../controllers/charityController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllCharities); // This will match /charities
router.get('/categories', getCharityCategories); // This will match /charities/categories
router.get('/managed', authenticate, getCharityByManager);
router.get('/:id', getCharityById); // This will match /charities/:id

// Protected routes
router.post('/', authenticate, createCharity);
router.put('/:id', authenticate, updateCharity);

export default router;