// controllers/charityController.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// controllers/charityController.js - Update public queries

// controllers/charityController.js - Update public queries

export const getAllCharities = async (req, res) => {
  try {
    const { page, limit, category, search, all } = req.query;
    
    // IMPORTANT: Only show ACTIVE charities to public
    const where = {
      status: 'ACTIVE' // This filters out SUSPENDED and CANCELLED charities
    };
    
    if (category && category !== 'All Categories') {
      where.category = category;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { mission: { contains: search } },
        { address: { contains: search } }
      ];
    }

    // Rest of the function remains the same...
    const shouldPaginate = !all && page && limit;
    
    const paginationOptions = shouldPaginate ? {
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    } : {};
    
    const charities = await prisma.charity.findMany({
      where, // This now includes status: 'ACTIVE'
      ...paginationOptions,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            projects: true,
            donations: true
          }
        },
        projects: {
          where: { status: 'ACTIVE' }, // Also filter active projects
          take: 3,
          select: {
            id: true,
            title: true,
            goal: true,
            currentAmount: true,
            status: true
          }
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    const total = await prisma.charity.count({ where });
    
    // Format response...
    const formattedCharities = charities.map(charity => ({
      id: charity.id,
      name: charity.name,
      description: charity.description,
      category: charity.category,
      address: charity.address,
      foundedYear: charity.foundedYear,
      createdAt: charity.createdAt,
      status: charity.status, // Include status in response
      manager: charity.manager,
      verified: true, // Active charities are verified
      impactMetrics: {
        donationsCount: charity._count.donations,
        projectsCount: charity._count.projects
      },
      featuredProjects: charity.projects
    }));
    
    // Return response...
    res.status(200).json({
      success: true,
      data: {
        charities: formattedCharities,
        pagination: shouldPaginate ? {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        } : { total }
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

// Admin queries can see all statuses by filtering
export const getAllCharitiesAdmin = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      category, 
      status = 'all', // Admin can filter by status
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const where = {};

    // Status filter for admin
    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { registrationId: { contains: search } }
      ];
    }

    if (category && category !== 'all') {
      where.category = category;
    }

    // Rest of admin query...
    const skip = (Number(page) - 1) * Number(limit);

    const [charities, total] = await Promise.all([
      prisma.charity.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          manager: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: {
              projects: true,
              donations: true
            }
          }
        }
      }),
      prisma.charity.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        charities,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching charities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching charities',
      error: error.message
    });
  }
};
// controllers/charityController.js - Charity manager can delete charity + their account

export const deleteCharity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log(`🗑️ Manager ${userId} attempting to delete charity ID: ${id}`);
    
    // Check if charity exists and user is the manager
    const charity = await prisma.charity.findUnique({
      where: { 
        id: Number(id),
        deletedAt: null // Only find active charities
      },
      include: {
        donations: {
          where: { paymentStatus: 'SUCCEEDED' }
        },
        projects: {
          include: {
            donations: {
              where: { paymentStatus: 'SUCCEEDED' }
            }
          }
        }
      }
    });
    
    if (!charity) {
      return res.status(404).json({
        success: false,
        message: 'Charity not found or already deleted'
      });
    }
    
    // Check if user is the manager of this charity
    if (charity.managerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own charity'
      });
    }
    
    console.log(`📊 Charity "${charity.name}" has ${charity.donations.length} donations`);
    
    // Always soft delete - mark charity as cancelled but keep user role
    await prisma.$transaction(async (tx) => {
      // Update charity status to CANCELLED
      await tx.charity.update({
        where: { id: Number(id) },
        data: {
          status: 'CANCELLED',
          deletedAt: new Date(),
          deletedBy: userId,
          updatedAt: new Date()
        }
      });

      // Cancel all active projects too
      await tx.project.updateMany({
        where: { 
          charityId: Number(id),
          status: 'ACTIVE'
        },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      });

      // Keep user role as 'charity' so they can reactivate
    });

    return res.status(200).json({
      success: true,
      message: `Charity "${charity.name}" has been cancelled. You can reactivate it anytime from your dashboard.`,
      action: 'CANCELLED',
      data: {
        charityId: Number(id),
        charityName: charity.name,
        canReactivate: true,
        donationsPreserved: charity.donations.length,
        projectsCancelled: charity.projects.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error deleting charity:', error);
    
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete charity due to existing dependencies.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error deleting charity',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
// Optional: Add a function to restore cancelled charities (for admins)
export const restoreCharity = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins can restore charities
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can restore cancelled charities'
      });
    }

    const charity = await prisma.charity.findUnique({
      where: { id: Number(id) }
    });

    if (!charity) {
      return res.status(404).json({
        success: false,
        message: 'Charity not found'
      });
    }

    if (charity.status !== 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Charity is not cancelled and cannot be restored'
      });
    }

    // Restore charity to active status
    await prisma.charity.update({
      where: { id: Number(id) },
      data: {
        status: 'ACTIVE',
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: `Charity "${charity.name}" restored successfully`,
      details: {
        charityId: Number(id),
        charityName: charity.name,
        restoredBy: req.user.name,
        restoredAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error restoring charity:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring charity',
      error: error.message
    });
  }
};

export const reactivateCharity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log(`🔄 Manager ${userId} attempting to reactivate charity ID: ${id}`);
    
    // Find cancelled charity
    const charity = await prisma.charity.findUnique({
      where: { 
        id: Number(id),
        status: 'CANCELLED'
      },
      include: {
        projects: {
          where: { status: 'CANCELLED' }
        }
      }
    });
    
    if (!charity) {
      return res.status(404).json({
        success: false,
        message: 'Cancelled charity not found'
      });
    }
    
    // Check if user is the manager
    if (charity.managerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only reactivate your own charity'
      });
    }
    
    // Reactivate charity and projects
    await prisma.$transaction(async (tx) => {
      // Reactivate charity
      await tx.charity.update({
        where: { id: Number(id) },
        data: {
          status: 'ACTIVE',
          deletedAt: null,
          deletedBy: null,
          updatedAt: new Date()
        }
      });

      // Reactivate projects that were cancelled when charity was cancelled
      await tx.project.updateMany({
        where: { 
          charityId: Number(id),
          status: 'CANCELLED'
        },
        data: {
          status: 'ACTIVE',
          updatedAt: new Date()
        }
      });
    });

    return res.status(200).json({
      success: true,
      message: `Charity "${charity.name}" has been reactivated successfully!`,
      data: {
        charityId: Number(id),
        charityName: charity.name,
        projectsReactivated: charity.projects.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error reactivating charity:', error);
    res.status(500).json({
      success: false,
      message: 'Error reactivating charity',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
            projects: true
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
      verified: true, 
      projects: charity.projects,
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
        projectsCount: charity._count.projects
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
        managerId: userId,
        updatedAt: new Date()
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
// Get charity managed by the logged-in user (including cancelled ones)
export const getCharityByManager = async (req, res) => {
  try {
    // Extract user ID from authenticated user
    const userId = req.user.id;
    
    // Make sure we're using the correct data type for managerId (Int)
    const userIdInt = parseInt(userId, 10);
    
    console.log('Looking for charity with managerId:', userIdInt);
    
    // Find charity including cancelled ones (don't filter by deletedAt)
    const charity = await prisma.charity.findUnique({
      where: { managerId: userIdInt },
      include: {
        projects: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          where: { 
            status: { in: ['ACTIVE', 'CANCELLED', 'PAUSED', 'COMPLETED'] } 
          }
        },
        _count: {
          select: {
            donations: true,
            projects: true
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
    
    // Format response with soft delete information
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
      
      // Add soft delete fields
      status: charity.status,
      deletedAt: charity.deletedAt,
      deletedBy: charity.deletedBy,
      
      // Helper flags for frontend
      isActive: charity.status === 'ACTIVE',
      isCancelled: charity.status === 'CANCELLED',
      canReactivate: charity.status === 'CANCELLED',
      
      featuredProjects: charity.projects,
      stats: {
        donationsCount: charity._count.donations,
        projectsCount: charity._count.projects,
        activeProjectsCount: charity.projects.filter(p => p.status === 'ACTIVE').length,
        cancelledProjectsCount: charity.projects.filter(p => p.status === 'CANCELLED').length
      }
    };
    
    console.log(`Found charity: ${charity.name} (Status: ${charity.status})`);
    
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

// Get only active charities for donation
export const getActiveCharities = async (req, res) => {
  try {
    const charities = await prisma.charity.findMany({
      where: {
        // Add any additional conditions for "active" charities if needed
        // For now, we'll assume all charities in the database are active
      },
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        description: true,
        mission: true,
        category: true,
        _count: {
          select: {
            projects: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    });

    // Filter out charities that have no active projects
    const charitiesWithActiveProjects = charities.filter(charity => 
      charity._count.projects > 0
    );

    res.status(200).json({
      success: true,
      data: charitiesWithActiveProjects
    });
  } catch (error) {
    console.error('Error fetching active charities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active charities',
      error: error.message
    });
  }
};