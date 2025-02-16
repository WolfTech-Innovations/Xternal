<template>
  <div id="app">
    <!-- Video Stream -->
    <div class="video-container">
      <video ref="localVideo" autoplay muted playsinline></video>
      <div v-for="(stream, id) in remoteStreams" :key="id" class="remote-video">
        <video :ref="'remoteVideo_' + id" autoplay playsinline></video>
      </div>
    </div>

    <!-- Branding -->
    <div class="branding">
      <h1>WolfTech Innovations</h1>
      <h2>Xternal</h2>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button @click="toggleMute">{{ isMuted ? 'Unmute' : 'Mute' }}</button>
      <button @click="toggleVideo">{{ isVideoOn ? 'Video Off' : 'Video On' }}</button>
      <button @click="createMeeting">Create Meeting</button>
      <button @click="joinMeeting">Join Meeting</button>
    </div>

    <!-- Notepad UI -->
    <div class="notepad">
      <textarea v-model="noteText" placeholder="Take notes here..." rows="5"></textarea>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client';

export default {
  data() {
    return {
      video: null,
      socket: null,
      localStream: null,
      remoteStreams: {},
      noteText: '',
      meetingCode: null,
      isMuted: false,
      isVideoOn: true,
    };
  },
  async mounted() {
    this.initSocket();
    await this.startLocalStream();
  },
  methods: {
    async startLocalStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        this.localStream = stream;
        this.$refs.localVideo.srcObject = stream;
      } catch (err) {
        console.error('Error accessing media devices:', err);
      }
    },
    initSocket() {
      this.socket = io('https://xternal.pages.dev:3000');

      this.socket.on('connect', () => {
        console.log('Connected to server');
      });

      this.socket.on('meetingCreated', (meetingCode) => {
        console.log(`Meeting created with code: ${meetingCode}`);
        this.meetingCode = meetingCode;
      });

      this.socket.on('meetingJoined', (meetingCode) => {
        console.log(`Joined meeting with code: ${meetingCode}`);
      });

      this.socket.on('newUser', (userId) => {
        console.log('New user joined:', userId);
        this.addRemoteStream(userId);
      });

      this.socket.on('userDisconnected', (userId) => {
        console.log('User disconnected:', userId);
        this.removeRemoteStream(userId);
      });

      this.socket.on('remoteStream', (userId, stream) => {
        this.remoteStreams[userId] = stream;
        const remoteVideo = this.$refs[`remoteVideo_${userId}`];
        if (remoteVideo) {
          remoteVideo.srcObject = stream;
        }
      });
    },
    toggleMute() {
      this.isMuted = !this.isMuted;
      this.localStream.getTracks().forEach(track => {
        if (track.kind === 'audio') track.enabled = !this.isMuted;
      });
    },
    toggleVideo() {
      this.isVideoOn = !this.isVideoOn;
      this.localStream.getTracks().forEach(track => {
        if (track.kind === 'video') track.enabled = !this.isVideoOn;
      });
    },
    createMeeting() {
      this.meetingCode = Math.floor(Math.random() * 1000000);
      console.log(`Meeting code: ${this.meetingCode}`);
      this.socket.emit('createMeeting', this.meetingCode);
    },
    joinMeeting() {
      if (!this.meetingCode) return alert("Please enter a meeting code.");
      this.socket.emit('joinMeeting', this.meetingCode);
    },
    addRemoteStream(userId) {
      const remoteStream = new MediaStream();
      this.remoteStreams[userId] = remoteStream;
    },
    removeRemoteStream(userId) {
      delete this.remoteStreams[userId];
    },
  },
};
</script>

<style>
#app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
}

.video-container {
  display: flex;
  gap: 10px;
}

video {
  width: 200px;
  height: 150px;
  background-color: black;
}

.branding {
  text-align: center;
  color: #333;
  font-family: 'Arial', sans-serif;
}

.controls {
  display: flex;
  gap: 10px;
}

.controls button {
  background-color: #ff0080;
  color: white;
  padding: 10px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.controls button:hover {
  background-color: #ff8c00;
}

.notepad {
  margin-top: 20px;
}

.notepad textarea {
  width: 300px;
  height: 150px;
  padding: 10px;
  border-radius: 8px;
}
</style>
