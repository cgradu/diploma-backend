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
    string[] public allCharityIds;
    string[] public allDonorIds;
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
        
        // Track unique charities
        if (charityDonations[charityId].length == 1) {
            allCharityIds.push(charityId);
        }
        
        if (!isAnonymous) {
            donorDonations[donorId].push(transactionId);
            // Track unique donors
            if (donorDonations[donorId].length == 1) {
                allDonorIds.push(donorId);
            }
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
    
    // PLATFORM-WIDE STATISTICS
    function getPlatformStats() public view returns (
        uint256 totalDonations,
        uint256 totalAmount,
        uint256 totalCharities,
        uint256 totalDonors,
        uint256 averageDonation
    ) {
        totalDonations = allDonationIds.length;
        totalCharities = allCharityIds.length;
        totalDonors = allDonorIds.length;
        
        for (uint i = 0; i < allDonationIds.length; i++) {
            totalAmount += donations[allDonationIds[i]].amount;
        }
        
        averageDonation = totalDonations > 0 ? totalAmount / totalDonations : 0;
    }
    
    function getRecentDonations(uint256 limit) public view returns (string[] memory) {
        uint256 start = allDonationIds.length > limit ? allDonationIds.length - limit : 0;
        string[] memory recent = new string[](allDonationIds.length - start);
        
        for (uint i = start; i < allDonationIds.length; i++) {
            recent[i - start] = allDonationIds[i];
        }
        
        return recent;
    }
    
    function getTopCharitiesByDonations(uint256 limit) public view returns (
        string[] memory charityIds,
        uint256[] memory donationCounts
    ) {
        charityIds = new string[](limit);
        donationCounts = new uint256[](limit);
        
        // Simple sorting - for production, consider off-chain processing
        for (uint i = 0; i < limit && i < allCharityIds.length; i++) {
            uint maxCount = 0;
            string memory maxCharityId;
            uint maxIndex;
            
            for (uint j = 0; j < allCharityIds.length; j++) {
                uint count = charityDonations[allCharityIds[j]].length;
                if (count > maxCount) {
                    bool alreadyIncluded = false;
                    for (uint k = 0; k < i; k++) {
                        if (keccak256(bytes(charityIds[k])) == keccak256(bytes(allCharityIds[j]))) {
                            alreadyIncluded = true;
                            break;
                        }
                    }
                    if (!alreadyIncluded) {
                        maxCount = count;
                        maxCharityId = allCharityIds[j];
                        maxIndex = j;
                    }
                }
            }
            
            charityIds[i] = maxCharityId;
            donationCounts[i] = maxCount;
        }
    }
    
    // CHARITY-SPECIFIC STATISTICS
    function getCharityStats(string memory charityId) public view returns (
        uint256 totalDonations,
        uint256 totalAmount,
        uint256 totalDisbursed,
        uint256 balance,
        uint256 averageDonation,
        uint256 lastDonationTime
    ) {
        string[] memory charityDonationIds = charityDonations[charityId];
        totalDonations = charityDonationIds.length;
        
        for (uint i = 0; i < charityDonationIds.length; i++) {
            Donation memory donation = donations[charityDonationIds[i]];
            totalAmount += donation.amount;
            if (donation.timestamp > lastDonationTime) {
                lastDonationTime = donation.timestamp;
            }
        }
        
        CharityFlow memory flow = charityFlows[charityId];
        totalDisbursed = flow.totalDisbursed;
        balance = totalAmount - totalDisbursed;
        averageDonation = totalDonations > 0 ? totalAmount / totalDonations : 0;
    }
    
    function getCharityDonationHistory(string memory charityId, uint256 limit) public view returns (
        string[] memory transactionIds,
        uint256[] memory amounts,
        uint256[] memory timestamps
    ) {
        string[] memory charityDonationIds = charityDonations[charityId];
        uint256 count = charityDonationIds.length > limit ? limit : charityDonationIds.length;
        
        transactionIds = new string[](count);
        amounts = new uint256[](count);
        timestamps = new uint256[](count);
        
        // Return most recent donations
        uint256 start = charityDonationIds.length > limit ? charityDonationIds.length - limit : 0;
        for (uint i = 0; i < count; i++) {
            Donation memory donation = donations[charityDonationIds[start + i]];
            transactionIds[i] = donation.transactionId;
            amounts[i] = donation.amount;
            timestamps[i] = donation.timestamp;
        }
    }
    
    // DONOR-SPECIFIC STATISTICS
    function getDonorStats(string memory donorId) public view returns (
        uint256 totalDonations,
        uint256 totalAmount,
        uint256 uniqueCharities,
        uint256 averageDonation,
        uint256 lastDonationTime
    ) {
        string[] memory donorDonationIds = donorDonations[donorId];
        totalDonations = donorDonationIds.length;
        
        string[] memory charitiesSupported = new string[](totalDonations);
        uint256 charityCount = 0;
        
        for (uint i = 0; i < donorDonationIds.length; i++) {
            Donation memory donation = donations[donorDonationIds[i]];
            totalAmount += donation.amount;
            
            if (donation.timestamp > lastDonationTime) {
                lastDonationTime = donation.timestamp;
            }
            
            // Count unique charities
            bool charityExists = false;
            for (uint j = 0; j < charityCount; j++) {
                if (keccak256(bytes(charitiesSupported[j])) == keccak256(bytes(donation.charityId))) {
                    charityExists = true;
                    break;
                }
            }
            if (!charityExists) {
                charitiesSupported[charityCount] = donation.charityId;
                charityCount++;
            }
        }
        
        uniqueCharities = charityCount;
        averageDonation = totalDonations > 0 ? totalAmount / totalDonations : 0;
    }
    
    function getDonorDonationHistory(string memory donorId, uint256 limit) public view returns (
        string[] memory transactionIds,
        string[] memory charityIds,
        uint256[] memory amounts,
        uint256[] memory timestamps
    ) {
        string[] memory donorDonationIds = donorDonations[donorId];
        uint256 count = donorDonationIds.length > limit ? limit : donorDonationIds.length;
        
        transactionIds = new string[](count);
        charityIds = new string[](count);
        amounts = new uint256[](count);
        timestamps = new uint256[](count);
        
        // Return most recent donations
        uint256 start = donorDonationIds.length > limit ? donorDonationIds.length - limit : 0;
        for (uint i = 0; i < count; i++) {
            Donation memory donation = donations[donorDonationIds[start + i]];
            transactionIds[i] = donation.transactionId;
            charityIds[i] = donation.charityId;
            amounts[i] = donation.amount;
            timestamps[i] = donation.timestamp;
        }
    }
    
    // EXISTING FUNCTIONS
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