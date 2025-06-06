// SPDX-License-Identifier: MIT
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
        uint256 lastUpdate;
    }
    
    mapping(string => Donation) public donations;
    mapping(string => CharityFlow) public charityFlows;
    mapping(string => string[]) public charityDonations;
    mapping(string => string[]) public donorDonations;
    
    string[] public allDonationIds;
    address public owner;
    
    event DonationRecorded(
        string transactionId,
        string charityId,
        string donorId,
        uint256 amount,
        uint256 timestamp
    );
    
    event FundsAllocated(
        string charityId,
        uint256 amount,
        string purpose,
        uint256 timestamp
    );
    
    constructor() {
        owner = msg.sender;
    }
    
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
        string memory purpose
    ) public {
        require(charityFlows[charityId].totalReceived >= charityFlows[charityId].totalDisbursed + amount, 
                "Insufficient funds");
        
        charityFlows[charityId].totalDisbursed += amount;
        charityFlows[charityId].lastUpdate = block.timestamp;
        
        emit FundsAllocated(charityId, amount, purpose, block.timestamp);
    }
    
    function getDonationsByCharity(string memory charityId) public view returns (string[] memory) {
        return charityDonations[charityId];
    }
    
    function getDonationsByDonor(string memory donorId) public view returns (string[] memory) {
        return donorDonations[donorId];
    }
    
    function getDonation(string memory transactionId) public view returns (
        string memory donorId,
        string memory charityId,
        string memory projectId,
        uint256 amount,
        string memory currency,
        uint256 timestamp,
        bool isAnonymous
    ) {
        Donation memory donation = donations[transactionId];
        return (
            donation.donorId,
            donation.charityId,
            donation.projectId,
            donation.amount,
            donation.currency,
            donation.timestamp,
            donation.isAnonymous
        );
    }
    
    function getCharityFlow(string memory charityId) public view returns (
        uint256 totalReceived,
        uint256 totalDisbursed,
        uint256 balance
    ) {
        CharityFlow memory flow = charityFlows[charityId];
        return (
            flow.totalReceived,
            flow.totalDisbursed,
            flow.totalReceived - flow.totalDisbursed
        );
    }
    
    function getAllDonationIds() public view returns (string[] memory) {
        return allDonationIds;
    }
}