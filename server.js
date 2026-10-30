const express = require('express');
const http = http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 15 * 1024 * 1024 // Augmenté à 15 Mo pour supporter l'audio/vidéo
});

app.use(express.static(path.join(__dirname, 'public')));

let clients = {};

io.on('connection', (socket) => {
    const uniqueId = socket.id;
    const randomPseudo = `Utilisateur_${uniqueId.substring(0, 5)}`;
    
    clients[uniqueId] = { 
        id: uniqueId, 
        pseudo: randomPseudo,
        unreadCount: 0,
        lastMessage: 'A rejoint la discussion'
    };

    io.emit('newUserNotification', { pseudo: randomPseudo });
    io.emit('updateUserList', Object.values(clients));

    socket.on('clientMessage', (data) => {
        const client = clients[uniqueId];
        if (client) {
            client.lastMessage = data.fileType && data.fileType.startsWith('audio/') ? '🎤 Message vocal' : (data.text || '[Média]');
            client.unreadCount += 1;

            const messageData = {
                senderId: uniqueId,
                author: client.pseudo,
                text: data.text || '',
                file: data.file || null,
                fileType: data.fileType || null,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            io.emit('newClientMessage', messageData);
            io.emit('updateUserList', Object.values(clients));
        }
    });

    socket.on('adminReply', (data) => {
        if (clients[data.targetSocketId]) {
            clients[data.targetSocketId].lastMessage = data.fileType && data.fileType.startsWith('audio/') ? '👑 Admin: 🎤 Vocal' : `Admin: ${data.text || '[Média]'}`;
        }
        const replyData = {
            author: '👑 Support Admin',
            text: data.text || '',
            file: data.file || null,
            fileType: data.fileType || null,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        io.to(data.targetSocketId).emit('privateMessage', replyData);
        io.emit('adminReplySent', { targetSocketId: data.targetSocketId, ...replyData });
        io.emit('updateUserList', Object.values(clients));
    });

    socket.on('markAsRead', (targetSocketId) => {
        if (clients[targetSocketId]) {
            clients[targetSocketId].unreadCount = 0;
            io.emit('updateUserList', Object.values(clients));
        }
    });

    socket.on('deleteConversation', (targetSocketId) => {
        if (clients[targetSocketId]) {
            delete clients[targetSocketId];
            io.to(targetSocketId).emit('conversationClosed');
            io.emit('updateUserList', Object.values(clients));
        }
    });

    socket.on('disconnect', () => {
        if (clients[uniqueId]) {
            delete clients[uniqueId];
            io.emit('updateUserList', Object.values(clients));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});
