/*
  Warnings:

  - You are about to drop the `CharityUpdate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `CharityUpdate` DROP FOREIGN KEY `CharityUpdate_charityId_fkey`;

-- DropTable
DROP TABLE `CharityUpdate`;
