// backend/contracts/DonationTracker.sol
pragma solidity ^0.8.0;

contract DonationTracker {
    struct Donation {
        address donor;
        string donorId;
        string charityId;
        string projectId;
        uint256 amount;
        string currency;
        uint256 timestamp;
        string transactionId;
        bool isAnonymous;
    }
    
    struct CharityFlow {
        string charityId;
        uint256 totalReceived;
        uint256 totalDisbursed;
        uint256 adminFees;
        uint256 lastUpdate;
    }
    
    mapping(string => Donation) public donations;
    mapping(string => CharityFlow) public charityFlows;
    mapping(string => string[]) public charityDonations;
    mapping(string => string[]) public donorDonations;
    
    string[] public allDonationIds;
    
    event DonationRecorded(
        string indexed transactionId,
        string indexed charityId,
        string indexed donorId,
        uint256 amount,
        uint256 timestamp
    );
    
    event FundsAllocated(
        string indexed charityId,
        uint256 amount,
        string purpose,
        uint256 timestamp
    );
    
    function recordDonation(
        string memory transactionId,
        string memory donorId,
        string memory charityId,
        string memory projectId,
        uint256 amount,
        string memory currency,
        bool isAnonymous
    ) public {
        require(bytes(donations[transactionId].transactionId).length == 0, "Donation already recorded");
        
        Donation memory newDonation = Donation({
            donor: msg.sender,
            donorId: donorId,
            charityId: charityId,
            projectId: projectId,
            amount: amount,
            currency: currency,
            timestamp: block.timestamp,
            transactionId: transactionId,
            isAnonymous: isAnonymous
        });
        
        donations[transactionId] = newDonation;
        charityDonations[charityId].push(transactionId);
        allDonationIds.push(transactionId);
        
        if (!isAnonymous) {
            donorDonations[donorId].push(transactionId);
        }
        
        charityFlows[charityId].totalReceived += amount;
        charityFlows[charityId].lastUpdate = block.timestamp;
        
        emit DonationRecorded(transactionId, charityId, donorId, amount, block.timestamp);
    }
    
    function allocateFunds(
        string memory charityId,
        uint256 amount,
        string memory purpose,
        uint256 adminFee
    ) public {
        require(charityFlows[charityId].totalReceived >= charityFlows[charityId].totalDisbursed + amount + adminFee, 
                "Insufficient funds");
        
        charityFlows[charityId].totalDisbursed += amount;
        charityFlows[charityId].adminFees += adminFee;
        charityFlows[charityId].lastUpdate = block.timestamp;
        
        emit FundsAllocated(charityId, amount, purpose, block.timestamp);
    }
    
    function getDonationsByCharity(string memory charityId) public view returns (string[] memory) {
        return charityDonations[charityId];
    }
    
    function getDonationsByDonor(string memory donorId) public view returns (string[] memory) {
        return donorDonations[donorId];
    }
    
    function getCharityFlow(string memory charityId) public view returns (
        uint256 totalReceived,
        uint256 totalDisbursed,
        uint256 adminFees,
        uint256 balance
    ) {
        CharityFlow memory flow = charityFlows[charityId];
        return (
            flow.totalReceived,
            flow.totalDisbursed,
            flow.adminFees,
            flow.totalReceived - flow.totalDisbursed - flow.adminFees
        );
    }
}