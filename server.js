
// Port variable to use for express instance(app)
const PORT = process.env.PORT || 4700;

// Initialize express instance(app)
import express from 'express';
// Cors (cross-origin resource sharing) connects the frontend to the backend
import cors from 'cors';
// Dotenv is used to load environment variables from a .env file into process.env
import dotenv from 'dotenv';
dotenv.config();

// Prisma is an orm (object relational mapping) used to connect to the database
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();


// Import routes
import authRoutes from './routes/authRoutes.js';
import charityRoutes from './routes/charityRoutes.js';
import donationRoutes from './routes/donationRoutes.js';
import donationController from './controllers/donationController.js';
import projectRoutes from './routes/projectRoutes.js';

// Initialize express app
const app = express();

app.use('/donations/webhook', express.raw({ type: 'application/json' }), donationController.handleWebhook); // For Stripe webhook
app.use(cors({
  origin: 'http://localhost:3000', // Or whatever your frontend URL is
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);
app.use('/charities', charityRoutes);
app.use('/donations', donationRoutes);
app.use('/projects', projectRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('API is running');
});

// Test database connection on server start
async function testDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1+1 AS result`;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1); // Exit if we can't connect to the database
  }
}

// Start the server only after testing the database connection
testDatabaseConnection()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('Failed to start server:', error);
  });