// backend/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authenticate = async (req, res, next) => {
  try {
    console.log(`Auth request to: ${req.method} ${req.originalUrl}`);
    
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'Authorization denied. No token provid,ed.' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Authorization denied. Invalid token format.' 
      });
    }
    

    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false,
          message: 'Token has expired. Please login again.' 
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid token format.' 
        });
      } else {
        return res.status(401).json({ 
          success: false,
          message: 'Token verification failed.' 
        });
      }
    }
    
    console.log('User ID from token:', decoded.id);
    
    // Check if user exists - AWAIT the database query
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          address: true
        }
      });
    } catch (dbError) {
      console.error('Database error during authentication:', dbError);
      return res.status(500).json({ 
        success: false,
        message: 'Database connection error during authentication.' 
      });
    }
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found. Invalid token.' 
      });
    }
    
    // Add user data to request object
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      address: user.address
    };
    
    console.log('Authentication successful for user:', user.email);
    next();
    
  } catch (error) {
    console.error('Unexpected authentication error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P1001') {
      return res.status(500).json({ 
        success: false,
        message: 'Database connection failed. Please try again later.' 
      });
    } else if (error.code === 'P2025') {
      return res.status(401).json({ 
        success: false,
        message: 'User not found.' 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error during authentication.',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};


export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated. Please login first.'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      });
    }
    
    next();
  };
};

export const protect = authenticate;
export const restrictTo = (...roles) => authorize(...roles);

export const authMiddleware = {
  authenticate,
  authorize,
  protect,
  restrictTo
};

export default authMiddleware;