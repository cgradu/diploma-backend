-- AlterTable
ALTER TABLE `User` ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Charity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `mission` TEXT NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `registrationId` VARCHAR(191) NOT NULL,
    `category` ENUM('EDUCATION', 'HEALTH', 'ENVIRONMENT', 'HUMANITARIAN', 'ANIMAL_WELFARE', 'ARTS_CULTURE', 'DISASTER_RELIEF', 'HUMAN_RIGHTS', 'COMMUNITY_DEVELOPMENT', 'RELIGIOUS', 'OTHER') NOT NULL,
    `address` VARCHAR(191) NULL,
    `foundedYear` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Charity_email_key`(`email`),
    UNIQUE INDEX `Charity_registrationId_key`(`registrationId`),
    INDEX `Charity_category_idx`(`category`),
    INDEX `Charity_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `goal` DOUBLE NOT NULL,
    `currentAmount` DOUBLE NOT NULL DEFAULT 0,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `charityId` INTEGER NOT NULL,

    INDEX `Project_charityId_idx`(`charityId`),
    INDEX `Project_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Donation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DOUBLE NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `message` TEXT NULL,
    `anonymous` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `donorId` INTEGER NOT NULL,
    `charityId` INTEGER NOT NULL,
    `projectId` INTEGER NULL,

    UNIQUE INDEX `Donation_transactionId_key`(`transactionId`),
    INDEX `Donation_donorId_idx`(`donorId`),
    INDEX `Donation_charityId_idx`(`charityId`),
    INDEX `Donation_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlockchainVerification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transactionHash` VARCHAR(191) NOT NULL,
    `blockNumber` INTEGER NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `donationId` INTEGER NOT NULL,

    UNIQUE INDEX `BlockchainVerification_transactionHash_key`(`transactionHash`),
    UNIQUE INDEX `BlockchainVerification_donationId_key`(`donationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CharityUpdate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `charityId` INTEGER NOT NULL,

    INDEX `CharityUpdate_charityId_idx`(`charityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Charity` ADD CONSTRAINT `Charity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_charityId_fkey` FOREIGN KEY (`charityId`) REFERENCES `Charity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donation` ADD CONSTRAINT `Donation_donorId_fkey` FOREIGN KEY (`donorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donation` ADD CONSTRAINT `Donation_charityId_fkey` FOREIGN KEY (`charityId`) REFERENCES `Charity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donation` ADD CONSTRAINT `Donation_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlockchainVerification` ADD CONSTRAINT `BlockchainVerification_donationId_fkey` FOREIGN KEY (`donationId`) REFERENCES `Donation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharityUpdate` ADD CONSTRAINT `CharityUpdate_charityId_fkey` FOREIGN KEY (`charityId`) REFERENCES `Charity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
