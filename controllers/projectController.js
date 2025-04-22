// controllers/projectController.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get all projects with pagination and filtering
export const getAllProjects = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      charityId, 
      search 
    } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build filter object
    const where = {};
    
    // Add status filter if provided
    if (status && status !== 'All') {
      where.status = status;
    }
    
    // Add charity filter if provided
    if (charityId) {
      where.charityId = Number(charityId);
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } }
      ];
    }
    
    // Get projects with pagination
    const projects = await prisma.project.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        Charity: {
          select: {
            id: true,
            name: true,
            category: true
          }
        },
        _count: {
          select: {
            Donation: true
          }
        }
      }
    });
    
    // Get total count for pagination
    const total = await prisma.project.count({ where });
    
    // Calculate progress percentage for each project
    const formattedProjects = projects.map(project => ({
      ...project,
      progressPercentage: Math.min(Math.round((project.currentAmount / project.goal) * 100), 100),
      donationsCount: project._count.Donation,
      daysRemaining: project.endDate ? Math.max(0, Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24))) : null
    }));
    
    res.status(200).json({
      success: true,
      data: {
        projects: formattedProjects,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error retrieving projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving projects',
      error: error.message
    });
  }
};

// Get project by ID
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await prisma.project.findUnique({
      where: { id: Number(id) },
      include: {
        Charity: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            email: true,
            phone: true
          }
        },
        Donation: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            message: true,
            anonymous: true,
            createdAt: true,
            User: {
              select: {
                name: true
              }
            },
            BlockchainVerification: {
              select: {
                transactionHash: true,
                verified: true
              }
            }
          }
        },
        _count: {
          select: {
            Donation: true
          }
        }
      }
    });
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Calculate progress percentage
    const progressPercentage = Math.min(Math.round((project.currentAmount / project.goal) * 100), 100);
    
    // Calculate days remaining if end date exists
    const daysRemaining = project.endDate 
      ? Math.max(0, Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
      : null;
    
    // Format donations for privacy and readability
    const formattedDonations = project.Donation.map(donation => ({
      id: donation.id,
      amount: donation.amount,
      message: donation.message || null,
      donorName: donation.anonymous ? 'Anonymous Donor' : donation.User.name,
      date: donation.createdAt,
      verified: donation.BlockchainVerification?.verified || false,
      transactionHash: donation.BlockchainVerification?.transactionHash || null
    }));
    
    // Prepare response
    const response = {
      ...project,
      progressPercentage,
      daysRemaining,
      donationsCount: project._count.Donation,
      recentDonations: formattedDonations
    };
    
    res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error retrieving project:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving project',
      error: error.message
    });
  }
};

// Create a new project (for charity managers and admins)
export const createProject = async (req, res) => {
  try {
    const {
      title,
      description,
      goal,
      startDate,
      endDate,
      charityId
    } = req.body;
    
    // Extract user ID from authenticated user
    const userId = req.user.id;
    
    // Check if user is charity owner or admin
    const charity = await prisma.charity.findUnique({
      where: { id: Number(charityId) }
    });
    
    if (!charity) {
      return res.status(404).json({
        success: false,
        message: 'Charity not found'
      });
    }
    
    // Check if user is authorized to create projects for this charity
    if (charity.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to create projects for this charity'
      });
    }
    
    // Create project
    const project = await prisma.project.create({
      data: {
        title,
        description,
        goal: parseFloat(goal),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        charityId: Number(charityId),
        updatedAt: new Date()
      }
    });
    
    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating project',
      error: error.message
    });
  }
};

// Update project
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      goal,
      startDate,
      endDate,
      status
    } = req.body;
    
    // Extract user ID from authenticated user
    const userId = req.user.id;
    
    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id: Number(id) },
      include: {
        Charity: true
      }
    });
    
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user is charity owner or admin
    if (existingProject.Charity.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this project'
      });
    }
    
    // Update project
    const project = await prisma.project.update({
      where: { id: Number(id) },
      data: {
        title,
        description,
        goal: goal ? parseFloat(goal) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        status: status || undefined,
        updatedAt: new Date()
      }
    });
    
    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating project',
      error: error.message
    });
  }
};

// Delete project (soft delete by setting status to CANCELLED)
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Extract user ID from authenticated user
    const userId = req.user.id;
    
    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id: Number(id) },
      include: {
        Charity: true
      }
    });
    
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user is charity owner or admin
    if (existingProject.Charity.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this project'
      });
    }
    
    // Check if project has donations
    const donationsCount = await prisma.donation.count({
      where: { projectId: Number(id) }
    });
    
    if (donationsCount > 0) {
      // If project has donations, mark as CANCELLED instead of deleting
      await prisma.project.update({
        where: { id: Number(id) },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      });
      
      return res.status(200).json({
        success: true,
        message: 'Project cancelled successfully',
        data: { id: Number(id) }
      });
    }
    
    // If no donations, actually delete the project
    await prisma.project.delete({
      where: { id: Number(id) }
    });
    
    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      data: { id: Number(id) }
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting project',
      error: error.message
    });
  }
};

// Get project statuses (for dropdown filters)
export const getProjectStatuses = async (req, res) => {
  try {
    // Define statuses based on your schema enum
    const statuses = [
      'ACTIVE',
      'COMPLETED',
      'CANCELLED',
      'PAUSED'
    ];
    
    res.status(200).json({
      success: true,
      data: statuses
    });
  } catch (error) {
    console.error('Error retrieving project statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving project statuses',
      error: error.message
    });
  }
};

// Get projects by charity ID
export const getProjectsByCharityId = async (req, res) => {
  try {
    const { charityId } = req.params;
    console.log('Charity ID:', charityId);
    // Validate charityId
    if (!charityId || isNaN(charityId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid charity ID'
      });
    }
    const { status } = req.query;
    console.log('Status filter:', status);
    
    // Build filter object
    const where = {
      charityId: Number(charityId)
    };
    
    // Add status filter if provided
    if (status && status !== 'All') {
      where.status = status;
    }
    
    const projects = await prisma.project.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: {
            Donation: true
          }
        }
      }
    });
    
    // Calculate progress percentage for each project
    const formattedProjects = projects.map(project => ({
      ...project,
      progressPercentage: Math.min(Math.round((project.currentAmount / project.goal) * 100), 100),
      donationsCount: project._count.Donation,
      daysRemaining: project.endDate ? Math.max(0, Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24))) : null
    }));
    
    res.status(200).json({
      success: true,
      data: formattedProjects
    });
  } catch (error) {
    console.error('Error retrieving charity projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving charity projects',
      error: error.message
    });
  }
};

// Update project funding amount (internal use for when donations are made)
export const updateProjectFunding = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    
    // Admin only endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update project funding'
      });
    }
    
    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id: Number(id) }
    });
    
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Update project funding
    const newAmount = existingProject.currentAmount + parseFloat(amount);
    
    // Check if project should be marked as completed
    let status = existingProject.status;
    if (newAmount >= existingProject.goal && status === 'ACTIVE') {
      status = 'COMPLETED';
    }
    
    // Update project
    const project = await prisma.project.update({
      where: { id: Number(id) },
      data: {
        currentAmount: newAmount,
        status,
        updatedAt: new Date()
      }
    });
    
    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error updating project funding:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating project funding',
      error: error.message
    });
  }
};