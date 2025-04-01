// controllers/charityController.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all charities with pagination and filtering
export const getAllCharities = async (req, res) => {
  try {
    console.log('GET /charities received with query:', req.query);
    const { page = 1, limit = 10, category, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build filter object
    const where = {};
    
    // Add category filter if provided
    if (category && category !== 'All Categories') {
      where.category = category;
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { mission: { contains: search } },
        { address: { contains: search } }
      ];
    }
    
    // Get charities with pagination and related counts
    const charities = await prisma.charity.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: {
            Donation: true,
            Project: true
          }
        },
        // Include some active projects
        Project: {
          where: { status: 'ACTIVE' },
          take: 3,
          select: {
            id: true,
            title: true,
            goal: true,
            currentAmount: true,
            status: true
          }
        }
      }
    });
    
    // Get total count for pagination
    const total = await prisma.charity.count({ where });
    
    // Format response data
    const formattedCharities = charities.map(charity => ({
      id: charity.id,
      name: charity.name,
      description: charity.description,
      category: charity.category,
      address: charity.address || null,
      foundedYear: charity.foundedYear || null,
      createdAt: charity.createdAt,
      // Add a placeholder logo path - in a real app you'd have proper image handling
      logo: `/uploads/charities/${charity.id}/logo.jpg`,
      verified: true, // Assuming all charities in the system are verified
      // Add impact metrics from counts
      impactMetrics: {
        donationsCount: charity._count.Donation,
        projectsCount: charity._count.Project,
        activeProjects: charity.Project.length
      },
      featuredProjects: charity.Project
    }));
    
    res.status(200).json({
      success: true,
      data: {
        charities: formattedCharities,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error retrieving charities:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving charities',
      error: error.message
    });
  }
};

// Get charity by ID with complete details
export const getCharityById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const charity = await prisma.charity.findUnique({
      where: { id: Number(id) },
      include: {
        Project: {
          orderBy: { createdAt: 'desc' }
        },
        CharityUpdate: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        User: {
          select: {
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            Donation: true,
            Project: true
          }
        },
        // Include recent donations for transparency
        Donation: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            BlockchainVerification: true,
            Project: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    });
    
    if (!charity) {
      return res.status(404).json({
        success: false,
        message: 'Charity not found'
      });
    }
    
    // Add placeholder logo URL
    const charityWithLogo = {
      ...charity,
      logo: `/uploads/charities/${charity.id}/logo.jpg`,
      verified: true // Assuming all charities in the system are verified
    };
    
    res.status(200).json({
      success: true,
      data: charityWithLogo
    });
  } catch (error) {
    console.error('Error retrieving charity:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving charity',
      error: error.message
    });
  }
};

// Create a new charity (for charity registration)
export const createCharity = async (req, res) => {
  try {
    const {
      name,
      description,
      mission,
      email,
      phone,
      registrationId,
      category,
      address,
      foundedYear
    } = req.body;
    
    // Extract user ID from authenticated user
    const userId = req.user.id;
    
    // Create charity
    const charity = await prisma.charity.create({
      data: {
        name,
        description,
        mission,
        email,
        phone,
        registrationId,
        category,
        address,
        foundedYear: foundedYear ? Number(foundedYear) : null,
        userId,
        updatedAt: new Date() // Set initial updatedAt
      }
    });
    
    res.status(201).json({
      success: true,
      data: charity
    });
  } catch (error) {
    console.error('Error creating charity:', error);
    
    // Handle duplicate email or registration ID
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: `A charity with this ${error.meta?.target?.[0] || 'field'} already exists`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating charity',
      error: error.message
    });
  }
};

// Update charity
export const updateCharity = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      mission,
      phone,
      category,
      address,
      foundedYear
    } = req.body;
    
    // Extract user ID from authenticated user
    const userId = req.user.id;
    
    // Check if charity exists and belongs to the user
    const existingCharity = await prisma.charity.findUnique({
      where: { id: Number(id) }
    });
    
    if (!existingCharity) {
      return res.status(404).json({
        success: false,
        message: 'Charity not found'
      });
    }
    
    // Check if user is owner or admin
    if (existingCharity.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this charity'
      });
    }
    
    // Update charity
    const charity = await prisma.charity.update({
      where: { id: Number(id) },
      data: {
        name,
        description,
        mission,
        phone,
        category,
        address,
        foundedYear: foundedYear ? Number(foundedYear) : null,
        updatedAt: new Date()
      }
    });
    
    res.status(200).json({
      success: true,
      data: charity
    });
  } catch (error) {
    console.error('Error updating charity:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating charity',
      error: error.message
    });
  }
};

// Get charity categories
export const getCharityCategories = async (req, res) => {
  try {
    // Convert enum to array of values
    const categories = Object.values(prisma.Charity_category);
    
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error retrieving charity categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving charity categories',
      error: error.message
    });
  }
};