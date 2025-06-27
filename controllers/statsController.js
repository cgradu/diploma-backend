// backend/controllers/statsController.js - COMPLETE IMPLEMENTATION WITH FALLBACK
import { prisma } from '../prisma/client.js';  // Changed this line
import BlockchainVerificationService from '../services/blockchainVerificationService.js';
import BlockchainService from '../services/blockchainService.js';

// Initialize services
const verificationService = new BlockchainVerificationService();
const blockchainService = new BlockchainService();


// ========================================
// HOMEPAGE STATISTICS - WITH SMART CONTRACT + DATABASE FALLBACK
// ========================================

export const getHomepageStats = async (req, res) => {
    try {
        console.log('📊 Fetching homepage statistics...');
        
        let stats;
        
        // Try smart contract first, fall back to database
        if (blockchainService.isContractDeployed) {
            try {
                console.log('🔗 Using smart contract for homepage stats...');
                stats = await getSmartContractHomepageStats();
            } catch (contractError) {
                console.warn('⚠️ Smart contract failed, using database fallback:', contractError.message);
                stats = await getDatabaseHomepageStats();
            }
        } else {
            console.log('📊 Using database for homepage stats (contract not deployed)...');
            stats = await getDatabaseHomepageStats();
        }
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Homepage stats error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch statistics',
            message: error.message 
        });
    }
};

// ========================================
// CHARITY STATISTICS - WITH SMART CONTRACT + DATABASE FALLBACK
// ========================================

export const getCharityStats = async (req, res) => {
    try {
        const { charityId } = req.params;
        const userId = req.user.id;

        console.log(`🏢 Fetching charity ${charityId} stats...`);

        // Security check
        const charity = await prisma.charity.findUnique({
            where: { id: parseInt(charityId) },
            include: { manager: { select: { name: true, email: true } } }
        });

        if (!charity) {
            return res.status(404).json({ 
                success: false,
                error: 'Charity not found' 
            });
        }

        if (charity.managerId !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                error: 'Access denied' 
            });
        }

        let stats;

        // Try smart contract first, fall back to database
        if (blockchainService.isContractDeployed) {
            try {
                console.log('🔗 Using smart contract for charity stats...');
                stats = await getSmartContractCharityStats(charityId, charity);
            } catch (contractError) {
                console.warn('⚠️ Smart contract failed, using database fallback:', contractError.message);
                stats = await getDatabaseCharityStats(charityId, charity);
            }
        } else {
            console.log('📊 Using database for charity stats (contract not deployed)...');
            stats = await getDatabaseCharityStats(charityId, charity);
        }
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Charity stats error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch charity statistics',
            message: error.message 
        });
    }
};

// ========================================
// DONOR STATISTICS - WITH SMART CONTRACT + DATABASE FALLBACK
// ========================================

export const getDonorStats = async (req, res) => {
    try {
        const { donorId } = req.params;
        const userId = req.user.id;

        // Security check
        if (parseInt(donorId) !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                error: 'Access denied' 
            });
        }

        console.log(`👤 Fetching donor ${donorId} stats...`);

        let stats;

        // Try smart contract first, fall back to database
        if (blockchainService.isContractDeployed) {
            try {
                console.log('🔗 Using smart contract for donor stats...');
                stats = await getSmartContractDonorStats(donorId);
            } catch (contractError) {
                console.warn('⚠️ Smart contract failed, using database fallback:', contractError.message);
                stats = await getDatabaseDonorStats(donorId);
            }
        } else {
            console.log('📊 Using database for donor stats (contract not deployed)...');
            stats = await getDatabaseDonorStats(donorId);
        }
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Donor stats error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch donor statistics',
            message: error.message 
        });
    }
};

// ========================================
// SMART CONTRACT IMPLEMENTATIONS
// ========================================

async function enrichDonationHistory(donationHistory) {
    console.log('🔍 Enriching donation history with donor names...');
    
    const enriched = [];
    
    for (const donation of donationHistory) {
        let donorInfo = { name: 'Anonymous' };
        
        // Get donor info from database if not anonymous
        if (!donation.isAnonymous && donation.donorId && donation.donorId !== '0') {
            try {
                const donor = await prisma.user.findUnique({
                    where: { id: parseInt(donation.donorId) },
                    select: { name: true, id: true }
                });
                
                if (donor) {
                    donorInfo = { 
                        name: donor.name, 
                        id: donor.id 
                    };
                }
            } catch (error) {
                console.error(`❌ Error fetching donor ${donation.donorId}:`, error);
            }
        }
        
        enriched.push({
            ...donation,
            donor: donorInfo
        });
    }
    
    console.log(`✅ Enriched ${enriched.length} donation records`);
    return enriched;
}

// Add this function to your statsController.js file
// Place it with the other helper functions at the bottom

async function enrichDonationData(recentDonations) {
    console.log('🔍 Enriching donation data with charity/donor names...');
    
    const enriched = [];
    
    for (const donation of recentDonations) {
        let enrichedDonation = { ...donation };
        
        // Get charity info from database
        if (donation.charityId) {
            try {
                const charity = await prisma.charity.findUnique({
                    where: { id: parseInt(donation.charityId) },
                    select: { name: true, category: true }
                });
                
                if (charity) {
                    enrichedDonation.charity = {
                        name: charity.name,
                        category: charity.category
                    };
                }
            } catch (error) {
                console.error(`❌ Error fetching charity ${donation.charityId}:`, error);
                enrichedDonation.charity = { name: `Charity ${donation.charityId}`, category: 'UNKNOWN' };
            }
        }
        
        // Get donor info from database if not anonymous
        if (!donation.isAnonymous && donation.donorId && donation.donorId !== '0') {
            try {
                const donor = await prisma.user.findUnique({
                    where: { id: parseInt(donation.donorId) },
                    select: { name: true, id: true }
                });
                
                if (donor) {
                    enrichedDonation.donor = {
                        name: donor.name,
                        id: donor.id
                    };
                } else {
                    enrichedDonation.donor = { name: 'Unknown Donor' };
                }
            } catch (error) {
                console.error(`❌ Error fetching donor ${donation.donorId}:`, error);
                enrichedDonation.donor = { name: 'Unknown Donor' };
            }
        } else {
            enrichedDonation.donor = { name: 'Anonymous' };
        }
        
        enriched.push(enrichedDonation);
    }
    
    console.log(`✅ Enriched ${enriched.length} donation records`);
    return enriched;
}

async function getSmartContractHomepageStats() {
    const [platformStats, recentDonations, topCharities] = await Promise.all([
        blockchainService.getPlatformStats(),
        blockchainService.getRecentDonations(5),
        blockchainService.getTopCharitiesByDonations(3)
    ]);

    // Enrich charity data with database info
    const enrichedTopCharities = await enrichCharityData(topCharities);
    const enrichedRecentDonations = await enrichDonationData(recentDonations);

    // Get verification stats from database
    const verificationStats = await verificationService.getVerificationStats();

    return {
        totals: {
            totalDonations: platformStats.totalDonations,
            totalAmount: parseFloat(platformStats.totalAmount),
            totalCharities: platformStats.totalCharities,
            totalDonors: platformStats.totalDonors,
            averageDonation: parseFloat(platformStats.averageDonation)
        },
        recent: enrichedRecentDonations,
        topCharities: enrichedTopCharities,
        blockchain: verificationStats,
        source: 'smart_contract',
        lastUpdated: new Date().toISOString()
    };
}

// Update this function in your statsController.js:

async function getSmartContractCharityStats(charityId, charity) {
    console.log(`🔗 Fetching smart contract charity stats for charity ${charityId}...`);
    
    const [charityStats, donationHistory, charityFlow] = await Promise.all([
        blockchainService.getCharityStats(charityId),
        blockchainService.getCharityDonationHistory(charityId, 20), // Get more to find unique donors
        blockchainService.getCharityFlow(charityId)
    ]);

    console.log(`📊 Raw donation history: ${donationHistory.length} donations`);
    
    // Enrich donation history with database info
    const enrichedHistory = await enrichDonationHistory(donationHistory);
    
    // Extract recent donors from blockchain donation history
    const recentDonors = await getRecentDonorsFromBlockchain(donationHistory);

    return {
        charity: {
            id: charity.id,
            name: charity.name,
            category: charity.category,
            createdAt: charity.createdAt,
            manager: charity.manager
        },
        donations: {
            total: charityStats.totalDonations,
            totalAmount: parseFloat(charityStats.totalAmount),
            averageAmount: parseFloat(charityStats.averageDonation),
            lastDonationTime: charityStats.lastDonationTime
        },
        flow: {
            totalReceived: parseFloat(charityFlow.totalReceived),
            totalDisbursed: parseFloat(charityFlow.totalDisbursed),
            balance: parseFloat(charityFlow.balance)
        },
        recentDonations: enrichedHistory.slice(0, 10), // Limit to 10 for display
        recentDonors: recentDonors, // NEW: Recent donors from blockchain
        source: 'smart_contract'
    };
}

// Add this helper function in your statsController.js:

async function getRecentDonorsFromBlockchain(donationHistory) {
    console.log('🔍 Extracting recent donors from blockchain data...');
    
    const recentDonors = [];
    const seenDonors = new Set();
    
    // Sort donations by timestamp (most recent first)
    const sortedDonations = donationHistory.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    for (const donation of sortedDonations) {
        // Skip anonymous donations or donations without donorId
        if (donation.isAnonymous || !donation.donorId || donation.donorId === '0') {
            continue;
        }
        
        // Skip if we've already seen this donor
        if (seenDonors.has(donation.donorId)) {
            continue;
        }
        
        try {
            // Get donor name from database using donorId
            const donor = await prisma.user.findUnique({
                where: { id: parseInt(donation.donorId) },
                select: { name: true, id: true }
            });
            
            if (donor) {
                recentDonors.push({
                    id: donor.id,
                    name: donor.name,
                    lastDonationDate: donation.timestamp,
                    lastDonationAmount: parseFloat(donation.amount)
                });
                seenDonors.add(donation.donorId);
                
                console.log(`✅ Added donor: ${donor.name} (ID: ${donor.id})`);
                
                // Limit to 5 recent donors
                if (recentDonors.length >= 5) break;
            } else {
                console.warn(`⚠️ Donor not found in database: ID ${donation.donorId}`);
            }
        } catch (error) {
            console.error(`❌ Error fetching donor ${donation.donorId}:`, error);
        }
    }
    
    console.log(`✅ Found ${recentDonors.length} recent donors`);
    return recentDonors;
}

async function getSmartContractDonorStats(donorId) {
    const [donorStats, donationHistory] = await Promise.all([
        blockchainService.getDonorStats(donorId),
        blockchainService.getDonorDonationHistory(donorId, 10)
    ]);

    // Enrich donation history with database info
    const enrichedHistory = await enrichDonorDonationHistory(donationHistory);

    return {
        donations: {
            total: donorStats.totalDonations,
            totalAmount: parseFloat(donorStats.totalAmount),
            uniqueCharities: donorStats.uniqueCharities,
            averageDonation: parseFloat(donorStats.averageDonation),
            lastDonationTime: donorStats.lastDonationTime
        },
        recentDonations: enrichedHistory,
        transparencyScore: 100, // All blockchain donations are transparent
        source: 'smart_contract'
    };
}

// ========================================
// DATABASE FALLBACK IMPLEMENTATIONS
// ========================================

async function getDatabaseHomepageStats() {
    console.log('📊 Fetching homepage stats from database...');
    
    const [totalStats, recentDonations, topCharities, categoryStats, verificationStats] = await Promise.all([
        getTotalStatsFromDB(),
        getRecentDonationsFromDB(5),
        getTopCharitiesFromDB(3),
        getCategoryStatsFromDB(),
        verificationService.getVerificationStats()
    ]);

    return {
        totals: totalStats,
        recent: recentDonations,
        topCharities,
        categories: categoryStats,
        blockchain: verificationStats,
        source: 'database_fallback',
        lastUpdated: new Date().toISOString()
    };
}

async function getDatabaseCharityStats(charityId, charity) {
    console.log(`📊 Fetching charity ${charityId} stats from database...`);
    
    const [donations, projects] = await Promise.all([
        prisma.donation.findMany({
            where: { 
                charityId: parseInt(charityId),
                paymentStatus: 'SUCCEEDED'
            },
            include: { 
                blockchainVerification: true,
                donor: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.project.findMany({
            where: { charityId: parseInt(charityId) },
            include: {
                donations: { where: { paymentStatus: 'SUCCEEDED' } }
            }
        })
    ]);

    return {
        charity: {
            id: charity.id,
            name: charity.name,
            category: charity.category,
            createdAt: charity.createdAt,
            manager: charity.manager
        },
        donations: {
            total: donations.length,
            totalAmount: donations.reduce((sum, d) => sum + d.amount, 0),
            averageAmount: donations.length > 0 ? 
                Math.round(donations.reduce((sum, d) => sum + d.amount, 0) / donations.length) : 0,
            uniqueDonors: new Set(donations.map(d => d.donorId).filter(Boolean)).size,
            verifiedOnBlockchain: donations.filter(d => d.blockchainVerification?.verified).length,
            monthlyBreakdown: getMonthlyBreakdown(donations),
            recent: donations.slice(0, 10)
        },
        projects: {
            total: projects.length,
            active: projects.filter(p => p.status === 'ACTIVE').length,
            completed: projects.filter(p => p.status === 'COMPLETED').length,
            totalFunded: projects.reduce((sum, p) => 
                sum + p.donations.reduce((pSum, d) => pSum + d.amount, 0), 0
            )
        },
        source: 'database'
    };
}

async function getDatabaseDonorStats(donorId) {
    console.log(`📊 Fetching donor ${donorId} stats from database...`);
    
    const donations = await prisma.donation.findMany({
        where: { 
            donorId: parseInt(donorId),
            paymentStatus: 'SUCCEEDED'
        },
        include: {
            charity: { select: { name: true, category: true } },
            project: { select: { title: true } },
            blockchainVerification: true
        },
        orderBy: { createdAt: 'desc' }
    });

    return {
        totalDonations: donations.length,
        totalAmount: donations.reduce((sum, d) => sum + d.amount, 0),
        uniqueCharities: new Set(donations.map(d => d.charityId)).size,
        averageDonation: donations.length > 0 ? 
            Math.round(donations.reduce((sum, d) => sum + d.amount, 0) / donations.length) : 0,
        verifiedOnBlockchain: donations.filter(d => d.blockchainVerification?.verified).length,
        categoriesSupported: [...new Set(donations.map(d => d.charity?.category).filter(Boolean))],
        recentDonations: donations.slice(0, 10),
        monthlyBreakdown: getMonthlyBreakdown(donations),
        source: 'database'
    };
}

async function getTotalStatsFromDB() {
    const [donations, charities, users] = await Promise.all([
        prisma.donation.aggregate({
            where: { paymentStatus: 'SUCCEEDED' },
            _count: { id: true },
            _sum: { amount: true }
        }),
        prisma.charity.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({ where: { role: 'donor' } })
    ]);

    const totalAmount = donations._sum.amount || 0;
    const totalDonations = donations._count.id || 0;

    return {
        totalDonations,
        totalAmount,
        totalCharities: charities,
        totalDonors: users,
        averageDonation: totalDonations > 0 ? Math.round(totalAmount / totalDonations) : 0
    };
}

async function getRecentDonationsFromDB(limit = 5) {
    return await prisma.donation.findMany({
        where: { 
            paymentStatus: 'SUCCEEDED',
            anonymous: false 
        },
        include: {
            charity: { select: { name: true } },
            donor: { select: { name: true } },
            blockchainVerification: { 
                select: { verified: true, transactionHash: true } 
            }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
    });
}

async function getTopCharitiesFromDB(limit = 3) {
    const result = await prisma.charity.findMany({
        where: { status: 'ACTIVE' },
        include: {
            donations: {
                where: { paymentStatus: 'SUCCEEDED' },
                select: { amount: true }
            },
            _count: {
                select: { 
                    donations: { where: { paymentStatus: 'SUCCEEDED' } }
                }
            }
        }
    });

    return result
        .map(charity => ({
            id: charity.id,
            name: charity.name,
            category: charity.category,
            donationCount: charity._count.donations,
            totalAmount: charity.donations.reduce((sum, d) => sum + d.amount, 0)
        }))
        .sort((a, b) => b.donationCount - a.donationCount)
        .slice(0, limit);
}

async function getCategoryStatsFromDB() {
    const stats = await prisma.donation.groupBy({
        by: ['charityId'],
        where: { paymentStatus: 'SUCCEEDED' },
        _sum: { amount: true },
        _count: { id: true }
    });

    const categoryMap = new Map();
    
    for (const stat of stats) {
        const charity = await prisma.charity.findUnique({
            where: { id: stat.charityId },
            select: { category: true }
        });
        
        if (charity) {
            const category = charity.category;
            if (!categoryMap.has(category)) {
                categoryMap.set(category, { totalAmount: 0, count: 0 });
            }
            categoryMap.get(category).totalAmount += stat._sum.amount || 0;
            categoryMap.get(category).count += stat._count.id || 0;
        }
    }

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        totalAmount: data.totalAmount,
        donationCount: data.count
    }));
}

// ========================================
// BLOCKCHAIN VERIFICATION ENDPOINTS
// ========================================

export const getBlockchainStats = async (req, res) => {
    try {
        console.log('⛓️ Fetching blockchain statistics...');
        
        const stats = await verificationService.getVerificationStats();
        
        console.log('✅ Blockchain stats fetched successfully');
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Blockchain stats error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch blockchain statistics',
            message: error.message 
        });
    }
};

export const getVerificationStatus = async (req, res) => {
    try {
        const { donationId } = req.params;
        
        console.log(`🔍 Getting verification status for donation ${donationId}`);
        
        const status = await verificationService.getVerificationStatus(parseInt(donationId));
        
        console.log(`✅ Verification status: ${status.status}`);
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('❌ Verification status error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to get verification status',
            message: error.message 
        });
    }
};

// Only available if smart contract is deployed
export const verifyDonationFromContract = async (req, res) => {
    try {
        if (!blockchainService.isContractDeployed) {
            return res.status(503).json({
                success: false,
                error: 'Smart contract not available',
                message: 'Contract verification requires deployed smart contract'
            });
        }

        const { transactionId } = req.params;
        
        console.log(`🔍 Verifying donation ${transactionId} directly from smart contract...`);
        
        const contractDonation = await blockchainService.getDonation(transactionId);
        
        if (!contractDonation.donorId) {
            return res.status(404).json({ 
                success: false,
                error: 'Donation not found on blockchain' 
            });
        }
        
        // Find corresponding database record
        const dbDonation = await prisma.donation.findUnique({
            where: { transactionId },
            include: {
                charity: { select: { name: true } },
                donor: { select: { name: true } },
                blockchainVerification: true
            }
        });
        
        const response = {
            found: true,
            blockchain: contractDonation,
            database: dbDonation ? {
                id: dbDonation.id,
                amount: dbDonation.amount,
                paymentStatus: dbDonation.paymentStatus,
                charity: dbDonation.charity?.name,
                donor: dbDonation.anonymous ? 'Anonymous' : dbDonation.donor?.name,
                verified: dbDonation.blockchainVerification?.verified || false
            } : null,
            match: dbDonation ? (
                Math.abs(parseFloat(contractDonation.amount) - dbDonation.amount) < 0.01 &&
                contractDonation.charityId === dbDonation.charityId.toString()
            ) : false
        };
        
        res.json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error('❌ Verification error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to verify donation from smart contract',
            message: error.message 
        });
    }
};

// ========================================
// HELPER FUNCTIONS
// ========================================

async function enrichCharityData(topCharities) {
    const enriched = [];
    for (const charityData of topCharities) {
        const charity = await prisma.charity.findUnique({
            where: { id: parseInt(charityData.charityId) },
            select: { name: true, category: true }
        });
        
        enriched.push({
            id: parseInt(charityData.charityId),
            name: charity?.name || `Charity ${charityData.charityId}`,
            category: charity?.category || 'UNKNOWN',
            donationCount: charityData.donationCount
        });
    }
    return enriched;
}




// Replace the simplified version with this full implementation
async function enrichDonorDonationHistory(donationHistory) {
    console.log('🔍 Enriching donor donation history...');
    
    const enriched = [];
    
    for (const donation of donationHistory) {
        let enrichedDonation = { ...donation };
        
        // Get charity info
        if (donation.charityId) {
            try {
                const charity = await prisma.charity.findUnique({
                    where: { id: parseInt(donation.charityId) },
                    select: { name: true, category: true }
                });
                
                if (charity) {
                    enrichedDonation.charity = {
                        name: charity.name,
                        category: charity.category
                    };
                }
            } catch (error) {
                console.error(`❌ Error fetching charity ${donation.charityId}:`, error);
            }
        }
        
        // Get project info if available
        if (donation.projectId && donation.projectId !== '0') {
            try {
                const project = await prisma.project.findUnique({
                    where: { id: parseInt(donation.projectId) },
                    select: { title: true }
                });
                
                if (project) {
                    enrichedDonation.project = {
                        title: project.title
                    };
                }
            } catch (error) {
                console.error(`❌ Error fetching project ${donation.projectId}:`, error);
            }
        }
        
        enriched.push(enrichedDonation);
    }
    
    return enriched;
}

function getMonthlyBreakdown(donations) {
    const monthlyData = new Map();
    
    donations.forEach(donation => {
        const month = donation.createdAt.toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyData.has(month)) {
            monthlyData.set(month, { amount: 0, count: 0 });
        }
        monthlyData.get(month).amount += donation.amount;
        monthlyData.get(month).count += 1;
    });

    return Array.from(monthlyData.entries())
        .map(([month, data]) => ({
            month,
            amount: data.amount,
            count: data.count
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
}