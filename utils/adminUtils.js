// utils/adminUtils.js
import { prisma } from '../prisma/client.js';  // Changed this line

/**
 * Generate CSV export data for any entity
 */
export const generateCSVData = async (entity, filters = {}) => {
  try {
    let data = [];
    
    switch (entity) {
      case 'users':
        data = await prisma.user.findMany({
          where: filters,
          include: {
            managedCharity: { select: { name: true } },
            _count: { select: { donations: true } }
          }
        });
        return data.map(user => ({
          ID: user.id,
          Name: user.name,
          Email: user.email,
          Role: user.role,
          Phone: user.phone || '',
          Address: user.address || '',
          'Managed Charity': user.managedCharity?.name || '',
          'Donations Count': user._count.donations,
          'Created At': user.createdAt.toISOString(),
          'Updated At': user.updatedAt.toISOString()
        }));
        
      case 'charities':
        data = await prisma.charity.findMany({
          where: filters,
          include: {
            manager: { select: { name: true, email: true } },
            _count: {
              select: { donations: true, projects: true}
            }
          }
        });
        return data.map(charity => ({
          ID: charity.id,
          Name: charity.name,
          Description: charity.description,
          Category: charity.category,
          Email: charity.email,
          Phone: charity.phone || '',
          'Registration ID': charity.registrationId,
          Address: charity.address || '',
          'Founded Year': charity.foundedYear || '',
          'Manager Name': charity.manager.name,
          'Manager Email': charity.manager.email,
          'Donations Count': charity._count.donations,
          'Projects Count': charity._count.projects,
          'Created At': charity.createdAt.toISOString()
        }));
        
      case 'projects':
        data = await prisma.project.findMany({
          where: filters,
          include: {
            charity: { select: { name: true } },
            _count: { select: { donations: true } }
          }
        });
        return data.map(project => ({
          ID: project.id,
          Title: project.title,
          Description: project.description,
          Goal: project.goal,
          'Current Amount': project.currentAmount,
          'Progress %': Math.round((project.currentAmount / project.goal) * 100),
          Status: project.status,
          'Charity Name': project.charity.name,
          'Donations Count': project._count.donations,
          'Start Date': project.startDate.toISOString(),
          'End Date': project.endDate?.toISOString() || '',
          'Created At': project.createdAt.toISOString()
        }));
        
      case 'donations':
        data = await prisma.donation.findMany({
          where: filters,
          include: {
            donor: { select: { name: true, email: true } },
            charity: { select: { name: true } },
            project: { select: { title: true } },
            blockchainVerification: { select: { verified: true, transactionHash: true } }
          }
        });
        return data.map(donation => ({
          ID: donation.id,
          Amount: donation.amount,
          Currency: donation.currency,
          'Transaction ID': donation.transactionId,
          'Payment Status': donation.paymentStatus,
          Anonymous: donation.anonymous ? 'Yes' : 'No',
          'Donor Name': donation.anonymous ? 'Anonymous' : donation.donor.name,
          'Donor Email': donation.anonymous ? 'Anonymous' : donation.donor.email,
          'Charity Name': donation.charity.name,
          'Project Title': donation.project?.title || 'General Donation',
          'Blockchain Verified': donation.blockchainVerification?.verified ? 'Yes' : 'No',
          'Transaction Hash': donation.blockchainVerification?.transactionHash || '',
          Message: donation.message || '',
          'Created At': donation.createdAt.toISOString()
        }));
        
      case 'verifications':
        data = await prisma.blockchainVerification.findMany({
          where: filters,
          include: {
            donation: {
              include: {
                donor: { select: { name: true } },
                charity: { select: { name: true } }
              }
            }
          }
        });
        return data.map(verification => ({
          ID: verification.id,
          'Transaction Hash': verification.transactionHash,
          'Block Number': verification.blockNumber,
          Verified: verification.verified ? 'Yes' : 'No',
          'Donation ID': verification.donationId,
          'Donation Amount': verification.donation.amount,
          'Donor Name': verification.donation.anonymous ? 'Anonymous' : verification.donation.donor.name,
          'Charity Name': verification.donation.charity.name,
          'Verification Timestamp': verification.timestamp.toISOString(),
          'Created At': verification.createdAt.toISOString()
        }));
        
      default:
        throw new Error(`Unknown entity: ${entity}`);
    }
  } catch (error) {
    console.error(`Error generating CSV data for ${entity}:`, error);
    throw error;
  }
};

/**
 * Calculate advanced analytics
 */
export const calculateAnalytics = async (timeframe = '30d') => {
  try {
    const now = new Date();
    let startDate = new Date();
    
    // Calculate start date based on timeframe
    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }
    
    // Get donations in timeframe
    const donations = await prisma.donation.findMany({
      where: {
        paymentStatus: 'SUCCEEDED',
        createdAt: { gte: startDate }
      },
      include: {
        charity: { select: { category: true } }
      }
    });
    
    // Calculate metrics
    const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
    const averageDonation = donations.length > 0 ? totalAmount / donations.length : 0;
    
    // Group by category
    const byCategory = donations.reduce((acc, donation) => {
      const category = donation.charity.category;
      if (!acc[category]) {
        acc[category] = { count: 0, amount: 0 };
      }
      acc[category].count++;
      acc[category].amount += donation.amount;
      return acc;
    }, {});
    
    // Daily breakdown
    const dailyData = {};
    donations.forEach(donation => {
      const day = donation.createdAt.toISOString().split('T')[0];
      if (!dailyData[day]) {
        dailyData[day] = { count: 0, amount: 0 };
      }
      dailyData[day].count++;
      dailyData[day].amount += donation.amount;
    });
    
    return {
      summary: {
        totalDonations: donations.length,
        totalAmount,
        averageDonation,
        timeframe
      },
      byCategory,
      dailyTrend: Object.keys(dailyData)
        .sort()
        .map(date => ({
          date,
          count: dailyData[date].count,
          amount: dailyData[date].amount
        }))
    };
    
  } catch (error) {
    console.error('Error calculating analytics:', error);
    throw error;
  }
};

/**
 * Validate admin operations
 */
export const validateAdminOperation = async (operation, entityType, entityId, userId) => {
  try {
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user || user.role !== 'admin') {
      return { valid: false, message: 'Unauthorized: Admin access required' };
    }
    
    // Additional validation based on operation
    switch (operation) {
      case 'delete':
        if (entityType === 'user') {
          const userToDelete = await prisma.user.findUnique({
            where: { id: entityId },
            include: {
              donations: true,
              managedCharity: true
            }
          });
          
          if (userToDelete?.donations.length > 0 || userToDelete?.managedCharity) {
            return {
              valid: false,
              message: 'Cannot delete user with existing donations or managed charity'
            };
          }
        }
        
        if (entityType === 'charity') {
          const charity = await prisma.charity.findUnique({
            where: { id: entityId },
            include: {
              donations: true,
              projects: true
            }
          });
          
          if (charity?.donations.length > 0 || charity?.projects.length > 0) {
            return {
              valid: false,
              message: 'Cannot delete charity with existing donations or projects'
            };
          }
        }
        break;
        
      case 'update':
        // Add specific update validations here
        break;
    }
    
    return { valid: true };
    
  } catch (error) {
    console.error('Error validating admin operation:', error);
    return { valid: false, message: 'Validation error occurred' };
  }
};

/**
 * Generate system health report
 */
export const generateHealthReport = async () => {
  try {
    const [
      userCount,
      charityCount,
      projectCount,
      donationCount,
      verificationCount,
      failedDonations,
      pendingVerifications
    ] = await Promise.all([
      prisma.user.count(),
      prisma.charity.count(),
      prisma.project.count(),
      prisma.donation.count({ where: { paymentStatus: 'SUCCEEDED' } }),
      prisma.blockchainVerification.count({ where: { verified: true } }),
      prisma.donation.count({ where: { paymentStatus: 'FAILED' } }),
      prisma.blockchainVerification.count({ where: { verified: false } })
    ]);
    
    // Calculate health scores
    const verificationRate = donationCount > 0 ? (verificationCount / donationCount) * 100 : 100;
    const failureRate = (donationCount + failedDonations) > 0 ? 
      (failedDonations / (donationCount + failedDonations)) * 100 : 0;
    
    return {
      timestamp: new Date().toISOString(),
      entities: {
        users: userCount,
        charities: charityCount,
        projects: projectCount,
        successfulDonations: donationCount,
        failedDonations,
        verifiedTransactions: verificationCount,
        pendingVerifications
      },
      healthScores: {
        verificationRate: Math.round(verificationRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
        overallHealth: Math.round((100 - failureRate + verificationRate) / 2 * 100) / 100
      },
      alerts: [
        ...(verificationRate < 90 ? ['Low blockchain verification rate'] : []),
        ...(failureRate > 5 ? ['High donation failure rate'] : []),
        ...(pendingVerifications > 50 ? ['High number of pending verifications'] : [])
      ]
    };
    
  } catch (error) {
    console.error('Error generating health report:', error);
    throw error;
  }
};

export default {
  generateCSVData,
  calculateAnalytics,
  validateAdminOperation,
  generateHealthReport
};