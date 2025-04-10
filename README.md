# 💬 NetworXchat

NetworXchat is a modern XML-driven chat backend system that integrates both **MongoDB** and **Neo4j** to deliver powerful user and social graph functionalities. This hybrid architecture allows seamless user management, messaging, and social networking features.

---

### 🚀 Features

### 🧾 XML Support
- Full XML-based communication (input and output).
- Strict XML validation using an XSD schema for all requests and responses.

### 🧑 User Management
- User registration with username, email, and password.
- Data is stored in both **MongoDB** (for credentials) and **Neo4j** (for social graph).
- Secure login with password hashing via **bcrypt**.
- Authenticates and retrieves user information from both databases.

### 👥 Social Graph
- Users can follow other users, establishing `FOLLOWS` relationships in **Neo4j**.
- Friendship status can be checked between any two users.
- Retrieves the full friends list (users being followed) from the social graph.

### 🔍 Search
- Search for users by username with case-insensitive matching.
- Results are pulled from **MongoDB** and returned in XML format.

### ✉️ Messaging
- Users can send messages to each other, which are saved in **MongoDB**.
- View full conversation history between two users.
- Retrieve the most recent message exchanged between two users.


## 📦 Tech Stack

| Technology | Purpose |
|------------|---------|
| **React.js** | Frontend |
| **Express.js** | REST API Framework |
| **MongoDB** | Persistent storage of users and messages |
| **Neo4j** | Graph database for social relationships |
| **bcryptjs** | Password hashing |
| **xml2js** | XML ⇌ JSON conversion |
| **libxmljs2** | XML + XSD validation |
| **cors** | CORS support |

---

## 🛠 Setup Instructions

### Prerequisites
- Node.js v14+
- MongoDB running at `mongodb://localhost:27017`
- Neo4j running at `neo4j://localhost`

### Credits
- Developed by **Bala Subramanian 😁✌️** - Done this project to learn usage of xml and different databases in a single application.
