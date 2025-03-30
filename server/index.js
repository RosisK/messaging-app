const express = require('express');
const { Pool } = require('pg'); // Changed from sqlite3 to pg
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static(path.join(__dirname, '../client/build')));
app.use(bodyParser.json());

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/messaging',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Create tables (async/await version)
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
        content TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
};

initializeDatabase();

// User registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, password]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// User login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT id, username FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Updated /users endpoint
app.get('/users', async (req, res) => {
  try {
    const currentUserId = req.query.currentUserId; // Pass this from frontend
    const result = await pool.query(
      'SELECT id, username FROM users WHERE id != $1',
      [currentUserId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get messages between two users
app.get('/messages/:senderId/:receiverId', async (req, res) => {
  const { senderId, receiverId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT m.*, u.username as sender_name 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
      ORDER BY timestamp
    `, [senderId, receiverId]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Socket.io for real-time messaging
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });
  
  socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
    try {
      // Insert message
      const insertResult = await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *',
        [senderId, receiverId, content]
      );
      
      // Get sender username
      const senderResult = await pool.query(
        'SELECT username FROM users WHERE id = $1',
        [senderId]
      );
      
      if (senderResult.rows.length > 0) {
        const message = {
          ...insertResult.rows[0],
          sender_name: senderResult.rows[0].username
        };
        
        io.to(receiverId).to(senderId).emit('receiveMessage', message);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});