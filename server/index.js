// Simple matchmaking + relay server for Castle Busters
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// Serve static files from parent directory (client)
app.use(express.static(path.join(__dirname, '..')));

const PORT = process.env.PORT || 3000;

// Very simple matchmaking queue
let waiting = null;
let roomIdCounter = 1;

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('join_queue', (payload) => {
    console.log('join_queue', socket.id, payload);
    if (waiting && waiting !== socket.id) {
      // pair
      const room = `room-${roomIdCounter++}`;
      const other = io.sockets.sockets.get(waiting);
      if (other) {
        socket.join(room);
        other.join(room);
        // notify both
        socket.emit('match_found', { room, side: 'B', peer: other.id });
        other.emit('match_found', { room, side: 'A', peer: socket.id });
        console.log(`Matched ${other.id} and ${socket.id} in ${room}`);
      }
      waiting = null;
    } else {
      waiting = socket.id;
      socket.emit('queued');
    }
  });

  socket.on('leave_queue', () => {
    if (waiting === socket.id) waiting = null;
  });

  socket.on('action', (data) => {
    // relay to other clients in the room
    const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
    for (const r of rooms) {
      socket.to(r).emit('action', { from: socket.id, payload: data });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    if (waiting === socket.id) waiting = null;
  });
});

server.listen(PORT, () => {
  console.log(`Castle Busters server running on http://localhost:${PORT}`);
});
