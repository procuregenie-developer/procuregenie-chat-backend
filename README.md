Here is a **clean, professional, and production-ready updated `README.md`** for your **Chatbot Backend Package**, rewritten for **clarity, correctness, and npm-quality documentation**.

You can **copy–paste this directly** into your repository.

---

# 🚀 Chatbot Backend Package

A **scalable, real-time chatbot backend** built with **Node.js, Express, Sequelize, and Socket.IO**.
Designed to plug into **any existing user table** without modifying your schema.

---

## 📌 Node Version

```txt
Node.js >= 23.11.0
```

---

## 📖 Introduction

`chatbortbackend` is a **ready-to-use backend engine** for real-time chat applications.
It provides:

* REST APIs for messages & groups
* Socket.IO real-time events
* Dynamic user-table integration
* Transaction-safe group management
* Clean service-based architecture

You **do not need to redesign your user table** — simply map it during initialization.

---

## ✨ Features

* 🔴 **Real-time Messaging** (Socket.IO)
* 👥 **One-to-One & Group Chat**
* 📎 **File & Document Sharing**
* ✏️ **Edit / Delete Messages (Live Sync)**
* 🟢 **Online / Offline User Tracking**
* 🔒 **Transaction-Safe Group Operations**
* 🧩 **Plug-and-Play User Table Mapping**
* 🧱 **Clean Architecture (Controller / Service / Model)**

---

## 🗂 Folder Structure

```
src/
├── config/
│   └── DatabaseConfig.js        # Sequelize DB connection
│
├── controllers/
│   └── MessageController.js     # REST API controllers
│
├── models/
│   ├── Group.js                 # Group model
│   ├── GroupMember.js           # Group-user mapping
│   ├── Message.js               # Message model
│   └── init_models.js           # Model associations
│
├── services/
│   └── ChatService.js           # Core business logic
│
├── sockets/
│   └── MessageSocketHandler.js  # Socket.IO events
│
├── utils/
│   ├── AppUtils.js              # Utility helpers
│   └── FileManager.js           # File handling
│
├── validators/
│   └── ChatValidators.js        # Express validators
│
└── index.js                     # Package entry point
```

---

## 📦 Installation

### Install from npm

```bash
npm install chatbortbackend
```

---

## ⚙️ Configuration & Initialization

### 🔧 Database Support

* PostgreSQL (Sequelize ORM)

---

### 🧠 Initialization Example

```js
const { Service } = require('chatbortbackend').ChatService;

const chatService = new Service();

(async () => {
    await chatService.init({
        dbconfig: {
            host: 'localhost',
            username: 'postgres',
            password: 'password',
            database: 'chat_db',
            port: 5432,
            dialect: 'postgres'
        },
        userModel: {
            name: 'users', // existing user table
            columns: {
                id: { columns: ['id'] },
                username: { columns: ['first_name', 'last_name'] },
                email: { columns: ['email'] },
                phoneNumber: { columns: ['phone'] }
            }
        }
    });
})();
```

✔ No schema changes required
✔ Works with existing production databases

---

## 🔌 API Documentation

### 📩 Messages

#### ➤ Create Message

```
POST /api/messages
```

**Request Body**

```json
{
  "fromUserId": 1,
  "toUserId": 2,
  "groupId": null,
  "messageType": "text",
  "messageText": "Hello world",
  "file": {
    "name": "image.png",
    "base64": "..."
  }
}
```

---

#### ➤ Fetch Messages

```
GET /api/messages
```

**Query Parameters**

| Parameter  | Required | Description      |
| ---------- | -------- | ---------------- |
| fromUserId | Optional | Sender user ID   |
| toUserId   | Optional | Receiver user ID |
| groupId    | Optional | Group ID         |
| search     | Optional | Search text      |
| page       | Optional | Default: 1       |
| limit      | Optional | Default: 10      |

---

## 🔄 Socket.IO Events

### Client → Server

| Event                  | Description    |
| ---------------------- | -------------- |
| `handleUserConnection` | Register user  |
| `handleSendMessage`    | Send message   |
| `handleEditMessage`    | Edit message   |
| `handleDeleteMessage`  | Delete message |

---

### Server → Client

| Event             | Description          |
| ----------------- | -------------------- |
| `new_message`     | New incoming message |
| `message_edited`  | Message updated      |
| `message_deleted` | Message removed      |
| `online_users`    | Active users list    |

---

### Sample Payload

```json
{
  "fromUserId": 1,
  "toUserId": 2,
  "groupId": null,
  "messageType": "text",
  "messageText": "Hello"
}
```

---

## 🗃 Database Schema

### Tables

| Table             | Purpose            |
| ----------------- | ------------------ |
| `groupsmaster`    | Group metadata     |
| `groupuserslines` | Group-user mapping |
| `message`         | Messages           |

---

### Relationships

* `Group` ➝ hasMany ➝ `GroupMember`
* `Group` ➝ hasMany ➝ `Message`
* `GroupMember` ➝ belongsTo ➝ `Group`
* `Message` ➝ belongsTo ➝ `Group`

---

## 🧠 Service Layer (`ChatService`)

Available Methods:

* `fetchMessages()`
* `fetchGroups()`
* `createGroup()`
* `updateGroup()`
* `assignGroupMembers()`
* `getGroupManageUsers()`

✔ All group operations are **transaction-safe**

---

## 🚀 Express.js Example

```js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const {
    MessageController,
    MessageSocketHandler,
    ChatValidators
} = require('chatbortbackend');

const { Service } = require('chatbortbackend').ChatService;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Initialize Chat Service
const chatService = new Service();
(async () => {
    await chatService.init({ ...config });
})();

// Routes
app.get(
    '/messages',
    ChatValidators.validateGetMessages,
    MessageController.fetchMessages
);

// Socket
io.on('connection', (socket) => {
    MessageSocketHandler(socket, io);
});

server.listen(3000, () => {
    console.log('🚀 Server running on port 3000');
});
```

---

## 🛠 Development Usage

### Using `npm link` (Local Development)

```bash
npm link
npm link chatbortbackend
```

---

### Install from Local Path

```bash
npm install /absolute/path/to/chatbortbackend
```