// backend/scripts/testBlockchainTransactions.js
import BlockchainService from '../services/blockchainService.js';
import { testConnection } from '../blockchain/config.js';

class BlockchainTransactionTester {
  constructor() {
    this.blockchainService = new BlockchainService();
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 BLOCKCHAIN TRANSACTION TESTING SUITE');
    console.log('=' .repeat(60));
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    
    try {
      // Initialize blockchain service
      await this.blockchainService.initialize();
      
      // Test 1: Basic connection
      await this.testBasicConnection();
      
      // Test 2: Record a test donation
      await this.testRecordDonation();
      
      // Test 3: Retrieve donations by charity
      await this.testGetDonationsByCharity();
      
      // Test 4: Get charity flow
      await this.testGetCharityFlow();
      
      // Test 5: Error handling
      await this.testErrorHandling();
      
      this.printTestSummary();
      
    } catch (error) {
      console.error('\n💥 Test suite failed to start:', error.message);
    }
  }

  async testBasicConnection() {
    console.log('\n1️⃣  Testing Basic Blockchain Connection...');
    try {
      const result = await testConnection();
      if (result.success) {
        this.addTestResult('Basic Connection', 'PASS', 'Successfully connected to blockchain');
      } else {
        this.addTestResult('Basic Connection', 'FAIL', result.error);
      }
    } catch (error) {
      this.addTestResult('Basic Connection', 'FAIL', error.message);
    }
  }

  async testRecordDonation() {
    console.log('\n2️⃣  Testing Record Donation...');
    
    const testDonation = {
      transactionId: `test_tx_${Date.now()}`,
      donorId: 1,
      charityId: 1,
      projectId: 1,
      amount: 50.00,
      currency: 'RON',
      anonymous: false
    };

    try {
      console.log('   📝 Recording test donation:', testDonation);
      
      const result = await this.blockchainService.recordDonation(testDonation);
      
      if (result && result.transactionHash) {
        console.log('   ✅ Donation recorded successfully!');
        console.log(`   📋 Transaction Hash: ${result.transactionHash}`);
        console.log(`   📦 Block Number: ${result.blockNumber}`);
        console.log(`   ⛽ Gas Used: ${result.gasUsed}`);
        
        this.addTestResult('Record Donation', 'PASS', `TX: ${result.transactionHash}`);
        
        // Store for later tests
        this.testTransactionId = testDonation.transactionId;
        this.testCharityId = testDonation.charityId;
        
        return result;
      } else {
        this.addTestResult('Record Donation', 'FAIL', 'No transaction hash returned');
      }
    } catch (error) {
      console.error('   ❌ Record donation failed:', error.message);
      this.addTestResult('Record Donation', 'FAIL', error.message);
    }
  }

  async testGetDonationsByCharity() {
    console.log('\n3️⃣  Testing Get Donations by Charity...');
    
    if (!this.testCharityId) {
      console.log('   ⚠️  Skipping - no test charity ID available');
      this.addTestResult('Get Donations by Charity', 'SKIP', 'No test data available');
      return;
    }

    try {
      console.log(`   🔍 Getting donations for charity ID: ${this.testCharityId}`);
      
      const donations = await this.blockchainService.getDonationsByCharity(this.testCharityId);
      
      console.log(`   📊 Found ${donations.length} donations`);
      
      if (donations.length > 0) {
        console.log('   📋 Sample donation:');
        console.log('   ', JSON.stringify(donations[0], null, 4));
      }
      
      this.addTestResult('Get Donations by Charity', 'PASS', `Found ${donations.length} donations`);
      
      return donations;
    } catch (error) {
      console.error('   ❌ Get donations failed:', error.message);
      this.addTestResult('Get Donations by Charity', 'FAIL', error.message);
    }
  }

  async testGetCharityFlow() {
    console.log('\n4️⃣  Testing Get Charity Flow...');
    
    if (!this.testCharityId) {
      console.log('   ⚠️  Skipping - no test charity ID available');
      this.addTestResult('Get Charity Flow', 'SKIP', 'No test data available');
      return;
    }

    try {
      console.log(`   💰 Getting charity flow for ID: ${this.testCharityId}`);
      
      const flow = await this.blockchainService.getCharityFlow(this.testCharityId);
      
      console.log('   📊 Charity Flow Data:');
      console.log(`   💵 Total Received: ${flow.totalReceived} ETH`);
      console.log(`   💸 Total Disbursed: ${flow.totalDisbursed} ETH`);
      console.log(`   💼 Admin Fees: ${flow.adminFees} ETH`);
      console.log(`   🏦 Balance: ${flow.balance} ETH`);
      
      this.addTestResult('Get Charity Flow', 'PASS', `Balance: ${flow.balance} ETH`);
      
      return flow;
    } catch (error) {
      console.error('   ❌ Get charity flow failed:', error.message);
      this.addTestResult('Get Charity Flow', 'FAIL', error.message);
    }
  }

  async testErrorHandling() {
    console.log('\n5️⃣  Testing Error Handling...');
    
    try {
      // Test with invalid data
      console.log('   🧪 Testing with invalid donation data...');
      
      const invalidDonation = {
        transactionId: '', // Empty transaction ID
        donorId: 'invalid', // Invalid donor ID
        charityId: null, // Null charity ID
        amount: -50 // Negative amount
      };

      try {
        await this.blockchainService.recordDonation(invalidDonation);
        this.addTestResult('Error Handling', 'FAIL', 'Should have thrown error for invalid data');
      } catch (error) {
        console.log('   ✅ Correctly handled invalid data:', error.message);
        this.addTestResult('Error Handling', 'PASS', 'Properly validates input data');
      }
      
    } catch (error) {
      this.addTestResult('Error Handling', 'FAIL', error.message);
    }
  }

  addTestResult(testName, status, details) {
    this.testResults.push({
      test: testName,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  }

  printTestSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(60));
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const skipped = this.testResults.filter(r => r.status === 'SKIP').length;
    
    console.log(`✅ PASSED: ${passed}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log(`⏭️  SKIPPED: ${skipped}`);
    console.log(`📋 TOTAL: ${this.testResults.length}`);
    
    console.log('\n📝 DETAILED RESULTS:');
    this.testResults.forEach((result, index) => {
      const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`${index + 1}. ${emoji} ${result.test}: ${result.details}`);
    });
    
    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Your blockchain integration is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
    }
    
    console.log('\n💡 Next Steps:');
    console.log('   1. If tests pass: Integrate with your donation flow');
    console.log('   2. If tests fail: Check your smart contract deployment');
    console.log('   3. Monitor gas usage for optimization');
  }
}

// Quick single transaction test
async function quickTransactionTest() {
  console.log('🚀 QUICK TRANSACTION TEST');
  console.log('-'.repeat(30));
  
  try {
    const service = new BlockchainService();
    await service.initialize();
    
    const testDonation = {
      transactionId: `quick_test_${Date.now()}`,
      donorId: 999,
      charityId: 999,
      projectId: null,
      amount: 10.0,
      currency: 'RON',
      anonymous: true
    };
    
    console.log('📝 Testing donation:', testDonation);
    
    const result = await service.recordDonation(testDonation);
    
    if (result.transactionHash) {
      console.log('✅ SUCCESS!');
      console.log(`📋 TX Hash: ${result.transactionHash}`);
      console.log(`📦 Block: ${result.blockNumber}`);
    } else {
      console.log('❌ FAILED: No transaction hash');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Export for use in other files
export default BlockchainTransactionTester;

// Command line execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick')) {
    quickTransactionTest();
  } else if (args.includes('--help')) {
    console.log(`
🧪 Blockchain Transaction Testing Suite

Usage: node scripts/testBlockchainTransactions.js [options]

Options:
  --help     Show this help message
  --quick    Run a quick single transaction test
  
Examples:
  node scripts/testBlockchainTransactions.js          # Full test suite
  node scripts/testBlockchainTransactions.js --quick  # Quick test
    `);
  } else {
    const tester = new BlockchainTransactionTester();
    tester.runAllTests();
  }
}