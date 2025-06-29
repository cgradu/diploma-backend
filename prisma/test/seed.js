import { prisma } from '../prisma/client.js';  // Changed this line
import bcrypt from 'bcrypt';

async function main() {
  console.log('Starting seeding...');
  
  // Clear existing data
  await clearDatabase();
  
  // Create test users
  const testAdmin = await createUser('admin@charitrace.org', 'admin123', 'Admin User', 'admin');
  const testDonor = await createUser('donor@example.com', 'donor123', 'Test Donor', 'donor');
  
  // Create charity manager users
  const charityUsers = [];
  charityUsers.push(await createUser('charity1@example.org', 'charity123', 'Charity Manager 1', 'charity'));
  charityUsers.push(await createUser('charity2@example.org', 'charity123', 'Charity Manager 2', 'charity'));
  
  // Create 8 more charity manager users (to make a total of 10)
  for (let i = 3; i <= 10; i++) {
    charityUsers.push(await createUser(`charity${i}@example.org`, 'charity123', `Charity Manager ${i}`, 'charity'));
  }
  
  // Create test charities
  const charities = [];
  
  // First two original charities
  charities.push(await createCharity(
    'Education For All',
    'We work to provide education to underprivileged children around the world.',
    'Our mission is to ensure every child has access to quality education regardless of their socioeconomic background.',
    'education@example.org',
    '+1234567890',
    'EFA12345',
    'EDUCATION',
    '123 Education St, Knowledge City',
    2010,
    charityUsers[0].id
  ));
  
  charities.push(await createCharity(
    'Clean Water Initiative',
    'We help communities access clean and safe drinking water.',
    'Our mission is to reduce water-borne diseases by providing clean water solutions to communities in need.',
    'water@example.org',
    '+1987654321',
    'CWI54321',
    'HUMANITARIAN',
    '456 Water Ave, Hydro Town',
    2015,
    charityUsers[1].id
  ));
  
  // Add 8 more charities (to make a total of 10)
  charities.push(await createCharity(
    'Wildlife Conservation Trust',
    'Protecting endangered species and their habitats through conservation efforts.',
    'Our mission is to preserve biodiversity and ensure the survival of threatened wildlife species for future generations.',
    'wildlife@example.org',
    '+1122334455',
    'WCT78901',
    'ENVIRONMENT',
    '789 Nature Blvd, Wildlife Park',
    2008,
    charityUsers[2].id
  ));
  
  charities.push(await createCharity(
    'Global Health Alliance',
    'Providing healthcare services to underserved communities worldwide.',
    'Our mission is to improve health outcomes and reduce healthcare disparities in disadvantaged regions.',
    'health@example.org',
    '+2233445566',
    'GHA24680',
    'HEALTHCARE',
    '101 Medical Dr, Health City',
    2012,
    charityUsers[3].id
  ));
  
  charities.push(await createCharity(
    'Youth Empowerment Network',
    'Empowering young people through leadership and skill development programs.',
    'Our mission is to create opportunities for youth to develop their potential and become agents of positive change.',
    'youth@example.org',
    '+3344556677',
    'YEN13579',
    'EDUCATION',
    '202 Youth St, Opportunity Village',
    2017,
    charityUsers[4].id
  ));
  
  charities.push(await createCharity(
    'Food Security Foundation',
    'Fighting hunger and food insecurity in vulnerable communities.',
    'Our mission is to ensure access to nutritious food for everyone and eliminate food waste through sustainable solutions.',
    'food@example.org',
    '+4455667788',
    'FSF97531',
    'HUMANITARIAN',
    '303 Harvest Rd, Abundance Town',
    2014,
    charityUsers[5].id
  ));
  
  charities.push(await createCharity(
    'Climate Action Coalition',
    'Advocating for policies and practices to combat climate change.',
    'Our mission is to accelerate the transition to a low-carbon economy and promote environmental sustainability.',
    'climate@example.org',
    '+5566778899',
    'CAC86420',
    'ENVIRONMENT',
    '404 Green St, Sustainable City',
    2016,
    charityUsers[6].id
  ));
  
  charities.push(await createCharity(
    'Digital Inclusion Project',
    'Bridging the digital divide through technology access and education.',
    'Our mission is to ensure equitable access to digital resources and skills in underserved communities.',
    'digital@example.org',
    '+6677889900',
    'DIP75319',
    'EDUCATION',
    '505 Tech Ave, Digital Heights',
    2019,
    charityUsers[7].id
  ));
  
  charities.push(await createCharity(
    'Mental Health Matters',
    'Promoting mental wellbeing and reducing stigma around mental health issues.',
    'Our mission is to provide support services and advocate for better mental health care for all.',
    'mentalhealth@example.org',
    '+7788990011',
    'MHM24681',
    'HEALTHCARE',
    '606 Wellness Way, Mindful Village',
    2015,
    charityUsers[8].id
  ));
  
  charities.push(await createCharity(
    'Disaster Relief Network',
    'Providing immediate assistance and long-term support to communities affected by disasters.',
    'Our mission is to help communities prepare for, respond to, and recover from natural and human-made disasters.',
    'disaster@example.org',
    '+8899001122',
    'DRN13572',
    'HUMANITARIAN',
    '707 Response Rd, Relief City',
    2011,
    charityUsers[9].id
  ));
  
  // Create projects
  // Original projects for the first two charities
  const projects = [];
  
  // First charity - Education For All
  projects.push(await createProject(
    'School Supplies Program',
    'Providing essential school supplies to 1,000 children for the upcoming school year. This includes notebooks, pens, pencils, backpacks, and other necessary items to help students succeed in their education.',
    25000,
    5000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 6)),
    'ACTIVE',
    charities[0].id
  ));
  
  projects.push(await createProject(
    'Teacher Training Initiative',
    'Training 100 teachers in modern teaching methodologies to improve education quality. The program includes workshops, mentoring sessions, and classroom observation to enhance teaching skills.',
    15000,
    3000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 3)),
    'ACTIVE',
    charities[0].id
  ));
  
  // Second charity - Clean Water Initiative
  projects.push(await createProject(
    'Well Construction Project',
    'Building 10 wells in rural communities lacking access to clean water. Each well will serve approximately 200-300 people and significantly improve health outcomes in the region.',
    50000,
    20000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 8)),
    'ACTIVE',
    charities[1].id
  ));
  
  projects.push(await createProject(
    'Water Purification Systems',
    'Installing water purification systems in 20 schools to provide safe drinking water to students. This will help reduce waterborne diseases and improve attendance rates.',
    30000,
    10000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 4)),
    'ACTIVE',
    charities[1].id
  ));
  
  // Add 8 more projects for each of the first two charities (to make a total of 10 per charity)
  
  // More projects for Education For All
  projects.push(await createProject(
    'School Building Renovation',
    'Renovating 5 deteriorating school buildings to create safe and conducive learning environments for students.',
    60000,
    15000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 9)),
    'ACTIVE',
    charities[0].id
  ));
  
  projects.push(await createProject(
    'Digital Classroom Initiative',
    'Equipping 10 schools with computers and internet access to improve digital literacy among students.',
    40000,
    8000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 7)),
    'ACTIVE',
    charities[0].id
  ));
  
  projects.push(await createProject(
    'Scholarship Program',
    'Providing scholarships to 50 talented students from low-income families to pursue higher education.',
    35000,
    10000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 12)),
    'ACTIVE',
    charities[0].id
  ));
  
  projects.push(await createProject(
    'Mobile Library Project',
    'Creating 3 mobile libraries to reach children in remote areas with limited access to books and reading materials.',
    20000,
    5000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 5)),
    'ACTIVE',
    charities[0].id
  ));
  
  projects.push(await createProject(
    'After-School Program',
    'Establishing after-school programs in 15 communities to provide academic support and enrichment activities.',
    28000,
    7000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 8)),
    'ACTIVE',
    charities[0].id
  ));
  
  projects.push(await createProject(
    'Educational Field Trips',
    'Organizing educational field trips for 2,000 students to museums, science centers, and historical sites.',
    18000,
    4000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 6)),
    'ACTIVE',
    charities[0].id
  ));
  
  projects.push(await createProject(
    'Parent Engagement Program',
    'Developing programs to increase parent involvement in their children\'s education through workshops and resources.',
    12000,
    3000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 4)),
    'ACTIVE',
    charities[0].id
  ));
  
  projects.push(await createProject(
    'STEM Education Initiative',
    'Introducing STEM (Science, Technology, Engineering, Mathematics) programs in 25 schools to prepare students for future careers.',
    45000,
    12000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 10)),
    'ACTIVE',
    charities[0].id
  ));
  
  // More projects for Clean Water Initiative
  projects.push(await createProject(
    'Rainwater Harvesting Systems',
    'Installing rainwater harvesting systems in 30 villages to collect and store rainwater for domestic use.',
    40000,
    15000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 7)),
    'ACTIVE',
    charities[1].id
  ));
  
  projects.push(await createProject(
    'Community Water Management Training',
    'Training 100 community members in sustainable water management practices and system maintenance.',
    20000,
    8000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 6)),
    'ACTIVE',
    charities[1].id
  ));
  
  projects.push(await createProject(
    'Water Quality Testing Program',
    'Implementing a water quality testing program in 50 communities to monitor and ensure safe drinking water.',
    25000,
    10000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 8)),
    'ACTIVE',
    charities[1].id
  ));
  
  projects.push(await createProject(
    'Sanitation Facilities Construction',
    'Building proper sanitation facilities in 20 schools and community centers to improve hygiene.',
    35000,
    12000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 9)),
    'ACTIVE',
    charities[1].id
  ));
  
  projects.push(await createProject(
    'Emergency Water Relief',
    'Providing emergency water supplies to communities affected by drought or natural disasters.',
    30000,
    18000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 3)),
    'ACTIVE',
    charities[1].id
  ));
  
  projects.push(await createProject(
    'Water Conservation Education',
    'Developing educational materials and workshops on water conservation practices for 5,000 households.',
    15000,
    6000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 5)),
    'ACTIVE',
    charities[1].id
  ));
  
  projects.push(await createProject(
    'Spring Protection Project',
    'Protecting 15 natural springs from contamination to preserve these valuable water sources.',
    28000,
    9000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 7)),
    'ACTIVE',
    charities[1].id
  ));
  
  projects.push(await createProject(
    'Community-Led Water Solutions',
    'Supporting 10 community-led initiatives to develop local solutions for water access and management.',
    22000,
    7000,
    new Date(),
    new Date(new Date().setMonth(new Date().getMonth() + 6)),
    'ACTIVE',
    charities[1].id
  ));
  
  // Create 10 projects for each of the remaining 8 charities
  const charityStartIdx = 2; // Starting from the third charity (index 2)
  
  const projectTemplates = [
    // Wildlife Conservation Trust project templates
    [
      { title: 'Elephant Conservation Initiative', description: 'Protecting elephant habitats and implementing anti-poaching measures in key regions.', goal: 60000, currentAmount: 25000 },
      { title: 'Marine Life Protection', description: 'Establishing marine protected areas and conducting research on endangered marine species.', goal: 45000, currentAmount: 18000 },
      { title: 'Wildlife Rescue Center', description: 'Building and operating a rescue center for injured and orphaned wild animals.', goal: 70000, currentAmount: 30000 },
      { title: 'Anti-Poaching Patrol Units', description: 'Training and equipping anti-poaching patrol units to protect endangered species.', goal: 50000, currentAmount: 22000 },
      { title: 'Habitat Restoration', description: 'Restoring degraded habitats to support wildlife populations and biodiversity.', goal: 35000, currentAmount: 15000 },
      { title: 'Community Conservation Education', description: 'Educating local communities about the importance of wildlife conservation and sustainable practices.', goal: 25000, currentAmount: 12000 },
      { title: 'Wildlife Monitoring Program', description: 'Implementing technology-based monitoring systems to track and protect endangered species.', goal: 40000, currentAmount: 18000 },
      { title: 'Conservation Research Grants', description: 'Funding research projects focused on understanding and preserving threatened species.', goal: 30000, currentAmount: 10000 },
      { title: 'Human-Wildlife Conflict Mitigation', description: 'Developing solutions to reduce conflicts between humans and wildlife in shared habitats.', goal: 28000, currentAmount: 14000 },
      { title: 'Wildlife Corridor Protection', description: 'Securing and protecting wildlife corridors to allow animal movement between habitats.', goal: 55000, currentAmount: 20000 }
    ],
    
    // Global Health Alliance project templates
    [
      { title: 'Mobile Health Clinics', description: 'Operating mobile clinics to provide healthcare services to remote communities.', goal: 65000, currentAmount: 28000 },
      { title: 'Medical Supply Distribution', description: 'Distributing essential medical supplies to underserved healthcare facilities.', goal: 40000, currentAmount: 18000 },
      { title: 'Healthcare Worker Training', description: 'Training local healthcare workers in essential medical skills and procedures.', goal: 35000, currentAmount: 15000 },
      { title: 'Maternal Health Program', description: 'Providing prenatal care and safe delivery services to reduce maternal mortality.', goal: 50000, currentAmount: 22000 },
      { title: 'Vaccination Campaign', description: 'Conducting vaccination campaigns to protect communities from preventable diseases.', goal: 45000, currentAmount: 25000 },
      { title: 'Disease Prevention Education', description: 'Educating communities about disease prevention and healthy living practices.', goal: 30000, currentAmount: 12000 },
      { title: 'Medical Equipment Provision', description: 'Supplying medical equipment to hospitals and clinics in underserved areas.', goal: 60000, currentAmount: 20000 },
      { title: 'Nutrition Support Program', description: 'Providing nutritional support to vulnerable populations, especially children and pregnant women.', goal: 38000, currentAmount: 16000 },
      { title: 'Mental Health Services', description: 'Establishing mental health services in communities with limited access to such care.', goal: 42000, currentAmount: 18000 },
      { title: 'Emergency Medical Response', description: 'Training local teams in emergency medical response for disasters and crises.', goal: 55000, currentAmount: 25000 }
    ],
    
    // More project templates for other charities...
    // (keeping the rest of the project templates the same)
  ];
  
  // Create projects for the remaining 8 charities
  for (let i = 0; i < 8; i++) {
    const charityIndex = charityStartIdx + i;
    const projectSet = projectTemplates[i % projectTemplates.length]; // Use modulo to handle if we have fewer templates than charities
    
    for (let j = 0; j < 10; j++) {
      const project = projectSet[j];
      const randomMonths = Math.floor(Math.random() * 12) + 3; // Random duration between 3-15 months
      
      await createProject(
        project.title,
        project.description,
        project.goal,
        project.currentAmount,
        new Date(),
        new Date(new Date().setMonth(new Date().getMonth() + randomMonths)),
        'ACTIVE',
        charities[charityIndex].id
      );
    }
  }
  
  // Create some test donations with blockchain verification
  const donation1 = await createDonation(
    100,
    'don_test12345678',
    'pi_test123456789',
    'SUCCEEDED',
    'Happy to support education!',
    false,
    testDonor.id,
    charities[0].id,
    projects[0].id,
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
    charities[1].id,
    projects[2].id,
    'RON',
    'https://example.com/receipt/67890'
  );
  
  await createBlockchainVerification(
    '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    12345679,
    true,
    donation2.id
  );
  
  // Create additional test donations for other charities
  for (let i = 2; i < charities.length; i++) {
    // Create 2 donations for each charity
    const donation1 = await createDonation(
      Math.floor(Math.random() * 150) + 50, // Random amount between 50-200
      `don_test_${i}_1_${Date.now()}`,
      `pi_test_${i}_1_${Date.now()}`,
      'SUCCEEDED',
      `Supporting the important work of ${charities[i].name}!`,
      false,
      testDonor.id,
      charities[i].id,
      // Get project ID for this charity (each charity has 10 projects)
      null, // Will be set below
      'RON',
      `https://example.com/receipt/${i}1${Date.now()}`
    );
    
    // Update the projectId field for the first donation (to the first project of this charity)
    await prisma.donation.update({
      where: { id: donation1.id },
      data: { 
        projectId: await getFirstProjectIdForCharity(charities[i].id) 
      }
    });
    
    await createBlockchainVerification(
      `0x${i}234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`,
      12345680 + i,
      true,
      donation1.id
    );
    
    const donation2 = await createDonation(
      Math.floor(Math.random() * 250) + 150, // Random amount between 150-400
      `don_test_${i}_2_${Date.now()}`,
      `pi_test_${i}_2_${Date.now()}`,
      'SUCCEEDED',
      null,
      true,
      testDonor.id,
      charities[i].id,
      // Get project ID for this charity (each charity has 10 projects)
      null, // Will be set below
      'RON',
      `https://example.com/receipt/${i}2${Date.now()}`
    );
    
    // Update the projectId field for the second donation (to the second project of this charity)
    await prisma.donation.update({
      where: { id: donation2.id },
      data: { 
        projectId: await getSecondProjectIdForCharity(charities[i].id) 
      }
    });
    
    await createBlockchainVerification(
      `0x${i}bcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890`,
      12345690 + i,
      true,
      donation2.id
    );
  }
  
  // Ensure every charity manager has a charity
  console.log('Checking for charity managers without charities...');
  
  // Find all users with 'charity' role
  const charityManagers = await prisma.user.findMany({
    where: { role: 'charity' },
    include: { managedCharity: true }
  });
  
  // For each charity manager without a charity, create one
  for (const manager of charityManagers) {
    if (!manager.managedCharity) {
      console.log(`Creating missing charity for manager: ${manager.name} (${manager.email})`);
      
      // Generate a unique registration ID
      const registrationId = `AUTO-${Date.now()}-${manager.id}`;
      
      // Create a charity with basic information
      await createCharity(
        `${manager.name}'s Organization`,
        'This charity was automatically created during seeding.',
        'Our mission is to make a positive impact on the world.',
        manager.email,
        manager.phone || '+1234567890',
        registrationId,
        'OTHER',
        manager.address || 'No address provided',
        new Date().getFullYear(),
        manager.id
      );
    }
  }
  
  console.log('Seeding completed successfully!');
}

// Helper function to get the ID of the first project for a charity
async function getFirstProjectIdForCharity(charityId) {
  const project = await prisma.project.findFirst({
    where: { charityId },
    orderBy: { createdAt: 'asc' }
  });
  return project ? project.id : null;
}

// Helper function to get the ID of the second project for a charity
async function getSecondProjectIdForCharity(charityId) {
  const projects = await prisma.project.findMany({
    where: { charityId },
    orderBy: { createdAt: 'asc' },
    take: 2
  });
  return projects.length > 1 ? projects[1].id : null;
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

async function createCharity(name, description, mission, email, phone, registrationId, category, address, foundedYear, managerId) {
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
      updatedAt: new Date(),
      // Connect directly to the manager using the new schema's relationship
      manager: {
        connect: { id: managerId }
      }
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