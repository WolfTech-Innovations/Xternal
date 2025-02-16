import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (you could also serve your Vue app here)
app.use(express.static('public'));

// In-memory meeting room storage (can be replaced with a database later)
let meetings = {};

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('createMeeting', (meetingCode) => {
    meetings[meetingCode] = { host: socket.id, participants: [] };
    socket.emit('meetingCreated', meetingCode);
    console.log(`Meeting created: ${meetingCode}`);
  });

  socket.on('joinMeeting', (meetingCode) => {
    if (meetings[meetingCode]) {
      meetings[meetingCode].participants.push(socket.id);
      socket.emit('meetingJoined', meetingCode);
      console.log(`User joined meeting: ${meetingCode}`);
    } else {
      socket.emit('meetingNotFound', 'Meeting code not valid');
    }
  });

  socket.on('disconnect', () => {
    for (let meetingCode in meetings) {
      const participants = meetings[meetingCode].participants;
      if (participants.includes(socket.id)) {
        participants.splice(participants.indexOf(socket.id), 1);
        console.log(`User disconnected from meeting: ${meetingCode}`);
        break;
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
