// controllers/adminController.js
import { prisma } from '../prisma/client.js';  // Changed this line
import bcrypt from 'bcryptjs';
import { validatePassword } from '../utils/passwordValidation.js';


export const getDashboardStats = async (req, res) => {
  try {
    // Check admin authorization
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized. Admin access required.' 
      });
    }

    // Get comprehensive statistics
    const [
      totalUsers,
      totalCharities,
      totalProjects,
      totalDonations,
      totalDonationAmount,
      verifiedDonations,
      pendingVerifications,
      usersByRole,
      recentActivity
    ] = await Promise.all([
      // Total counts
      prisma.user.count(),
      prisma.charity.count(),
      prisma.project.count(),
      prisma.donation.count({ where: { paymentStatus: 'SUCCEEDED' } }),
      
      // Total donation amount
      prisma.donation.aggregate({
        where: { paymentStatus: 'SUCCEEDED' },
        _sum: { amount: true }
      }),
      
      // Blockchain verification stats
      prisma.blockchainVerification.count({ where: { verified: true } }),
      prisma.blockchainVerification.count({ where: { verified: false } }),
      
      // Users by role
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      }),
      
      // Recent activity (last 10 donations)
      prisma.donation.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          donor: { select: { name: true, email: true } },
          charity: { select: { name: true } },
          project: { select: { title: true } }
        }
      })
    ]);

    // Calculate monthly trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyStats = await prisma.donation.findMany({
      where: {
        paymentStatus: 'SUCCEEDED',
        createdAt: { gte: sixMonthsAgo }
      },
      select: { amount: true, createdAt: true }
    });

    // Group by month
    const monthlyData = {};
    monthlyStats.forEach(donation => {
      const month = donation.createdAt.toISOString().substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { count: 0, amount: 0 };
      }
      monthlyData[month].count += 1;
      monthlyData[month].amount += donation.amount;
    });

    const trendData = Object.keys(monthlyData)
      .sort()
      .map(month => ({
        month,
        donations: monthlyData[month].count,
        amount: monthlyData[month].amount
      }));

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalCharities,
          totalProjects,
          totalDonations,
          totalDonationAmount: totalDonationAmount._sum.amount || 0,
          verificationRate: totalDonations > 0 ? (verifiedDonations / totalDonations) * 100 : 0
        },
        usersByRole: usersByRole.reduce((acc, item) => {
          acc[item.role] = item._count.role;
          return acc;
        }, {}),
        blockchain: {
          verifiedDonations,
          pendingVerifications,
          totalRecords: verifiedDonations + pendingVerifications
        },
        trends: trendData,
        recentActivity: recentActivity.map(donation => ({
          id: donation.id,
          amount: donation.amount,
          currency: donation.currency,
          donor: donation.anonymous ? 'Anonymous' : donation.donor.name,
          charity: donation.charity.name,
          project: donation.project?.title || 'General donation',
          date: donation.createdAt,
          status: donation.paymentStatus
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};

// ==================== USER MANAGEMENT ====================
export const getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { 
      page = 1, 
      limit = 10, 
      search, 
      role, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    if (role && role !== 'all') {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          managedCharity: {
            select: { id: true, name: true }
          },
          _count: {
            select: { donations: true }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          managedCharity: user.managedCharity,
          donationsCount: user._count.donations
        })),
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      include: {
        managedCharity: true,
        donations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            charity: { select: { name: true } },
            project: { select: { title: true } }
          }
        },
        _count: {
          select: { donations: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        ...user,
        password: undefined // Never return password
      }
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Replace your existing createUser function with this updated version:
export const createUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { name, email, password, role, phone, address } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
        errors: {
          name: !name ? 'Name is required' : null,
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null
        }
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors,
        requirements: passwordValidation.requirements,
        strength: passwordValidation.strength
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'donor',
        phone,
        address
      }
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
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
    console.error('Error creating user:', error);
    
    // Handle Prisma unique constraint violations
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Email is already taken'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

// Replace your existing updateUser function with this updated version:
export const updateUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { name, email, role, phone, address, password } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: Number(id) }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updateData = { name, email, role, phone, address };

    // If password is being updated, validate it
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements',
          errors: passwordValidation.errors,
          requirements: passwordValidation.requirements,
          strength: passwordValidation.strength
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(12);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating user:', error);
    
    // Handle Prisma unique constraint violations
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Email is already taken by another user'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

// Add this new function for transferring charity management
export const transferCharityManagement = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { charityId, newManagerId } = req.body;

    // Validate inputs
    if (!charityId || !newManagerId) {
      return res.status(400).json({
        success: false,
        message: 'Charity ID and new manager ID are required'
      });
    }

    // Check if charity exists
    const charity = await prisma.charity.findUnique({
      where: { id: Number(charityId) },
      include: { manager: true }
    });

    if (!charity) {
      return res.status(404).json({
        success: false,
        message: 'Charity not found'
      });
    }

    // Check if new manager exists and is not already managing a charity
    const newManager = await prisma.user.findUnique({
      where: { id: Number(newManagerId) },
      include: { managedCharity: true }
    });

    if (!newManager) {
      return res.status(404).json({
        success: false,
        message: 'New manager not found'
      });
    }

    if (newManager.managedCharity) {
      return res.status(400).json({
        success: false,
        message: 'New manager already manages another charity'
      });
    }

    // Transfer charity management
    const updatedCharity = await prisma.charity.update({
      where: { id: Number(charityId) },
      data: { managerId: Number(newManagerId) },
      include: {
        manager: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Update new manager's role to charity if not already
    if (newManager.role !== 'charity') {
      await prisma.user.update({
        where: { id: Number(newManagerId) },
        data: { role: 'charity' }
      });
    }

    res.status(200).json({
      success: true,
      message: `Charity management transferred successfully from ${charity.manager.name} to ${newManager.name}`,
      data: updatedCharity
    });

  } catch (error) {
    console.error('Error transferring charity management:', error);
    res.status(500).json({
      success: false,
      message: 'Error transferring charity management',
      error: error.message
    });
  }
};

// Enhanced delete user function with forced deletion option
export const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { force } = req.query; // Add ?force=true to force delete

    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      include: {
        donations: true,
        managedCharity: {
          include: {
            donations: true,
            projects: {
              include: {
                donations: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If force delete is requested
    if (force === 'true') {
      let deletionSummary = {
        deletedUser: user.name,
        deletedCharity: null,
        deletedProjects: 0,
        keptDonations: 0,
        anonymizedDonations: 0
      };

      // Check if user manages a charity with donations
      if (user.managedCharity) {
        const charity = user.managedCharity;
        const totalCharityDonations = charity.donations.length;
        const totalProjectDonations = charity.projects.reduce((sum, project) => sum + project.donations.length, 0);
        
        if (totalCharityDonations > 0 || totalProjectDonations > 0) {
          // Cannot force delete if charity has donations - must preserve audit trail
          return res.status(400).json({
            success: false,
            message: `Cannot force delete user because charity "${charity.name}" has donations. Charity data must be preserved for audit purposes. Please transfer charity management to another user first.`,
            details: {
              charityDonations: totalCharityDonations,
              projectDonations: totalProjectDonations,
              totalAffectedDonations: totalCharityDonations + totalProjectDonations
            }
          });
        }
      }

      // Use transaction to ensure all operations succeed or fail together
      try {
        await prisma.$transaction(async (tx) => {
          // If user manages a charity without donations, we can delete it
          if (user.managedCharity) {
            const charity = user.managedCharity;
            deletionSummary.deletedCharity = charity.name;
            
            // Delete charity projects that have no donations
            for (const project of charity.projects) {
              if (project.donations.length === 0) {
                await tx.project.delete({
                  where: { id: project.id }
                });
                deletionSummary.deletedProjects++;
              }
            }

            // Delete the charity (only possible if no donations)
            await tx.charity.delete({
              where: { id: charity.id }
            });
          }

          // Handle user's personal donations - mark them as anonymous
          if (user.donations.length > 0) {
            await tx.donation.updateMany({
              where: { donorId: Number(id) },
              data: { 
                anonymous: true // Mark as anonymous since donor will be deleted
              }
            });
            deletionSummary.anonymizedDonations = user.donations.length;
          }

          // Finally delete the user
          await tx.user.delete({
            where: { id: Number(id) }
          });
        });

        return res.status(200).json({
          success: true,
          message: 'User forcefully deleted with dependency handling',
          deletionSummary
        });

      } catch (transactionError) {
        console.error('Transaction error:', transactionError);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete user due to database constraints',
          error: transactionError.message
        });
      }
    }

    // Regular deletion checks (same as before)
    if (user.donations.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete user with existing donations. User has ${user.donations.length} donations. Use ?force=true to force delete (donations will be anonymized).`
      });
    }

    if (user.managedCharity) {
      if (user.managedCharity.donations.length > 0 || user.managedCharity.projects.some(p => p.donations && p.donations.length > 0)) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete user because their managed charity "${user.managedCharity.name}" has existing donations or projects with donations. Transfer charity management first.`
        });
      }

      // Delete charity if it has no dependencies
      await prisma.charity.delete({
        where: { id: user.managedCharity.id }
      });
    }

    // Delete user
    await prisma.user.delete({
      where: { id: Number(id) }
    });

    return res.status(200).json({
      success: true,
      message: user.managedCharity 
        ? 'User and their managed charity deleted successfully'
        : 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// ==================== CHARITY MANAGEMENT ====================
export const getAllCharitiesAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { 
      page = 1, 
      limit = 10, 
      search,
      category, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { email: { contains: search } },
        { registrationId: { contains: search } }
      ];
    }

    if (category && category !== 'all') {
      where.category = category;
    }

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

export const updateCharityAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const updateData = req.body;

    const charity = await prisma.charity.update({
      where: { id: Number(id) },
      data: {
        ...updateData,
        foundedYear: updateData.foundedYear ? Number(updateData.foundedYear) : null,
        updatedAt: new Date()
      },
      include: {
        manager: {
          select: { id: true, name: true, email: true }
        }
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

// controllers/adminController.js - Complete charity deletion implementation

export const deleteCharity = async (req, res) => {
  try {
    // 1. Verify admin authorization
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized. Admin access required.' 
      });
    }

    const { id } = req.params;
    console.log(`🗑️ Admin ${req.user.name} attempting to delete charity ID: ${id}`);

    // 2. Get charity with all related data
    const charity = await prisma.charity.findUnique({
      where: { id: Number(id) },
      include: {
        donations: {
          where: { paymentStatus: 'SUCCEEDED' }
        },
        projects: true,
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

    console.log(`📊 Charity "${charity.name}" has ${charity.donations.length} donations and ${charity.projects.length} projects`);

    // 3. Apply same logic as projects: Check if charity has donations
    if (charity.donations.length > 0) {
      console.log(`💰 Charity has ${charity.donations.length} donations - marking as CANCELLED`);
      
      // Mark charity as CANCELLED (like projects with donations)
      await prisma.$transaction(async (tx) => {
        // Update charity status to CANCELLED
        await tx.charity.update({
          where: { id: Number(id) },
          data: {
            status: 'CANCELLED',
            deletedAt: new Date(),
            deletedBy: req.user.id,
            updatedAt: new Date()
          }
        });

        // Cancel all projects too
        await tx.project.updateMany({
          where: { charityId: Number(id) },
          data: {
            status: 'CANCELLED',
            updatedAt: new Date()
          }
        });
      });

      return res.status(200).json({
        success: true,
        message: `Charity "${charity.name}" cancelled (had existing donations)`,
        action: 'CANCELLED',
        details: {
          charityId: Number(id),
          charityName: charity.name,
          donationsCount: charity.donations.length,
          projectsAffected: charity.projects.length,
          reason: 'Charity had existing donations - marked as cancelled to preserve data'
        }
      });
    }

    console.log(`🗑️ Charity has no donations - permanently deleting`);

    // 4. If no donations, actually delete the charity and its projects
    await prisma.$transaction(async (tx) => {
      // Delete all projects (should have no donations if charity has none)
      await tx.project.deleteMany({
        where: { charityId: Number(id) }
      });

      // Delete the charity
      await tx.charity.delete({
        where: { id: Number(id) }
      });
    });

    // 5. Update manager role if they have no other charity
    try {
      const managerHasOtherCharity = await prisma.charity.findFirst({
        where: { managerId: charity.manager.id }
      });

      if (!managerHasOtherCharity) {
        await prisma.user.update({
          where: { id: charity.manager.id },
          data: { role: 'donor' }
        });
        console.log(`👤 Updated manager ${charity.manager.email} role to donor`);
      }
    } catch (error) {
      console.warn('Warning: Could not update manager role:', error.message);
    }

    res.status(200).json({
      success: true,
      message: `Charity "${charity.name}" deleted successfully`,
      action: 'DELETED',
      details: {
        charityId: Number(id),
        charityName: charity.name,
        projectsDeleted: charity.projects.length,
        managerReverted: charity.manager.email,
        reason: 'No donations found - charity and projects permanently deleted'
      }
    });

  } catch (error) {
    console.error('❌ Error deleting charity:', error);
    
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete charity due to foreign key constraints'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error deleting charity',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Additional status management functions
export const updateCharityStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be ACTIVE, SUSPENDED, or CANCELLED'
      });
    }

    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (status === 'CANCELLED' || status === 'SUSPENDED') {
      updateData.deletedAt = new Date();
      updateData.deletedBy = req.user.id;
    } else {
      updateData.deletedAt = null;
      updateData.deletedBy = null;
    }

    const charity = await prisma.charity.update({
      where: { id: Number(id) },
      data: updateData
    });

    // If marking as cancelled, also cancel projects
    if (status === 'CANCELLED') {
      await prisma.project.updateMany({
        where: { charityId: Number(id) },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      });
    }

    res.status(200).json({
      success: true,
      message: `Charity status updated to ${status}`,
      data: charity
    });

  } catch (error) {
    console.error('Error updating charity status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating charity status',
      error: error.message
    });
  }
};

export const restoreCharity = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;

    const charity = await prisma.charity.update({
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
      message: `Charity "${charity.name}" restored successfully`
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

// ==================== PROJECT MANAGEMENT ====================
export const getAllProjectsAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      charityId,
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } }
      ];
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (charityId) {
      where.charityId = Number(charityId);
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          charity: {
            select: { id: true, name: true, category: true }
          },
          _count: {
            select: { donations: true }
          }
        }
      }),
      prisma.project.count({ where })
    ]);

    // Add calculated fields
    const enhancedProjects = projects.map(project => ({
      ...project,
      progressPercentage: Math.min(Math.round((project.currentAmount / project.goal) * 100), 100),
      donationsCount: project._count.donations,
      daysRemaining: project.endDate 
        ? Math.max(0, Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
        : null
    }));

    res.status(200).json({
      success: true,
      data: {
        projects: enhancedProjects,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching projects',
      error: error.message
    });
  }
};

export const updateProjectAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Process dates and numbers
    const processedData = {
      ...updateData,
      goal: updateData.goal ? parseFloat(updateData.goal) : undefined,
      currentAmount: updateData.currentAmount ? parseFloat(updateData.currentAmount) : undefined,
      startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
      endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
      updatedAt: new Date()
    };

    const project = await prisma.project.update({
      where: { id: Number(id) },
      data: processedData,
      include: {
        charity: {
          select: { id: true, name: true }
        }
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

export const deleteProjectAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;

    // Check if project has donations
    const project = await prisma.project.findUnique({
      where: { id: Number(id) },
      include: { donations: true }
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (project.donations.length > 0) {
      // If project has donations, mark as CANCELLED
      await prisma.project.update({
        where: { id: Number(id) },
        data: { status: 'CANCELLED', updatedAt: new Date() }
      });

      return res.status(200).json({
        success: true,
        message: 'Project cancelled (had existing donations)'
      });
    }

    // If no donations, delete the project
    await prisma.project.delete({
      where: { id: Number(id) }
    });

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
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

// ==================== DONATION MANAGEMENT ====================
export const getAllDonationsAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      charityId,
      projectId,
      startDate,
      endDate,
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (search) {
      where.OR = [
        { transactionId: { contains: search } },
        { paymentIntentId: { contains: search } }
      ];
    }

    if (status && status !== 'all') {
      where.paymentStatus = status;
    }

    if (charityId) {
      where.charityId = Number(charityId);
    }

    if (projectId) {
      where.projectId = Number(projectId);
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          donor: {
            select: { id: true, name: true, email: true }
          },
          charity: {
            select: { id: true, name: true }
          },
          project: {
            select: { id: true, title: true }
          },
          blockchainVerification: {
            select: {
              id: true,
              transactionHash: true,
              verified: true,
              timestamp: true
            }
          }
        }
      }),
      prisma.donation.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        donations,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching donations',
      error: error.message
    });
  }
};

export const updateDonationAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { paymentStatus, message, anonymous } = req.body;

    const donation = await prisma.donation.update({
      where: { id: Number(id) },
      data: {
        paymentStatus,
        message,
        anonymous: Boolean(anonymous)
      },
      include: {
        donor: { select: { name: true, email: true } },
        charity: { select: { name: true } },
        project: { select: { title: true } },
        blockchainVerification: true
      }
    });

    res.status(200).json({
      success: true,
      data: donation
    });

  } catch (error) {
    console.error('Error updating donation:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating donation',
      error: error.message
    });
  }
};

// ==================== BLOCKCHAIN VERIFICATION MANAGEMENT ====================
export const getAllVerificationsAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { 
      page = 1, 
      limit = 10, 
      verified, 
      search,
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (verified !== undefined && verified !== 'all') {
      where.verified = verified === 'true';
    }

    if (search) {
      where.OR = [
        { transactionHash: { contains: search } }
      ];
    }

    const [verifications, total] = await Promise.all([
      prisma.blockchainVerification.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          donation: {
            include: {
              donor: { select: { name: true, email: true } },
              charity: { select: { name: true } },
              project: { select: { title: true } }
            }
          }
        }
      }),
      prisma.blockchainVerification.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        verifications,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching blockchain verifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blockchain verifications',
      error: error.message
    });
  }
};

export const updateVerificationAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { verified, transactionHash, blockNumber } = req.body;

    const verification = await prisma.blockchainVerification.update({
      where: { id: Number(id) },
      data: {
        verified: Boolean(verified),
        transactionHash,
        blockNumber: blockNumber ? Number(blockNumber) : undefined,
        timestamp: new Date()
      },
      include: {
        donation: {
          include: {
            charity: { select: { name: true } }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: verification
    });

  } catch (error) {
    console.error('Error updating blockchain verification:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating blockchain verification',
      error: error.message
    });
  }
};

export const deleteVerificationAdmin = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;

    await prisma.blockchainVerification.delete({
      where: { id: Number(id) }
    });

    res.status(200).json({
      success: true,
      message: 'Blockchain verification deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting blockchain verification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting blockchain verification',
      error: error.message
    });
  }
};

// ==================== ANALYTICS & REPORTING ====================
export const getAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { timeframe = '30d' } = req.query;

    // Import the analytics utility
    const { calculateAnalytics } = await import('../utils/adminUtils.js');
    const analytics = await calculateAnalytics(timeframe);

    res.status(200).json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
};

export const exportData = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { entity, format = 'json', ...filters } = req.query;

    if (!entity) {
      return res.status(400).json({
        success: false,
        message: 'Entity parameter is required'
      });
    }

    if (format === 'csv') {
      // Import the CSV utility
      const { generateCSVData } = await import('../utils/adminUtils.js');
      const csvData = await generateCSVData(entity, filters);
      
      // Convert to CSV format
      if (csvData.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No data found for export'
        });
      }
      
      const headers = Object.keys(csvData[0]);
      const csvRows = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => {
            const value = row[header];
            // Handle values that might contain commas
            if (typeof value === 'string' && value.includes(',')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ];
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${entity}-export.csv"`);
      return res.send(csvRows.join('\n'));
    }

    // Default JSON export
    let data = [];
    
    switch (entity) {
      case 'users':
        data = await prisma.user.findMany({
          where: filters,
          include: {
            managedCharity: true,
            _count: { select: { donations: true } }
          }
        });
        break;
      case 'charities':
        data = await prisma.charity.findMany({
          where: filters,
          include: {
            manager: true,
            _count: {
              select: { donations: true, projects: true}
            }
          }
        });
        break;
      case 'projects':
        data = await prisma.project.findMany({
          where: filters,
          include: {
            charity: true,
            _count: { select: { donations: true } }
          }
        });
        break;
      case 'donations':
        data = await prisma.donation.findMany({
          where: filters,
          include: {
            donor: true,
            charity: true,
            project: true,
            blockchainVerification: true
          }
        });
        break;
      case 'verifications':
        data = await prisma.blockchainVerification.findMany({
          where: filters,
          include: { donation: true }
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid entity specified'
        });
    }

    res.status(200).json({
      success: true,
      data,
      count: data.length,
      exportedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting data',
      error: error.message
    });
  }
};

export const getSystemHealth = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Import the health report utility
    const { generateHealthReport } = await import('../utils/adminUtils.js');
    const healthReport = await generateHealthReport();

    res.status(200).json({
      success: true,
      data: healthReport
    });

  } catch (error) {
    console.error('Error generating system health report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating system health report',
      error: error.message
    });
  }
};

// ==================== BULK OPERATIONS ====================
export const bulkUpdateUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { userIds, updateData } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }

    // Hash password if provided
    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    const result = await prisma.user.updateMany({
      where: {
        id: { in: userIds.map(id => Number(id)) }
      },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: `Successfully updated ${result.count} users`,
      updatedCount: result.count
    });

  } catch (error) {
    console.error('Error bulk updating users:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk updating users',
      error: error.message
    });
  }
};

export const bulkDeleteUsers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }

    // Check if any users have donations or manage charities
    const usersWithDependencies = await prisma.user.findMany({
      where: {
        id: { in: userIds.map(id => Number(id)) }
      },
      include: {
        donations: true,
        managedCharity: true
      }
    });

    const cannotDelete = usersWithDependencies.filter(user => 
      user.donations.length > 0 || user.managedCharity
    );

    if (cannotDelete.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ${cannotDelete.length} users with existing donations or managed charities`,
        cannotDeleteUsers: cannotDelete.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          reason: user.donations.length > 0 ? 'Has donations' : 'Manages charity'
        }))
      });
    }

    const result = await prisma.user.deleteMany({
      where: {
        id: { in: userIds.map(id => Number(id)) }
      }
    });

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.count} users`,
      deletedCount: result.count
    });

  } catch (error) {
    console.error('Error bulk deleting users:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk deleting users',
      error: error.message
    });
  }
};

// ==================== ADVANCED SEARCH ====================
export const advancedSearch = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { 
      entity, 
      searchTerm, 
      filters = {}, 
      dateRange = {},
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.body;

    const skip = (Number(page) - 1) * Number(limit);
    let where = { ...filters };

    // Add search term to appropriate fields based on entity
    if (searchTerm) {
      switch (entity) {
        case 'users':
          where.OR = [
            { name: { contains: searchTerm } },
            { email: { contains: searchTerm } },
            { phone: { contains: searchTerm } }
          ];
          break;
        case 'charities':
          where.OR = [
            { name: { contains: searchTerm } },
            { description: { contains: searchTerm } },
            { email: { contains: searchTerm } },
            { registrationId: { contains: searchTerm } }
          ];
          break;
        case 'projects':
          where.OR = [
            { title: { contains: searchTerm } },
            { description: { contains: searchTerm } }
          ];
          break;
        case 'donations':
          where.OR = [
            { transactionId: { contains: searchTerm } },
            { paymentIntentId: { contains: searchTerm } }
          ];
          break;
      }
    }

    // Add date range filter
    if (dateRange.start && dateRange.end) {
      where.createdAt = {
        gte: new Date(dateRange.start),
        lte: new Date(dateRange.end)
      };
    }

    let data = [];
    let total = 0;
    let include = {};

    switch (entity) {
      case 'users':
        include = {
          managedCharity: { select: { id: true, name: true } },
          _count: { select: { donations: true } }
        };
        [data, total] = await Promise.all([
          prisma.user.findMany({
            where, skip, take: Number(limit),
            orderBy: { [sortBy]: sortOrder },
            include
          }),
          prisma.user.count({ where })
        ]);
        break;
        
      case 'charities':
        include = {
          manager: { select: { name: true, email: true } },
          _count: { select: { donations: true, projects: true } }
        };
        [data, total] = await Promise.all([
          prisma.charity.findMany({
            where, skip, take: Number(limit),
            orderBy: { [sortBy]: sortOrder },
            include
          }),
          prisma.charity.count({ where })
        ]);
        break;
        
      case 'projects':
        include = {
          charity: { select: { name: true } },
          _count: { select: { donations: true } }
        };
        [data, total] = await Promise.all([
          prisma.project.findMany({
            where, skip, take: Number(limit),
            orderBy: { [sortBy]: sortOrder },
            include
          }),
          prisma.project.count({ where })
        ]);
        break;
        
      case 'donations':
        include = {
          donor: { select: { name: true, email: true } },
          charity: { select: { name: true } },
          project: { select: { title: true } },
          blockchainVerification: { select: { verified: true, transactionHash: true } }
        };
        [data, total] = await Promise.all([
          prisma.donation.findMany({
            where, skip, take: Number(limit),
            orderBy: { [sortBy]: sortOrder },
            include
          }),
          prisma.donation.count({ where })
        ]);
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid entity specified for search'
        });
    }

    res.status(200).json({
      success: true,
      data: {
        results: data,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        },
        searchParams: {
          entity,
          searchTerm,
          filters,
          dateRange,
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Error performing advanced search:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing advanced search',
      error: error.message
    });
  }
};