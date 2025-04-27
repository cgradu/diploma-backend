// routes/projectRoutes.js
import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectStatuses,
  getProjectsByCharityId,
  updateProjectFunding
} from '../controllers/projectController.js';

const router = express.Router();

// Public routes - specific routes first, then parameterized routes
router.get('/', getAllProjects);
router.get('/statuses', getProjectStatuses);
router.get('/:id', getProjectById); // This should come after other specific routes
router.get('/charity/:charityId', getProjectsByCharityId); // projects/charity/:charityId

// Protected routes (require authentication)
router.use(authenticate);

// Create project (charity managers and admins)
router.post('/', authorize('charity', 'admin'), createProject);

// Update and delete projects (charity managers and admins)
router.put('/:id', authorize('charity', 'admin'), updateProject);
router.delete('/:id', authorize('charity', 'admin'), deleteProject);

// Admin-only route to update project funding
router.put('/:id/funding', authorize('admin'), updateProjectFunding);

export default router;