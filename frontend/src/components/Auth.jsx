import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Auth.css";

const API_URL = "http://localhost:5000";

const Auth = () => {
  const [isLoginActive, setIsLoginActive] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loggedInUser, setLoggedInUser] = useState(null);
  const navigate = useNavigate();

  // Toggle between Login and Signup
  const toggleForm = () => {
    setIsLoginActive((prev) => !prev);
    setMessage(""); // Clear messages when toggling
  };

  // Function to parse XML responses
  const parseXMLResponse = (xmlText) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "application/xml");

      // Check for errors in XML parsing
      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        return { message: "Invalid XML response.", username: null };
      }

      const message = xmlDoc.getElementsByTagName("message")[0]?.textContent || "Unexpected response.";
      const username = xmlDoc.getElementsByTagName("username")[0]?.textContent || null;

      return { message, username };
    } catch (error) {
      return { message: "Error parsing XML.", username: null };
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    console.log("🚀 Signup button clicked!");

    console.log("Username:", username);
    console.log("Email:", email);
    console.log("Password:", password);

    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
    <user>
        <username>${username}</username>
        <email>${email}</email>
        <password>${password}</password>
    </user>`;

    console.log("📤 Sending XML:", xmlData);

    try {
        const response = await fetch("http://localhost:5000/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/xml",
                "Accept": "application/xml",
            },
            body: xmlData, // ✅ Sending dynamic values now
        });

        const text = await response.text(); // Read response as text
        console.log("✅ Server Response:", text);

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        setIsLoginActive(true);
    } catch (error) {
        console.error("❌ Signup Error:", error);
    }
};


  const handleLogin = async () => {
    if (!email || !password) {
      setMessage("Email and Password are required.");
      return;
    }
  
    try {
      const xmlData = `
        <user>
          <email>${email}</email>
          <password>${password}</password>
        </user>
      `;
  
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: xmlData,
      });
  
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
  
      const responseText = await response.text();
      const { message, username } = parseXMLResponse(responseText);
  
      setMessage(message);
  
      if (username) {
        localStorage.setItem("username", username);
        setLoggedInUser(username);
        navigate("/dashboard"); // Redirect on success
      }
    } catch (error) {
      console.error("❌ Login Error:", error.message);
      setMessage("Failed to log in. Please check your credentials.");
    }
  };
  

  // Check if user is already logged in
  useEffect(() => {
    const storedUser = localStorage.getItem("username");
    if (storedUser) {
      setLoggedInUser(storedUser);
      navigate("/dashboard");
    }
  }, [navigate]);

  // Logout Function
  const handleLogout = () => {
    localStorage.removeItem("username");
    setLoggedInUser(null);
    navigate("/");
  };

  return (
    <div className="form-structor">
      {loggedInUser ? (
        <div className="logout">
          <h2>Welcome, {loggedInUser}! 🎉</h2>
          <button className="submit-btn" onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <>
          {/* Signup Section */}
          <div className={`signup ${isLoginActive ? "slide-up" : ""}`}>
            <h2 className="form-title" onClick={toggleForm}>
              <span>or</span> Sign Up
            </h2>
            <div className="form-holder">
              <input type="text" className="input" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
              <input type="email" className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" className="input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="submit-btn" onClick={handleSignup}>Sign Up</button>
          </div>

          {/* Login Section */}
          <div className={`login ${isLoginActive ? "" : "slide-up"}`}>
            <div className="center">
              <h2 className="form-title" onClick={toggleForm}>
                <span>or</span> Log in
              </h2>
              <div className="form-holder">
                <input type="email" className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input type="password" className="input" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button className="submit-btn" onClick={handleLogin}>Log in</button>
            </div>
          </div>

          {message && <p className="message">{message}</p>}
        </>
      )}
    </div>
  );
};

export default Auth;
