// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');
// const path = require('path');
// require('dotenv').config();

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: process.env.NODE_ENV === 'production' 
//       ? 'https://votre-domaine.onrender.com' 
//       : 'http://localhost:3000',
//     methods: ['GET', 'POST']
//   }
// });

// app.use(express.static('public'));

// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// const rooms = new Map();

// io.on('connection', socket => {
//     socket.on('join-room', (roomId) => {
//         socket.join(roomId);
        
//         // Obtenir le nombre de clients dans la salle
//         const clients = io.sockets.adapter.rooms.get(roomId);
//         const numClients = clients ? clients.size : 0;

//         if (numClients > 5) {
//             socket.emit('room-full');
//             socket.leave(roomId);
//         } else {
//             // Informer le client de son rôle (initiateur ou récepteur)
//             socket.emit('role-assigned', numClients === 1 ? 'initiator' : 'receiver');
//             // Informer les autres utilisateurs de la salle
//             socket.to(roomId).emit('user-connected', socket.id);
//         }
//     });

//     socket.on('offer', (offer, roomId) => {
//         socket.to(roomId).emit('offer', offer, socket.id);
//     });

//     socket.on('answer', (answer, roomId) => {
//         socket.to(roomId).emit('answer', answer, socket.id);
//     });

//     socket.on('ice-candidate', (candidate, roomId) => {
//         socket.to(roomId).emit('ice-candidate', candidate, socket.id);
//     });

//     socket.on('disconnect', () => {
//         io.emit('user-disconnected', socket.id);
//     });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`Serveur démarré sur le port ${PORT}`);
// });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configuration de Socket.io avec CORS pour la production
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.CORS_ORIGIN || 'https://votre-domaine.onrender.com'
      : 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Servir les fichiers statiques
app.use(express.static('public'));

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gestion des salles et des utilisateurs
const rooms = new Map();

io.on('connection', socket => {
    console.log('Nouvelle connexion:', socket.id);

    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        
        // Initialiser la salle si elle n'existe pas
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        
        const roomUsers = rooms.get(roomId);
        
        // Vérifier la limite d'utilisateurs (5 maximum)
        if (roomUsers.size >= 5) {
            socket.emit('room-full');
            socket.leave(roomId);
            return;
        }

        // Ajouter l'utilisateur à la salle
        roomUsers.add(userId);
        
        // Envoyer la liste des utilisateurs existants au nouvel arrivant
        const existingUsers = Array.from(roomUsers).filter(id => id !== userId);
        socket.emit('existing-users', existingUsers);

        // Informer les autres utilisateurs
        socket.to(roomId).emit('user-connected', userId);

        // Logging pour le débogage en production
        console.log(`Utilisateur ${userId} a rejoint la salle ${roomId}. Utilisateurs dans la salle:`, 
            Array.from(roomUsers));

        // Gérer la déconnexion
        socket.on('disconnect', () => {
            console.log(`Utilisateur ${userId} s'est déconnecté de la salle ${roomId}`);
            
            if (rooms.has(roomId)) {
                roomUsers.delete(userId);
                socket.to(roomId).emit('user-disconnected', userId);
                
                // Nettoyer la salle si elle est vide
                if (roomUsers.size === 0) {
                    rooms.delete(roomId);
                    console.log(`Salle ${roomId} supprimée car vide`);
                }
            }
        });
    });

    // Gérer la signalisation WebRTC avec logging
    socket.on('offer', (offer, roomId, fromUserId, toUserId) => {
        console.log(`Offre de ${fromUserId} à ${toUserId} dans la salle ${roomId}`);
        socket.to(roomId).emit('offer', offer, fromUserId, toUserId);
    });

    socket.on('answer', (answer, roomId, fromUserId, toUserId) => {
        console.log(`Réponse de ${fromUserId} à ${toUserId} dans la salle ${roomId}`);
        socket.to(roomId).emit('answer', answer, fromUserId, toUserId);
    });

    socket.on('ice-candidate', (candidate, roomId, fromUserId, toUserId) => {
        console.log(`Candidat ICE de ${fromUserId} à ${toUserId} dans la salle ${roomId}`);
        socket.to(roomId).emit('ice-candidate', candidate, fromUserId, toUserId);
    });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
    console.error('Erreur serveur:', err);
    res.status(500).send('Erreur serveur');
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT} en mode ${process.env.NODE_ENV || 'development'}`);
});

// Gestion de la fermeture propre
process.on('SIGTERM', () => {
    console.log('SIGTERM reçu. Fermeture du serveur...');
    server.close(() => {
        console.log('Serveur fermé');
        process.exit(0);
    });
});