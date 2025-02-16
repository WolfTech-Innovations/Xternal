<template>
  <div id="app">
    <!-- VR Scene -->
    <a-scene ref="aScene" embedded>
      <!-- Environment -->
      <a-sky color="#1a1a1a"></a-sky>
      <a-plane position="0 0 0" rotation="-90 0 0" width="30" height="30" color="#333"></a-plane>
      
      <!-- Conference Room -->
      <a-entity id="conferenceRoom">
        <!-- Central Table -->
        <a-cylinder position="0 0.5 0" radius="3" height="1" color="#444"></a-cylinder>
        
        <!-- Video Screens - One for each participant -->
        <a-entity id="screenContainer" position="0 3 -5">
          <!-- Screens will be added dynamically -->
        </a-entity>

        <!-- Avatar Container -->
        <a-entity id="avatarContainer">
          <!-- User avatars will be added dynamically -->
        </a-entity>
      </a-entity>

      <!-- User Camera Rig -->
      <a-entity id="rig" position="0 1.6 0">
        <a-camera look-controls wasd-controls>
          <a-cursor raycaster="objects: .interactive"></a-cursor>
        </a-camera>
      </a-entity>

      <!-- Lighting -->
      <a-light type="ambient" intensity="0.5"></a-light>
      <a-light type="directional" position="1 1 1" intensity="0.8"></a-light>
    </a-scene>

    <!-- Web UI -->
    <div class="web-ui" :class="{ 'vr-mode': isInVR }">
      <div class="video-grid" v-if="!isInVR">
        <div v-for="stream in allStreams" :key="stream.id" class="video-container">
          <video :ref="'video-' + stream.id" autoplay playsinline></video>
          <div class="user-name">{{ stream.userName }}</div>
        </div>
      </div>

      <div class="controls">
        <button @click="toggleMute">{{ isMuted ? 'Unmute' : 'Mute' }}</button>
        <button @click="toggleVideo">{{ isVideoOn ? 'Video Off' : 'Video On' }}</button>
        <button @click="toggleVR" v-if="isVRSupported">{{ isInVR ? 'Exit VR' : 'Enter VR' }}</button>
        <button @click="leaveRoom">Leave Room</button>
      </div>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client';
import 'aframe';

export default {
  data() {
    return {
      socket: null,
      localStream: null,
      peerConnections: {},
      allStreams: [],
      userId: null,
      roomId: null,
      isInVR: false,
      isMuted: false,
      isVideoOn: true,
      isVRSupported: false,
      userColors: {},
      avatarRefs: {},
    };
  },
  async mounted() {
    this.userId = 'user_' + Math.random().toString(36).substr(2, 9);
    this.isVRSupported = navigator.xr !== undefined;
    await this.initializeRoom();
    this.setupSocketEvents();
    this.setupVREvents();
  },
  methods: {
    async initializeRoom() {
      // Initialize WebRTC and room
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        this.socket = io('http://localhost:3000');
        this.setupLocalStream();
      } catch (err) {
        console.error('Media initialization error:', err);
      }
    },

    setupSocketEvents() {
      this.socket.on('userJoined', async ({ userId, color }) => {
        this.userColors[userId] = color;
        this.createUserAvatar(userId);
        await this.createPeerConnection(userId);
      });

      this.socket.on('userLeft', (userId) => {
        this.removeUser(userId);
      });

      this.socket.on('offer', async ({ offer, from }) => {
        const pc = await this.createPeerConnection(from);
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('answer', { answer, to: from });
      });

      this.socket.on('answer', async ({ answer, from }) => {
        await this.peerConnections[from].setRemoteDescription(answer);
      });

      this.socket.on('iceCandidate', async ({ candidate, from }) => {
        await this.peerConnections[from].addIceCandidate(candidate);
      });

      this.socket.on('userMoved', ({ userId, position, rotation }) => {
        this.updateUserAvatar(userId, position, rotation);
      });
    },

    createUserAvatar(userId) {
      const color = this.userColors[userId] || this.getRandomColor();
      const avatarEntity = document.createElement('a-sphere');
      
      avatarEntity.setAttribute('radius', '0.3');
      avatarEntity.setAttribute('color', color);
      avatarEntity.setAttribute('position', this.getRandomPosition());
      avatarEntity.setAttribute('class', 'avatar');
      avatarEntity.setAttribute('id', `avatar-${userId}`);
      
      this.$refs.aScene.querySelector('#avatarContainer').appendChild(avatarEntity);
      this.avatarRefs[userId] = avatarEntity;
    },

    updateUserAvatar(userId, position, rotation) {
      const avatar = this.avatarRefs[userId];
      if (avatar) {
        avatar.setAttribute('position', position);
        avatar.object3D.rotation.copy(rotation);
      }
    },

    getRandomColor() {
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5'];
      return colors[Math.floor(Math.random() * colors.length)];
    },

    getRandomPosition() {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2 + Math.random() * 1; // Random position around the table
      return {
        x: Math.cos(angle) * radius,
        y: 1.6, // Head height
        z: Math.sin(angle) * radius
      };
    },

    async createPeerConnection(userId) {
      if (this.peerConnections[userId]) return this.peerConnections[userId];

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('iceCandidate', {
            candidate: event.candidate,
            to: userId
          });
        }
      };

      pc.ontrack = (event) => {
        this.addRemoteStream(userId, event.streams[0]);
      };

      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });

      this.peerConnections[userId] = pc;
      return pc;
    },

    addRemoteStream(userId, stream) {
      this.allStreams.push({
        id: userId,
        stream,
        userName: `User ${userId.slice(0, 4)}`
      });

      // Add video to VR scene
      this.addVideoToVRScene(userId, stream);
    },

    addVideoToVRScene(userId, stream) {
      const screenEntity = document.createElement('a-plane');
      const videoEl = document.createElement('video');
      
      videoEl.srcObject = stream;
      videoEl.id = `video-${userId}`;
      videoEl.play();

      screenEntity.setAttribute('width', '2');
      screenEntity.setAttribute('height', '1.5');
      screenEntity.setAttribute('position', this.getScreenPosition(this.allStreams.length - 1));
      screenEntity.setAttribute('material', 'src', `#video-${userId}`);
      
      this.$refs.aScene.querySelector('#screenContainer').appendChild(screenEntity);
    },

    getScreenPosition(index) {
      const angle = (index * Math.PI / 4) - (Math.PI / 2);
      const radius = 5;
      return {
        x: Math.cos(angle) * radius,
        y: 2,
        z: Math.sin(angle) * radius - 5
      };
    },

    setupVREvents() {
      if (this.isVRSupported) {
        this.$refs.aScene.addEventListener('enter-vr', () => {
          this.isInVR = true;
          this.startVRTracking();
        });

        this.$refs.aScene.addEventListener('exit-vr', () => {
          this.isInVR = false;
          this.stopVRTracking();
        });
      }
    },

    startVRTracking() {
      // Track user position and rotation in VR
      const rig = document.querySelector('#rig');
      this.vrInterval = setInterval(() => {
        this.socket.emit('userMoved', {
          position: rig.getAttribute('position'),
          rotation: rig.object3D.rotation,
          userId: this.userId
        });
      }, 50);
    },

    stopVRTracking() {
      if (this.vrInterval) {
        clearInterval(this.vrInterval);
      }
    },

    async toggleVR() {
      if (this.isInVR) {
        await this.$refs.aScene.exitVR();
      } else {
        await this.$refs.aScene.enterVR();
      }
    },

    toggleMute() {
      this.isMuted = !this.isMuted;
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = !this.isMuted;
        });
      }
    },

    toggleVideo() {
      this.isVideoOn = !this.isVideoOn;
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach(track => {
          track.enabled = this.isVideoOn;
        });
      }
    },

    leaveRoom() {
      this.socket.emit('leaveRoom', this.userId);
      this.cleanup();
    },

    cleanup() {
      Object.values(this.peerConnections).forEach(pc => pc.close());
      this.peerConnections = {};
      this.allStreams = [];
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }
      this.socket.disconnect();
    }
  },
  beforeDestroy() {
    this.cleanup();
  }
};
</script>

<style>
.web-ui {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  transition: opacity 0.3s ease;
}

.web-ui.vr-mode {
  opacity: 0;
  pointer-events: none;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.video-container {
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-name {
  position: absolute;
  bottom: 10px;
  left: 10px;
  color: white;
  background: rgba(0, 0, 0, 0.5);
  padding: 4px 8px;
  border-radius: 4px;
}

.controls {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  background: rgba(0, 0, 0, 0.5);
  padding: 10px;
  border-radius: 8px;
}

.controls button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: #4CAF50;
  color: white;
  cursor: pointer;
  transition: background 0.3s ease;
}

.controls button:hover {
  background: #45a049;
}
</style>