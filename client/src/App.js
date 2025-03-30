import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, Link } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';

const socket = io('https://messaging-app-backend-zsdk.onrender.com');

const AuthContext = React.createContext();

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <Router>
        <Routes>
          <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}

function Login() {
  const { setUser } = React.useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://messaging-app-backend-zsdk.onrender.com/login', { username, password });
      localStorage.setItem('user', JSON.stringify(response.data));
      setUser(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2>Login</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Username:</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required 
          />
        </div>
        <div>
          <label>Password:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <button type="submit">Login</button>
      </form>
      <p>Don't have an account? <Link to="/register">Register</Link></p>
    </div>
  );
}

function Register() {
  const { setUser } = React.useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://messaging-app-backend-zsdk.onrender.com/register', { username, password });
      localStorage.setItem('user', JSON.stringify(response.data));
      setUser(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2>Register</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Username:</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required 
          />
        </div>
        <div>
          <label>Password:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>
        <button type="submit">Register</button>
      </form>
      <p>Already have an account? <Link to="/login">Login</Link></p>
    </div>
  );
}

function Home() {
  const { user, setUser } = React.useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const fetchUsers = async () => {
    try {
      const response = await axios.get(
        `https://messaging-app-backend-zsdk.onrender.com/users?currentUserId=${user.id}`
      );
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  const fetchMessages = async () => {
    if (!selectedUser) return;
    try {
      const response = await axios.get(
        `https://messaging-app-backend-zsdk.onrender.com/messages/${user.id}/${selectedUser.id}`
      );
      setMessages(response.data);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  useEffect(() => {
    if (!user) return;

    socket.emit('join', user.id);
    fetchUsers();

    socket.on('receiveMessage', (message) => {
      if (
        (message.sender_id === selectedUser?.id && message.receiver_id === user.id) ||
        (message.receiver_id === selectedUser?.id && message.sender_id === user.id)
      ) {
        setMessages(prev => [...prev, message]);
      }
      // Refresh user list when receiving new messages
      fetchUsers();
    });

    return () => {
      socket.off('receiveMessage');
    };
  }, [user, selectedUser]);

  useEffect(() => {
    fetchMessages();
  }, [selectedUser]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    socket.emit('sendMessage', {
      senderId: user.id,
      receiverId: selectedUser.id,
      content: newMessage
    });

    setNewMessage('');
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '200px', borderRight: '1px solid #ccc', padding: '10px' }}>
        <h3>Welcome, {user.username}</h3>
        <button onClick={handleLogout}>Logout</button>
        <h4>Users</h4>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {users.map(u => (
            <li 
              key={u.id} 
              onClick={() => setSelectedUser(u)}
              style={{ 
                padding: '8px', 
                cursor: 'pointer', 
                backgroundColor: selectedUser?.id === u.id ? '#eee' : 'transparent'
              }}
            >
              {u.username}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedUser ? (
          <>
            <div style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
              <h3>Chat with {selectedUser.username}</h3>
            </div>
            <div style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
              {messages.map((message, index) => (
                <div 
                  key={index} 
                  style={{ 
                    textAlign: message.sender_id === user.id ? 'right' : 'left',
                    margin: '10px 0'
                  }}
                >
                  <div style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    backgroundColor: message.sender_id === user.id ? '#007bff' : '#e9ecef',
                    color: message.sender_id === user.id ? 'white' : 'black'
                  }}>
                    {message.content}
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#666' }}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} style={{ padding: '10px', borderTop: '1px solid #ccc' }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={{ width: '80%', padding: '8px' }}
              />
              <button type="submit" style={{ width: '18%', padding: '8px' }}>Send</button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>Select a user to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;