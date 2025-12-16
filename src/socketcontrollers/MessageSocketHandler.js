const path = require("path");
const { fileManager } = require("../utils/filemanager");
const { getUserInfo, getUserMessagesMaster } = require("../utils/helper");

const baseDir = path.join(fileManager.fileLocation, "messagesdocs");

// ======================================================================
// 🔌 ENHANCED SOCKET.IO STATE MANAGEMENT
// ======================================================================
let onlineUsers = new Map(); // userId -> { socketId, userInfo, lastSeen, status }
let typingUsers = new Map(); // `${fromUserId}-${toUserId}` -> timestamp
let userSocketMap = new Map(); // socketId -> userId (reverse lookup)

/**
 * 🔍 Helper: Fetch user data dynamically
 */


/**
 * 🔄 Helper: Broadcast online users with detailed status
 */
function broadcastOnlineUsers(io) {
    const onlineUsersList = Array.from(onlineUsers.entries()).map(([userId, data]) => ({
        userId,
        status: data.status,
        lastSeen: data.lastSeen
    }));

    io.emit("online_users_list", onlineUsersList);

    // Also emit simple array for backward compatibility
    const userIds = Array.from(onlineUsers.keys());
    io.emit("online_users", userIds);
}

/**
 * 🔄 Helper: Broadcast specific user status change
 */
function broadcastUserStatus(io, userId, status, lastSeen = null) {
    io.emit("user_status_changed", {
        userId,
        status,
        lastSeen: lastSeen || new Date()
    });
}

/**
 * 🧹 Helper: Clean up user on disconnect
 */
function cleanupUser(userId, socketId) {
    // Remove from online users
    onlineUsers.delete(userId);

    // Remove socket mapping
    userSocketMap.delete(socketId);

    // Clear all typing indicators for this user
    for (const [key] of typingUsers.entries()) {
        if (key.startsWith(`${userId}-`)) {
            typingUsers.delete(key);
        }
    }
}

// ======================================================================
// 🔌 ENHANCED SOCKET.IO CONTROLLERS
// ======================================================================
let userMessagesControllers = (socket, io) => {
    if (!socket || !io) {
        console.error("❌ Socket or IO missing. Cannot initialize controllers.");
        return;
    };
    // ======================================================================
    // 👤 USER CONNECTED - Enhanced with comprehensive status management
    // ======================================================================
    socket.on("handleUserConnection", (userData) => {
        try {
            const { userId, userInfo } = userData;

            if (!userId) {
                console.error("❌ User connected without userId");
                socket.emit("connection_error", { error: "User ID required" });
                return;
            }

            // Check if user already connected from another device/tab
            const existingUser = onlineUsers.get(userId);
            if (existingUser && existingUser.socketId !== socket.id) {
                console.log(`⚠️ User ${userId} already connected, disconnecting old session`);
                const oldSocket = io.sockets.sockets.get(existingUser.socketId);
                if (oldSocket) {
                    oldSocket.emit("force_disconnect", {
                        reason: "Connected from another location"
                    });
                    oldSocket.disconnect(true);
                }
            }

            // Store user connection with enhanced status
            onlineUsers.set(userId, {
                socketId: socket.id,
                userInfo: userInfo || {},
                lastSeen: new Date(),
                status: "online",
                connectedAt: new Date()
            });

            // Store reverse mapping
            userSocketMap.set(socket.id, userId);

            console.log(`✅ User ${userId} connected (socket: ${socket.id})`);

            // Broadcast updated online users list
            broadcastOnlineUsers(io);

            // Broadcast individual status change
            broadcastUserStatus(io, userId, "online");

            // Confirm connection to the user
            socket.emit("connection_established", {
                message: "Connected to chat server",
                userId,
                socketId: socket.id,
                timestamp: new Date(),
                onlineUsers: Array.from(onlineUsers.keys())
            });

        } catch (error) {
            console.error("❌ User connected error:", error);
            socket.emit("connection_error", { error: "Failed to register user" });
        }
    });

    // ======================================================================
    // 💓 HEARTBEAT - Enhanced with status update
    // ======================================================================
    socket.on("heartbeat", (data) => {
        try {
            const { userId } = data;

            if (userId && onlineUsers.has(userId)) {
                const userData = onlineUsers.get(userId);
                userData.lastSeen = new Date();
                userData.status = "online";
                onlineUsers.set(userId, userData);

                socket.emit("heartbeat_ack", {
                    timestamp: new Date(),
                    status: "online"
                });
            }
        } catch (error) {
            console.error("Heartbeat error:", error);
        }
    });

    // ======================================================================
    // ✏️ TYPING INDICATORS - Private chat only
    // ======================================================================
    socket.on("typing_start", (data) => {
        try {
            const { fromUserId, toUserId } = data;

            if (!fromUserId || !toUserId) {
                console.warn("⚠️ Invalid typing_start data:", data);
                return;
            }

            const typingKey = `${fromUserId}-${toUserId}`;
            typingUsers.set(typingKey, Date.now());

            // Notify the recipient only
            const recipient = onlineUsers.get(parseInt(toUserId));
            if (recipient) {
                io.to(recipient.socketId).emit("user_typing", {
                    userId: fromUserId,
                    isTyping: true,
                    timestamp: new Date()
                });
                console.log(`✏️ ${fromUserId} started typing to ${toUserId}`);
            }

        } catch (error) {
            console.error("Typing start error:", error);
        }
    });

    socket.on("typing_stop", (data) => {
        try {
            const { fromUserId, toUserId } = data;

            if (!fromUserId || !toUserId) {
                console.warn("⚠️ Invalid typing_stop data:", data);
                return;
            }

            const typingKey = `${fromUserId}-${toUserId}`;
            typingUsers.delete(typingKey);

            // Notify the recipient only
            const recipient = onlineUsers.get(parseInt(toUserId));
            if (recipient) {
                io.to(recipient.socketId).emit("user_typing", {
                    userId: fromUserId,
                    isTyping: false,
                    timestamp: new Date()
                });
                console.log(`⏹️ ${fromUserId} stopped typing to ${toUserId}`);
            }

        } catch (error) {
            console.error("Typing stop error:", error);
        }
    });

    // ======================================================================
    // 📨 SEND MESSAGE - Enhanced with validation
    // ======================================================================
socket.on("handleSendMessage", async (data) => {
    let messageModel = getUserMessagesMaster();
    try {
        const { fromUserId, toUserId, groupId, messageType, messageText, files, tempId } = data;
        
        if (!["doc", "text"].includes(messageType)) {
            socket.emit("message_error", {
                tempId,
                error: "Invalid message type!"
            });
            return;
        };

        // Validation
        if (!fromUserId || (!toUserId && !groupId)) {
            socket.emit("message_error", {
                tempId,
                error: "Either toUserId or groupId required."
            });
            return;
        }

        // ⚠️ CRITICAL: Prevent sending both message and document simultaneously
        if (messageText && messageText.trim() && files && files.length > 0) {
            socket.emit("message_error", {
                tempId,
                error: "Cannot send text message and documents simultaneously. Please send one at a time."
            });
            return;
        }

        // Validate message type consistency
        if (messageType === "text" && files && files.length > 0) {
            socket.emit("message_error", {
                tempId,
                error: "Message type mismatch. Text messages cannot include files."
            });
            return;
        }

        if (messageType === "doc" && (!files || files.length === 0)) {
            socket.emit("message_error", {
                tempId,
                error: "Document messages must include at least one file."
            });
            return;
        }

        // Validate files array structure
        if (files && files.length > 0) {
            for (const file of files) {
                if (!file.base64 || !file.name) {
                    socket.emit("message_error", {
                        tempId,
                        error: "Invalid file structure. Each file must have base64 and name properties."
                    });
                    return;
                }
            }
        }

        // Fetch sender info
        const sender = await getUserInfo(fromUserId);

        // Create message in database
        const message = await messageModel.create({
            fromUserId,
            toUserId: groupId ? null : toUserId,
            groupId: groupId || null,
            messageType,
            messageText: messageType === "text" ? (messageText || null) : null,
            isEdited: false
        });

        // Handle multiple file uploads if present
        if (files && files.length > 0) {
            try {
                const MAX_SIZE = 10 * 1024 * 1024; // 10 MB per file
                const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB total
                const MAX_FILES = 10; // Maximum files per message

                // Check file count limit
                if (files.length > MAX_FILES) {
                    socket.emit("message_error", {
                        tempId,
                        error: `Too many files. Maximum ${MAX_FILES} files allowed.`
                    });
                    await message.destroy({ where: { id: message.id } });
                    return;
                }

                // Check total size
                let totalSize = 0;
                for (const file of files) {
                    const fileBuffer = Buffer.from(file.base64, "base64");
                    totalSize += fileBuffer.length;
                }

                if (totalSize > MAX_TOTAL_SIZE) {
                    socket.emit("message_error", {
                        tempId,
                        error: `Total files size exceeds ${MAX_TOTAL_SIZE / (1024 * 1024)}MB limit.`
                    });
                    await message.destroy({ where: { id: message.id } });
                    return;
                }

                // Create message directory
                const messageDir = path.join(baseDir, `${message.id}`);
                fileManager.addDirs({ uploadpath: baseDir, dirs: [`${message.id}`] });

                const uploadedFiles = [];
                let fileIndex = 0;

                // Process each file
                for (const file of files) {
                    try {
                        const fileBuffer = Buffer.from(file.base64, "base64");

                        // Check individual file size
                        if (fileBuffer.length > MAX_SIZE) {
                            console.warn(`❌ File too large: ${file.name} (${fileBuffer.length} bytes)`);
                            throw new Error(`File "${file.name}" exceeds 10MB size limit.`);
                        }

                        // Generate unique filename to avoid conflicts
                        const fileExtension = path.extname(file.name);
                        const fileName = path.basename(file.name, fileExtension);
                        const uniqueFileName = `${fileName}_${Date.now()}_${fileIndex}${fileExtension}`;
                        const filePath = path.join(messageDir, uniqueFileName);

                        await fileManager.addFiles({ data: fileBuffer, location: filePath });

                        // Store file info for response
                        uploadedFiles.push({
                            name: file.name,
                            size: fileBuffer.length,
                            type: file.type,
                            path: filePath,
                            uniqueName: uniqueFileName
                        });

                        console.log(`📎 File saved: ${file.name} as ${uniqueFileName}`);
                        fileIndex++;

                    } catch (fileError) {
                        console.error(`❌ File save error for ${file.name}:`, fileError);

                        // Cleanup: delete all already uploaded files
                        for (const uploadedFile of uploadedFiles) {
                            try {
                                await fileManager.deleteFile(uploadedFile.path);
                            } catch (deleteError) {
                                console.error(`Failed to delete ${uploadedFile.path}:`, deleteError);
                            }
                        }

                        // Delete the message record
                        await message.destroy({ where: { id: message.id } });

                        socket.emit("message_error", {
                            tempId,
                            error: fileError.message || `Failed to upload file: ${file.name}`
                        });
                        return;
                    }
                }

                console.log(`✅ All ${files.length} files uploaded successfully for message ${message.id}`);

            } catch (fileError) {
                console.error("❌ File processing error:", fileError);

                await message.destroy({ where: { id: message.id } });

                socket.emit("message_error", {
                    tempId,
                    error: "Failed to process files. Please try again."
                });
                return;
            }
        }

        // Get uploaded files for response
        let responseFiles = [];
        if (files && files.length > 0) {
            const messageDir = path.join("messagesdocs", String(message.id));
            try {
                const fileData = await fileManager.getAllFiles(messageDir, "base64");
                responseFiles = fileData.map(file => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    base64: file.base64,
                    // Include additional metadata if needed
                    uploadedAt: new Date().toISOString()
                }));
            } catch (error) {
                console.error("❌ Error getting uploaded files:", error);
                // Continue without files in response rather than failing completely
            }
        }

        const completeMessage = {
            ...message.toJSON(),
            files: responseFiles,
            senderName: sender ? sender.username : null,
        };

        // Confirm to sender
        socket.emit("message_sent", {
            tempId,
            message: completeMessage,
            status: "delivered",
            timestamp: new Date(),
            fileCount: files ? files.length : 0
        });

        // Deliver to recipients
        if (groupId) {
            // Group message - broadcast to all group members
            io.emit(`group_message_${groupId}`, {
                message: completeMessage,
                timestamp: new Date(),
                fileCount: files ? files.length : 0
            });
            console.log(`📤 Group message with ${files ? files.length : 0} files sent to group ${groupId}`);
        } else {
            // Private message - deliver to specific recipient
            const recipient = onlineUsers.get(parseInt(toUserId));
            if (recipient && recipient.status === "online") {
                io.to(recipient.socketId).emit("new_message", {
                    message: completeMessage,
                    fromUser: onlineUsers.get(parseInt(fromUserId))?.userInfo,
                    timestamp: new Date(),
                    fileCount: files ? files.length : 0
                });

                // Send delivery confirmation
                socket.emit("message_delivered", {
                    messageId: message.id,
                    deliveredAt: new Date(),
                    recipientOnline: true,
                    fileCount: files ? files.length : 0
                });

                console.log(`📤 Message with ${files ? files.length : 0} files delivered to ${toUserId} (online)`);
            } else {
                // Recipient offline
                socket.emit("message_delivered", {
                    messageId: message.id,
                    deliveredAt: new Date(),
                    recipientOnline: false,
                    fileCount: files ? files.length : 0
                });
                console.log(`📭 Recipient ${toUserId} is offline (message had ${files ? files.length : 0} files)`);
            }
        }

    } catch (error) {
        console.error("❌ Send Message Error:", error);
        socket.emit("message_error", {
            tempId: data.tempId,
            error: "Failed to send message. Please try again."
        });
    }
});

    // ======================================================================
    // 🗑️ DELETE MESSAGE
    // ======================================================================
    socket.on("handleDeleteMessage", async (data) => {
        let messageModel = getUserMessagesMaster();
        try {
            const { messageId, fromUserId, toUserId, groupId } = data;

            if (!messageId || !fromUserId) {
                return socket.emit("delete_message_error", {
                    error: "messageId and fromUserId are required."
                });
            }

            const message = await messageModel.findByPk(messageId);
            if (!message) {
                return socket.emit("delete_message_error", {
                    error: "Message not found."
                });
            }

            if (message.fromUserId !== fromUserId) {
                return socket.emit("delete_message_error", {
                    error: "Unauthorized to delete this message."
                });
            }

            // Delete files
            const messageDir = path.join(baseDir, String(message.id));
            try {
                const files = await fileManager.getAllFiles(messageDir);
                if (files.length > 0) {
                    await fileManager.deleteDir(messageDir);
                    console.log(`🗑️ Files deleted for message ${message.id}`);
                }
            } catch (fileErr) {
                console.warn(`⚠️ Could not delete files for message ${message.id}:`, fileErr.message);
            }

            // Delete from database
            await message.destroy({ where: { id: messageId } });

            const deletedMessage = {
                messageId,
                groupId: groupId || null,
                toUserId: toUserId || null,
                fromUserId,
                deleted: true,
                deletedAt: new Date(),
            };

            // Notify sender
            socket.emit("message_deleted", deletedMessage);

            // Notify recipients
            if (groupId) {
                io.emit(`group_message_deleted_${groupId}`, deletedMessage);
            } else if (toUserId) {
                const recipient = onlineUsers.get(parseInt(toUserId));
                if (recipient) {
                    io.to(recipient.socketId).emit("message_deleted", deletedMessage);
                }
            }

            console.log(`🗑️ Message ${messageId} deleted successfully`);
        } catch (error) {
            console.error("Delete message error:", error);
            socket.emit("delete_message_error", { error: error.message });
        }
    });

    // ======================================================================
    // ✏️ EDIT MESSAGE - Text messages only
    // ======================================================================
    socket.on("handleEditMessage", async (data) => {
        let messageModel = getUserMessagesMaster();
        try {
            const { messageId, messageText, fromUserId, toUserId, groupId } = data;

            if (!messageText || !messageText.trim()) {
                return socket.emit("edit_message_error", {
                    error: "Message text cannot be empty"
                });
            }

            const message = await messageModel.findByPk(messageId);
            if (!message) {
                return socket.emit("edit_message_error", {
                    error: "Message not found"
                });
            }

            if (message.fromUserId !== fromUserId) {
                return socket.emit("edit_message_error", {
                    error: "Unauthorized to edit this message"
                });
            }

            if (message.messageType !== "text") {
                return socket.emit("edit_message_error", {
                    error: "Only text messages can be edited"
                });
            }

            message.messageText = messageText.trim();
            message.isEdited = true;
            await message.save();

            const sender = await getUserInfo(fromUserId);
            const updatedMessage = {
                ...message.toJSON(),
                edited: true,
                senderName: sender ? sender.username : null,
                editedAt: new Date()
            };

            // Notify sender
            socket.emit("message_edited", updatedMessage);

            // Notify recipients
            if (groupId) {
                io.emit(`group_message_edited_${groupId}`, updatedMessage);
            } else {
                const recipient = onlineUsers.get(parseInt(toUserId));
                if (recipient) {
                    io.to(recipient.socketId).emit("message_edited", updatedMessage);
                }
            }

            console.log(`✏️ Message ${messageId} edited successfully`);
        } catch (error) {
            console.error("Edit message error:", error);
            socket.emit("edit_message_error", { error: error.message });
        }
    });

    // ======================================================================
    // 🛑 DISCONNECT - Enhanced with comprehensive cleanup
    // ======================================================================
    socket.on("disconnect", (reason) => {
        console.log(`🔴 Socket disconnected: ${socket.id} (${reason})`);

        // Find user by socket ID
        const userId = userSocketMap.get(socket.id);

        if (userId) {
            const lastSeen = new Date();

            // Clean up user data
            cleanupUser(userId, socket.id);

            // Broadcast status change
            broadcastUserStatus(io, userId, "offline", lastSeen);

            // Broadcast updated online users list
            broadcastOnlineUsers(io);

            console.log(`👋 User ${userId} went offline (last seen: ${lastSeen.toISOString()})`);
        }
    });

    // ======================================================================
    // 🔌 FORCE DISCONNECT - Handle multiple device connections
    // ======================================================================
    socket.on("disconnect_other_sessions", (data) => {
        try {
            const { userId } = data;

            if (!userId) return;

            // Find and disconnect all other sessions for this user
            for (const [uid, userData] of onlineUsers.entries()) {
                if (uid === userId && userData.socketId !== socket.id) {
                    const oldSocket = io.sockets.sockets.get(userData.socketId);
                    if (oldSocket) {
                        oldSocket.emit("force_disconnect", {
                            reason: "Connected from another location"
                        });
                        oldSocket.disconnect(true);
                    }
                }
            }
        } catch (error) {
            console.error("Disconnect other sessions error:", error);
        }
    });
};

// ======================================================================
// 🌐 REST API CONTROLLERS (unchanged but with validation)
// ======================================================================
module.exports = {
    userMessagesControllers
};