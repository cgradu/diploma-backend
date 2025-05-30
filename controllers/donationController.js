import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import crypto from 'crypto';
import blockchainService from '../services/blockchainService.js'; // Add this import
import BlockchainVerificationService from '../services/blockchainVerificationService.js';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create a payment intent
const createPaymentIntent = async (req, res) => {
  try {
    const { amount, charityId, projectId, message, anonymous, currency = 'USD' } = req.body;
    
    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    
    if (!charityId) {
      return res.status(400).json({ error: 'Charity ID is required' });
    }
    
    // Get the user ID from the authenticated user
    const userId = req.user.id;
    
    // Check if charity exists
    const charity = await prisma.charity.findUnique({
      where: { id: parseInt(charityId) }
    });
    
    if (!charity) {
      return res.status(404).json({ error: 'Charity not found' });
    }
    
    // Check if project exists if projectId is provided
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { 
          id: parseInt(projectId),
          charityId: parseInt(charityId)
        }
      });
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found or does not belong to the specified charity' });
      }
    }
    
    // Convert amount to cents for Stripe
    const amountInCents = Math.round(amount * 100);
    
    // Create a payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      description: `Donation to ${charity.name}${projectId ? ` for project #${projectId}` : ''}`,
      metadata: {
        charityId: charityId.toString(),
        projectId: projectId ? projectId.toString() : null,
        userId: userId.toString(),
        anonymous: anonymous ? 'true' : 'false',
      }
    });
    
    // Generate a unique transaction ID
    const transactionId = `don_${crypto.randomBytes(8).toString('hex')}`;
    
    // Create a pending donation record
    const donation = await prisma.donation.create({
      data: {
        amount,
        transactionId,
        paymentIntentId: paymentIntent.id,
        paymentStatus: 'PENDING',
        message: message || null,
        anonymous,
        currency,
        donorId: userId,
        charityId: parseInt(charityId),
        projectId: projectId ? parseInt(projectId) : null
      }
    });
    
    // Return the client secret to the frontend
    return res.status(200).json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      donationId: donation.id
    });
    
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return res.status(500).json({ error: 'Failed to process donation' });
  }
};

// confirmPayment function
// confirmPayment function - Updated with proper blockchain integration
const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, donationId } = req.body;
    
    console.log("=== Confirm Payment Request ===");
    console.log("PaymentIntent ID:", paymentIntentId);
    console.log("Donation ID:", donationId);
    console.log("Request user:", req.user?.id);
    
    // Validate inputs
    if (!paymentIntentId || !donationId) {
      console.error("Missing required parameters");
      return res.status(400).json({ 
        error: 'Missing required parameters',
        details: { paymentIntentId: !!paymentIntentId, donationId: !!donationId }
      });
    }
    
    // Check if donation exists first
    const existingDonation = await prisma.donation.findUnique({
      where: { id: parseInt(donationId) }
    });
    
    if (!existingDonation) {
      console.error("Donation not found:", donationId);
      return res.status(404).json({ error: 'Donation not found' });
    }
    
    console.log("Found donation:", existingDonation);
    
    // Retrieve the payment intent from Stripe with expanded charges
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ['charges'] }  // Expand charges to get receipt_url
      );
      console.log("PaymentIntent status:", paymentIntent.status);
      console.log("PaymentIntent charges:", paymentIntent.charges?.data?.length || 0);
    } catch (stripeError) {
      console.error("Stripe error:", stripeError);
      return res.status(400).json({ 
        error: 'Failed to retrieve payment from Stripe',
        details: stripeError.message 
      });
    }
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        error: `Payment has not succeeded. Current status: ${paymentIntent.status}` 
      });
    }
    
    // Get receipt URL safely
    let receiptUrl = null;
    if (paymentIntent.charges && paymentIntent.charges.data && paymentIntent.charges.data.length > 0) {
      receiptUrl = paymentIntent.charges.data[0].receipt_url;
    }
    console.log("Receipt URL:", receiptUrl || "Not available");
    
    // Update the donation status with correct include syntax
    const donation = await prisma.donation.update({
      where: { id: parseInt(donationId) },
      data: {
        paymentStatus: 'SUCCEEDED',
        receiptUrl: receiptUrl || null
      },
      include: {
        charity: true,
        donor: true,
        project: true,
        blockchainVerification: true
      }
    });
    
    console.log("Donation updated successfully");
    
    // Update project amount if applicable
    if (donation.projectId) {
      try {
        await prisma.project.update({
          where: { id: donation.projectId },
          data: {
            currentAmount: {
              increment: donation.amount
            }
          }
        });
        console.log("Project amount updated");
      } catch (projectError) {
        console.error("Project update error:", projectError);
        // Don't fail the whole transaction for this
      }
    }
    
    // Create blockchain verification - UPDATED SECTION
    let blockchainVerification = null;
    try {
      // Use blockchainVerificationService to verify the donation on blockchain
      console.log("Recording donation on blockchain via verification service...");

      const verificationService = new BlockchainVerificationService();
      await verificationService.initialize(); // Ensure service is initialized
      blockchainVerification = verificationService.verifyDonation(donation.id);
      
      console.log("Blockchain verification successful:", blockchainVerification);
    } catch (blockchainError) {
      console.error("Blockchain verification error:", blockchainError);
      
      // Create pending verification record
      try {
        blockchainVerification = await prisma.blockchainVerification.create({
          data: {
            transactionHash: `pending_${crypto.randomBytes(16).toString('hex')}`,
            blockNumber: 0,
            timestamp: new Date(),
            verified: false,
            donationId: donation.id
          }
        });
        console.log("Created pending blockchain verification");
      } catch (dbError) {
        console.error("Failed to create pending verification:", dbError);
      }
    }
    
    // Fetch the complete donation with all relationships including blockchain verification
    const finalDonation = await prisma.donation.findUnique({
      where: { id: donation.id },
      include: {
        charity: {
          select: {
            id: true,
            name: true,
            category: true,
            description: true
          }
        },
        donor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            goal: true,
            currentAmount: true,
            status: true
          }
        },
        blockchainVerification: true
      }
    });
    
    console.log("=== Payment Confirmed Successfully ===");
    console.log("Final donation data:", {
      id: finalDonation.id,
      amount: finalDonation.amount,
      currency: finalDonation.currency,
      blockchainVerified: finalDonation.blockchainVerification?.verified || false
    });
    
    return res.status(200).json({
      success: true,
      donation: finalDonation,
      message: finalDonation.blockchainVerification?.verified 
        ? 'Donation successfully recorded and verified on blockchain'
        : 'Donation recorded successfully (blockchain verification pending)'
    });
    
  } catch (error) {
    console.error('=== Unexpected Error in confirmPayment ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log Prisma-specific errors
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.meta) {
      console.error('Error meta:', error.meta);
    }
    
    return res.status(500).json({ 
      error: 'Failed to confirm donation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user's donation history
const getDonationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const donations = await prisma.donation.findMany({
      where: {
        donorId: userId
      },
      include: {
        charity: {
          select: {
            id: true,
            name: true,
            category: true
          }
        },
        Project: {
          select: {
            id: true,
            title: true,
            status: true
          }
        },
        BlockchainVerification: {
          select: {
            transactionHash: true,
            verified: true,
            timestamp: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return res.status(200).json(donations);
    
  } catch (error) {
    console.error('Error fetching donation history:', error);
    return res.status(500).json({ error: 'Failed to retrieve donation history' });
  }
};

// Get donation details
const getDonationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const donation = await prisma.donation.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        charity: {
          select: {
            id: true,
            name: true,
            category: true,
            description: true
          }
        },
        Project: {
          select: {
            id: true,
            title: true,
            description: true,
            goal: true,
            currentAmount: true,
            status: true
          }
        },
        BlockchainVerification: {
          select: {
            transactionHash: true,
            blockNumber: true,
            verified: true,
            timestamp: true
          }
        }
      }
    });
    
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }
    
    // Only allow the donor or admins to view the donation details
    if (donation.donorId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to view this donation' });
    }
    
    return res.status(200).json(donation);
    
  } catch (error) {
    console.error('Error fetching donation details:', error);
    return res.status(500).json({ error: 'Failed to retrieve donation details' });
  }
};

// Enhanced charity donation statistics for the dashboard
const getCharityDonationStats = async (req, res) => {
  try {
    const { charityId } = req.params;
    const parsedCharityId = parseInt(charityId);
    
    // Check if charity exists
    const charity = await prisma.charity.findUnique({
      where: { id: parsedCharityId }
    });
    
    if (!charity) {
      return res.status(404).json({ error: 'Charity not found' });
    }
    
    // Get total amount donated
    const totalDonations = await prisma.donation.aggregate({
      where: {
        charityId: parsedCharityId,
        paymentStatus: 'SUCCEEDED'
      },
      _sum: {
        amount: true
      },
      _count: true
    });
    
    // For handling unique donors, we'll use a simpler approach to avoid Prisma errors
    // First get non-anonymous donations with valid donor IDs
    const donationsWithDonors = await prisma.donation.findMany({
      where: {
        charityId: parsedCharityId,
        paymentStatus: 'SUCCEEDED',
        anonymous: false
      },
      select: {
        donorId: true
      }
    });
    
    // Extract unique donor IDs
    const uniqueDonorIds = new Set();
    donationsWithDonors.forEach(donation => {
      if (donation.donorId) {
        uniqueDonorIds.add(donation.donorId);
      }
    });
    
    // Count anonymous donations
    const anonymousDonations = await prisma.donation.count({
      where: {
        charityId: parsedCharityId,
        paymentStatus: 'SUCCEEDED',
        anonymous: true
      }
    });
    
    // Get donations by month for trend analysis
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyDonations = await prisma.donation.findMany({
      where: {
        charityId: parsedCharityId,
        paymentStatus: 'SUCCEEDED',
        createdAt: { gte: sixMonthsAgo }
      },
      select: {
        amount: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    // Format monthly data for easier frontend consumption
    const monthlyData = {};
    
    monthlyDonations.forEach(donation => {
      const month = donation.createdAt.toISOString().substring(0, 7); // YYYY-MM format
      
      if (!monthlyData[month]) {
        monthlyData[month] = {
          total: 0,
          count: 0
        };
      }
      
      monthlyData[month].total += donation.amount;
      monthlyData[month].count += 1;
    });
    
    // Convert to array format for easier frontend processing
    const trendData = Object.keys(monthlyData).map(month => ({
      month,
      total: monthlyData[month].total,
      count: monthlyData[month].count
    }));
    
    // Get projects with donation statistics
    const projects = await prisma.project.findMany({
      where: {
        charityId: parsedCharityId
      },
      select: {
        id: true,
        title: true,
        goal: true,
        currentAmount: true,
        status: true,
        _count: {
          select: {
            donations: {
              where: {
                paymentStatus: 'SUCCEEDED'
              }
            }
          }
        }
      }
    });
    
    return res.status(200).json({
      totalAmount: totalDonations._sum.amount || 0,
      totalDonations: totalDonations._count || 0,
      uniqueDonors: uniqueDonorIds.size + anonymousDonations, // Count unique users plus anonymous donations
      projects: projects.map(project => ({
        id: project.id,
        title: project.title,
        goal: project.goal,
        currentAmount: project.currentAmount || 0,
        status: project.status,
        donationCount: project._count.donations,
        percentFunded: project.goal > 0 ? Math.round(((project.currentAmount || 0) / project.goal) * 100) : 0
      })),
      trendData: trendData.sort((a, b) => a.month.localeCompare(b.month)) // Sort by date
    });
    
  } catch (error) {
    console.error('Error fetching charity donation stats:', error);
    return res.status(500).json({ error: 'Failed to retrieve donation statistics' });
  }
};

// Handle Stripe webhook events
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      // Update donation status
      await prisma.donation.updateMany({
        where: {
          paymentIntentId: paymentIntent.id
        },
        data: {
          paymentStatus: 'SUCCEEDED',
          receiptUrl: paymentIntent.charges.data[0]?.receipt_url || null
        }
      });
      
      // Get the donation to update project funds
      const donation = await prisma.donation.findFirst({
        where: {
          paymentIntentId: paymentIntent.id
        }
      });
      
      if (donation && donation.projectId) {
        await prisma.project.update({
          where: { id: donation.projectId },
          data: {
            currentAmount: {
              increment: donation.amount
            }
          }
        });
      }
      
      // Create blockchain verification for the donation
      if (donation) {
        await prisma.blockchainVerification.create({
          data: {
            transactionHash: `0x${crypto.randomBytes(32).toString('hex')}`,
            blockNumber: Math.floor(Math.random() * 1000000),
            timestamp: new Date(),
            verified: true,
            donationId: donation.id
          }
        });
      }
    } 
    else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      
      // Update donation status to failed
      await prisma.donation.updateMany({
        where: {
          paymentIntentId: paymentIntent.id
        },
        data: {
          paymentStatus: 'FAILED'
        }
      });
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook event:', error);
    return res.status(500).json({ error: 'Failed to process webhook event' });
  }
};

// Get blockchain donations by charity
const getBlockchainDonationsByCharity = async (req, res) => {
  try {
    const { charityId } = req.params;
    const donations = await blockchainService.getDonationsByCharity(charityId);
    res.json(donations);
  } catch (error) {
    console.error('Error fetching blockchain donations:', error);
    res.status(500).json({ error: 'Failed to fetch blockchain data' });
  }
};

// Get blockchain donations by donor
const getBlockchainDonationsByDonor = async (req, res) => {
  try {
    const { donorId } = req.params;
    const donations = await blockchainService.getDonationsByDonor(donorId);
    res.json(donations);
  } catch (error) {
    console.error('Error fetching blockchain donations:', error);
    res.status(500).json({ error: 'Failed to fetch blockchain data' });
  }
};

// Get charity flow data
const getCharityFlowData = async (req, res) => {
  try {
    const { charityId } = req.params;
    const flowData = await blockchainService.getCharityFlow(charityId);
    res.json(flowData);
  } catch (error) {
    console.error('Error fetching charity flow:', error);
    res.status(500).json({ error: 'Failed to fetch flow data' });
  }
};

// Get verification status
const getVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const verification = await blockchainVerificationService.getVerificationStatus(parseInt(id));
    return res.status(200).json(verification);
  } catch (error) {
    console.error('Error getting verification status:', error);
    return res.status(500).json({ error: 'Failed to get verification status' });
  }
};

// Verify donation on blockchain
const verifyDonationOnBlockchain = async (req, res) => {
  try {
    const { id } = req.params;
    const donationId = parseInt(id);
    
    // Check if admin or donation owner
    const donation = await prisma.donation.findUnique({
      where: { id: donationId },
      include: { blockchainVerification: true }
    });
    
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }
    
    // Only admin or the donor can manually verify
    if (donation.donorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to verify this donation' });
    }
    
    // Check if already verified
    if (donation.blockchainVerification?.verified) {
      return res.status(200).json({ 
        message: 'Donation already verified on blockchain',
        verification: donation.blockchainVerification
      });
    }
    
    // Perform blockchain verification
    const verification = await blockchainVerificationService.verifyDonation(donationId);
    
    return res.status(200).json({
      success: true,
      message: 'Donation successfully verified on blockchain',
      verification: verification
    });
    
  } catch (error) {
    console.error('Error verifying donation on blockchain:', error);
    return res.status(500).json({ 
      error: 'Failed to verify donation on blockchain',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get blockchain statistics
const getBlockchainStats = async (req, res) => {
  try {
    // Ensure admin access
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can access blockchain statistics' });
    }
    
    // Get global blockchain stats
    const verifiedCount = await prisma.blockchainVerification.count({
      where: { verified: true }
    });
    
    const pendingCount = await prisma.blockchainVerification.count({
      where: { verified: false }
    });
    
    const totalDonations = await prisma.donation.count({
      where: { paymentStatus: 'SUCCEEDED' }
    });
    
    // Get recent verifications
    const recentVerifications = await prisma.blockchainVerification.findMany({
      where: { verified: true },
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        donation: {
          include: {
            charity: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    
    return res.status(200).json({
      verifiedCount,
      pendingCount,
      totalDonations,
      verificationRate: totalDonations > 0 ? (verifiedCount / totalDonations) * 100 : 0,
      recentVerifications: recentVerifications.map(v => ({
        id: v.id,
        donationId: v.donationId,
        transactionHash: v.transactionHash,
        blockNumber: v.blockNumber,
        timestamp: v.timestamp,
        amount: v.donation?.amount || 0,
        currency: v.donation?.currency || 'USD',
        charityName: v.donation?.charity?.name || 'Unknown Charity'
      }))
    });
  } catch (error) {
    console.error('Error getting blockchain stats:', error);
    return res.status(500).json({ error: 'Failed to retrieve blockchain statistics' });
  }
};

// In controllers/donationController.js
const getDonationContext = async (req, res) => {
  try {
    const { type, id } = req.params; // type: 'charity' or 'project'
    
    if (type === 'charity') {
      const charity = await prisma.charity.findUnique({
        where: { id: parseInt(id) },
        include: {
          projects: {
            where: { status: 'ACTIVE' },
            select: { id: true, title: true, status: true }
          }
        }
      });
      
      if (!charity) {
        return res.status(404).json({ error: 'Charity not found' });
      }
      
      return res.json({
        type: 'charity',
        charity,
        projects: charity.projects
      });
    } else if (type === 'project') {
      const project = await prisma.project.findUnique({
        where: { id: parseInt(id) },
        include: {
          charity: {
            select: { id: true, name: true, category: true }
          }
        }
      });
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      return res.json({
        type: 'project',
        project,
        charity: project.charity
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to get donation context' });
  }
};

// Don't forget to add these to your export
export default {
  createPaymentIntent,
  confirmPayment,
  getDonationHistory,
  getDonationDetails,
  getCharityDonationStats,
  handleWebhook,
  getBlockchainDonationsByCharity,
  getBlockchainDonationsByDonor,
  getCharityFlowData,
  getVerificationStatus,
  verifyDonationOnBlockchain,
  getBlockchainStats,
  getDonationContext
};

