const socket = io('/');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const joinButton = document.getElementById('joinButton');
const roomIdInput = document.getElementById('roomId');

let localStream;
let peerConnection;
let currentRoom;
let isInitiator = false;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

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

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    // Ajouter les tracks locaux
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Gérer les tracks distants
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Gérer les candidats ICE
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('ice-candidate', event.candidate, currentRoom);
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE State:', peerConnection.iceConnectionState);
    };
}

async function joinRoom() {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert('Veuillez entrer un ID de salle');
        return;
    }

    currentRoom = roomId;
    
    // S'assurer que le flux local est configuré
    if (!localStream) {
        await setupLocalStream();
    }

    socket.emit('join-room', roomId);
}

async function initiateCall() {
    createPeerConnection();

    try {
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
        });
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', offer, currentRoom);
    } catch (error) {
        console.error('Erreur lors de la création de l\'offre:', error);
    }
}

// Gestionnaires d'événements Socket.io
socket.on('role-assigned', role => {
    isInitiator = role === 'initiator';
    if (isInitiator) {
        initiateCall();
    }
});

socket.on('user-connected', async userId => {
    console.log('Nouvel utilisateur connecté:', userId);
    if (isInitiator) {
        initiateCall();
    }
});

socket.on('offer', async (offer, userId) => {
    if (!peerConnection) {
        createPeerConnection();
    }
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', answer, currentRoom);
    } catch (error) {
        console.error('Erreur lors du traitement de l\'offre:', error);
    }
});

socket.on('answer', async (answer) => {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Erreur lors du traitement de la réponse:', error);
    }
});

socket.on('ice-candidate', async (candidate) => {
    try {
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout du candidat ICE:', error);
    }
});

socket.on('user-disconnected', userId => {
    console.log('Utilisateur déconnecté:', userId);
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
});

socket.on('room-full', () => {
    alert('La salle est pleine (maximum 2 personnes)');
});

// Configuration initiale
setupLocalStream();
joinButton.addEventListener('click', joinRoom);