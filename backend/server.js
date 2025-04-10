const express = require("express");
const mongoose = require("mongoose");
const neo4j = require("neo4j-driver");
const xml2js = require("xml2js");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const libxmljs = require("libxmljs2");

const app = express();
const PORT = 5000;

app.use(express.text({ type: "application/xml" }));

app.use(cors({
    origin: "*",
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type"
}));


mongoose.connect("mongodb://localhost:27017/chatapp")
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.log("❌ MongoDB Error:", err));


const neo4jDriver = neo4j.driver("neo4j://localhost", neo4j.auth.basic("neo4j", "12345678"));
console.log("✅ Connected to Neo4j");


const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
});
const User = mongoose.model("User", UserSchema);
const MessageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});

// Create Model
const Message = mongoose.model("Message", MessageSchema);

const schemaPath = "schema.xsd";
const schemaContent = fs.readFileSync(schemaPath, "utf8").trim();

const validateXML = (xmlData) => {
    try {
        xmlData = xmlData.replace(/<\?xml.*?\?>/g, "").trim(); // Remove XML declaration
        console.log("📄 [Debug] Final XML Sent to Validator:", xmlData);

        const xmlDoc = libxmljs.parseXml(xmlData);
        const xsdDoc = libxmljs.parseXml(schemaContent);

        if (xmlDoc.validate(xsdDoc)) {
            return "✅ XML is valid!";
        } else {
            console.error("❌ XSD Validation Errors:", xmlDoc.validationErrors);
            return "Invalid XML format.";
        }
    } catch (error) {
        console.error("❌ XML Parsing Error:", error);
        return "Invalid XML format.";
    }
};

const jsonToXml = (json) => {
    const builder = new xml2js.Builder();
    return builder.buildObject(json);
};

const xmlValidationMiddleware = async (req, res, next) => {
    console.log("📩 Raw XML Received:", req.body); // Log original XML

    if (!req.body || typeof req.body !== "string") {
        return res.status(400).send(jsonToXml({ response: { message: "Invalid XML input type." } }));
    }

    // ✅ Remove XML Declaration and invisible characters
    let cleanedXML = req.body.replace(/<\?xml.*?\?>/g, "").trim(); 

    console.log("📄 [Debug] XML after cleaning:", cleanedXML);

    try {
        await validateXML(cleanedXML);
        req.body = cleanedXML; // Store cleaned XML for use in request
        next();
    } catch (error) {
        return res.status(400).send(jsonToXml({ response: { message: error } }));
    }
};

app.post("/register", xmlValidationMiddleware, async (req, res) => {
    console.log("📩 Incoming request at /register");

    try {
        xml2js.parseString(req.body, async (err, result) => {
            if (err) {
                console.error("❌ XML Parsing Error:", err);
                return res.status(400).send(jsonToXml({ response: { message: "Invalid XML format" } }));
            }

            console.log("📄 Parsed XML JSON:", result);
            const userData = result.user;
            if (!userData || !userData.username || !userData.email || !userData.password) {
                return res.status(400).send(jsonToXml({ response: { message: "Missing user details in XML." } }));
            }

            const username = userData.username[0];
            const email = userData.email[0];
            const password = userData.password[0];

            // ✅ Hash Password
            const hashedPassword = await bcrypt.hash(password, 10);

            // ✅ Save to MongoDB
            const newUser = new User({ username, email, password: hashedPassword });
            await newUser.save();

            // ✅ Save to Neo4j
            const neo4jSession = neo4jDriver.session();
            await neo4jSession.run(
                `CREATE (u:User {username: $username, email: $email})`,
                { username, email }
            );
            await neo4jSession.close();

            res.status(201).send(jsonToXml({ response: { message: "User registered successfully", username } }));
        });
    } catch (err) {
        console.error("🔥 Server Error:", err);
        res.status(500).send(jsonToXml({ response: { message: "Server error" } }));
    }
});

app.post("/login", xmlValidationMiddleware, async (req, res) => {
    console.log("📩 Incoming request at /login");

    try {
        xml2js.parseString(req.body, async (err, result) => {
            if (err) {
                console.error("❌ XML Parsing Error:", err);
                return res.status(400).send(jsonToXml({ response: { message: "Invalid XML format" } }));
            }

            console.log("📄 Parsed XML JSON:", result);
            const userData = result.user;
            if (!userData || !userData.email || !userData.password) {
                return res.status(400).send(jsonToXml({ response: { message: "Missing login details in XML." } }));
            }

            const email = userData.email[0];
            const password = userData.password[0];

            // ✅ Check if user exists in MongoDB
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(400).send(jsonToXml({ response: { message: "Invalid credentials" } }));
            }

            // ✅ Compare Passwords
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).send(jsonToXml({ response: { message: "Invalid credentials" } }));
            }

            // ✅ Retrieve user from Neo4j
            const neo4jSession = neo4jDriver.session();
            const neo4jResult = await neo4jSession.run(
                `MATCH (u:User {email: $email}) RETURN u.username AS username`,
                { email }
            );
            await neo4jSession.close();

            const neo4jUser = neo4jResult.records[0]?.get("username") || user.username;

            res.send(jsonToXml({ response: { message: "Login successful", username: neo4jUser } }));
        });
    } catch (err) {
        console.error("🔥 Server Error:", err);
        res.status(500).send(jsonToXml({ response: { message: "Server error" } }));
    }
});

app.post("/friends", xmlValidationMiddleware, async (req, res) => {
    console.log("📩 Incoming request at /friends");

    try {
        // ✅ Parse XML request
        const result = await xml2js.parseStringPromise(req.body);
        console.log("📄 Parsed XML JSON:", result);

        if (!result.user || !result.user.username) {
            return res.status(400).send(jsonToXml({ response: { message: "Missing username in XML." } }));
        }

        const username = result.user.username[0];

        // ✅ Check if user exists in MongoDB
        const userExists = await User.findOne({ username });
        if (!userExists) {
            return res.status(404).send(jsonToXml({ response: { message: "User not found" } }));
        }

        // ✅ Fetch Friends from Neo4j
        const neo4jSession = neo4jDriver.session();
        const friendsResult = await neo4jSession.run(
            `MATCH (:User {username: $username})-[:FOLLOWS]->(friend:User) 
            WHERE friend.username <> $username  // Exclude self-following
            RETURN friend.username AS username
            `,
            { username }
        );
        await neo4jSession.close();

        // ✅ Format Friends List as Multiple `<username>` elements
        const friendsList = friendsResult.records.map(record => ({
            username: record.get("username")
        }));

        const responseXml = jsonToXml({ 
            response: { 
                message: "Friends list retrieved",
                username: friendsList.map(f => f.username)  // ✅ This should generate multiple <username> elements
            }
        });  
        console.log("🛠 Friends List Before Sending:", friendsList);
    
        // ✅ Validate XML Response
        const xmlDoc = libxmljs.parseXml(responseXml);
        const xsdDoc = libxmljs.parseXml(schemaContent);
        if (!xmlDoc.validate(xsdDoc)) {
            console.error("❌ XML Response Validation Failed:", xmlDoc.validationErrors);
            return res.status(500).send(jsonToXml({ response: { message: "Invalid XML response format" } }));
        }

        res.send(responseXml);
    } catch (err) {
        console.error("🔥 Error fetching friends:", err);
        res.status(500).send(jsonToXml({ response: { message: "Server error" } }));
    }
});

app.get("/search-users", async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).send(jsonToXml({ response: { message: "Search query required" } }));
    }

    try {
        // ✅ Find users matching the query
        const users = await User.find({ 
            username: { $regex: new RegExp(query, "i") } 
        }).select("username");

        console.log("🔍 Users Found:", users);

        if (users.length === 0) {
            return res.status(404).send(jsonToXml({ response: { message: "No users found" } }));
        }

        // ✅ Convert list of usernames to a single string (comma-separated)
        const usernamesString = users.map(user => user.username).join(", ");

        // ✅ Convert list of usernames to an array (not a single string)
        const usersXml = jsonToXml({
            response: {
                message: "Users found",
                username: users.map(user => user.username) // Array of usernames
            }
        });

        res.set("Content-Type", "application/xml");
        res.send(usersXml);
    } catch (err) {
        console.error("🔥 Error searching users:", err);
        res.status(500).send(jsonToXml({ response: { message: "Server error" } }));
    }
});

// ✅ Check Friendship Status
app.get("/check-friendship", async (req, res) => {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) return res.status(400).send(jsonToXml({ error: "Both usernames required" }));

    try {
        const neo4jSession = neo4jDriver.session();
        const result = await neo4jSession.run(
            `MATCH (a:User {username: $user1})-[:FOLLOWS]->(b:User {username: $user2}) 
             RETURN COUNT(b) > 0 AS areFriends`,
            { user1, user2 }
        );
        await neo4jSession.close();

        const areFriends = result.records[0].get("areFriends");
        res.send(jsonToXml({ areFriends }));
    } catch (err) {
        console.error("🔥 Error checking friendship:", err);
        res.status(500).send(jsonToXml({ error: "Server error" }));
    }
});

app.post("/follow-user", xmlValidationMiddleware, async (req, res) => {
    console.log("📩 Incoming request at /follow-user");

    try {
        const result = await xml2js.parseStringPromise(req.body);
        console.log("📄 Parsed XML JSON:", result);

        const { follower, following } = result.follow;
        if (!follower || !following) {
            return res.status(400).send(jsonToXml({ response: { message: "Missing follow details in XML." } }));
        }

        const followerUsername = follower[0];
        const followingUsername = following[0];

        // ✅ Step 1: Verify Users Exist in MongoDB in a single query
        const users = await User.find({ username: { $in: [followerUsername, followingUsername] } });

        if (users.length !== 2) {
            return res.status(400).send(jsonToXml({ response: { message: "One or both users do not exist" } }));
        }

        // ✅ Step 2: Add Relationship in Neo4j only if it doesn't already exist
        const neo4jSession = neo4jDriver.session();
        await neo4jSession.run(
            `MATCH (a:User {username: $follower}), (b:User {username: $following}) 
             MERGE (a)-[:FOLLOWS]->(b)`,
            { follower: followerUsername, following: followingUsername }
        );
        await neo4jSession.close();

        // ✅ Step 3: Prepare XML Response
        const responseXml = jsonToXml({ 
            response: { 
                message: "Successfully followed user", 
                username: followingUsername 
            } 
        });

        // ✅ Step 4: Validate Response Against XSD
        if (!validateXML(responseXml)) {
            console.error("❌ XML Response Validation Failed!");
            return res.status(500).send(jsonToXml({ response: { message: "Invalid XML response format" } }));
        }

        res.send(responseXml);
    } catch (err) {
        console.error("🔥 Error following user:", err);
        res.status(500).send(jsonToXml({ response: { message: "Server error" } }));
    }
});

app.get("/messages/:friend", async (req, res) => {
    const { username } = req.query;
    const { friend } = req.params;

    if (!username || !friend) {
        return res.status(400).send(jsonToXml({ response: { message: "Invalid request" } }));
    }

    try {
        console.log("🛠 Querying MongoDB with:", { sender: username, receiver: friend });

        const messages = await Message.find({
            $or: [
                { sender: username, receiver: friend },
                { sender: friend, receiver: username }
            ]
        }).sort({ timestamp: 1 });

        console.log("📩 Messages Found in DB:", messages);

        if (messages.length === 0) {
            return res.send(jsonToXml({
                response: { message: "No messages found" }
            }));
        }

        const formattedMessages = {
            messages: {
                message: messages.map(msg => ({
                    sender: msg.sender,
                    receiver: msg.receiver,
                    content: msg.content,
                    timestamp: msg.timestamp.toISOString()
                }))
            }
        };

        // ✅ Convert JSON to XML
        const responseXml = jsonToXml(formattedMessages);

        // ✅ Validate XML against XSD
        const xmlDoc = libxmljs.parseXml(responseXml);
        const xsdDoc = libxmljs.parseXml(schemaContent);

        if (!xmlDoc.validate(xsdDoc)) {
            console.error("❌ XML Validation Failed:", xmlDoc.validationErrors);
            return res.status(500).send(jsonToXml({ response: { message: "Invalid XML format" } }));
        }

        res.set("Content-Type", "application/xml");
        res.send(responseXml);
    } catch (err) {
        console.error("🔥 Error fetching messages:", err);
        res.status(500).send(jsonToXml({ response: { message: "Server error" } }));
    }
});

// ✅ Send Message (Modified with XSD validation)
app.post("/send-message", xmlValidationMiddleware, async (req, res) => {
    try {
        const parsedXml = await xml2js.parseStringPromise(req.body);
        const sender = parsedXml.message?.sender?.[0];
        const receiver = parsedXml.message?.receiver?.[0];
        const content = parsedXml.message?.content?.[0];

        if (!sender || !receiver || !content) {
            return res.status(400).send(jsonToXml({ response: { message: "Invalid message format" } }));
        }

        const newMessage = new Message({ sender, receiver, content });
        await newMessage.save();

        const responseXml = jsonToXml({ response: { message: "Message sent successfully" } });

        // ✅ Validate response before sending
        const xmlDoc = libxmljs.parseXml(responseXml);
        const xsdDoc = libxmljs.parseXml(schemaContent);
        if (!xmlDoc.validate(xsdDoc)) {
            console.error("❌ XML Response Validation Failed:", xmlDoc.validationErrors);
            return res.status(500).send(jsonToXml({ response: { message: "Invalid XML response format" } }));
        }

        res.send(responseXml);
    } catch (err) {
        console.error("🔥 Error sending message:", err);
        res.status(500).send(jsonToXml({ response: { message: "Server error" } }));
    }
});

app.get("/last-message/:friend", async (req, res) => {
    const { username } = req.query;
    const { friend } = req.params;

    if (!username || !friend) {
        return res.status(400).send(jsonToXml({ response: { message: "Invalid request" } }));
    }

    try {
        console.log("🛠 Checking database for:", { username, friend });

        // ✅ Check MongoDB first
        const mongoUser = await User.findOne({ username });
        const mongoFriend = await User.findOne({ username: friend });

        if (mongoUser && mongoFriend) {
            console.log("📦 Fetching last message from MongoDB...");
            
            const lastMessage = await Message.findOne({
                $or: [
                    { sender: username, receiver: friend },
                    { sender: friend, receiver: username }
                ]
            })
            .sort({ timestamp: -1 }) // Latest message first
            .limit(1);

            if (!lastMessage) {
                return res.send(jsonToXml({ response: { message: "No messages found" } }));
            }

            const responseXml = jsonToXml({
                response: {
                    message: {
                        sender: lastMessage.sender,
                        receiver: lastMessage.receiver,
                        content: lastMessage.content,
                        timestamp: lastMessage.timestamp.toISOString()
                    }
                }
            });

            res.set("Content-Type", "application/xml");
            return res.send(responseXml);
        }

        // ✅ If not found in MongoDB, check Neo4j
        console.log("🌐 Fetching last message from Neo4j...");
        const neo4jSession = neo4jDriver.session();

        const neo4jResult = await neo4jSession.run(
            `MATCH (u:User {username: $username})-[r:SENT]->(m:Message)-[:TO]->(f:User {username: $friend})
             RETURN m.content AS content, m.timestamp AS timestamp, u.username AS sender, f.username AS receiver
             ORDER BY m.timestamp DESC LIMIT 1`,
            { username, friend }
        );

        await neo4jSession.close();

        if (neo4jResult.records.length === 0) {
            return res.send(jsonToXml({ response: { message: "No messages found" } }));
        }

        const record = neo4jResult.records[0];

        const responseXml = jsonToXml({
            response: {
                message: {
                    sender: record.get("sender"),
                    receiver: record.get("receiver"),
                    content: record.get("content"),
                    timestamp: new Date(record.get("timestamp")).toISOString()
                }
            }
        });

        res.set("Content-Type", "application/xml");
        res.send(responseXml);

    } catch (err) {
        console.error("🔥 Error fetching last message:", err);
        res.status(500).send(jsonToXml({ response: { message: "Server error" } }));
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
