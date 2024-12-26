const express = require('express');
const http = require('http');
const socket = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socket(server);

app.use(express.static('public'));

const rooms = new Map();

io.on('connection', socket => {
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        
        // Obtenir le nombre de clients dans la salle
        const clients = io.sockets.adapter.rooms.get(roomId);
        const numClients = clients ? clients.size : 0;

        if (numClients > 2) {
            socket.emit('room-full');
            socket.leave(roomId);
        } else {
            // Informer le client de son rôle (initiateur ou récepteur)
            socket.emit('role-assigned', numClients === 1 ? 'initiator' : 'receiver');
            // Informer les autres utilisateurs de la salle
            socket.to(roomId).emit('user-connected', socket.id);
        }
    });

    socket.on('offer', (offer, roomId) => {
        socket.to(roomId).emit('offer', offer, socket.id);
    });

    socket.on('answer', (answer, roomId) => {
        socket.to(roomId).emit('answer', answer, socket.id);
    });

    socket.on('ice-candidate', (candidate, roomId) => {
        socket.to(roomId).emit('ice-candidate', candidate, socket.id);
    });

    socket.on('disconnect', () => {
        io.emit('user-disconnected', socket.id);
    });
});

server.listen(3000, () => console.log('Server running on port 3000'));