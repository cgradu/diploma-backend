import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import crypto from 'crypto';

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
      clientSecret: paymentIntent.client_secret,
      donationId: donation.id
    });
    
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return res.status(500).json({ error: 'Failed to process donation' });
  }
};

// Confirm a payment was successful
const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, donationId } = req.body;
    
    // Retrieve the payment intent from Stripe to verify its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment has not succeeded' });
    }
    
    // Update the donation status
    const donation = await prisma.donation.update({
      where: { id: parseInt(donationId) },
      data: {
        paymentStatus: 'SUCCEEDED',
        receiptUrl: paymentIntent.charges.data[0]?.receipt_url || null
      }
    });
    
    // If donation is for a project, update the project's current amount
    if (donation.projectId) {
      await prisma.project.update({
        where: { id: donation.projectId },
        data: {
          currentAmount: {
            increment: donation.amount
          }
        }
      });
    }
    
    // Mock blockchain verification
    // In a real implementation, this would trigger a blockchain transaction
    await prisma.blockchainVerification.create({
      data: {
        transactionHash: `0x${crypto.randomBytes(32).toString('hex')}`,
        blockNumber: Math.floor(Math.random() * 1000000),
        timestamp: new Date(),
        verified: true,
        donationId: donation.id
      }
    });
    
    return res.status(200).json({
      success: true,
      donation,
      message: 'Donation successfully recorded and verified'
    });
    
  } catch (error) {
    console.error('Error confirming payment:', error);
    return res.status(500).json({ error: 'Failed to confirm donation' });
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
        Charity: {
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
        Charity: {
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

// Get charity donation statistics
const getCharityDonationStats = async (req, res) => {
  try {
    const { charityId } = req.params;
    
    // Check if charity exists
    const charity = await prisma.charity.findUnique({
      where: { id: parseInt(charityId) }
    });
    
    if (!charity) {
      return res.status(404).json({ error: 'Charity not found' });
    }
    
    // Get total amount donated
    const totalDonations = await prisma.donation.aggregate({
      where: {
        charityId: parseInt(charityId),
        paymentStatus: 'SUCCEEDED'
      },
      _sum: {
        amount: true
      },
      _count: true
    });
    
    // Get projects with donation statistics
    const projects = await prisma.project.findMany({
      where: {
        charityId: parseInt(charityId)
      },
      select: {
        id: true,
        title: true,
        goal: true,
        currentAmount: true,
        status: true,
        _count: {
          select: {
            Donation: {
              where: {
                paymentStatus: 'SUCCEEDED'
              }
            }
          }
        }
      }
    });
    
    // Get recent donations
    const recentDonations = await prisma.donation.findMany({
      where: {
        charityId: parseInt(charityId),
        paymentStatus: 'SUCCEEDED',
        anonymous: false
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        User: {
          select: {
            name: true
          }
        },
        Project: {
          select: {
            title: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    return res.status(200).json({
      totalAmount: totalDonations._sum.amount || 0,
      totalDonations: totalDonations._count,
      projects,
      recentDonations
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

export default {
  createPaymentIntent,
  confirmPayment,
  getDonationHistory,
  getDonationDetails,
  getCharityDonationStats,
  handleWebhook
};