// backend/services/blockchainVerificationService.js
import { PrismaClient } from '@prisma/client';
import BlockchainService from './blockchainService.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

class BlockchainVerificationService {
  constructor() {
    this.blockchainService = new BlockchainService();
  }

  async initialize() {
    await this.blockchainService.initialize();
  }

  /**
   * Verify a donation on the blockchain
   * @param {number} donationId - The ID of the donation to verify
   * @returns {Promise<Object>} The blockchain verification record
   */
  async verifyDonation(donationId) {
    try {
      console.log(`🔍 Starting blockchain verification for donation ID: ${donationId}`);
      
      // Get the donation with all necessary data
      const donation = await prisma.donation.findUnique({
        where: { id: donationId },
        include: {
          charity: true,
          donor: true,
          project: true,
          blockchainVerification: true
        }
      });

      if (!donation) {
        throw new Error(`Donation with ID ${donationId} not found`);
      }

      // Check if already verified
      if (donation.blockchainVerification?.verified) {
        console.log(`✅ Donation ${donationId} is already verified on blockchain`);
        return donation.blockchainVerification;
      }

      console.log(`📝 Recording donation on blockchain:`, {
        id: donation.id,
        amount: donation.amount,
        charity: donation.charity.name,
        donor: donation.anonymous ? 'Anonymous' : donation.donor.name
      });

      // Prepare donation data for blockchain
      const blockchainDonationData = {
        transactionId: donation.transactionId,
        donorId: donation.donorId,
        charityId: donation.charityId,
        projectId: donation.projectId,
        amount: donation.amount,
        currency: donation.currency,
        anonymous: donation.anonymous
      };

      // Record on blockchain
      const blockchainResult = await this.blockchainService.recordDonation(blockchainDonationData);
      
      console.log(`🔗 Blockchain recording result:`, blockchainResult);

      // Create or update blockchain verification record
      let verification;
      
      if (donation.blockchainVerification) {
        // Update existing record
        verification = await prisma.blockchainVerification.update({
          where: { id: donation.blockchainVerification.id },
          data: {
            transactionHash: blockchainResult.transactionHash,
            blockNumber: parseInt(blockchainResult.blockNumber),
            timestamp: new Date(),
            verified: true
          }
        });
      } else {
        // Create new verification record
        verification = await prisma.blockchainVerification.create({
          data: {
            transactionHash: blockchainResult.transactionHash,
            blockNumber: parseInt(blockchainResult.blockNumber),
            timestamp: new Date(),
            verified: true,
            donationId: donationId
          }
        });
      }

      console.log(`✅ Blockchain verification completed for donation ${donationId}`);
      console.log(`📋 Transaction Hash: ${verification.transactionHash}`);
      console.log(`📦 Block Number: ${verification.blockNumber}`);

      return verification;

    } catch (error) {
      console.error(`❌ Blockchain verification failed for donation ${donationId}:`, error);
      
      // Create a pending verification record even if blockchain fails
      let verification;
      try {
        const existingVerification = await prisma.blockchainVerification.findUnique({
          where: { donationId: donationId }
        });

        if (existingVerification) {
          verification = await prisma.blockchainVerification.update({
            where: { id: existingVerification.id },
            data: {
              transactionHash: `failed_${crypto.randomBytes(16).toString('hex')}`,
              blockNumber: 0,
              timestamp: new Date(),
              verified: false
            }
          });
        } else {
          verification = await prisma.blockchainVerification.create({
            data: {
              transactionHash: `failed_${crypto.randomBytes(16).toString('hex')}`,
              blockNumber: 0,
              timestamp: new Date(),
              verified: false,
              donationId: donationId
            }
          });
        }

        console.log(`⚠️ Created pending verification record for donation ${donationId}`);
        return verification;
      } catch (dbError) {
        console.error(`❌ Failed to create pending verification record:`, dbError);
        throw error; // Re-throw original error
      }
    }
  }

  /**
   * Get verification status for a donation
   * @param {number} donationId - The ID of the donation
   * @returns {Promise<Object>} The verification status
   */
  async getVerificationStatus(donationId) {
    try {
      const donation = await prisma.donation.findUnique({
        where: { id: donationId },
        include: {
          blockchainVerification: true
        }
      });

      if (!donation) {
        throw new Error(`Donation with ID ${donationId} not found`);
      }

      if (!donation.blockchainVerification) {
        return {
          verified: false,
          status: 'NOT_VERIFIED',
          message: 'Donation has not been verified on blockchain yet'
        };
      }

      const verification = donation.blockchainVerification;
      
      return {
        verified: verification.verified,
        status: verification.verified ? 'VERIFIED' : 'PENDING',
        transactionHash: verification.transactionHash,
        blockNumber: verification.blockNumber,
        timestamp: verification.timestamp,
        message: verification.verified 
          ? 'Donation is verified on blockchain' 
          : 'Blockchain verification is pending'
      };

    } catch (error) {
      console.error(`Error getting verification status for donation ${donationId}:`, error);
      throw error;
    }
  }

  /**
   * Batch verify multiple donations
   * @param {number[]} donationIds - Array of donation IDs to verify
   * @returns {Promise<Object[]>} Array of verification results
   */
  async batchVerifyDonations(donationIds) {
    console.log(`🔄 Starting batch verification for ${donationIds.length} donations`);
    
    const results = [];
    
    for (const donationId of donationIds) {
      try {
        const verification = await this.verifyDonation(donationId);
        results.push({
          donationId,
          success: true,
          verification
        });
      } catch (error) {
        console.error(`Batch verification failed for donation ${donationId}:`, error);
        results.push({
          donationId,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`✅ Batch verification completed. Success: ${results.filter(r => r.success).length}/${results.length}`);
    return results;
  }

  /**
   * Get all unverified donations
   * @returns {Promise<Object[]>} Array of unverified donations
   */
  async getUnverifiedDonations() {
    try {
      const unverifiedDonations = await prisma.donation.findMany({
        where: {
          paymentStatus: 'SUCCEEDED',
          OR: [
            { blockchainVerification: null },
            { 
              blockchainVerification: {
                verified: false
              }
            }
          ]
        },
        include: {
          charity: {
            select: {
              id: true,
              name: true
            }
          },
          donor: {
            select: {
              id: true,
              name: true
            }
          },
          blockchainVerification: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return unverifiedDonations.map(donation => ({
        id: donation.id,
        amount: donation.amount,
        currency: donation.currency,
        transactionId: donation.transactionId,
        createdAt: donation.createdAt,
        charity: donation.charity,
        donor: donation.anonymous ? { name: 'Anonymous' } : donation.donor,
        verificationStatus: donation.blockchainVerification?.verified ? 'PENDING' : 'NOT_STARTED'
      }));

    } catch (error) {
      console.error('Error getting unverified donations:', error);
      throw error;
    }
  }

  /**
   * Retry failed verifications
   * @returns {Promise<Object>} Retry results
   */
  async retryFailedVerifications() {
    try {
      console.log('🔄 Retrying failed blockchain verifications...');
      
      const failedVerifications = await prisma.blockchainVerification.findMany({
        where: {
          verified: false,
          transactionHash: {
            startsWith: 'failed_'
          }
        },
        include: {
          donation: true
        }
      });

      if (failedVerifications.length === 0) {
        console.log('✅ No failed verifications to retry');
        return { retried: 0, successful: 0, failed: 0 };
      }

      console.log(`🔄 Found ${failedVerifications.length} failed verifications to retry`);

      let successful = 0;
      let failed = 0;

      for (const verification of failedVerifications) {
        try {
          await this.verifyDonation(verification.donationId);
          successful++;
        } catch (error) {
          console.error(`Retry failed for donation ${verification.donationId}:`, error);
          failed++;
        }
      }

      console.log(`✅ Retry completed. Successful: ${successful}, Failed: ${failed}`);
      
      return {
        retried: failedVerifications.length,
        successful,
        failed
      };

    } catch (error) {
      console.error('Error retrying failed verifications:', error);
      throw error;
    }
  }

  /**
   * Get blockchain verification statistics
   * @returns {Promise<Object>} Verification statistics
   */
  async getVerificationStats() {
    try {
      const totalDonations = await prisma.donation.count({
        where: { paymentStatus: 'SUCCEEDED' }
      });

      const verifiedCount = await prisma.blockchainVerification.count({
        where: { verified: true }
      });

      const pendingCount = await prisma.blockchainVerification.count({
        where: { verified: false }
      });

      const unverifiedCount = totalDonations - verifiedCount - pendingCount;

      const verificationRate = totalDonations > 0 ? (verifiedCount / totalDonations) * 100 : 0;

      return {
        totalDonations,
        verifiedCount,
        pendingCount,
        unverifiedCount,
        verificationRate: Math.round(verificationRate * 100) / 100
      };

    } catch (error) {
      console.error('Error getting verification stats:', error);
      throw error;
    }
  }
}

export default BlockchainVerificationService;