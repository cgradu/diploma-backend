import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');
  
  // Clear existing data
  await clearDatabase();
  
  // Create test users
  const testAdmin = await createUser('admin@charitrace.org', 'admin123', 'Admin User', 'admin');
  const testDonor = await createUser('donor@example.com', 'donor123', 'Test Donor', 'donor');
  const charityUser1 = await createUser('charity1@example.org', 'charity123', 'Charity Manager 1', 'charity');
  const charityUser2 = await createUser('charity2@example.org', 'charity123', 'Charity Manager 2', 'charity');
  
  // Create test charities
  const charity1 = await createCharity(
    'Education For All',
    'We work to provide education to underprivileged children around the world.',
    'Our mission is to ensure every child has access to quality education regardless of their socioeconomic background.',
    'education@example.org',
    '+1234567890',
    'EFA12345',
    'EDUCATION',
    '123 Education St, Knowledge City',
    2010,
    charityUser1.id
  );
  
  const charity2 = await createCharity(
    'Clean Water Initiative',
    'We help communities access clean and safe drinking water.',
    'Our mission is to reduce water-borne diseases by providing clean water solutions to communities in need.',
    'water@example.org',
    '+1987654321',
    'CWI54321',
    'HUMANITARIAN',
    '456 Water Ave, Hydro Town',
    2015,
    charityUser2.id
  );
  
  // Create some charity updates
  await createCharityUpdate(
    'New School Built in Rural Area',
    'We are happy to announce that we have completed construction of a new school that will serve 200 children in a rural community.',
    charity1.id
  );
  
  await createCharityUpdate(
    'Teacher Training Program Launched',
    'Our new teacher training program has begun, with 50 teachers participating in the first cohort.',
    charity1.id
  );
  
  await createCharityUpdate(
    'Clean Water Project Milestone',
    'We have successfully installed 5 wells in the target region, providing clean water to over 1,000 people.',
    charity2.id
  );
  
  // Create test projects
  const project1 = await createProject(
    'School Supplies Program',
    'Providing essential school supplies to 1,000 children for the upcoming school year. This includes notebooks, pens, pencils, backpacks, and other necessary items to help students succeed in their education.',
    25000,
    5000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 6)),
    'ACTIVE',
    charity1.id
  );
  
  const project2 = await createProject(
    'Teacher Training Initiative',
    'Training 100 teachers in modern teaching methodologies to improve education quality. The program includes workshops, mentoring sessions, and classroom observation to enhance teaching skills.',
    15000,
    3000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 3)),
    'ACTIVE',
    charity1.id
  );
  
  const project3 = await createProject(
    'Well Construction Project',
    'Building 10 wells in rural communities lacking access to clean water. Each well will serve approximately 200-300 people and significantly improve health outcomes in the region.',
    50000,
    20000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 8)),
    'ACTIVE',
    charity2.id
  );
  
  const project4 = await createProject(
    'Water Purification Systems',
    'Installing water purification systems in 20 schools to provide safe drinking water to students. This will help reduce waterborne diseases and improve attendance rates.',
    30000,
    10000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 4)),
    'ACTIVE',
    charity2.id
  );
  
  // Create some test donations with blockchain verification
  const donation1 = await createDonation(
    100,
    'don_test12345678',
    'pi_test123456789',
    'SUCCEEDED',
    'Happy to support education!',
    false,
    testDonor.id,
    charity1.id,
    project1.id,
    'RON',
    'https://example.com/receipt/12345'
  );
  
  await createBlockchainVerification(
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    12345678,
    true,
    donation1.id
  );
  
  const donation2 = await createDonation(
    200,
    'don_test87654321',
    'pi_test987654321',
    'SUCCEEDED',
    null,
    true,
    testDonor.id,
    charity2.id,
    project3.id,
    'RON',
    'https://example.com/receipt/67890'
  );
  
  await createBlockchainVerification(
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    12345679,
    true,
    donation2.id
  );
  
  console.log('Seeding completed successfully!');
}

async function clearDatabase() {
  console.log('Clearing existing data...');
  
  // Delete in order to respect foreign key constraints
  await prisma.blockchainVerification.deleteMany({});
  await prisma.donation.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.charityUpdate.deleteMany({});
  await prisma.charity.deleteMany({});
  
  // Only delete non-admin users to keep your access
  await prisma.user.deleteMany({
    where: {
      NOT: {
        email: 'admin@charitrace.org' // Preserve this admin if it exists
      }
    }
  });
  
  console.log('Database cleared');
}

async function createUser(email, password, name, role) {
  console.log(`Creating user: ${email}`);
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      name,
      role
    }
  });
}

async function createCharity(name, description, mission, email, phone, registrationId, category, address, foundedYear, userId) {
  console.log(`Creating charity: ${name}`);
  
  return prisma.charity.create({
    data: {
      name,
      description,
      mission,
      email,
      phone,
      registrationId,
      category,
      address,
      foundedYear,
      userId,
      updatedAt: new Date()
    }
  });
}

async function createCharityUpdate(title, content, charityId) {
  console.log(`Creating charity update: ${title}`);
  
  return prisma.charityUpdate.create({
    data: {
      title,
      content,
      charityId
    }
  });
}

async function createProject(title, description, goal, currentAmount, startDate, endDate, status, charityId) {
  console.log(`Creating project: ${title}`);
  
  return prisma.project.create({
    data: {
      title,
      description,
      goal,
      currentAmount,
      startDate,
      endDate,
      status,
      charityId,
      updatedAt: new Date()
    }
  });
}

async function createDonation(amount, transactionId, paymentIntentId, paymentStatus, message, anonymous, donorId, charityId, projectId, currency, receiptUrl) {
  console.log(`Creating donation: ${transactionId}`);
  
  return prisma.donation.create({
    data: {
      amount,
      transactionId,
      paymentIntentId,
      paymentStatus,
      message,
      anonymous,
      donorId,
      charityId,
      projectId,
      currency,
      receiptUrl
    }
  });
}

async function createBlockchainVerification(transactionHash, blockNumber, verified, donationId) {
  console.log(`Creating blockchain verification for donation: ${donationId}`);
  
  return prisma.blockchainVerification.create({
    data: {
      transactionHash,
      blockNumber,
      timestamp: new Date(),
      verified,
      donationId
    }
  });
}

// Execute the seed function
main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });