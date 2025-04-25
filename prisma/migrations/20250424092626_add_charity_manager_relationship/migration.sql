/*
  Warnings:

  - You are about to drop the column `userId` on the `Charity` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[managerId]` on the table `Charity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `managerId` to the `Charity` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Charity` DROP FOREIGN KEY `Charity_userId_fkey`;

-- AlterTable
ALTER TABLE `Charity` DROP COLUMN `userId`,
    ADD COLUMN `managerId` INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Charity_managerId_key` ON `Charity`(`managerId`);

-- AddForeignKey
ALTER TABLE `Charity` ADD CONSTRAINT `Charity_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
