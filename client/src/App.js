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
  const [isSending, setIsSending] = useState(false);

  // Fetch users and messages
  const fetchData = async () => {
    if (!user) return;
    
    try {
      // Get all users except current user
      const usersResponse = await axios.get(
        `https://messaging-app-backend-zsdk.onrender.com/users?currentUserId=${user.id}`
      );
      setUsers(usersResponse.data);

      // Get messages if a user is selected
      if (selectedUser) {
        const messagesResponse = await axios.get(
          `https://messaging-app-backend-zsdk.onrender.com/messages/${user.id}/${selectedUser.id}`
        );
        setMessages(messagesResponse.data);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  };

  // Initialize socket and data
  useEffect(() => {
    if (!user) return;

    socket.emit('join', user.id);
    fetchData();

    // Message received handler
    const handleNewMessage = (message) => {
      if (
        (message.sender_id === user.id && message.receiver_id === selectedUser?.id) ||
        (message.receiver_id === user.id && message.sender_id === selectedUser?.id)
      ) {
        setMessages(prev => [...prev, message]);
      }
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [user, selectedUser]);

  // Handle sending messages
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || isSending) return;

    setIsSending(true);
    const tempId = Date.now();
    const tempMessage = {
      tempId,
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content: newMessage,
      timestamp: new Date().toISOString(),
      sender_name: user.username,
      isPending: true
    };

    try {
      // Optimistic update
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');

      // Send via Socket.IO with acknowledgement
      socket.emit('sendMessage', 
        {
          senderId: user.id,
          receiverId: selectedUser.id,
          content: newMessage
        },
        (response) => {
          if (response.status === 'success') {
            // Replace temp message with confirmed message
            setMessages(prev => prev.map(m => 
              m.tempId === tempId ? response.message : m
            ));
          } else {
            // Mark as failed
            setMessages(prev => prev.map(m => 
              m.tempId === tempId ? {...m, isPending: false, failed: true} : m
            ));
          }
        }
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages(prev => prev.filter(m => m.tempId !== tempId));
    } finally {
      setIsSending(false);
    }
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
              {messages.map((message) => (
                <div 
                  key={message.id || message.tempId}
                  style={{ 
                    textAlign: message.sender_id === user.id ? 'right' : 'left',
                    margin: '10px 0',
                    opacity: message.isPending ? 0.7 : 1
                  }}
                >
                  <div style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    backgroundColor: message.failed ? '#ffebee' : 
                                    message.sender_id === user.id ? '#007bff' : '#e9ecef',
                    color: message.sender_id === user.id ? 'white' : 'black'
                  }}>
                    {message.content}
                    {message.isPending && ' (Sending...)'}
                    {message.failed && ' (Failed)'}
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
                disabled={isSending}
              />
              <button 
                type="submit" 
                style={{ width: '18%', padding: '8px' }}
                disabled={isSending}
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
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