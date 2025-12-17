# Chatbot Backend Package


----

Node version :- 23.11.0

---

## Introduction
This package provides a robust backend solution for a real-time chat application. It includes REST APIs for message management, Socket.IO handlers for real-time communication, and a service layer for managing users and groups. Built with Node.js, Express, and Sequelize.

## Features
- **Real-time Messaging**: Instant text and file messaging using Socket.IO.
- **Group Chat**: Create, update, and manage group conversations.
- **File Sharing**: Upload and share files/documents in chats.
- **Message Management**: Edit and delete messages with real-time updates for all participants.
- **User Status**: Track online/offline status of users.
- **Clean Architecture**: Separation of concerns with Services, Controllers, and Models.

## Folder Structure
```
src/
├── config/
│   └── DatabaseConfig.js       # Database connection and configuration
├── controllers/
│   └── MessageController.js    # REST API controllers for messages
├── models/
│   ├── Group.js                # Group model
│   ├── GroupMember.js          # Group Member model
│   ├── Message.js              # Message model
│   └── init_models.js          # Model initialization and associations
├── services/
│   └── ChatService.js          # Core business logic service
├── sockets/
│   └── MessageSocketHandler.js # Socket.IO event handlers
├── utils/
│   ├── AppUtils.js             # General utilities
│   └── FileManager.js          # File system management
└── validators/
    └── ChatValidators.js       # Request validators
index.js                        # Main entry point
```

## Installation
```bash
npm install chatbortbackend
```

## Configuration

### Database Configuration
The package requires a PostgreSQL database. Configure it using `DatabaseConfig`.

### Initialization
Initialize the package in your main application file:

```javascript
const { Service } = require('chatbortbackend').ChatService;

let chatService=new Service();
(async()=>{
    await chatService.init({
        dbconfig: {
            host: 'localhost',
            username: 'postgres',
            password: 'password',
            database: 'chat_db',
            dialect: 'postgres'
        },
        userModel: {
            name: 'users', // Your existing user table name
            columns: {
                id: { columns: ['id'] },
                username: { columns: ['first_name', 'last_name'] },
                email: { columns: ['email'] },
                phoneNumber: { columns: ['phone'] }
            }
        }
    });
})();

module.exports = { chatService };
```

## API Documentation

### Messages

#### Create Message
- **URL**: `/api/messages`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "fromUserId": 1,
    "toUserId": 2, // OR "groupId": 1
    "messageType": "text", // or "doc"
    "messageText": "Hello world",
    "file": { "name": "image.png", "base64": "..." } // Optional
  }
  ```

#### Fetch Messages
- **URL**: `/api/messages`
- **Method**: `GET`
- **Query Params**:
  - `fromUserId`: Sender ID (required if no groupId)
  - `toUserId`: Receiver ID (required if no groupId)
  - `groupId`: Group ID (required if no user IDs)
  - `search`: Search text (optional)
  - `page`: Page number (default 1)
  - `limit`: Records per page (default 10)

## Socket Documentation

### Events

| Event Name | Direction | Description | Payload |
|------------|-----------|-------------|---------|
| `handleUserConnection` | Client -> Server | Register user | `{ userId, userInfo }` |
| `handleSendMessage` | Client -> Server | Send message | `{ fromUserId, toUserId, groupId, messageType, messageText, file }` |
| `handleDeleteMessage` | Client -> Server | Delete message | `{ messageId, fromUserId }` |
| `handleEditMessage` | Client -> Server | Edit message | `{ messageId, messageText, fromUserId }` |
| `new_message` | Server -> Client | New message received | `{ message, fromUser }` |
| `message_deleted` | Server -> Client | Message deleted | `{ messageId, deleted: true }` |
| `message_edited` | Server -> Client | Message edited | `{ messageId, messageText, edited: true }` |
| `online_users` | Server -> Client | List of online users | `[userId1, userId2, ...]` |

## Database Schema

### Tables
- **groupsmaster (`Group`)**: Stores group details.
- **GroupMember (`GroupMember`)**: Links users to groups.
- **message (`Message`)**: Stores all chat messages.

### Relationships
- `Group` has many `GroupMember`
- `Group` has many `Message`
- `GroupMember` belongs to `Group`
- `Message` belongs to `Group`

## Service Layer (`ChatService`)

- `fetchMessages: Retrieve messages with pagination.
- `fetchGroups`: Retrieve groups for a user.
- `createGroup`: Create a new group.
- `updateGroup`: Update group details and members.

## Example Usage (Express.js)

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MessageController, MessageSocketHandler,ChatValidators } = require('chatbortbackend');
const { Service } = require('chatbortbackend').ChatService;

let chatService=new Service();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// Initialize
(async ()=>{
   await chatService.init({ ...config });
})();

// Routes
app.get('/messages',ChatValidators.validateGetMessages, MessageController.fetchMessages);

// Socket
io.on('connection', (socket) => {
    MessageSocketHandler(socket, io);
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});
```

Package use steps :-

1) npm install

Using npm link (For Active Development)
---------------------------------------
1) npm link
2) npm link <packagename>

Installation with Absolute Path

1) npm install <packlocation>