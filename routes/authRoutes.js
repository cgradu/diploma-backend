// Initialize Express Router
const express = require('express');
const router = express.Router();

// Import controllers and middleware
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/profile', authMiddleware.authenticate, authController.getProfile);

module.exports = router;