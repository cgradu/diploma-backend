const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise'); // MySQL client with promise support

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'raki2024',
  database: process.env.DB_NAME || 'licenta',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('Charity Transparency Blockchain API is running');
});

// Database status route
app.get('/db-status', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT NOW() as server_time');
    res.json({
      status: 'connected',
      server_time: result[0].server_time,
      message: 'Database connection is healthy'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Get all tables route
app.get('/tables', async (req, res) => {
  try {
    const [result] = await pool.query(
      'SHOW TABLES'
    );
    // Format the result to match the expected format
    const tables = result.map(row => {
      const key = Object.keys(row)[0]; // Get the first property name
      return { table_name: row[key] };
    });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get table structure
app.get('/tables/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const [result] = await pool.query(
      `DESCRIBE ${tableName}`
    );
    
    // Transform to a more readable format
    const columns = result.map(col => ({
      column_name: col.Field,
      data_type: col.Type,
      is_nullable: col.Null,
      column_default: col.Default,
      extra: col.Extra
    }));
    
    res.json(columns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add column to table
app.post('/tables/:tableName/columns', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { columnName, dataType, constraints } = req.body;
    
    if (!columnName || !dataType) {
      return res.status(400).json({ error: "Column name and data type are required" });
    }
    
    let constraintClause = constraints || '';
    
    const query = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${dataType} ${constraintClause}`;
    await pool.query(query);
    
    res.json({ 
      success: true, 
      message: `Column ${columnName} added to ${tableName}`,
      query: query
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete column from table
app.delete('/tables/:tableName/columns/:columnName', async (req, res) => {
  try {
    const { tableName, columnName } = req.params;
    
    const query = `ALTER TABLE ${tableName} DROP COLUMN ${columnName}`;
    await pool.query(query);
    
    res.json({ 
      success: true, 
      message: `Column ${columnName} dropped from ${tableName}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new table
app.post('/tables', async (req, res) => {
  try {
    const { tableName, columns } = req.body;
    
    if (!tableName || !columns || !columns.length) {
      return res.status(400).json({ error: "Table name and columns are required" });
    }
    
    const columnDefinitions = columns.map(col => 
      `${col.name} ${col.type}${col.constraints ? ' ' + col.constraints : ''}`
    ).join(', ');
    
    const query = `CREATE TABLE ${tableName} (${columnDefinitions})`;
    await pool.query(query);
    
    res.json({ 
      success: true, 
      message: `Table ${tableName} created successfully`,
      query: query
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete table
app.delete('/tables/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    
    const query = `DROP TABLE ${tableName}`;
    await pool.query(query);
    
    res.json({ 
      success: true, 
      message: `Table ${tableName} dropped successfully`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Modify table (add foreign key)
app.post('/tables/:tableName/foreign-keys', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { columnName, referenceTable, referenceColumn, constraintName, onDelete, onUpdate } = req.body;
    
    if (!columnName || !referenceTable || !referenceColumn) {
      return res.status(400).json({ error: "Column name, reference table, and reference column are required" });
    }
    
    const name = constraintName || `fk_${tableName}_${columnName}`;
    const deleteAction = onDelete || 'CASCADE';
    const updateAction = onUpdate || 'NO ACTION';
    
    const query = `ALTER TABLE ${tableName} 
                   ADD CONSTRAINT ${name} 
                   FOREIGN KEY (${columnName}) 
                   REFERENCES ${referenceTable}(${referenceColumn})
                   ON DELETE ${deleteAction} 
                   ON UPDATE ${updateAction}`;
    
    await pool.query(query);
    
    res.json({ 
      success: true, 
      message: `Foreign key constraint added to ${tableName}.${columnName}`,
      query: query
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add index to table
app.post('/tables/:tableName/indexes', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { indexName, columns, unique } = req.body;
    
    if (!columns || !columns.length) {
      return res.status(400).json({ error: "At least one column is required for the index" });
    }
    
    const name = indexName || `idx_${tableName}_${columns.join('_')}`;
    const uniqueClause = unique ? 'UNIQUE' : '';
    const columnList = columns.join(', ');
    
    const query = `CREATE ${uniqueClause} INDEX ${name} ON ${tableName} (${columnList})`;
    await pool.query(query);
    
    res.json({ 
      success: true, 
      message: `Index ${name} created on ${tableName}`,
      query: query
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 4700;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Error handling for unhandled Promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

module.exports = app;