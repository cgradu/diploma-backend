// routes/authRoutes.js - Complete implementation with password validation
import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Import controllers and middleware
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { passwordValidationMiddleware, changePasswordValidationMiddleware } from '../utils/passwordValidation.js';

// Async wrapper for route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== PUBLIC ROUTES ====================

/**
 * @route   POST /auth/register
 * @desc    Register a new user with password validation
 * @access  Public
 * @body    { name, email, password, role }
 */
router.post('/register', 
  passwordValidationMiddleware('password'),
  asyncHandler(authController.register)
);

/**
 * @route   POST /auth/login
 * @desc    Login existing user
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', asyncHandler(authController.login));

/**
 * @route   GET /auth/password-requirements
 * @desc    Get password requirements for frontend validation
 * @access  Public
 */
router.get('/password-requirements', (req, res) => {
  res.status(200).json({
    success: true,
    requirements: passwordRequirements,
    message: 'Password requirements retrieved successfully'
  });
});

/**
 * @route   POST /auth/validate-password
 * @desc    Validate password strength (for real-time frontend validation)
 * @access  Public
 * @body    { password }
 */
router.post('/validate-password', (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password is required for validation'
    });
  }
  
  const validation = validatePassword(password);
  
  res.status(200).json({
    success: true,
    validation: {
      isValid: validation.isValid,
      errors: validation.errors,
      strength: validation.strength
    },
    requirements: passwordRequirements
  });
});

/**
 * @route   POST /auth/check-email
 * @desc    Check if email is already registered (for frontend validation)
 * @access  Public
 * @body    { email }
 */
router.post('/check-email', asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }
  
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() }
  });
  
  res.status(200).json({
    success: true,
    available: !existingUser,
    message: existingUser ? 'Email is already registered' : 'Email is available'
  });
}));

// ==================== PROTECTED ROUTES ====================

/**
 * @route   GET /auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', 
  authMiddleware.authenticate, 
  asyncHandler(authController.getProfile)
);

/**
 * @route   PUT /auth/profile
 * @desc    Update user profile
 * @access  Private
 * @body    { name, email, phone, address }
 */
router.put('/profile', 
  authMiddleware.authenticate, 
  asyncHandler(authController.updateProfile)
);

/**
 * @route   PUT /auth/password
 * @desc    Change user password with validation
 * @access  Private
 * @body    { currentPassword, newPassword, confirmPassword }
 */
router.put('/password', 
  authMiddleware.authenticate,
  changePasswordValidationMiddleware,
  asyncHandler(authController.changePassword)
);

/**
 * @route   DELETE /auth/account
 * @desc    Delete user account (anonymize donations)
 * @access  Private
 */
router.delete('/account', 
  authMiddleware.authenticate, 
  async (req, res) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Only allow donors to delete their own accounts
      if (userRole !== 'donor') {
        return res.status(403).json({
          success: false,
          message: 'Account deletion is only available for donors. Please contact support for assistance.'
        });
      }
      
      // Use a transaction to ensure atomicity
      const result = await prisma.$transaction(async (tx) => {
        // Count existing donations
        const donationCount = await tx.donation.count({
          where: { donorId: userId }
        });
        
        // Anonymize all donations before deleting user
        if (donationCount > 0) {
          await tx.donation.updateMany({
            where: { donorId: userId },
            data: { 
              anonymous: true,
              // Optionally clear personal messages
              message: null
            }
          });
        }
        
        // Delete the user account
        await tx.user.delete({
          where: { id: userId }
        });
        
        return donationCount;
      });
      
      res.status(200).json({
        success: true,
        message: result > 0 
          ? `Account deleted successfully. ${result} donations have been anonymized to preserve donation transparency.`
          : 'Account deleted successfully.',
        anonymizedDonations: result
      });
      
    } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting account'
      });
    }
  }
);

/**
 * @route   GET /auth/test
 * @desc    Test authentication endpoint
 * @access  Private
 */
router.get('/test', 
  authMiddleware.authenticate, 
  (req, res) => {
    res.json({
      success: true,
      message: 'Authentication working correctly',
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        name: req.user.name
      },
      timestamp: new Date().toISOString()
    });
  }
);

// ==================== ADMIN ROUTES ====================

/**
 * @route   POST /auth/admin/create-user
 * @desc    Admin endpoint to create user with password validation
 * @access  Admin only
 * @body    { name, email, password, role, phone, address }
 */
router.post('/admin/create-user', 
  authMiddleware.authenticate,
  authMiddleware.authorize('admin'),
  passwordValidationMiddleware('password'),
  asyncHandler(async (req, res) => {
    try {
      const { name, email, password, role, phone, address } = req.body;
      
      // Validate required fields
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        });
      }
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Validate role
      const validRoles = ['donor', 'charity', 'admin'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: role || 'donor',
          phone: phone?.trim() || null,
          address: address?.trim() || null
        }
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Admin create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating user',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * @route   PUT /auth/admin/reset-password/:userId
 * @desc    Admin endpoint to reset user password
 * @access  Admin only
 * @body    { newPassword }
 */
router.put('/admin/reset-password/:userId',
  authMiddleware.authenticate,
  authMiddleware.authorize('admin'),
  passwordValidationMiddleware('newPassword'),
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      // Validate userId
      if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json({
          success: false,
          message: 'Valid user ID is required'
        });
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: { id: true, email: true, name: true, role: true }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prevent admin from resetting their own password this way
      if (user.id === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reset your own password using this endpoint. Use the regular password change endpoint.'
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update password
      await prisma.user.update({
        where: { id: parseInt(userId) },
        data: { 
          password: hashedPassword,
          updatedAt: new Date()
        }
      });

      res.status(200).json({
        success: true,
        message: `Password reset successfully for user: ${user.email}`,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Admin reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Error resetting password',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * @route   GET /auth/admin/users
 * @desc    Admin endpoint to list all users (basic info)
 * @access  Admin only
 * @query   ?page=1&limit=10&role=donor&search=email
 */
router.get('/admin/users',
  authMiddleware.authenticate,
  authMiddleware.authorize('admin'),
  asyncHandler(async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        role, 
        search 
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const where = {};

      // Add role filter
      if (role && ['donor', 'charity', 'admin'].includes(role)) {
        where.role = role;
      }

      // Add search filter
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } }
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                donations: true
              }
            }
          }
        }),
        prisma.user.count({ where })
      ]);

      res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Admin list users error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving users'
      });
    }
  })
);

// ==================== ERROR HANDLING ====================

// Route-specific error handler
router.use((error, req, res, next) => {
  console.error('Auth route error:', error);
  
  // Handle specific Prisma errors
  if (error.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A user with this email already exists'
    });
  }
  
  if (error.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Default error response
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Authentication error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

export default router;