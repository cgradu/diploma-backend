// prisma/comprehensiveSeed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Configuration for data generation
const CONFIG = {
  USERS: {
    DONORS: 120,
    CHARITY_MANAGERS: 30,
    ADMINS: 3
  },
  CHARITIES: 30,
  PROJECTS_PER_CHARITY: { MIN: 2, MAX: 6 },
  DONATIONS: {
    TOTAL: 1200,
    DATE_RANGE_MONTHS: 18 // Generate donations over the last 18 months
  }
};

// Sample data arrays
const CHARITY_CATEGORIES = [
  'EDUCATION', 'HEALTHCARE', 'ENVIRONMENT', 'HUMANITARIAN',
  'ANIMAL_WELFARE', 'ARTS_CULTURE', 'DISASTER_RELIEF',
  'HUMAN_RIGHTS', 'COMMUNITY_DEVELOPMENT', 'RELIGIOUS', 'OTHER'
];

const PROJECT_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED'];
const PAYMENT_STATUSES = ['SUCCEEDED', 'FAILED', 'REFUNDED', 'PENDING'];
const CURRENCIES = ['RON', 'USD', 'EUR'];

// Sample names and data
const FIRST_NAMES = [
  'Alex', 'Maria', 'John', 'Ana', 'David', 'Elena', 'Michael', 'Ioana',
  'Robert', 'Carmen', 'James', 'Andreea', 'William', 'Diana', 'Richard',
  'Cristina', 'Thomas', 'Mihaela', 'Christopher', 'Simona', 'Daniel',
  'Georgiana', 'Paul', 'Raluca', 'Mark', 'Alina', 'Steven', 'Oana',
  'Kevin', 'Roxana', 'Brian', 'Camelia', 'Anthony', 'Teodora'
];

const LAST_NAMES = [
  'Popescu', 'Ionescu', 'Popa', 'Radu', 'Stoica', 'Gheorghe', 'Dima',
  'Constantin', 'Marin', 'Ilie', 'Tudose', 'Barbu', 'Nistor', 'Florea',
  'Petrescu', 'Manole', 'Georgescu', 'Tudor', 'Moldovan', 'Tomescu',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson',
  'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White'
];

const ROMANIAN_CITIES = [
  'București', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Craiova',
  'Brașov', 'Galați', 'Ploiești', 'Oradea', 'Braila', 'Arad', 'Pitești',
  'Sibiu', 'Bacău', 'Târgu Mureș', 'Baia Mare', 'Buzău', 'Satu Mare'
];

const CHARITY_TEMPLATES = {
  EDUCATION: [
    { name: 'Future Scholars Foundation', mission: 'Providing educational opportunities for underprivileged children' },
    { name: 'Digital Learning Initiative', mission: 'Bridging the digital divide in education' },
    { name: 'Rural Schools Support', mission: 'Supporting education in rural communities' },
    { name: 'Adult Literacy Program', mission: 'Promoting adult education and literacy' }
  ],
  HEALTHCARE: [
    { name: 'Medical Aid Romania', mission: 'Providing medical assistance to those in need' },
    { name: 'Cancer Support Network', mission: 'Supporting cancer patients and their families' },
    { name: 'Mental Health Awareness', mission: 'Promoting mental health and wellness' },
    { name: 'Emergency Medical Response', mission: 'Rapid medical response in crisis situations' }
  ],
  ENVIRONMENT: [
    { name: 'Green Future Romania', mission: 'Environmental protection and sustainability' },
    { name: 'Clean Rivers Initiative', mission: 'Protecting and cleaning Romanian rivers' },
    { name: 'Forest Conservation Trust', mission: 'Preserving Romanian forests for future generations' },
    { name: 'Renewable Energy Advocates', mission: 'Promoting clean energy solutions' }
  ],
  HUMANITARIAN: [
    { name: 'Helping Hands Romania', mission: 'Humanitarian aid for those in crisis' },
    { name: 'Refugee Support Center', mission: 'Supporting refugees and displaced persons' },
    { name: 'Food Security Alliance', mission: 'Fighting hunger and food insecurity' },
    { name: 'Disaster Relief Network', mission: 'Emergency response and disaster relief' }
  ],
  ANIMAL_WELFARE: [
    { name: 'Animal Rescue Romania', mission: 'Rescuing and caring for abandoned animals' },
    { name: 'Wildlife Protection Fund', mission: 'Protecting endangered wildlife species' },
    { name: 'Pet Adoption Centers', mission: 'Finding homes for homeless pets' },
    { name: 'Farm Animal Sanctuary', mission: 'Providing sanctuary for farm animals' }
  ]
};

const PROJECT_TEMPLATES = {
  EDUCATION: [
    'School Building Renovation', 'Computer Lab Setup', 'Scholarship Program',
    'Teacher Training Initiative', 'Library Development', 'STEM Education Program',
    'After-School Programs', 'Educational Field Trips', 'Special Needs Support'
  ],
  HEALTHCARE: [
    'Mobile Health Clinics', 'Medical Equipment Purchase', 'Free Health Screenings',
    'Medicine Distribution Program', 'Hospital Construction', 'Mental Health Services',
    'Emergency Medical Training', 'Vaccination Campaigns', 'Elderly Care Program'
  ],
  ENVIRONMENT: [
    'Tree Planting Campaign', 'River Cleanup Project', 'Solar Panel Installation',
    'Waste Reduction Program', 'Environmental Education', 'Green Transportation',
    'Eco-friendly Infrastructure', 'Wildlife Habitat Restoration', 'Air Quality Monitoring'
  ],
  HUMANITARIAN: [
    'Emergency Food Distribution', 'Homeless Shelter Support', 'Crisis Intervention',
    'Community Kitchen Program', 'Clothing Distribution', 'Temporary Housing',
    'Family Reunification', 'Legal Aid Services', 'Psychological Support'
  ],
  ANIMAL_WELFARE: [
    'Animal Shelter Construction', 'Veterinary Care Program', 'Spay/Neuter Campaign',
    'Wildlife Rescue Center', 'Pet Food Distribution', 'Animal Adoption Events',
    'Habitat Protection', 'Anti-Poaching Initiative', 'Animal Education Program'
  ]
};

// Utility functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function getRandomDate(monthsBack) {
  const now = new Date();
  const pastDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const randomTime = pastDate.getTime() + Math.random() * (now.getTime() - pastDate.getTime());
  return new Date(randomTime);
}

// Track used emails to prevent duplicates
const usedEmails = new Set();

function generateEmail(firstName, lastName, domain = 'example.com') {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
  
  let email;
  let attempts = 0;
  
  do {
    const number = attempts === 0 ? '' : getRandomNumber(1, 9999);
    email = `${cleanFirst}.${cleanLast}${number}@${domain}`;
    attempts++;
  } while (usedEmails.has(email) && attempts < 100);
  
  if (usedEmails.has(email)) {
    // Fallback with timestamp if all attempts failed
    email = `${cleanFirst}.${cleanLast}.${Date.now()}@${domain}`;
  }
  
  usedEmails.add(email);
  return email;
}

function generatePhone() {
  const prefixes = ['07', '06'];
  const prefix = getRandomElement(prefixes);
  const number = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return `${prefix}${number}`;
}

function generateAddress(city) {
  const streets = ['Str. Libertății', 'Str. Mihai Viteazu', 'Bd. Unirii', 'Str. Republicii', 'Calea Victoriei'];
  const street = getRandomElement(streets);
  const number = getRandomNumber(1, 200);
  return `${street} nr. ${number}, ${city}`;
}

// Weighted distribution for donation amounts (more realistic)
function getRandomDonationAmount() {
  const random = Math.random();
  if (random < 0.4) return getRandomFloat(10, 50); // 40% small donations
  if (random < 0.7) return getRandomFloat(50, 150); // 30% medium donations
  if (random < 0.9) return getRandomFloat(150, 500); // 20% large donations
  return getRandomFloat(500, 2000); // 10% very large donations
}

// Main seeding function
async function main() {
  console.log('🌱 Starting comprehensive database seeding...');
  
  // Clear existing data
  await clearDatabase();
  
  // Generate users
  const users = await generateUsers();
  console.log(`✅ Created ${users.length} users`);
  
  // Generate charities
  const charities = await generateCharities(users.charityManagers);
  console.log(`✅ Created ${charities.length} charities`);
  
  // Generate projects
  const projects = await generateProjects(charities);
  console.log(`✅ Created ${projects.length} projects`);
  
  // Generate donations with realistic patterns
  const donations = await generateDonations(users.donors, charities, projects);
  console.log(`✅ Created ${donations.length} donations`);
  
  // Generate blockchain verifications
  await generateBlockchainVerifications(donations);
  console.log(`✅ Created blockchain verifications`);
  
  // Update project current amounts based on donations
  await updateProjectAmounts();
  console.log(`✅ Updated project funding amounts`);
  
  // Print summary statistics
  await printSummaryStatistics();
  
  console.log('🎉 Comprehensive seeding completed successfully!');
}

async function clearDatabase() {
  console.log('🗑️ Clearing existing data...');
  
  // Clear in correct order to respect foreign key constraints
  await prisma.blockchainVerification.deleteMany({});
  await prisma.donation.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.charity.deleteMany({});
  
  // Get existing admin emails to preserve them
  const existingAdmins = await prisma.user.findMany({
    where: {
      role: 'admin'
    },
    select: { email: true }
  });
  
  // Add existing admin emails to our tracking set
  existingAdmins.forEach(admin => usedEmails.add(admin.email));
  
  // Delete non-admin users
  await prisma.user.deleteMany({
    where: {
      role: { not: 'admin' }
    }
  });
  
  console.log('✅ Database cleared (preserved admin users)');
}

async function generateUsers() {
  console.log('👥 Generating users...');
  
  const users = { donors: [], charityManagers: [], admins: [] };
  
  // Get existing admin users first
  const existingAdmins = await prisma.user.findMany({
    where: { role: 'admin' }
  });
  
  users.admins = existingAdmins;
  console.log(`Found ${existingAdmins.length} existing admin users`);
  
  // Create additional admin users if needed
  const adminUsers = [
    { email: 'admin@charitrace.org', name: 'System Administrator', role: 'admin' },
    { email: 'super@charitrace.org', name: 'Super Admin', role: 'admin' },
    { email: 'moderator@charitrace.org', name: 'Platform Moderator', role: 'admin' }
  ];
  
  for (const adminData of adminUsers) {
    if (!usedEmails.has(adminData.email)) {
      try {
        const admin = await createUser(adminData.email, 'admin123', adminData.name, adminData.role);
        users.admins.push(admin);
        console.log(`Created admin user: ${adminData.email}`);
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`Admin user ${adminData.email} already exists, skipping...`);
          // Add to tracking set to prevent future conflicts
          usedEmails.add(adminData.email);
        } else {
          throw error;
        }
      }
    }
  }
  
  // Generate charity managers
  console.log('Creating charity managers...');
  for (let i = 0; i < CONFIG.USERS.CHARITY_MANAGERS; i++) {
    const firstName = getRandomElement(FIRST_NAMES);
    const lastName = getRandomElement(LAST_NAMES);
    const email = generateEmail(firstName, lastName, 'charity-manager.org');
    const name = `${firstName} ${lastName}`;
    
    try {
      const user = await createUser(email, 'charity123', name, 'charity');
      users.charityManagers.push(user);
      
      if ((i + 1) % 10 === 0) {
        console.log(`Created ${i + 1}/${CONFIG.USERS.CHARITY_MANAGERS} charity managers`);
      }
    } catch (error) {
      if (error.code === 'P2002') {
        console.log(`Email ${email} already exists, retrying...`);
        i--; // Retry this iteration
      } else {
        throw error;
      }
    }
  }
  
  // Generate donors with varied profiles
  console.log('Creating donors...');
  for (let i = 0; i < CONFIG.USERS.DONORS; i++) {
    const firstName = getRandomElement(FIRST_NAMES);
    const lastName = getRandomElement(LAST_NAMES);
    const email = generateEmail(firstName, lastName);
    const name = `${firstName} ${lastName}`;
    
    try {
      const user = await createUser(email, 'donor123', name, 'donor');
      users.donors.push(user);
      
      if ((i + 1) % 25 === 0) {
        console.log(`Created ${i + 1}/${CONFIG.USERS.DONORS} donors`);
      }
    } catch (error) {
      if (error.code === 'P2002') {
        console.log(`Email ${email} already exists, retrying...`);
        i--; // Retry this iteration
      } else {
        throw error;
      }
    }
  }
  
  return users;
}

async function createUser(email, password, name, role) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const city = getRandomElement(ROMANIAN_CITIES);
  
  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role,
      phone: Math.random() < 0.7 ? generatePhone() : null,
      address: Math.random() < 0.6 ? generateAddress(city) : null,
      createdAt: getRandomDate(CONFIG.DONATIONS.DATE_RANGE_MONTHS)
    }
  });
}

async function generateCharities(charityManagers) {
  console.log('🏢 Generating charities...');
  
  const charities = [];
  
  for (let i = 0; i < Math.min(CONFIG.CHARITIES, charityManagers.length); i++) {
    const manager = charityManagers[i];
    const category = getRandomElement(CHARITY_CATEGORIES);
    const templates = CHARITY_TEMPLATES[category] || [
      { name: `${category} Foundation ${i + 1}`, mission: `Supporting ${category.toLowerCase()} initiatives` }
    ];
    
    const template = getRandomElement(templates);
    const city = getRandomElement(ROMANIAN_CITIES);
    
    // Generate unique charity email
    let charityEmail;
    let attempts = 0;
    do {
      const baseName = template.name.split(' ')[0].toLowerCase();
      const suffix = attempts === 0 ? '' : attempts;
      charityEmail = `${baseName}${suffix}@ngo.ro`;
      attempts++;
    } while (usedEmails.has(charityEmail) && attempts < 100);
    
    if (usedEmails.has(charityEmail)) {
      charityEmail = `charity.${Date.now()}.${i}@ngo.ro`;
    }
    usedEmails.add(charityEmail);
    
    try {
      const charity = await prisma.charity.create({
        data: {
          name: `${template.name} ${getRandomNumber(1, 99)}`,
          description: `${template.mission}. We are dedicated to making a positive impact in our community through various programs and initiatives.`,
          mission: template.mission,
          email: charityEmail,
          phone: generatePhone(),
          registrationId: `REG-${category.substring(0, 3)}-${getRandomNumber(100000, 999999)}`,
          category,
          address: generateAddress(city),
          foundedYear: getRandomNumber(1990, 2023),
          managerId: manager.id,
          createdAt: getRandomDate(CONFIG.DONATIONS.DATE_RANGE_MONTHS - 2),
          updatedAt: new Date()
        }
      });
      
      charities.push(charity);
      
      if ((i + 1) % 10 === 0) {
        console.log(`Created ${i + 1}/${Math.min(CONFIG.CHARITIES, charityManagers.length)} charities`);
      }
    } catch (error) {
      if (error.code === 'P2002') {
        console.log(`Conflict creating charity for manager ${manager.id}, retrying...`);
        i--; // Retry this iteration
      } else {
        throw error;
      }
    }
  }
  
  return charities;
}

async function generateProjects(charities) {
  console.log('📋 Generating projects...');
  
  const projects = [];
  
  for (const charity of charities) {
    const projectCount = getRandomNumber(CONFIG.PROJECTS_PER_CHARITY.MIN, CONFIG.PROJECTS_PER_CHARITY.MAX);
    const projectTemplates = PROJECT_TEMPLATES[charity.category] || ['General Support Project'];
    
    for (let i = 0; i < projectCount; i++) {
      const title = `${getRandomElement(projectTemplates)} ${getRandomNumber(2020, 2025)}`;
      const goal = getRandomFloat(1000, 50000);
      const startDate = getRandomDate(CONFIG.DONATIONS.DATE_RANGE_MONTHS);
      
      // Determine project status based on age and random factors
      const projectAge = (new Date() - startDate) / (1000 * 60 * 60 * 24); // days
      let status = 'ACTIVE';
      let endDate = null;
      
      if (projectAge > 180) { // Projects older than 6 months
        const statusRandom = Math.random();
        if (statusRandom < 0.6) {
          status = 'COMPLETED';
          endDate = new Date(startDate.getTime() + getRandomNumber(30, 180) * 24 * 60 * 60 * 1000);
        } else if (statusRandom < 0.8) {
          status = 'ACTIVE';
        } else if (statusRandom < 0.95) {
          status = 'PAUSED';
        } else {
          status = 'CANCELLED';
          endDate = new Date(startDate.getTime() + getRandomNumber(15, 90) * 24 * 60 * 60 * 1000);
        }
      } else if (projectAge > 90) { // Projects 3-6 months old
        if (Math.random() < 0.3) {
          status = 'COMPLETED';
          endDate = new Date(startDate.getTime() + getRandomNumber(60, 120) * 24 * 60 * 60 * 1000);
        }
      }
      
      const project = await prisma.project.create({
        data: {
          title,
          description: `This project aims to ${title.toLowerCase()} and make a significant impact in our community. We are committed to transparency and will provide regular updates on our progress.`,
          goal,
          currentAmount: 0, // Will be updated based on donations
          startDate,
          endDate,
          status,
          charityId: charity.id,
          createdAt: startDate,
          updatedAt: new Date()
        }
      });
      
      projects.push(project);
    }
  }
  
  return projects;
}

async function generateDonations(donors, charities, projects) {
  console.log('💰 Generating donations with realistic patterns...');
  
  const donations = [];
  
  // Create donation patterns (some users donate more frequently)
  const donorProfiles = donors.map(donor => ({
    ...donor,
    donationFrequency: Math.random() < 0.2 ? 'high' : Math.random() < 0.4 ? 'medium' : 'low',
    preferredCategories: getRandomElement(CHARITY_CATEGORIES),
    isGenerousDonor: Math.random() < 0.15 // 15% are particularly generous
  }));
  
  for (let i = 0; i < CONFIG.DONATIONS.TOTAL; i++) {
    // Select donor based on frequency profile
    let donor;
    const random = Math.random();
    if (random < 0.5) {
      // 50% chance to pick a high-frequency donor
      const highFreqDonors = donorProfiles.filter(d => d.donationFrequency === 'high');
      donor = highFreqDonors.length > 0 ? getRandomElement(highFreqDonors) : getRandomElement(donorProfiles);
    } else {
      donor = getRandomElement(donorProfiles);
    }
    
    // Select charity (with some preference for donor's preferred category)
    let charity;
    if (Math.random() < 0.3 && donor.preferredCategories) {
      const preferredCharities = charities.filter(c => c.category === donor.preferredCategories);
      charity = preferredCharities.length > 0 ? getRandomElement(preferredCharities) : getRandomElement(charities);
    } else {
      charity = getRandomElement(charities);
    }
    
    // Select project (70% chance to donate to specific project)
    const charityProjects = projects.filter(p => p.charityId === charity.id);
    const project = Math.random() < 0.7 && charityProjects.length > 0 ? 
      getRandomElement(charityProjects) : null;
    
    // Generate donation amount
    let amount = getRandomDonationAmount();
    if (donor.isGenerousDonor) {
      amount *= getRandomFloat(1.5, 3.0); // Generous donors give 1.5-3x more
    }
    
    // Determine payment status (most succeed, some fail)
    const statusRandom = Math.random();
    let paymentStatus;
    if (statusRandom < 0.85) paymentStatus = 'SUCCEEDED';
    else if (statusRandom < 0.92) paymentStatus = 'PENDING';
    else if (statusRandom < 0.97) paymentStatus = 'PROCESSING';
    else if (statusRandom < 0.99) paymentStatus = 'FAILED';
    else paymentStatus = 'REFUNDED';
    
    // Currency distribution
    const currency = Math.random() < 0.7 ? 'RON' : Math.random() < 0.85 ? 'EUR' : 'USD';
    
    // Generate seasonal patterns (more donations in November-December)
    const donationDate = getRandomDate(CONFIG.DONATIONS.DATE_RANGE_MONTHS);
    const month = donationDate.getMonth();
    if (month === 10 || month === 11) { // November-December
      amount *= getRandomFloat(1.1, 1.4); // 10-40% increase during holiday season
    }
    
    const donation = await prisma.donation.create({
      data: {
        amount: parseFloat(amount.toFixed(2)),
        transactionId: `txn_${crypto.randomBytes(8).toString('hex')}`,
        paymentIntentId: `pi_${crypto.randomBytes(12).toString('hex')}`,
        paymentStatus,
        message: Math.random() < 0.3 ? generateDonationMessage() : null,
        anonymous: Math.random() < 0.25, // 25% anonymous donations
        currency,
        receiptUrl: paymentStatus === 'SUCCEEDED' ? `https://receipt.stripe.com/${crypto.randomBytes(16).toString('hex')}` : null,
        donorId: donor.id,
        charityId: charity.id,
        projectId: project?.id || null,
        createdAt: donationDate
      }
    });
    
    donations.push(donation);
  }
  
  return donations;
}

function generateDonationMessage() {
  const messages = [
    'Happy to support this great cause!',
    'Keep up the excellent work!',
    'Hope this helps make a difference.',
    'Thank you for all you do.',
    'Proud to contribute to your mission.',
    'Wishing you success in your endeavors.',
    'Every little bit helps!',
    'Continue the amazing work!',
    'Grateful for organizations like yours.',
    'May this donation help those in need.'
  ];
  return getRandomElement(messages);
}

async function generateBlockchainVerifications(donations) {
  console.log('🔗 Generating blockchain verifications...');
  
  const successfulDonations = donations.filter(d => d.paymentStatus === 'SUCCEEDED');
  
  for (const donation of successfulDonations) {
    // 85% of successful donations get verified on blockchain
    if (Math.random() < 0.85) {
      await prisma.blockchainVerification.create({
        data: {
          transactionHash: `0x${crypto.randomBytes(32).toString('hex')}`,
          blockNumber: getRandomNumber(1000000, 2000000),
          timestamp: new Date(donation.createdAt.getTime() + getRandomNumber(300, 3600) * 1000), // 5min-1hour after donation
          verified: Math.random() < 0.95, // 95% verification success rate
          donationId: donation.id,
          createdAt: new Date(donation.createdAt.getTime() + getRandomNumber(60, 1800) * 1000) // 1min-30min after donation
        }
      });
    }
  }
}

async function updateProjectAmounts() {
  console.log('📊 Updating project funding amounts...');
  
  const projects = await prisma.project.findMany({
    include: {
      donations: {
        where: { paymentStatus: 'SUCCEEDED' }
      }
    }
  });
  
  for (const project of projects) {
    const totalAmount = project.donations.reduce((sum, donation) => sum + donation.amount, 0);
    
    await prisma.project.update({
      where: { id: project.id },
      data: { currentAmount: totalAmount }
    });
  }
}

async function printSummaryStatistics() {
  console.log('\n📈 SEEDING SUMMARY STATISTICS');
  console.log('=' .repeat(50));
  
  const [userStats, charityStats, projectStats, donationStats, verificationStats] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
    prisma.charity.groupBy({ by: ['category'], _count: { category: true } }),
    prisma.project.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.donation.groupBy({ by: ['paymentStatus'], _count: { paymentStatus: true } }),
    prisma.blockchainVerification.groupBy({ by: ['verified'], _count: { verified: true } })
  ]);
  
  console.log('\n👥 Users by Role:');
  userStats.forEach(stat => console.log(`  ${stat.role}: ${stat._count.role}`));
  
  console.log('\n🏢 Charities by Category:');
  charityStats.forEach(stat => console.log(`  ${stat.category}: ${stat._count.category}`));
  
  console.log('\n📋 Projects by Status:');
  projectStats.forEach(stat => console.log(`  ${stat.status}: ${stat._count.status}`));
  
  console.log('\n💰 Donations by Payment Status:');
  donationStats.forEach(stat => console.log(`  ${stat.paymentStatus}: ${stat._count.paymentStatus}`));
  
  console.log('\n🔗 Blockchain Verifications:');
  verificationStats.forEach(stat => console.log(`  ${stat.verified ? 'Verified' : 'Unverified'}: ${stat._count.verified}`));
  
  // Financial summary
  const totalDonations = await prisma.donation.aggregate({
    where: { paymentStatus: 'SUCCEEDED' },
    _sum: { amount: true },
    _count: true
  });
  
  console.log('\n💵 Financial Summary:');
  console.log(`  Total Successful Donations: ${totalDonations._count}`);
  console.log(`  Total Amount Raised: ${totalDonations._sum.amount?.toFixed(2) || 0} RON`);
  console.log(`  Average Donation: ${totalDonations._count > 0 ? (totalDonations._sum.amount / totalDonations._count).toFixed(2) : 0} RON`);
  
  console.log('\n🎯 Ready for comprehensive statistics and graphs!');
}

// Execute the seed function
main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });