import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import SendIcon from "@mui/icons-material/Send";

const Dashboard = () => {
  const [friends, setFriends] = useState([]);
  const [searchedUsers, setSearchedUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [notFriend, setNotFriend] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const messagesEndRef = useRef(null);
  const currentUser = localStorage.getItem("username") || "";
  const [lastMessages, setLastMessages] = useState({});

  useEffect(() => {
    fetchFriends();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const parseXMLResponse = (xmlText) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "application/xml");

      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Invalid XML received.");
      }

      return xmlDoc;
    } catch (error) {
      console.error("❌ XML Parsing Error:", error);
      return null;
    }
  };

  const fetchFriends = async () => {
    try {
      const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
            <user>
                <username>${currentUser}</username>
            </user>`;

      const response = await fetch("http://localhost:5000/friends", {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: xmlBody,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch friends");
      }

      const text = await response.text();
      console.log("✅ Raw Friends List Response:", text);

      // ✅ Parse XML Response
      const xmlDoc = parseXMLResponse(text);
      if (!xmlDoc) {
        console.error("❌ XML Parsing Error");
        return;
      }

      // ✅ Corrected username extraction
      const usernames = Array.from(xmlDoc.getElementsByTagName("username")).map(
        (node) => node.textContent.trim()
      );

      console.log("🎉 Extracted Usernames:", usernames);

      // ✅ Fetch last messages for each friend
      const friendsWithLastMessages = await Promise.all(
        usernames.map(async (username) => {
          const lastMessage = await fetchLastMessage(username);
          return {
            username,
            lastMessage: lastMessage.content || "No messages",
            lastMessageSender: lastMessage.sender || "",
          };
        })
      );

      setFriends(friendsWithLastMessages);
    } catch (error) {
      console.error("❌ Fetch Friends Error:", error);
    }
  };

  const handleSearch = async () => {
    if (!search.trim()) return;

    try {
      const res = await fetch(
        `http://localhost:5000/search-users?query=${search}`,
        {
          headers: { Accept: "application/xml" },
        }
      );

      const text = await res.text();
      console.log("📝 RAW XML RESPONSE:", text); // ✅ Debug log

      const xmlDoc = parseXMLResponse(text);
      if (!xmlDoc) return;

      console.log("📂 Parsed XML Document:", xmlDoc); // ✅ Debug log

      // ✅ Extract response element
      const responseNode = xmlDoc.getElementsByTagName("response")[0];
      if (!responseNode) {
        console.error("❌ No <response> found in XML");
        return;
      }

      // ✅ Extract multiple <username> elements
      const usernames = Array.from(
        responseNode.getElementsByTagName("username")
      )
        .map((user) => user.textContent.trim())
        .filter(Boolean);

      console.log("✅ Extracted Usernames:", usernames); // ✅ Debug log

      // ✅ Convert to object format expected by state
      const users = usernames.map((username) => ({ username }));

      setSearchedUsers(users);
      setShowDropdown(true);
    } catch (error) {
      console.error("❌ Error searching users:", error);
    }
  };

  const handleUserClick = async (user) => {
    setSelectedUser(user);
    setMessages([]);
    setNotFriend(false);
    setShowDropdown(false); // ✅ Close dropdown immediately

    try {
      const res = await fetch(
        `http://localhost:5000/check-friendship?user1=${currentUser}&user2=${user.username}`,
        { headers: { Accept: "application/xml" } }
      );

      const text = await res.text();
      const xmlDoc = parseXMLResponse(text);
      if (!xmlDoc) return;

      const areFriends =
        xmlDoc.getElementsByTagName("areFriends")[0]?.textContent === "true";
      setNotFriend(!areFriends);

      if (areFriends) fetchMessages(user.username);
    } catch (error) {
      console.error("❌ Error checking friendship:", error);
    }
  };

  // ✅ Follow User (Add Friend)
  const handleFollow = async () => {
    try {
      const xmlData = `
          <follow>
              <follower>${currentUser}</follower>
              <following>${selectedUser.username}</following>
          </follow>
      `;

      const res = await fetch("http://localhost:5000/follow-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          Accept: "application/xml",
        },
        body: xmlData,
      });

      const text = await res.text();
      console.log("📝 RAW XML RESPONSE:", text); // ✅ Debugging

      const xmlDoc = parseXMLResponse(text);
      if (!xmlDoc) return;

      console.log("📂 Parsed XML Document:", xmlDoc); // ✅ Debugging

      const messageNode = xmlDoc.getElementsByTagName("message")[0];
      const message = messageNode
        ? messageNode.textContent
        : "Unknown error occurred";

      alert(message);

      if (message === "Successfully followed user") {
        setNotFriend(false);
        fetchMessages(selectedUser.username);
        await fetchFriends();
      }
    } catch (error) {
      console.error("❌ Error following user:", error);
      alert("Error following user. Please try again.");
    }
  };

  const fetchMessages = async (friendUsername) => {
    // ⬅ Fix: Expect a string
    console.log("📢 Fetching messages for:", friendUsername);

    try {
      const res = await fetch(
        `http://localhost:5000/messages/${friendUsername}?username=${currentUser}`, // ⬅ Use friendUsername
        {
          headers: { Accept: "application/xml" },
        }
      );

      const text = await res.text();
      console.log("✅ Raw XML Response:", text);

      const xmlDoc = parseXMLResponse(text);
      if (!xmlDoc) {
        console.error("❌ XML Parsing Failed");
        return;
      }

      const messagesNodes = xmlDoc.getElementsByTagName("message");
      console.log("📂 Parsed XML Nodes:", messagesNodes);

      const parsedMessages = Array.from(messagesNodes).map((msg) => ({
        sender: msg.getElementsByTagName("sender")[0]?.textContent,
        content: msg.getElementsByTagName("content")[0]?.textContent,
      }));

      console.log("🎉 Parsed Messages:", parsedMessages);

      setMessages(parsedMessages.length > 0 ? parsedMessages : []);
    } catch (error) {
      console.error("❌ Chat Fetch Error:", error);
    }
  };

  const sendMessage = async () => {
    if (!currentUser || !selectedUser || !newMessage.trim()) return;

    console.log("📩 Sending Message:", {
      sender: currentUser,
      receiver: selectedUser.username,
      content: newMessage,
    });

    try {
      const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
          <message>
              <sender>${currentUser}</sender>
              <receiver>${selectedUser.username}</receiver>
              <content>${newMessage}</content>
          </message>`;

      const res = await fetch("http://localhost:5000/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          Accept: "application/xml",
        },
        body: xmlData,
      });

      const text = await res.text();
      console.log("✅ Server Response:", text);

      const xmlDoc = parseXMLResponse(text);
      if (!xmlDoc) return;

      setMessages([...messages, { sender: currentUser, content: newMessage }]);
      setNewMessage("");
    } catch (error) {
      console.error("❌ Network error:", error);
    }
  };

  const fetchLastMessage = async (friend) => {
    try {
      const response = await fetch(
        `http://localhost:5000/last-message/${friend}?username=${currentUser}`,
        {
          method: "GET",
          headers: { Accept: "application/xml" },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch last message");

      const text = await response.text();
      console.log(`📩 Last Message for ${friend}:`, text);

      // ✅ Parse XML Response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "application/xml");

      // ✅ Extract <content> and <sender>
      const contentNode = xmlDoc.getElementsByTagName("content")[0];
      const senderNode = xmlDoc.getElementsByTagName("sender")[0];

      return {
        content: contentNode ? contentNode.textContent : "No messages yet",
        sender: senderNode ? senderNode.textContent : "",
      };
    } catch (error) {
      console.error("❌ Error fetching last message:", error);
      return { content: "No messages", sender: "" };
    }
  };

  useEffect(() => {
    const loadLastMessages = async () => {
      const newLastMessages = {};
      for (const user of searchedUsers) {
        newLastMessages[user.username] = await fetchLastMessage(user.username);
      }
      setLastMessages(newLastMessages);
    };

    if (searchedUsers.length > 0) {
      loadLastMessages();
    }
  }, [searchedUsers]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const handleLogout = () => {
    localStorage.removeItem("username"); // Clear stored user
    localStorage.removeItem("token"); // (If using JWT, clear the token)

    window.location.href = "/"; // Redirect to login page
  };

  return (
    <div className="flex w-screen h-screen bg-white gap-6">
      <div className="w-1/4 bg-slate-200 text-[#333] shadow-lg p-4">
        <div className="flex justify-between items-center mt-4">
          <h2 className="text-2xl font-bold mb-16 bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
            NetworXchat
          </h2>
          <motion.button
            onClick={handleLogout}
            className="bg-slate-800 text-white p-3 rounded-xl shadow-lg mt-[-60px]"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9, rotate: -5 }}
            transition={{ type: "spring", stiffness: 200 }}
            style={{ backgroundColor: "#1E293B" }} // Ensures dynamic color works
          >
            Logout
          </motion.button>
        </div>
        <p className="mb-2 text-xl font-medium">
          Welcome,{" "}
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
            {currentUser}
          </span>
        </p>
        <div className="relative mb-6">
          <motion.input
            type="text"
            placeholder="Search users..."
            className="mt-2 w-full p-3 rounded-xl shadow-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            whileFocus={{
              scale: 1.05,
              borderColor: "#1E293B",
              boxShadow: "0px 0px 10px rgba(30,41,59,0.5)",
            }} // Expands & highlights on focus
            whileHover={{ scale: 1.02 }} // Slight hover effect
            transition={{ type: "spring", stiffness: 200 }}
          />
          {showDropdown && (
            <div
              className="absolute w-full bg-white border shadow-md rounded-md mt-1 z-50"
              style={{ top: "100%", left: 0 }}
            >
              {searchedUsers.length > 0 ? (
                searchedUsers.map((user) => (
                  <div
                    key={user.username}
                    className="p-2 hover:bg-gray-200 cursor-pointer"
                    onClick={() => handleUserClick(user)}
                  >
                    {user.username}
                  </div>
                ))
              ) : (
                <div className="p-2 text-gray-500">No users found</div>
              )}
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold text-gray-700 mb-3">Friends</h2>

        <div className="mt-4">
          {friends.length === 0 ? (
            <p className="text-gray-500">No friends yet 🥺</p>
          ) : (
            friends.map((friend) => (
              <motion.div
              whileFocus={{
                scale: 1.05,
              }} // Expands & highlights on focus
              whileHover={{ scale: 1.02 }} // Slight hover effect
              transition={{ type: "spring", stiffness: 200 }}
                key={friend.username}
                className="p-3 mb-3 bg-gray-700 hover:bg-gray-900 text-white cursor-pointer rounded-2xl shadow-[0_0_20px_2px_rgba(107,114,128,0.5)] backdrop-blur-md"
                onClick={() => handleUserClick(friend)}
              >
                <p className="font-bold">{friend.username}</p>
                <p className="text-sm mt-2 text-gray-300 truncate overflow-hidden whitespace-nowrap max-w-[300px]">
                  {friend.lastMessageSender
                    ? `${friend.lastMessageSender}: `
                    : ""}
                  {friend.lastMessage}
                </p>
              </motion.div>
            ))
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-gray-800 p-3 rounded-3xl mt-5 mr-5 mb-5 shadow-[0_0_20px_2px_rgba(107,114,128,0.5)] backdrop-blur-md">
        {selectedUser ? (
          <>
            <div className="relative p-4 -m-3 mb-5 text-white animate-gradient text-2xl font-semibold bg-gradient-to-r from-blue-600 via-green-500 to-blue-600 shadow-lg rounded-t-3xl">
              {selectedUser.username}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-white"></div>
            </div>
            {notFriend ? (
              <div className="w-96 mx-auto p-7 bg-slate-200 text-center rounded-2xl mt-10 shadow-[0_0_20px_5px_rgba(107,114,128,0.5)] backdrop-blur-md">
                <p className="text-md">
                  Not friends with {selectedUser.username}. Follow to chat?
                </p>
                <motion.button
                  whileHover={{ scale: 1.1 }} // Slightly enlarges on hover
                  whileTap={{ scale: 0.9 }} // Shrinks when clicked
                  className="mt-5 p-3 bg-gradient-to-r from-blue-600 to-green-500 text-white font-semibold rounded-xl"
                  onClick={handleFollow}
                >
                  Follow & Chat
                </motion.button>
              </div>
            ) : (
              <>
                <div className="flex-1 p-4 overflow-auto flex flex-col">
                  {messages.length > 0 &&
                  messages.some((msg) => msg.content) ? (
                    messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`p-2 shadow-[0_0_14px_2px_rgba(107,114,128,0.6)] backdrop-blur-md px-4 rounded-lg mb-2 max-w-[75%] break-words ${
                          msg.sender === currentUser
                            ? "self-end bg-gradient-to-r from-blue-600 to-green-500 text-white text-lg font-semibold" // Align right
                            : "self-start bg-slate-200 text-gray-800 text-lg font-semibold" // Align left
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center mt-48 text-xl font-medium">
                      Text Your Friend 😁
                    </p>
                  )}
                  <div ref={messagesEndRef}></div>
                </div>

                <div className="p-4 flex">
                  <input
                    type="text"
                    placeholder="Message..."
                    className="flex-1 p-3 rounded-xl shadow-lg"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }} // Slightly enlarges on hover
                    whileTap={{ scale: 0.9 }} // Shrinks when clicked
                    className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-xl shadow-lg flex items-center justify-center"
                    onClick={sendMessage}
                  >
                    <SendIcon style={{ fontSize: 25 }} />
                  </motion.button>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-400 text-lg">
            Select a user to chat
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
