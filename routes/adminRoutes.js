// routes/adminRoutes.js
import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  // Dashboard
  getDashboardStats,
  
  // User management
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  
  // Charity management
  getAllCharitiesAdmin,
  updateCharityAdmin,
  deleteCharity,
  
  // Transfer charity management
  transferCharityManagement,
  
  // Project management
  getAllProjectsAdmin,
  updateProjectAdmin,
  deleteProjectAdmin,
  
  // Donation management
  getAllDonationsAdmin,
  updateDonationAdmin,
  
  // Blockchain verification management
  getAllVerificationsAdmin,
  updateVerificationAdmin,
  deleteVerificationAdmin,
  
  // Analytics & Reporting
  getAnalytics,
  exportData,
  getSystemHealth,
  
  // Bulk operations
  bulkUpdateUsers,
  bulkDeleteUsers,
  
  // Advanced search
  advancedSearch
} from '../controllers/adminController.js';

const router = express.Router();

// Apply authentication and admin authorization to all routes
router.use(authenticate);
router.use(authorize('admin'));

// ==================== DASHBOARD ROUTES ====================
/**
 * @route   GET /admin/dashboard/stats
 * @desc    Get comprehensive dashboard statistics
 * @access  Admin only
 */
router.get('/dashboard/stats', getDashboardStats);

// ==================== USER MANAGEMENT ROUTES ====================
/**
 * @route   GET /admin/users
 * @desc    Get all users with pagination and filtering
 * @access  Admin only
 * @query   page, limit, search, role, sortBy, sortOrder
 */
router.get('/users', getAllUsers);

/**
 * @route   GET /admin/users/:id
 * @desc    Get user by ID with complete details
 * @access  Admin only
 */
router.get('/users/:id', getUserById);

/**
 * @route   POST /admin/users
 * @desc    Create new user
 * @access  Admin only
 * @body    name, email, password, role, phone, address
 */
router.post('/users', createUser);

/**
 * @route   PUT /admin/users/:id
 * @desc    Update user
 * @access  Admin only
 * @body    name, email, role, phone, address, password (optional)
 */
router.put('/users/:id', updateUser);

/**
 * @route   DELETE /admin/users/:id
 * @desc    Delete user (only if no donations or managed charity)
 * @access  Admin only
 * @query   force=true to force delete with all dependencies
 */
router.delete('/users/:id', deleteUser);

/**
 * @route   POST /admin/charities/transfer
 * @desc    Transfer charity management to another user
 * @access  Admin only
 * @body    charityId, newManagerId
 */
router.post('/charities/transfer', transferCharityManagement);

// ==================== CHARITY MANAGEMENT ROUTES ====================
/**
 * @route   GET /admin/charities
 * @desc    Get all charities with pagination and filtering
 * @access  Admin only
 * @query   page, limit, search, category, sortBy, sortOrder
 */
router.get('/charities', getAllCharitiesAdmin);

/**
 * @route   PUT /admin/charities/:id
 * @desc    Update charity details
 * @access  Admin only
 * @body    name, description, mission, phone, category, address, foundedYear
 */
router.put('/charities/:id', updateCharityAdmin);

/**
 * @route   DELETE /admin/charities/:id
 * @desc    Delete charity (only if no donations or projects)
 * @access  Admin only
 */
router.delete('/charities/:id', deleteCharity);

// ==================== PROJECT MANAGEMENT ROUTES ====================
/**
 * @route   GET /admin/projects
 * @desc    Get all projects with pagination and filtering
 * @access  Admin only
 * @query   page, limit, search, status, charityId, sortBy, sortOrder
 */
router.get('/projects', getAllProjectsAdmin);

/**
 * @route   PUT /admin/projects/:id
 * @desc    Update project details
 * @access  Admin only
 * @body    title, description, goal, currentAmount, startDate, endDate, status
 */
router.put('/projects/:id', updateProjectAdmin);

/**
 * @route   DELETE /admin/projects/:id
 * @desc    Delete project (cancel if has donations, delete if none)
 * @access  Admin only
 */
router.delete('/projects/:id', deleteProjectAdmin);

// ==================== DONATION MANAGEMENT ROUTES ====================
/**
 * @route   GET /admin/donations
 * @desc    Get all donations with pagination and filtering
 * @access  Admin only
 * @query   page, limit, search, status, charityId, projectId, startDate, endDate, sortBy, sortOrder
 */
router.get('/donations', getAllDonationsAdmin);

/**
 * @route   PUT /admin/donations/:id
 * @desc    Update donation details
 * @access  Admin only
 * @body    paymentStatus, message, anonymous
 */
router.put('/donations/:id', updateDonationAdmin);

// Note: Donations are typically not deleted, only status updated

// ==================== BLOCKCHAIN VERIFICATION ROUTES ====================
/**
 * @route   GET /admin/verifications
 * @desc    Get all blockchain verifications with pagination and filtering
 * @access  Admin only
 * @query   page, limit, verified, search, sortBy, sortOrder
 */
router.get('/verifications', getAllVerificationsAdmin);

/**
 * @route   PUT /admin/verifications/:id
 * @desc    Update blockchain verification
 * @access  Admin only
 * @body    verified, transactionHash, blockNumber
 */
router.put('/verifications/:id', updateVerificationAdmin);

/**
 * @route   DELETE /admin/verifications/:id
 * @desc    Delete blockchain verification record
 * @access  Admin only
 */
router.delete('/verifications/:id', deleteVerificationAdmin);

// ==================== ANALYTICS & REPORTING ROUTES ====================
/**
 * @route   GET /admin/analytics
 * @desc    Get analytics data with timeframe
 * @access  Admin only
 * @query   timeframe (7d, 30d, 90d, 1y)
 */
router.get('/analytics', getAnalytics);

/**
 * @route   GET /admin/export
 * @desc    Export data in JSON or CSV format
 * @access  Admin only
 * @query   entity, format, filters
 */
router.get('/export', exportData);

/**
 * @route   GET /admin/system/health
 * @desc    Get system health report
 * @access  Admin only
 */
router.get('/system/health', getSystemHealth);

// ==================== BULK OPERATIONS ROUTES ====================
/**
 * @route   PUT /admin/users/bulk
 * @desc    Bulk update users
 * @access  Admin only
 * @body    userIds[], updateData{}
 */
router.put('/users/bulk', bulkUpdateUsers);

/**
 * @route   DELETE /admin/users/bulk
 * @desc    Bulk delete users
 * @access  Admin only
 * @body    userIds[]
 */
router.delete('/users/bulk', bulkDeleteUsers);

// ==================== ADVANCED SEARCH ROUTES ====================
/**
 * @route   POST /admin/search
 * @desc    Advanced search across entities
 * @access  Admin only
 * @body    entity, searchTerm, filters, dateRange, sortBy, sortOrder, page, limit
 */
router.post('/search', advancedSearch);

// ==================== EXPORT ROUTES ====================
export default router;