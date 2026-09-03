# Castle Busters — Online prototype server

This directory contains a minimal Node.js server that provides:

- Simple matchmaking (pairing two clients into a room)
- Relaying of action messages between matched players
- Serving of static client files from the repository root

Run locally:

1. Install dependencies:

   cd server
   npm install

2. Start the server:

   npm start

3. Open client in browser (when server runs on port 3000):

   http://localhost:3000/index.html

Client integration:
- The server emits `match_found` and `queued` events.
- Clients should connect with Socket.IO and emit `join_queue` to enter matchmaking.
- When a client emits `action` (any gameplay event), the server relays it to the peer via the room.

Notes:
- This server is a prototype for development and testing only. It is not secured or hardened for production use.
