// controllers/projectController.js - Enhanced version
import { prisma } from '../prisma/client.js';  // Changed this line

// Import existing functions from your current controller
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
        charity: {
          select: {
            id: true,
            name: true,
            category: true
          }
        },
        _count: {
          select: {
            donations: true
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
      donationsCount: project._count.donations,
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
        charity: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            email: true,
            phone: true
          }
        },
        donations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            message: true,
            anonymous: true,
            createdAt: true,
            donor: {
              select: {
                name: true
              }
            },
            blockchainVerification: {
              select: {
                transactionHash: true,
                verified: true
              }
            }
          }
        },
        _count: {
          select: {
            donations: true
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
    const formattedDonations = project.donations.map(donation => ({
      id: donation.id,
      amount: donation.amount,
      message: donation.message || null,
      donorName: donation.anonymous ? 'Anonymous Donor' : donation.donor.name,
      date: donation.createdAt,
      verified: donation.blockchainVerification?.verified || false,
      transactionHash: donation.blockchainVerification?.transactionHash || null
    }));
    
    // Prepare response
    const response = {
      ...project,
      progressPercentage,
      daysRemaining,
      donationsCount: project._count.donations,
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

// Get projects by charity ID
export const getProjectsByCharityId = async (req, res) => {
  try {
    const { charityId } = req.params;
    // Validate charityId
    if (!charityId || isNaN(charityId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid charity ID'
      });
    }
    
    // Build filter object
    const where = {
      charityId: Number(charityId)
    };
    
    const projects = await prisma.project.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: {
            donations: true
          }
        }
      }
    });
    
    // Calculate progress percentage for each project
    const formattedProjects = projects.map(project => ({
      ...project,
      progressPercentage: Math.min(Math.round((project.currentAmount / project.goal) * 100), 100),
      donationsCount: project._count.donations,
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

// Update existing functions
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
        charity: true
      }
    });
    
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user is charity owner or admin
    if (existingProject.charity.managerId !== userId && req.user.role !== 'admin') {
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
        charity: true
      }
    });
    
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user is charity owner or admin
    if (existingProject.charity.managerId !== userId && req.user.role !== 'admin') {
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

// Create a new project (for charity managers and admins)
export const createProject = async (req, res) => {
  try {
    const {
      title,
      description,
      goal,
      startDate,
      endDate,
      charityId // This can be optional if we derive it from the user
    } = req.body;
    
    // Extract user ID from authenticated user
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Validate required fields
    if (!title || !description || !goal || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, goal, and start date are required',
        errors: {
          title: !title ? 'Title is required' : null,
          description: !description ? 'Description is required' : null,
          goal: !goal ? 'Goal amount is required' : null,
          startDate: !startDate ? 'Start date is required' : null
        }
      });
    }

    // Validate goal is a positive number
    const goalAmount = parseFloat(goal);
    if (isNaN(goalAmount) || goalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Goal must be a positive number',
        field: 'goal'
      });
    }

    // Validate dates
    const projectStartDate = new Date(startDate);
    const projectEndDate = endDate ? new Date(endDate) : null;
    
    if (isNaN(projectStartDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start date format',
        field: 'startDate'
      });
    }

    if (projectEndDate && isNaN(projectEndDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid end date format',
        field: 'endDate'
      });
    }

    if (projectEndDate && projectEndDate <= projectStartDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date',
        field: 'endDate'
      });
    }

    let targetCharityId;

    // Determine which charity to create the project for
    if (userRole === 'admin') {
      // Admins can create projects for any charity if charityId is provided
      if (!charityId) {
        return res.status(400).json({
          success: false,
          message: 'Charity ID is required for admin users',
          field: 'charityId'
        });
      }
      targetCharityId = parseInt(charityId);
    } else if (userRole === 'charity') {
      // Charity managers can only create projects for their own charity
      const userCharity = await prisma.charity.findUnique({
        where: { managerId: userId },
        select: { id: true, name: true }
      });

      if (!userCharity) {
        return res.status(403).json({
          success: false,
          message: 'You must be managing a charity to create projects'
        });
      }

      // If charityId is provided, verify it matches the user's charity
      if (charityId && parseInt(charityId) !== userCharity.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only create projects for your own charity'
        });
      }

      targetCharityId = userCharity.id;
    } else {
      return res.status(403).json({
        success: false,
        message: 'Only charity managers and admins can create projects'
      });
    }

    // Verify the target charity exists
    const charity = await prisma.charity.findUnique({
      where: { id: targetCharityId },
      include: {
        manager: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    
    if (!charity) {
      return res.status(404).json({
        success: false,
        message: 'Charity not found'
      });
    }

    // Additional validation: Check if the charity manager is active
    if (userRole === 'charity' && charity.managerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to create projects for this charity'
      });
    }

    // Check for duplicate project titles within the same charity (optional business rule)
    const existingProject = await prisma.project.findFirst({
      where: {
        charityId: targetCharityId,
        title: title.trim()
      }
    });

    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: 'A project with this title already exists for this charity',
        field: 'title'
      });
    }

    // Create the project
    const project = await prisma.project.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        goal: goalAmount,
        startDate: projectStartDate,
        endDate: projectEndDate,
        charityId: targetCharityId,
        currentAmount: 0, // Always start at 0
        status: 'ACTIVE', // New projects are always active
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        charity: {
          select: {
            id: true,
            name: true,
            category: true,
            manager: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    // Calculate additional fields for response
    const response = {
      ...project,
      progressPercentage: 0, // New project starts at 0%
      donationsCount: 0, // No donations yet
      daysRemaining: projectEndDate ? 
        Math.max(0, Math.ceil((projectEndDate - new Date()) / (1000 * 60 * 60 * 24))) : 
        null,
      isActive: true,
      canReceiveDonations: true
    };

    console.log(`✅ Project "${project.title}" created successfully for charity "${charity.name}" by user ${req.user.name}`);

    res.status(201).json({
      success: true,
      message: `Project "${project.title}" created successfully`,
      data: response
    });

  } catch (error) {
    console.error('Error creating project:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'A project with these details already exists',
        error: 'Duplicate entry'
      });
    }
    
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Invalid charity reference',
        error: 'Foreign key constraint failed'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating project',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get projects for the current charity manager
export const getMyCharityProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'charity') {
      return res.status(403).json({
        success: false,
        message: 'Only charity managers can access this endpoint'
      });
    }

    // Get the charity managed by this user
    const charity = await prisma.charity.findUnique({
      where: { managerId: userId },
      select: { id: true, name: true }
    });

    if (!charity) {
      return res.status(404).json({
        success: false,
        message: 'No charity found for this manager'
      });
    }

    // Get all projects for this charity
    const projects = await prisma.project.findMany({
      where: { charityId: charity.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            donations: {
              where: { paymentStatus: 'SUCCEEDED' }
            }
          }
        }
      }
    });

    // Format projects with additional calculated fields
    const formattedProjects = projects.map(project => ({
      ...project,
      progressPercentage: project.goal > 0 ? 
        Math.min(Math.round((project.currentAmount / project.goal) * 100), 100) : 0,
      donationsCount: project._count.donations,
      daysRemaining: project.endDate ? 
        Math.max(0, Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24))) : 
        null,
      canEdit: true, // Charity managers can always edit their projects
      canDelete: project._count.donations === 0, // Can only delete if no donations
      charity: {
        id: charity.id,
        name: charity.name
      }
    }));

    res.status(200).json({
      success: true,
      data: {
        charity: charity,
        projects: formattedProjects,
        totalProjects: formattedProjects.length,
        activeProjects: formattedProjects.filter(p => p.status === 'ACTIVE').length,
        completedProjects: formattedProjects.filter(p => p.status === 'COMPLETED').length
      }
    });

  } catch (error) {
    console.error('Error fetching charity projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching charity projects',
      error: error.message
    });
  }
};

// Get project creation requirements/guidelines
export const getProjectCreationGuidelines = async (req, res) => {
  try {
    const guidelines = {
      requirements: {
        title: {
          required: true,
          minLength: 5,
          maxLength: 100,
          description: 'Project title should be clear and descriptive'
        },
        description: {
          required: true,
          minLength: 50,
          maxLength: 2000,
          description: 'Detailed description of project goals and impact'
        },
        goal: {
          required: true,
          minimum: 100,
          maximum: 1000000,
          currency: 'RON',
          description: 'Funding goal in Romanian Lei (RON)'
        },
        startDate: {
          required: true,
          earliestDate: new Date().toISOString().split('T')[0],
          description: 'Project start date (cannot be in the past)'
        },
        endDate: {
          required: false,
          description: 'Optional project end date'
        }
      },
      tips: [
        'Choose a clear, compelling title that explains your project',
        'Include specific goals and expected outcomes in your description',
        'Set a realistic funding goal based on actual project costs',
        'Consider seasonal factors when setting start and end dates',
        'Projects with detailed descriptions receive more donations',
        'Regular updates help maintain donor engagement'
      ],
      categories: [
        'EDUCATION', 'HEALTHCARE', 'ENVIRONMENT', 'HUMANITARIAN',
        'ANIMAL_WELFARE', 'ARTS_CULTURE', 'DISASTER_RELIEF',
        'HUMAN_RIGHTS', 'COMMUNITY_DEVELOPMENT', 'RELIGIOUS', 'OTHER'
      ],
      statuses: [
        { value: 'ACTIVE', description: 'Accepting donations' },
        { value: 'COMPLETED', description: 'Goal reached or project finished' },
        { value: 'PAUSED', description: 'Temporarily not accepting donations' },
        { value: 'CANCELLED', description: 'Project cancelled' }
      ]
    };

    res.status(200).json({
      success: true,
      data: guidelines
    });
  } catch (error) {
    console.error('Error fetching project guidelines:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching project guidelines'
    });
  }
};

// Validate project data before creation (can be used by frontend)
export const validateProjectData = async (req, res) => {
  try {
    const { title, description, goal, startDate, endDate } = req.body;
    const errors = {};
    const warnings = [];

    // Validate title
    if (!title || title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters long';
    } else if (title.trim().length > 100) {
      errors.title = 'Title must be less than 100 characters';
    }

    // Validate description
    if (!description || description.trim().length < 50) {
      errors.description = 'Description must be at least 50 characters long';
    } else if (description.trim().length > 2000) {
      errors.description = 'Description must be less than 2000 characters';
    }

    // Validate goal
    const goalAmount = parseFloat(goal);
    if (!goal || isNaN(goalAmount) || goalAmount <= 0) {
      errors.goal = 'Goal must be a positive number';
    } else if (goalAmount < 100) {
      errors.goal = 'Minimum goal is 100 RON';
    } else if (goalAmount > 1000000) {
      errors.goal = 'Maximum goal is 1,000,000 RON';
    } else if (goalAmount > 50000) {
      warnings.push('High funding goals may be harder to achieve');
    }

    // Validate dates
    if (!startDate) {
      errors.startDate = 'Start date is required';
    } else {
      const start = new Date(startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (start < today) {
        errors.startDate = 'Start date cannot be in the past';
      }
    }

    if (endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end <= start) {
        errors.endDate = 'End date must be after start date';
      }
      
      const daysDifference = (end - start) / (1000 * 60 * 60 * 24);
      if (daysDifference > 365) {
        warnings.push('Projects longer than 1 year may lose donor interest');
      } else if (daysDifference < 30) {
        warnings.push('Very short projects may not have enough time to gain momentum');
      }
    }

    // Check for potential duplicate titles if charity is known
    if (req.user.role === 'charity' && title) {
      const charity = await prisma.charity.findUnique({
        where: { managerId: req.user.id }
      });

      if (charity) {
        const existingProject = await prisma.project.findFirst({
          where: {
            charityId: charity.id,
            title: title.trim(),
            status: { not: 'CANCELLED' }
          }
        });

        if (existingProject) {
          errors.title = 'A project with this title already exists';
        }
      }
    }

    const isValid = Object.keys(errors).length === 0;

    res.status(200).json({
      success: true,
      data: {
        isValid,
        errors: Object.keys(errors).length > 0 ? errors : null,
        warnings: warnings.length > 0 ? warnings : null,
        summary: isValid ? 
          'Project data is valid and ready for creation' : 
          `Found ${Object.keys(errors).length} validation errors`
      }
    });

  } catch (error) {
    console.error('Error validating project data:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating project data',
      error: error.message
    });
  }
};

// Get only active projects for a charity
export const getActiveProjectsByCharityId = async (req, res) => {
  try {
    const { charityId } = req.params;
    
    if (!charityId || isNaN(charityId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid charity ID is required'
      });
    }
    
    const projects = await prisma.project.findMany({
      where: {
        charityId: Number(charityId),
        status: 'ACTIVE'
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        description: true,
        goal: true,
        currentAmount: true,
        status: true,
        startDate: true,
        endDate: true,
        _count: {
          select: {
            donations: {
              where: { paymentStatus: 'SUCCEEDED' }
            }
          }
        }
      }
    });
    
    // Calculate progress percentage for each project
    const formattedProjects = projects.map(project => ({
      ...project,
      progressPercentage: Math.min(Math.round((project.currentAmount / project.goal) * 100), 100),
      donationsCount: project._count.donations,
      daysRemaining: project.endDate ? Math.max(0, Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24))) : null
    }));
    
    res.status(200).json({
      success: true,
      data: formattedProjects
    });
  } catch (error) {
    console.error('Error fetching active projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active projects',
      error: error.message
    });
  }
};