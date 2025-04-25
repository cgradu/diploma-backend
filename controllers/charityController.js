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
            // Use the exact relation names from your schema
            projects: true,
            donations: true,
            updates: true
          }
        },
        // Include some active projects
        projects: {
          where: { status: 'ACTIVE' },
          take: 3,
          select: {
            id: true,
            title: true,
            goal: true,
            currentAmount: true,
            status: true
          }
        },
        // Include user (manager) info
        manager: {
          select: {
            id: true,
            name: true,
            email: true
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
      manager: {
        id: charity.manager.id,
        name: charity.manager.name,
        email: charity.manager.email
      },
      // Add a placeholder logo path - in a real app you'd have proper image handling
      logo: `/uploads/charities/${charity.id}/logo.jpg`,
      verified: true, // Assuming all charities in the system are verified
      // Add impact metrics from counts - using the correct relation names
      impactMetrics: {
        donationsCount: charity._count.donations,
        projectsCount: charity._count.projects,
        updatesCount: charity._count.updates
      },
      featuredProjects: charity.projects
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
        projects: {
          orderBy: { createdAt: 'desc' }
        },
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        manager: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        _count: {
          select: {
            donations: true,
            projects: true,
            updates: true
          }
        },
        // Include recent donations for transparency
        donations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            blockchainVerification: true,
            project: {
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
    
    // Add placeholder logo URL and format the response
    const formattedCharity = {
      id: charity.id,
      name: charity.name,
      description: charity.description,
      mission: charity.mission,
      email: charity.email,
      phone: charity.phone,
      registrationId: charity.registrationId,
      category: charity.category,
      address: charity.address,
      foundedYear: charity.foundedYear,
      createdAt: charity.createdAt,
      updatedAt: charity.updatedAt,
      manager: charity.manager,
      logo: `/uploads/charities/${charity.id}/logo.jpg`,
      verified: true, // Assuming all charities in the system are verified
      projects: charity.projects,
      updates: charity.updates,
      recentDonations: charity.donations.map(donation => ({
        id: donation.id,
        amount: donation.amount,
        currency: donation.currency,
        createdAt: donation.createdAt,
        anonymous: donation.anonymous,
        verified: donation.blockchainVerification?.verified || false,
        project: donation.project,
        transactionHash: donation.blockchainVerification?.transactionHash || null
      })),
      stats: {
        donationsCount: charity._count.donations,
        projectsCount: charity._count.projects,
        updatesCount: charity._count.updates
      }
    };
    
    res.status(200).json({
      success: true,
      data: formattedCharity
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
    
    // Check if user already manages a charity
    const existingCharity = await prisma.charity.findUnique({
      where: { managerId: userId }
    });
    
    if (existingCharity) {
      return res.status(400).json({
        success: false,
        message: 'This user already manages a charity. One user can only manage one charity.'
      });
    }
    
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
        managerId: userId, // Associate with user as manager
        updatedAt: new Date() // Set initial updatedAt
      }
    });
    
    // Update user role to charity if not already
    if (req.user.role !== 'charity') {
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'charity' }
      });
    }
    
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
    
    // Check if charity exists
    const existingCharity = await prisma.charity.findUnique({
      where: { id: Number(id) }
    });
    
    if (!existingCharity) {
      return res.status(404).json({
        success: false,
        message: 'Charity not found'
      });
    }
    
    // Check if user is the charity manager or an admin
    if (existingCharity.managerId !== userId && req.user.role !== 'admin') {
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
    // Define categories based on your schema enum
    const categories = [
      'EDUCATION',
      'HEALTHCARE',
      'ENVIRONMENT',
      'HUMANITARIAN',
      'ANIMAL_WELFARE',
      'ARTS_CULTURE',
      'DISASTER_RELIEF',
      'HUMAN_RIGHTS',
      'COMMUNITY_DEVELOPMENT',
      'RELIGIOUS',
      'OTHER'
    ];
    
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

// Get charity managed by the logged-in user
export const getCharityByManager = async (req, res) => {
  try {
    // Extract user ID from authenticated user
    const userId = req.user.id;
    
    // Make sure we're using the correct data type for managerId (Int)
    const userIdInt = parseInt(userId, 10);
    
    console.log('Looking for charity with managerId:', userIdInt);
    
    // Find charity where the managerId matches the user's ID
    const charity = await prisma.charity.findUnique({
      where: { managerId: userIdInt },
      include: {
        projects: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          where: { status: 'ACTIVE' }
        },
        _count: {
          select: {
            donations: true,
            projects: true,
            updates: true
          }
        }
      }
    });
    
    if (!charity) {
      return res.status(404).json({
        success: false,
        message: 'No charity found for this manager'
      });
    }
    
    // Format response
    const formattedCharity = {
      id: charity.id,
      name: charity.name,
      description: charity.description,
      mission: charity.mission,
      email: charity.email,
      phone: charity.phone,
      registrationId: charity.registrationId,
      category: charity.category,
      address: charity.address,
      foundedYear: charity.foundedYear,
      createdAt: charity.createdAt,
      updatedAt: charity.updatedAt,
      managerId: charity.managerId,
      featuredProjects: charity.projects,
      stats: {
        donationsCount: charity._count.donations,
        projectsCount: charity._count.projects,
        updatesCount: charity._count.updates
      }
    };
    
    res.status(200).json({
      success: true,
      data: formattedCharity
    });
  } catch (error) {
    console.error('Error retrieving manager charity:', error);
    console.error('Error details:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error retrieving manager charity',
      error: error.message
    });
  }
};