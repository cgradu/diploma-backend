/*
  Warnings:

  - A unique constraint covering the columns `[paymentIntentId]` on the table `Donation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Donation` ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'RON',
    ADD COLUMN `paymentIntentId` VARCHAR(191) NULL,
    ADD COLUMN `paymentStatus` ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `receiptUrl` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Donation_paymentIntentId_key` ON `Donation`(`paymentIntentId`);
