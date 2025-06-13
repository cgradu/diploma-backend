/*
  Warnings:

  - Made the column `managerId` on table `Charity` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `Charity` DROP FOREIGN KEY `Charity_managerId_fkey`;

-- AlterTable
ALTER TABLE `Charity` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedBy` INTEGER NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'SUSPENDED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    MODIFY `managerId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `Charity_status_idx` ON `Charity`(`status`);

-- AddForeignKey
ALTER TABLE `Charity` ADD CONSTRAINT `Charity_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
