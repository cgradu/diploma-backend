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

router.get('/', getAllProjects);
router.get('/statuses', getProjectStatuses);
router.get('/active/charity/:charityId', getActiveProjectsByCharityId);
router.get('/charity/:charityId', getProjectsByCharityId);

router.use(authenticate);

router.post('/validate', authorize('charity', 'admin'), validateProjectData);

router.get('/my/charity', authorize('charity'), getMyCharityProjects);

router.post('/', authorize('charity', 'admin'), createProject);

router.put('/:id', authorize('charity', 'admin'), updateProject);
router.delete('/:id', authorize('charity', 'admin'), deleteProject);

export default router;