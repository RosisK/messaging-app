import React, { useState, useEffect } from "react";
import {
    BrowserRouter as Router,
    Route,
    Routes,
    Navigate,
    Link,
} from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";

const socketUrl = 'https://messaging-app-backend-zsdk.onrender.com';
console.log('Connecting to Socket.IO at:', socketUrl);
const socket = io(socketUrl, {
  transports: ['websocket'], // Force WebSocket transport
  reconnectionAttempts: 5, // Number of reconnect attempts
  reconnectionDelay: 1000, // Time between reconnections
  timeout: 20000 // Connection timeout
});

const AuthContext = React.createContext();

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem("user");
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
                    <Route
                        path="/"
                        element={user ? <Home /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/login"
                        element={!user ? <Login /> : <Navigate to="/" />}
                    />
                    <Route
                        path="/register"
                        element={!user ? <Register /> : <Navigate to="/" />}
                    />
                </Routes>
            </Router>
        </AuthContext.Provider>
    );
}

function Login() {
    const { setUser } = React.useContext(AuthContext);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(
                "https://messaging-app-backend-zsdk.onrender.com/login",
                { username, password }
            );
            localStorage.setItem("user", JSON.stringify(response.data));
            setUser(response.data);
        } catch (err) {
            setError(err.response?.data?.error || "Login failed");
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "0 auto", padding: "20px" }}>
            <h2>Login</h2>
            {error && <div style={{ color: "red" }}>{error}</div>}
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
            <p>
                Don't have an account? <Link to="/register">Register</Link>
            </p>
        </div>
    );
}

function Register() {
    const { setUser } = React.useContext(AuthContext);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(
                "https://messaging-app-backend-zsdk.onrender.com/register",
                { username, password }
            );
            localStorage.setItem("user", JSON.stringify(response.data));
            setUser(response.data);
        } catch (err) {
            setError(err.response?.data?.error || "Registration failed");
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "0 auto", padding: "20px" }}>
            <h2>Register</h2>
            {error && <div style={{ color: "red" }}>{error}</div>}
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
            <p>
                Already have an account? <Link to="/login">Login</Link>
            </p>
        </div>
    );
}

function Home() {
    const { user, setUser } = React.useContext(AuthContext);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [transport, setTransport] = useState("N/A");

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      setTransport(socket.io.engine.transport.name);
      console.log('Socket connected via:', socket.io.engine.transport.name);
    };

    const onDisconnect = () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    };

    const onConnectError = (err) => {
      console.error('Connection error:', err);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('transport-upgrade', (transport) => {
      console.log('Transport upgraded to:', transport.name);
      setTransport(transport.name);
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('transport-upgrade');
    };
  }, []);

  // More detailed status indicator
  const connectionStatus = () => (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      padding: '8px 12px',
      backgroundColor: isConnected ? '#4CAF50' : '#F44336',
      color: 'white',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      fontSize: '14px'
    }}>
      <div style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: 'white',
        marginRight: '8px',
        opacity: isConnected ? 1 : 0.5
      }} />
      {isConnected ? `Connected (${transport})` : 'Disconnected'}
      {!isConnected && (
        <button 
          onClick={() => socket.connect()}
          style={{
            marginLeft: '10px',
            padding: '2px 8px',
            background: 'white',
            color: '#F44336',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Reconnect
        </button>
      )}
    </div>
  );

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

        socket.emit("join", user.id);
        fetchData();

        // Message received handler
        const handleNewMessage = (message) => {
            if (
                (message.sender_id === user.id &&
                    message.receiver_id === selectedUser?.id) ||
                (message.receiver_id === user.id &&
                    message.sender_id === selectedUser?.id)
            ) {
                setMessages((prev) => [...prev, message]);
            }
        };

        socket.on("newMessage", handleNewMessage);

        return () => {
            socket.off("newMessage", handleNewMessage);
        };
    }, [user, selectedUser]);

    useEffect(() => {
        // Connection status handlers
        const onConnect = () => {
            setIsConnected(true);
            console.log("Socket connected");
        };

        const onDisconnect = () => {
            setIsConnected(false);
            console.log("Socket disconnected");
        };

        // Setup event listeners
        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        // Cleanup function
        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
        };
    }, []); // Empty dependency array means this runs once on mount

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
            isPending: true,
        };

        // Optimistic update
        setMessages((prev) => [...prev, tempMessage]);
        setNewMessage("");

        // Debug log before sending
        console.log("Attempting to send:", {
            senderId: user.id,
            receiverId: selectedUser.id,
            content: newMessage,
        });

        // Add timeout fallback
        const timeout = setTimeout(() => {
            console.warn("Socket.IO response timeout");
            setMessages((prev) =>
                prev.map((m) =>
                    m.tempId === tempId
                        ? { ...m, isPending: false, failed: true }
                        : m
                )
            );
            setIsSending(false);
        }, 5000); // 5 second timeout

        try {
            socket.emit(
                "sendMessage",
                {
                    senderId: user.id,
                    receiverId: selectedUser.id,
                    content: newMessage,
                },
                (response) => {
                    clearTimeout(timeout);
                    console.log("Server response:", response); // Debug log

                    if (response.status === "success") {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.tempId === tempId ? response.message : m
                            )
                        );
                    } else {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.tempId === tempId
                                    ? { ...m, isPending: false, failed: true }
                                    : m
                            )
                        );
                    }
                    setIsSending(false);
                }
            );
        } catch (err) {
            clearTimeout(timeout);
            console.error("Socket emit error:", err);
            setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
            setIsSending(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("user");
        setUser(null);
    };

    return (
        <div style={{ display: "flex", height: "100vh" }}>
            <div
                style={{
                    width: "200px",
                    borderRight: "1px solid #ccc",
                    padding: "10px",
                }}
            >
                <h3>Welcome, {user.username}</h3>
                <button onClick={handleLogout}>Logout</button>
                <h4>Users</h4>
                <ul style={{ listStyle: "none", padding: 0 }}>
                    {users.map((u) => (
                        <li
                            key={u.id}
                            onClick={() => setSelectedUser(u)}
                            style={{
                                padding: "8px",
                                cursor: "pointer",
                                backgroundColor:
                                    selectedUser?.id === u.id
                                        ? "#eee"
                                        : "transparent",
                            }}
                        >
                            {u.username}
                        </li>
                    ))}
                </ul>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {selectedUser ? (
                    <>
                        <div
                            style={{
                                padding: "10px",
                                borderBottom: "1px solid #ccc",
                            }}
                        >
                            <h3>Chat with {selectedUser.username}</h3>
                        </div>
                        <div
                            style={{
                                flex: 1,
                                padding: "10px",
                                overflowY: "auto",
                            }}
                        >
                            {messages.map((message) => (
                                <div
                                    key={message.id || message.tempId}
                                    style={{
                                        textAlign:
                                            message.sender_id === user.id
                                                ? "right"
                                                : "left",
                                        margin: "10px 0",
                                        opacity: message.isPending ? 0.7 : 1,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "inline-block",
                                            padding: "8px 12px",
                                            borderRadius: "12px",
                                            backgroundColor: message.failed
                                                ? "#ffebee"
                                                : message.sender_id === user.id
                                                ? "#007bff"
                                                : "#e9ecef",
                                            color:
                                                message.sender_id === user.id
                                                    ? "white"
                                                    : "black",
                                        }}
                                    >
                                        {message.content}
                                        {message.isPending && " (Sending...)"}
                                        {message.failed && " (Failed)"}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.8em",
                                            color: "#666",
                                        }}
                                    >
                                        {new Date(
                                            message.timestamp
                                        ).toLocaleTimeString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <form
                            onSubmit={handleSendMessage}
                            style={{
                                padding: "10px",
                                borderTop: "1px solid #ccc",
                            }}
                        >
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                style={{ width: "80%", padding: "8px" }}
                                disabled={isSending}
                            />
                            <button
                                type="submit"
                                style={{ width: "18%", padding: "8px" }}
                                disabled={isSending}
                            >
                                {isSending ? "Sending..." : "Send"}
                            </button>
                        </form>
                    </>
                ) : (
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <p>Select a user to start chatting</p>
                    </div>
                )}
            </div>
            {/* Add this status indicator */}
            <div
                style={{
                    position: "fixed",
                    bottom: 10,
                    right: 10,
                    padding: "5px 10px",
                    backgroundColor: isConnected ? "#4CAF50" : "#F44336",
                    color: "white",
                    borderRadius: "4px",
                    zIndex: 1000,
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <div
                    style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: "white",
                        marginRight: "8px",
                        animation: isConnected ? "pulse 2s infinite" : "none",
                    }}
                />
                {isConnected ? "Connected" : "Disconnected"}
            </div>
        </div>
    );
}

export default App;
