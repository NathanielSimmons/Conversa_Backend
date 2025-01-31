const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");
const {
  getAiResponse,
  sendMessageHandler,
  deleteMessageHandler,
} = require("../Controllers/message_controller.js");

// module.exports = (io, socket) => {
//   let currentUserId = null;

//   // Setup user in a room
//   socket.on("setup", async (id) => {
//     currentUserId = id;
//     socket.join(id);
//     socket.emit("user setup", id);

//     // change isOnline to true
//     await User.findByIdAndUpdate(id, { isOnline: true });

//     const conversations = await Conversation.find({
//       members: { $in: [id] },
//     });

//     conversations.forEach((conversation) => {
//       const sock = io.sockets.adapter.rooms.get(conversation.id);
//       if (sock) {
//         console.log("Other user is online is sent to: ", id);
//         io.to(conversation.id).emit("receiver-online", {});
//       }
//     });
//   });

//   // Join chat room
//   socket.on("join-chat", async (data) => {
//     const { roomId, userId } = data;

//     const conv = await Conversation.findById(roomId);
//     socket.join(roomId);

//     // set joined user unread to 0
//     conv.unreadCounts = conv.unreadCounts.map((unread) => {
//       if (unread.userId == userId) {
//         unread.count = 0;
//       }
//       return unread;
//     });
//     await conv.save({ timestamps: false });

//     io.to(roomId).emit("user-joined-room", userId);
//   });

//   // Leave chat room
//   socket.on("leave-chat", (room) => {
//     socket.leave(room);
//   });

//   const handleSendMessage = async (data) => {
//     var isSentToBot = false;

//     const { conversationId, senderId, text, imageUrl } = data;
//     const conversation = await Conversation.findById(conversationId).populate(
//       "members"
//     );

//     // processing for AI chatbot
//     conversation.members.forEach(async (member) => {
//       if (member._id != senderId && member.email.endsWith("bot")) {
//         // this member is a bot
//         isSentToBot = true;
//         // send typing event
//         io.to(conversationId).emit("typing", { typer: member._id.toString() });
//         // generating AI response

//         const mockUserMessage = {
//           id_: Date.now().toString(),
//           conversationId: conversationId,
//           senderId: senderId,
//           text: text,
//           seenBy: [
//             {
//               user: member._id.toString(),
//               seenAt: new Date(),
//             },
//           ],
//           imageUrl: imageUrl,
//           createdAt: new Date(),
//           updatedAt: new Date(),
//         };

//         io.to(conversationId).emit("receive-message", mockUserMessage);

//         const responseMessage = await getAiResponse(
//           text,
//           senderId,
//           conversationId
//         );

//         if (responseMessage == -1) {
//           return;
//         }

//         io.to(conversationId).emit("receive-message", responseMessage);
//         io.to(conversationId).emit("stop-typing", {
//           typer: member._id.toString(),
//         });
//       }
//     });

//     if (isSentToBot) {
//       return;
//     }

//     // processing for personal chat
//     const receiverId = conversation.members.find(
//       (member) => member._id != senderId
//     )._id;

//     const receiverPersonalRoom = io.sockets.adapter.rooms.get(
//       receiverId.toString()
//     );

//     let isReceiverInsideChatRoom = false;

//     if (receiverPersonalRoom) {
//       const receiverSid = Array.from(receiverPersonalRoom)[0];
//       isReceiverInsideChatRoom = io.sockets.adapter.rooms
//         .get(conversationId)
//         .has(receiverSid);
//     }

//     const message = await sendMessageHandler({
//       text,
//       imageUrl,
//       senderId,
//       conversationId,
//       receiverId,
//       isReceiverInsideChatRoom,
//     });

//     io.to(conversationId).emit("receive-message", message);

//     // sending notification to receiver
//     if (!isReceiverInsideChatRoom) {
//       io.to(receiverId.toString()).emit("new-message-notification", message);
//     }
//   };

//   // Send message
//   socket.on("send-message", handleSendMessage);

//   const handleDeleteMessage = async (data) => {
//     const { messageId, deleteFrom, conversationId } = data;
//     const deleted = await deleteMessageHandler({ messageId, deleteFrom });
//     if (deleted && deleteFrom.length > 1) {
//       io.to(conversationId).emit("message-deleted", data);
//     }
//   };

//   // Send message
//   socket.on("delete-message", handleDeleteMessage);

//   // Typing indicator
//   socket.on("typing", (data) => {
//     io.to(data.conversationId).emit("typing", data);
//   });

//   // Stop typing indicator
//   socket.on("stop-typing", (data) => {
//     io.to(data.conversationId).emit("stop-typing", data);
//   });

//   // Disconnect
//   socket.on("disconnect", async () => {
//     console.log("A user disconnected", currentUserId, socket.id);
//     try {
//       const user = await User.findByIdAndUpdate(currentUserId, {
//         isOnline: false,
//         lastSeen: new Date(),
//       });
//       console.log('Disconnected User: ', user);
//     } catch (error) {
//       console.error("Error updating user status on disconnect:", error);
//     }

//     const conversations = await Conversation.find({
//       members: { $in: [currentUserId] },
//     });

//     conversations.forEach((conversation) => {
//       const sock = io.sockets.adapter.rooms.get(conversation.id);
//       if (sock) {
//         console.log("Other user is offline is sent to: ", currentUserId);
//         io.to(conversation.id).emit("receiver-offline", {});
//       }
//     });
//   });
// };

module.exports = (io, socket) => {
  const userSocketMap = {}; // Map to keep track of user to socket mapping

  // Setup user in a room
  socket.on("setup", async (id) => {
    console.log('Setting up user connection: ', id);
    userSocketMap[socket.id] = id; // Store user id associated with socket id
    console.log('User Socket Map: ', userSocketMap);
    socket.join(id);
    socket.emit("user setup", id);

    // change isOnline to true for the user
    await User.findByIdAndUpdate(id, { isOnline: true });

    const conversations = await Conversation.find({
      members: { $in: [id] },
    });

    conversations.forEach((conversation) => {
      const sock = io.sockets.adapter.rooms.get(conversation.id);
      if (sock) {
        console.log("Other user is online, sent to: ", id);
        io.to(conversation.id).emit("receiver-online", {});
      }
    });
  });

  // Join chat room
  socket.on("join-chat", async (data) => {
    const { roomId, userId } = data;

    const conv = await Conversation.findById(roomId);
    socket.join(roomId);

    // set joined user unread to 0
    conv.unreadCounts = conv.unreadCounts.map((unread) => {
      if (unread.userId == userId) {
        unread.count = 0;
      }
      return unread;
    });
    await conv.save({ timestamps: false });

    io.to(roomId).emit("user-joined-room", userId);
  });

  // Leave chat room
  socket.on("leave-chat", (room) => {
    socket.leave(room);
  });

  const handleSendMessage = async (data) => {
    var isSentToBot = false;

    const { conversationId, senderId, text, imageUrl } = data;
    const conversation = await Conversation.findById(conversationId).populate(
      "members"
    );

    // processing for AI chatbot
    conversation.members.forEach(async (member) => {
      if (member._id != senderId && member.email.endsWith("bot")) {
        // this member is a bot
        isSentToBot = true;
        // send typing event
        io.to(conversationId).emit("typing", { typer: member._id.toString() });
        // generating AI response

        const mockUserMessage = {
          id_: Date.now().toString(),
          conversationId: conversationId,
          senderId: senderId,
          text: text,
          seenBy: [
            {
              user: member._id.toString(),
              seenAt: new Date(),
            },
          ],
          imageUrl: imageUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        io.to(conversationId).emit("receive-message", mockUserMessage);

        const responseMessage = await getAiResponse(
          text,
          senderId,
          conversationId
        );

        if (responseMessage == -1) {
          return;
        }

        io.to(conversationId).emit("receive-message", responseMessage);
        io.to(conversationId).emit("stop-typing", {
          typer: member._id.toString(),
        });
      }
    });

    if (isSentToBot) {
      return;
    }

    // processing for personal chat
    const receiverId = conversation.members.find(
      (member) => member._id != senderId
    )._id;

    const receiverPersonalRoom = io.sockets.adapter.rooms.get(
      receiverId.toString()
    );

    let isReceiverInsideChatRoom = false;

    if (receiverPersonalRoom) {
      const receiverSid = Array.from(receiverPersonalRoom)[0];
      isReceiverInsideChatRoom = io.sockets.adapter.rooms
        .get(conversationId)
        .has(receiverSid);
    }

    const message = await sendMessageHandler({
      text,
      imageUrl,
      senderId,
      conversationId,
      receiverId,
      isReceiverInsideChatRoom,
    });

    io.to(conversationId).emit("receive-message", message);

    // sending notification to receiver
    if (!isReceiverInsideChatRoom) {
      io.to(receiverId.toString()).emit("new-message-notification", message);
    }
  };

  // Send message
  socket.on("send-message", handleSendMessage);

  const handleDeleteMessage = async (data) => {
    const { messageId, deleteFrom, conversationId } = data;
    const deleted = await deleteMessageHandler({ messageId, deleteFrom });
    if (deleted && deleteFrom.length > 1) {
      io.to(conversationId).emit("message-deleted", data);
    }
  };

  // Send message
  socket.on("delete-message", handleDeleteMessage);

  // Typing indicator
  socket.on("typing", (data) => {
    io.to(data.conversationId).emit("typing", data);
  });

  // Stop typing indicator
  socket.on("stop-typing", (data) => {
    io.to(data.conversationId).emit("stop-typing", data);
  });

  // Disconnect
  socket.on("disconnect", async () => {
    const userId = userSocketMap[socket.id]; // Retrieve user ID from socket mapping
    console.log("A user disconnected", userId, socket.id);

    if (userId) {
      try {
        const user = await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });
      } catch (error) {
        console.error("Error updating user status on disconnect:", error);
      }

      const conversations = await Conversation.find({
        members: { $in: [userId] },
      });

      conversations.forEach((conversation) => {
        const sock = io.sockets.adapter.rooms.get(conversation.id);
        if (sock) {
          console.log("Other user is offline, sent to: ", userId);
          io.to(conversation.id).emit("receiver-offline", {});
        }
      });
    }

    // Clean up the user-to-socket mapping, even if the userId is undefined
    delete userSocketMap[socket.id];
  });
};
