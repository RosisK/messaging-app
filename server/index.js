const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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

// Database setup
const db = new sqlite3.Database('./messaging.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the messaging database.');
});

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      receiver_id INTEGER,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )
  `);
});

// User registration
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  
  db.run('INSERT INTO users (username, password) VALUES (?, ?)', 
    [username, password], 
    function(err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({ id: this.lastID, username });
    }
  );
});

// User login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ? AND password = ?', 
    [username, password], 
    (err, user) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      res.json({ id: user.id, username: user.username });
    }
  );
});

// Get all users
app.get('/users', (req, res) => {
  db.all('SELECT id, username FROM users', [], (err, users) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json(users);
  });
});

// Get messages between two users
app.get('/messages/:senderId/:receiverId', (req, res) => {
  const { senderId, receiverId } = req.params;
  
  db.all(`
    SELECT m.*, u.username as sender_name 
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    ORDER BY timestamp
  `, [senderId, receiverId, receiverId, senderId], (err, messages) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json(messages);
  });
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
  
  socket.on('sendMessage', ({ senderId, receiverId, content }) => {
    db.run(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
      [senderId, receiverId, content],
      function(err) {
        if (err) {
          console.error(err);
          return;
        }
        
        db.get(`
          SELECT m.*, u.username as sender_name 
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.id = ?
        `, [this.lastID], (err, message) => {
          if (err) {
            console.error(err);
            return;
          }
          
          io.to(receiverId).to(senderId).emit('receiveMessage', message);
        });
      }
    );
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});