// server.js
const PORT = process.env.PORT || 4700;

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// In your main app.js or server.js
const prisma = require('./prisma/client');

// Import routes
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

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