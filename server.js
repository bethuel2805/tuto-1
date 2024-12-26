const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? 'https://votre-domaine.onrender.com' 
      : 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const rooms = new Map();

io.on('connection', socket => {
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        
        // Obtenir le nombre de clients dans la salle
        const clients = io.sockets.adapter.rooms.get(roomId);
        const numClients = clients ? clients.size : 0;

        if (numClients > 5) {
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});