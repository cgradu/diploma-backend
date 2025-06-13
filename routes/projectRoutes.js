// routes/projectRoutes.js - Enhanced with new endpoints
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
  updateProjectFunding,
  getMyCharityProjects,
  getProjectCreationGuidelines,
  validateProjectData,
  getActiveProjectsByCharityId
} from '../controllers/projectController.js';

const router = express.Router();

// Public routes - specific routes first, then parameterized routes
router.get('/', getAllProjects);
router.get('/statuses', getProjectStatuses);
router.get('/active/charity/:charityId', getActiveProjectsByCharityId); // projects/active/charity/:charityId
router.get('/guidelines', getProjectCreationGuidelines); // New endpoint for project creation guidelines
router.get('/charity/:charityId', getProjectsByCharityId); // projects/charity/:charityId
router.get('/:id', getProjectById); // This should come after other specific routes

// Protected routes (require authentication)
router.use(authenticate);

// Validation endpoint for project data (can be used by frontend for real-time validation)
router.post('/validate', authorize('charity', 'admin'), validateProjectData);

// Get projects for the current charity manager
router.get('/my/charity', authorize('charity'), getMyCharityProjects);

// Create project (charity managers and admins)
router.post('/', authorize('charity', 'admin'), createProject);

// Update and delete projects (charity managers and admins)
router.put('/:id', authorize('charity', 'admin'), updateProject);
router.delete('/:id', authorize('charity', 'admin'), deleteProject);

// Admin-only route to update project funding
router.put('/:id/funding', authorize('admin'), updateProjectFunding);
// Add this route

export default router;