import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/client.js'; // Make sure to include .js extension



export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    console.log(`Auth request to: ${req.method} ${req.originalUrl}`);
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization denied. No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add additional error handling and logging
    console.log('User ID from token:', decoded.id);
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });
    
    if (!user) {
      return res.status(401).json({ message: 'User not found. Invalid token.' });
    }
    
    // Add user data to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    // More descriptive error messaging
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token format' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    } else if (error.code === 'P1001') {
      return res.status(500).json({ message: 'Database connection error' });
    }
    
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

// Create role-based authorization middleware
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access this resource`
      });
    }
    next();
  };
};

// Export as a named object for those importing it as authMiddleware
export const authMiddleware = {
  authenticate,
  authorize
};