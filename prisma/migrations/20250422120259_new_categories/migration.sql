/*
  Warnings:

  - The values [HEALTH] on the enum `Charity_category` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Charity` MODIFY `category` ENUM('EDUCATION', 'HEALTHCARE', 'ENVIRONMENT', 'HUMANITARIAN', 'ANIMAL_WELFARE', 'ARTS_CULTURE', 'DISASTER_RELIEF', 'HUMAN_RIGHTS', 'COMMUNITY_DEVELOPMENT', 'RELIGIOUS', 'OTHER') NOT NULL;
