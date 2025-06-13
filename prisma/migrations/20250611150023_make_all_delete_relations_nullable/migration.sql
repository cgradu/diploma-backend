-- DropForeignKey
ALTER TABLE `Charity` DROP FOREIGN KEY `Charity_managerId_fkey`;

-- DropForeignKey
ALTER TABLE `Donation` DROP FOREIGN KEY `Donation_charityId_fkey`;

-- DropForeignKey
ALTER TABLE `Donation` DROP FOREIGN KEY `Donation_donorId_fkey`;

-- DropForeignKey
ALTER TABLE `Project` DROP FOREIGN KEY `Project_charityId_fkey`;

-- AlterTable
ALTER TABLE `Charity` MODIFY `managerId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Donation` MODIFY `donorId` INTEGER NULL,
    MODIFY `charityId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Project` MODIFY `charityId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Charity` ADD CONSTRAINT `Charity_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_charityId_fkey` FOREIGN KEY (`charityId`) REFERENCES `Charity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donation` ADD CONSTRAINT `Donation_charityId_fkey` FOREIGN KEY (`charityId`) REFERENCES `Charity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donation` ADD CONSTRAINT `Donation_donorId_fkey` FOREIGN KEY (`donorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
