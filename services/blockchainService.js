// backend/services/blockchainService.js
import { ethers } from 'ethers';
import { getWallet, CONTRACT_ADDRESS, CONTRACT_ABI } from '../blockchain/config.js';

class BlockchainService {
  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      this.wallet = getWallet();
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.wallet);
      console.log('Connected to blockchain contract at:', CONTRACT_ADDRESS);
    } catch (error) {
      console.error('Error initializing blockchain service:', error);
      // Don't throw error to allow the service to continue functioning
      console.error('Using mock functionality instead');
      this.useMock = true;
    }
  }

  async recordDonation(donation) {
    try {
      console.log('Recording donation on blockchain:', donation);
      
      // Convert amount to wei (assuming 18 decimals)
      const amountInWei = ethers.parseUnits(donation.amount.toString(), 18);
      
      // Call smart contract function
      const tx = await this.contract.recordDonation(
        donation.transactionId,
        donation.donorId.toString(),
        donation.charityId.toString(),
        donation.projectId ? donation.projectId.toString() : '',
        amountInWei,
        donation.currency || 'RON',
        donation.anonymous || false
      );
      
      console.log('Transaction sent:', tx.hash);
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction confirmed in block:', receipt.blockNumber);
      
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error recording donation on blockchain:', error);
      throw error;
    }
  }

  async getDonationsByCharity(charityId) {
    try {
      // If initialization failed, use mock functionality
      if (this.useMock) {
        return this._mockGetDonationsByCharity(charityId);
      }

      const donationIds = await this.contract.getDonationsByCharity(charityId.toString());
      
      const donations = [];
      for (const id of donationIds) {
        const donation = await this.contract.getDonation(id);
        
        donations.push({
          transactionId: id,
          donorId: donation[0],
          charityId: donation[1],
          projectId: donation[2],
          amount: ethers.formatUnits(donation[3], 18),
          currency: donation[4],
          timestamp: new Date(Number(donation[5]) * 1000).toISOString(),
          isAnonymous: donation[6]
        });
      }
      
      return donations;
    } catch (error) {
      console.error('Error getting charity donations:', error);
      return this._mockGetDonationsByCharity(charityId);
    }
  }

  async getCharityFlow(charityId) {
    try {
      // If initialization failed, use mock functionality
      if (this.useMock) {
        return this._mockGetCharityFlow(charityId);
      }

      const flow = await this.contract.getCharityFlow(charityId.toString());
      
      return {
        totalReceived: ethers.formatUnits(flow[0], 18),
        totalDisbursed: ethers.formatUnits(flow[1], 18),
        adminFees: ethers.formatUnits(flow[2], 18),
        balance: ethers.formatUnits(flow[3], 18)
      };
    } catch (error) {
      console.error('Error getting charity flow:', error);
      return this._mockGetCharityFlow(charityId);
    }
  }
}

// Export the class itself, not an instance
export default BlockchainService;