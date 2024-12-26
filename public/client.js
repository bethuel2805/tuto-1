// const socket = io('/');
// const localVideo = document.getElementById('localVideo');
// const remoteVideo = document.getElementById('remoteVideo');
// const joinButton = document.getElementById('joinButton');
// const roomIdInput = document.getElementById('roomId');

// let localStream;
// let peerConnection;
// let currentRoom;
// let isInitiator = false;

// const configuration = {
//     iceServers: [
//         { urls: 'stun:stun.l.google.com:19302' }
//     ]
// };

// async function setupLocalStream() {
//     try {
//         localStream = await navigator.mediaDevices.getUserMedia({
//             video: true,
//             audio: true
//         });
//         localVideo.srcObject = localStream;
//     } catch (error) {
//         console.error('Erreur d\'accès aux périphériques:', error);
//         alert('Erreur d\'accès à la caméra ou au microphone');
//     }
// }

// function createPeerConnection() {
//     peerConnection = new RTCPeerConnection(configuration);

//     // Ajouter les tracks locaux
//     localStream.getTracks().forEach(track => {
//         peerConnection.addTrack(track, localStream);
//     });

//     // Gérer les tracks distants
//     peerConnection.ontrack = event => {
//         remoteVideo.srcObject = event.streams[0];
//     };

//     // Gérer les candidats ICE
//     peerConnection.onicecandidate = event => {
//         if (event.candidate) {
//             socket.emit('ice-candidate', event.candidate, currentRoom);
//         }
//     };

//     peerConnection.oniceconnectionstatechange = () => {
//         console.log('ICE State:', peerConnection.iceConnectionState);
//     };
// }

// async function joinRoom() {
//     const roomId = roomIdInput.value.trim();
//     if (!roomId) {
//         alert('Veuillez entrer un ID de salle');
//         return;
//     }

//     currentRoom = roomId;
    
//     // S'assurer que le flux local est configuré
//     if (!localStream) {
//         await setupLocalStream();
//     }

//     socket.emit('join-room', roomId);
// }

// async function initiateCall() {
//     createPeerConnection();

//     try {
//         const offer = await peerConnection.createOffer({
//             offerToReceiveAudio: 1,
//             offerToReceiveVideo: 1
//         });
//         await peerConnection.setLocalDescription(offer);
//         socket.emit('offer', offer, currentRoom);
//     } catch (error) {
//         console.error('Erreur lors de la création de l\'offre:', error);
//     }
// }

// // Gestionnaires d'événements Socket.io
// socket.on('role-assigned', role => {
//     isInitiator = role === 'initiator';
//     if (isInitiator) {
//         initiateCall();
//     }
// });

// socket.on('user-connected', async userId => {
//     console.log('Nouvel utilisateur connecté:', userId);
//     if (isInitiator) {
//         initiateCall();
//     }
// });

// socket.on('offer', async (offer, userId) => {
//     if (!peerConnection) {
//         createPeerConnection();
//     }
    
//     try {
//         await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
//         const answer = await peerConnection.createAnswer();
//         await peerConnection.setLocalDescription(answer);
//         socket.emit('answer', answer, currentRoom);
//     } catch (error) {
//         console.error('Erreur lors du traitement de l\'offre:', error);
//     }
// });

// socket.on('answer', async (answer) => {
//     try {
//         await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
//     } catch (error) {
//         console.error('Erreur lors du traitement de la réponse:', error);
//     }
// });

// socket.on('ice-candidate', async (candidate) => {
//     try {
//         if (peerConnection) {
//             await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
//         }
//     } catch (error) {
//         console.error('Erreur lors de l\'ajout du candidat ICE:', error);
//     }
// });

// socket.on('user-disconnected', userId => {
//     console.log('Utilisateur déconnecté:', userId);
//     if (remoteVideo.srcObject) {
//         remoteVideo.srcObject.getTracks().forEach(track => track.stop());
//         remoteVideo.srcObject = null;
//     }
//     if (peerConnection) {
//         peerConnection.close();
//         peerConnection = null;
//     }
// });

// socket.on('room-full', () => {
//     alert('La salle est pleine (maximum 2 personnes)');
// });

// // Configuration initiale
// setupLocalStream();
// joinButton.addEventListener('click', joinRoom);

const socket = io('/');
const videosContainer = document.getElementById('videos-container');
const localVideo = document.getElementById('localVideo');
const joinButton = document.getElementById('joinButton');
const roomIdInput = document.getElementById('roomId');

let localStream;
let currentRoom;
const peers = new Map(); // Map pour stocker les connexions peer
const userId = generateUserId(); // Générer un ID unique pour l'utilisateur

// Configuration ICE
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

function generateUserId() {
    return Math.random().toString(36).substr(2, 9);
}

async function setupLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error('Erreur d\'accès aux périphériques:', error);
        alert('Erreur d\'accès à la caméra ou au microphone');
    }
}

function createPeerConnection(targetUserId) {
    const peerConnection = new RTCPeerConnection(configuration);
    
    // Ajouter les tracks locaux
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Gérer les tracks distants
    peerConnection.ontrack = event => {
        const videoElement = createVideoElement(targetUserId);
        videoElement.srcObject = event.streams[0];
    };

    // Gérer les candidats ICE
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, currentRoom, userId, targetUserId);
        }
    };

    peers.set(targetUserId, peerConnection);
    return peerConnection;
}

function createVideoElement(remoteUserId) {
    // Vérifier si l'élément existe déjà
    const existingVideo = document.getElementById(`video-${remoteUserId}`);
    if (existingVideo) {
        return existingVideo;
    }

    // Créer un nouveau wrapper et élément vidéo
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';
    wrapper.id = `wrapper-${remoteUserId}`;

    const video = document.createElement('video');
    video.id = `video-${remoteUserId}`;
    video.autoplay = true;
    video.playsinline = true;

    const label = document.createElement('div');
    label.className = 'user-label';
    label.textContent = `Utilisateur ${remoteUserId.substr(0, 4)}`;

    wrapper.appendChild(video);
    wrapper.appendChild(label);
    videosContainer.appendChild(wrapper);

    return video;
}

async function initiateCall(targetUserId) {
    const peerConnection = createPeerConnection(targetUserId);
    
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer, currentRoom, userId, targetUserId);
    } catch (error) {
        console.error('Erreur lors de la création de l\'offre:', error);
    }
}

async function joinRoom() {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert('Veuillez entrer un ID de salle');
        return;
    }

    currentRoom = roomId;
    socket.emit('join-room', roomId, userId);
}

// Gestionnaires d'événements Socket.io
socket.on('user-connected', async (newUserId) => {
    console.log('Nouvel utilisateur connecté:', newUserId);
    await initiateCall(newUserId);
});

socket.on('existing-users', async (users) => {
    console.log('Utilisateurs existants:', users);
    for (const existingUserId of users) {
        await initiateCall(existingUserId);
    }
});

socket.on('offer', async (offer, fromUserId, toUserId) => {
    if (toUserId !== userId) return;
    
    const peerConnection = createPeerConnection(fromUserId);
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', answer, currentRoom, userId, fromUserId);
    } catch (error) {
        console.error('Erreur lors du traitement de l\'offre:', error);
    }
});

socket.on('answer', async (answer, fromUserId, toUserId) => {
    if (toUserId !== userId) return;
    
    const peerConnection = peers.get(fromUserId);
    if (peerConnection) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Erreur lors du traitement de la réponse:', error);
        }
    }
});

socket.on('ice-candidate', async (candidate, fromUserId, toUserId) => {
    if (toUserId !== userId) return;
    
    const peerConnection = peers.get(fromUserId);
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Erreur lors de l\'ajout du candidat ICE:', error);
        }
    }
});

socket.on('user-disconnected', (disconnectedUserId) => {
    // Fermer la connexion peer
    const peerConnection = peers.get(disconnectedUserId);
    if (peerConnection) {
        peerConnection.close();
        peers.delete(disconnectedUserId);
    }

    // Supprimer l'élément vidéo
    const wrapper = document.getElementById(`wrapper-${disconnectedUserId}`);
    if (wrapper) {
        wrapper.remove();
    }
});

// Initialisation
setupLocalStream();
joinButton.addEventListener('click', joinRoom);