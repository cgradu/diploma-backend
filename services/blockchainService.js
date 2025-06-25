// backend/services/blockchainService.js - CLEAN REAL IMPLEMENTATION
import { ethers } from 'ethers';
import { getWallet, CONTRACT_ADDRESS, CONTRACT_ABI } from '../blockchain/config.js';

class BlockchainService {
constructor() {
  this.isContractDeployed = false;
  this.initialize();

}

async initialize() {
  try {
    const { wallet } = await getWallet();
    this.wallet = wallet;

    // Create contract instance with signer
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.wallet);
    
    // Test contract connection
    await this.testContractConnection();

    this.isContractDeployed = true;
    console.log('✅ Blockchain service initialized successfully');
    
  } catch (error) {
    console.error('❌ Error initializing blockchain service:', error.message);
    this.isContractDeployed = false;
    console.error('⚠️ Blockchain service is not deployed or initialized correctly');
    throw error;
  }
}

async testContractConnection() {
  try {
    // Test with a simple view function
    const totalDonations = await this.contract.getAllDonationIds();
  } catch (error) {
    console.error('⚠️ Contract connection test failed:', error.message);
    throw error;
  }
}

async recordDonation(donation) {
  try {
    const amountInWei = ethers.parseUnits(donation.amount.toString(), 2);
    
    const tx = await this.contract.recordDonation(
      donation.transactionId,
      donation.donorId.toString(),
      donation.charityId.toString(),
      donation.projectId ? donation.projectId.toString() : '',
      amountInWei,
      donation.currency || 'RON',
      donation.anonymous || false
    );
  
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
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
    console.log(`🏢 Fetching donations for charity ${charityId} from smart contract...`);
    
    const donationIds = await this.contract.getDonationsByCharity(charityId.toString());
    
    const donations = [];
    for (const id of donationIds) {
      try {
        const donation = await this.contract.getDonation(id);
        
        donations.push({
          transactionId: id,
          donorId: donation[0],
          charityId: donation[1],
          projectId: donation[2],
          amount: ethers.formatUnits(donation[3], 2), // Using 2 decimals
          currency: donation[4],
          timestamp: new Date(Number(donation[5]) * 1000).toISOString(),
          isAnonymous: donation[6]
        });
      } catch (donationError) {
        console.warn(`⚠️ Failed to get donation details for ${id}:`, donationError.message);
      }
    }
    
    console.log(`✅ Found ${donations.length} donations for charity ${charityId}`);
    return donations;
  } catch (error) {
    console.error(`❌ Error getting charity ${charityId} donations:`, error);
    throw error;
  }
}

async getCharityFlow(charityId) {
  try {
    console.log(`💰 Fetching charity ${charityId} flow from smart contract...`);
    
    const flow = await this.contract.getCharityFlow(charityId.toString());
    
    const result = {
      totalReceived: ethers.formatUnits(flow[0], 2),
      totalDisbursed: ethers.formatUnits(flow[1], 2),
      balance: ethers.formatUnits(flow[2], 2)
    };
    
    console.log(`✅ Charity ${charityId} flow:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error getting charity ${charityId} flow:`, error);
    throw error;
  }
}

async getPlatformStats() {
  try {
    console.log('📊 Fetching platform stats from smart contract...');
    
    const stats = await this.contract.getPlatformStats();
    
    const result = {
      totalDonations: Number(stats.totalDonations),
      totalAmount: ethers.formatUnits(stats.totalAmount, 2),
      totalCharities: Number(stats.totalCharities),
      totalDonors: Number(stats.totalDonors),
      averageDonation: ethers.formatUnits(stats.averageDonation, 2)
    };
    
    console.log('✅ Platform stats fetched:', result);
    return result;
  } catch (error) {
    console.error('❌ Error getting platform stats:', error);
    throw error;
  }
}

async getRecentDonations(limit = 5) {
  try {
    console.log(`📋 Fetching ${limit} recent donations from smart contract...`);
    
    const donationIds = await this.contract.getRecentDonations(limit);
    
    const donations = [];
    for (const id of donationIds) {
      try {
        const donation = await this.contract.getDonation(id);
        donations.push({
          transactionId: id,
          donorId: donation[0],
          charityId: donation[1],
          projectId: donation[2],
          amount: ethers.formatUnits(donation[3], 2),
          currency: donation[4],
          timestamp: new Date(Number(donation[5]) * 1000).toISOString(),
          isAnonymous: donation[6]
        });
      } catch (donationError) {
        console.warn(`⚠️ Failed to get donation details for ${id}:`, donationError.message);
      }
    }
    
    console.log(`✅ Found ${donations.length} recent donations`);
    return donations;
  } catch (error) {
    console.error('❌ Error getting recent donations:', error);
    throw error;
  }
}

async getTopCharitiesByDonations(limit = 3) {
  try {
    console.log(`🏆 Fetching top ${limit} charities from smart contract...`);
    
    const topCharities = await this.contract.getTopCharitiesByDonations(limit);
    
    const formattedCharities = [];
    for (let i = 0; i < topCharities[0].length; i++) {
      if (topCharities[0][i]) {
        formattedCharities.push({
          charityId: topCharities[0][i],
          donationCount: Number(topCharities[1][i])
        });
      }
    }
    
    console.log(`✅ Found ${formattedCharities.length} top charities`);
    return formattedCharities;
  } catch (error) {
    console.error('❌ Error getting top charities:', error);
    throw error;
  }
}

async getCharityStats(charityId) {
  try {
    console.log(`🏢 Fetching charity ${charityId} stats from smart contract...`);
    
    const stats = await this.contract.getCharityStats(charityId.toString());
    
    const result = {
      totalDonations: Number(stats.totalDonations),
      totalAmount: ethers.formatUnits(stats.totalAmount, 2),
      totalDisbursed: ethers.formatUnits(stats.totalDisbursed, 2),
      balance: ethers.formatUnits(stats.balance, 2),
      averageDonation: ethers.formatUnits(stats.averageDonation, 2),
      lastDonationTime: Number(stats.lastDonationTime)
    };
    
    console.log(`✅ Charity ${charityId} stats:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error getting charity ${charityId} stats:`, error);
    throw error;
  }
}

async getCharityDonationHistory(charityId, limit = 10) {
  try {
      console.log(`📋 Fetching charity ${charityId} donation history from smart contract...`);
      
      // Get basic history (transactionIds, amounts, timestamps)
      const history = await this.contract.getCharityDonationHistory(charityId.toString(), limit);
      
      const formattedHistory = [];
      
      // For each transaction, get the full donation details to extract donorId
      for (let i = 0; i < history.transactionIds.length; i++) {
          const transactionId = history.transactionIds[i];
          
          console.log(`🔍 Getting donation details for transaction: ${transactionId}`);
          
          // Get donation details including donorId
          const donation = await this.contract.getDonation(transactionId);
          
          formattedHistory.push({
              transactionId: transactionId,
              donorId: donation.donorId, // Now we have the donorId!
              charityId: donation.charityId,
              amount: ethers.formatUnits(history.amounts[i], 2),
              timestamp: new Date(Number(history.timestamps[i]) * 1000).toISOString(),
              isAnonymous: donation.isAnonymous
          });
      }
      
      console.log(`✅ Found ${formattedHistory.length} donations in charity ${charityId} history`);
      return formattedHistory;
  } catch (error) {
      console.error(`❌ Error getting charity ${charityId} history:`, error);
      throw error;
  }
}

async getDonorStats(donorId) {
try {
  console.log(`👤 Fetching donor ${donorId} stats from smart contract...`);
  
  const stats = await this.contract.getDonorStats(donorId.toString());
  
  const result = {
    totalDonations: Number(stats.totalDonations),
    totalAmount: ethers.formatUnits(stats.totalAmount, 2),
    uniqueCharities: Number(stats.uniqueCharities),
    averageDonation: ethers.formatUnits(stats.averageDonation, 2),
    lastDonationTime: Number(stats.lastDonationTime)
  };
  
  console.log(`✅ Donor ${donorId} stats:`, result);
  return result;
} catch (error) {
  console.error(`❌ Error getting donor ${donorId} stats:`, error);
  throw error;
}
}

async getDonorDonationHistory(donorId, limit = 10) {
try {
  console.log(`📋 Fetching donor ${donorId} donation history from smart contract...`);
  
  const history = await this.contract.getDonorDonationHistory(donorId.toString(), limit);
  
  const formattedHistory = [];
  for (let i = 0; i < history.transactionIds.length; i++) {
    formattedHistory.push({
      transactionId: history.transactionIds[i],
      charityId: history.charityIds[i],
      amount: ethers.formatUnits(history.amounts[i], 2),
      timestamp: new Date(Number(history.timestamps[i]) * 1000).toISOString()
    });
  }
  
  console.log(`✅ Found ${formattedHistory.length} donations in donor ${donorId} history`);
  return formattedHistory;
} catch (error) {
  console.error(`❌ Error getting donor ${donorId} history:`, error);
  throw error;
}
}

async getDonation(transactionId) {
try {
  console.log(`🔍 Fetching donation ${transactionId} from smart contract...`);
  
  const donation = await this.contract.getDonation(transactionId);
  
  const result = {
    donorId: donation[0],
    charityId: donation[1],
    projectId: donation[2],
    amount: ethers.formatUnits(donation[3], 2),
    currency: donation[4],
    timestamp: new Date(Number(donation[5]) * 1000).toISOString(),
    isAnonymous: donation[6]
  };
  
  console.log(`✅ Donation ${transactionId} found:`, result);
  return result;
} catch (error) {
  console.error(`❌ Error getting donation ${transactionId}:`, error);
  throw error;
}
}

async getDonationsByDonor(donorId) {
try {
  console.log(`👤 Fetching donations for donor ${donorId} from smart contract...`);
  
  const donationIds = await this.contract.getDonationsByDonor(donorId.toString());
  
  const donations = [];
  for (const id of donationIds) {
    try {
      const donation = await this.contract.getDonation(id);
      donations.push({
        transactionId: id,
        donorId: donation[0],
        charityId: donation[1],
        projectId: donation[2],
        amount: ethers.formatUnits(donation[3], 2),
        currency: donation[4],
        timestamp: new Date(Number(donation[5]) * 1000).toISOString(),
        isAnonymous: donation[6]
      });
    } catch (donationError) {
      console.warn(`⚠️ Failed to get donation details for ${id}:`, donationError.message);
    }
  }
  
  console.log(`✅ Found ${donations.length} donations for donor ${donorId}`);
  return donations;
} catch (error) {
  console.error(`❌ Error getting donations for donor ${donorId}:`, error);
  throw error;
}
}

async getAllDonationIds() {
try {
  console.log('📋 Fetching all donation IDs from smart contract...');
  
  const allIds = await this.contract.getAllDonationIds();
  
  console.log(`✅ Found ${allIds.length} total donation IDs`);
  return allIds;
} catch (error) {
  console.error('❌ Error getting all donation IDs:', error);
  throw error;
}
}

async allocateFunds(charityId, amount, purpose) {
try {
  console.log(`💸 Allocating ${amount} funds for charity ${charityId}...`);
  
  const amountInWei = ethers.parseUnits(amount.toString(), 2);
  
  const tx = await this.contract.allocateFunds(
    charityId.toString(),
    amountInWei,
    purpose
  );
  
  console.log('📤 Fund allocation transaction sent:', tx.hash);
  
  const receipt = await tx.wait();
  console.log('✅ Fund allocation confirmed in block:', receipt.blockNumber);
  
  return {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString()
  };
} catch (error) {
  console.error('❌ Error allocating funds:', error);
  throw error;
}
}
}

// Export the class itself, not an instance
export default BlockchainService;