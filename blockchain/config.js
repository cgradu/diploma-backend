// backend/blockchain/config.js
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { CONTRACT_ABI } from './contractABI.js';

dotenv.config();

const NETWORK = process.env.BLOCKCHAIN_NETWORK;

// Network configurations
const networks = {
  localhost: {
    url: 'http://127.0.0.1:8545',
    chainId: 31337,
    name: 'Localhost'
  },
  sepolia: {
    url: `https://sepolia.infura.io/v3/416d976e9cf04600a91b11bb9e07290d`,
    chainId: 11155111,
    name: 'Sepolia Testnet'
  },
  mainnet: {
    url: `https://mainnet.infura.io/v3/416d976e9cf04600a91b11bb9e07290d`,
    chainId: 1,
    name: 'Ethereum Mainnet'
  }
};

// Enhanced validation with detailed error messages
const validateConfig = () => {
  const errors = [];
  const warnings = [];
  
  console.log('🔍 Validating blockchain configuration...');
  
  // Check CONTRACT_ADDRESS
  if (!process.env.CONTRACT_ADDRESS) {
    errors.push('CONTRACT_ADDRESS is missing from environment variables');
  } else if (!ethers.isAddress(process.env.CONTRACT_ADDRESS)) {
    errors.push(`CONTRACT_ADDRESS is not a valid Ethereum address: ${process.env.CONTRACT_ADDRESS}`);
  } else {
    console.log('✅ CONTRACT_ADDRESS is valid');
  }
  
  // Check BLOCKCHAIN_NETWORK
  if (!networks[NETWORK]) {
    errors.push(`Unsupported BLOCKCHAIN_NETWORK: ${NETWORK}. Supported: ${Object.keys(networks).join(', ')}`);
  } else {
    console.log(`✅ Using network: ${networks[NETWORK].name}`);
  }
  
  // Network-specific validations
  if (NETWORK === 'sepolia' || NETWORK === 'mainnet') {
    if (!process.env.INFURA_API_KEY) {
      errors.push('INFURA_API_KEY is required for Sepolia/Mainnet network');
    } else if (process.env.INFURA_API_KEY === 'your_infura_api_key') {
      errors.push('Please replace INFURA_API_KEY with your actual Infura project ID');
    } else if (process.env.INFURA_API_KEY.length < 32) {
      warnings.push('INFURA_API_KEY seems too short - please verify it\'s correct');
    } else {
      console.log('✅ INFURA_API_KEY is present');
    }
    
    if (!process.env.BLOCKCHAIN_PRIVATE_KEY) {
      errors.push('BLOCKCHAIN_PRIVATE_KEY is required for sending transactions');
    } else if (!process.env.BLOCKCHAIN_PRIVATE_KEY.startsWith('0x')) {
      warnings.push('BLOCKCHAIN_PRIVATE_KEY should start with 0x');
    } else if (process.env.BLOCKCHAIN_PRIVATE_KEY.length !== 66) {
      warnings.push('BLOCKCHAIN_PRIVATE_KEY should be 66 characters long (including 0x)');
    } else {
      console.log('✅ BLOCKCHAIN_PRIVATE_KEY is present and properly formatted');
    }
  }
  
  // Display warnings
  if (warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }
  
  // Handle errors
  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach(error => console.error(`   - ${error}`));
    throw new Error(`Invalid blockchain configuration: ${errors.join('; ')}`);
  }
  
  console.log('✅ Blockchain configuration validation passed');
};

// Enhanced provider creation with retry logic
export const getProvider = async (retries = 3) => {
  validateConfig();
  
  const network = networks[NETWORK];
  console.log(`🌐 Connecting to ${network.name}...`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const provider = new ethers.JsonRpcProvider(network.url);
      
      // Test the connection
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ Connected to ${network.name} - Block #${blockNumber}`);
      
      // Verify chain ID
      const chainInfo = await provider.getNetwork();
      if (chainInfo.chainId !== BigInt(network.chainId)) {
        throw new Error(`Chain ID mismatch. Expected: ${network.chainId}, Got: ${chainInfo.chainId}`);
      }
      
      return provider;
    } catch (error) {
      console.error(`❌ Connection attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt === retries) {
        // Provide helpful error messages
        if (error.message.includes('401')) {
          throw new Error('Authentication failed - check your INFURA_API_KEY');
        } else if (error.message.includes('ENOTFOUND')) {
          throw new Error('DNS resolution failed - check your internet connection');
        } else if (error.message.includes('timeout')) {
          throw new Error('Connection timeout - the network might be down');
        } else {
          throw new Error(`Failed to connect to ${network.name}: ${error.message}`);
        }
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

export const getWallet = async () => {
  const provider = await getProvider();
  
  try {
    // Make sure the private key is properly formatted
    let privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`💼 Wallet address: ${wallet.address}`);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceInEth = ethers.formatEther(balance);
    console.log(`💰 Wallet balance: ${balanceInEth} ETH`);
    
    return wallet; // This should be a wallet, not a provider
  } catch (error) {
    throw new Error(`Failed to create wallet: ${error.message}`);
  }
};

export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
export { CONTRACT_ABI };

// Enhanced test connection function with detailed diagnostics
export const testConnection = async () => {
  console.log('\n🔍 Starting blockchain connection test...');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Test provider connection
    console.log('\n1️⃣  Testing provider connection...');
    const provider = await getProvider();
    console.log('✅ Provider connection successful');
    
    // Step 2: Test wallet
    console.log('\n2️⃣  Testing wallet...');
    const wallet = await getWallet();
    console.log('✅ Wallet creation successful');
    
    // Step 3: Test contract existence
    console.log('\n3️⃣  Testing contract...');
    if (CONTRACT_ADDRESS) {
      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (code === '0x') {
        console.warn(`⚠️  No contract found at ${CONTRACT_ADDRESS}`);
        console.warn('   This might be normal if the contract hasn\'t been deployed yet');
      } else {
        console.log(`✅ Contract found at ${CONTRACT_ADDRESS}`);
        console.log(`   Bytecode length: ${code.length} characters`);
      }
    }
    
    // Step 4: Test basic contract interaction (if ABI is available)
    if (CONTRACT_ABI && CONTRACT_ABI.length > 0 && CONTRACT_ADDRESS) {
      console.log('\n4️⃣  Testing contract interaction...');
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
        console.log('✅ Contract instance created successfully');
        
        // Try to call a view function (adjust based on your contract)
        // This is just an example - replace with an actual function from your contract
        try {
          // Example: const result = await contract.someViewFunction();
          console.log('ℹ️  Contract function calls will be available once deployed');
        } catch (error) {
          console.warn(`⚠️  Contract function call failed: ${error.message}`);
        }
      } catch (error) {
        console.warn(`⚠️  Contract instance creation failed: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Blockchain connection test completed successfully!');
    console.log('🚀 Your blockchain service is ready to use.');
    
    return {
      success: true,
      provider,
      wallet,
      network: networks[NETWORK]
    };
    
  } catch (error) {
    console.log('\n' + '='.repeat(50));
    console.error('❌ Blockchain connection test failed!');
    console.error(`💥 Error: ${error.message}`);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Check your .env file has all required variables');
    console.log('   2. Verify your INFURA_API_KEY is correct');
    console.log('   3. Ensure your BLOCKCHAIN_PRIVATE_KEY is valid');
    console.log('   4. Check your internet connection');
    console.log('   5. Try switching networks (localhost vs sepolia)');
    
    return {
      success: false,
      error: error.message
    };
  }
};

// Utility function to get network info
export const getNetworkInfo = () => {
  return {
    currentNetwork: NETWORK,
    availableNetworks: Object.keys(networks),
    networkConfig: networks[NETWORK]
  };
};

// Health check function for monitoring
export const healthCheck = async () => {
  try {
    const provider = await getProvider();
    const blockNumber = await provider.getBlockNumber();
    const wallet = await getWallet();
    const balance = await provider.getBalance(wallet.address);
    
    return {
      status: 'healthy',
      network: networks[NETWORK].name,
      blockNumber,
      walletAddress: wallet.address,
      walletBalance: ethers.formatEther(balance),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};