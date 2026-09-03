// Minimal client network helper for prototype online play
// Adds window.net with simple API: connect(), joinQueue(), sendAction(payload), onRemote(fn)

(function(){
  const net = {
    socket: null,
    connected: false,
    room: null,
    side: null,
    connect(serverUrl) {
      if (this.socket) return;
      // serverUrl optional — default will connect to same origin
      this.socket = io(serverUrl || undefined);
      this.socket.on('connect', () => {
        console.log('net: connected', this.socket.id);
        this.connected = true;
      });
      this.socket.on('queued', () => { console.log('net: queued for match'); });
      this.socket.on('match_found', (m) => {
        console.log('net: match_found', m);
        this.room = m.room; this.side = m.side;
        if (this.onMatch) this.onMatch(m);
      });
      this.socket.on('action', (msg) => {
        console.log('net: action from peer', msg);
        if (this.onRemoteAction) this.onRemoteAction(msg.payload);
      });
      this.socket.on('disconnect', () => { console.log('net: disconnected'); this.connected = false; });
    },
    joinQueue(info) {
      if (!this.socket) return;
      this.socket.emit('join_queue', info || {});
    },
    leaveQueue() { if (this.socket) this.socket.emit('leave_queue'); },
    sendAction(payload) { if (this.socket) this.socket.emit('action', payload); },
    onRemote(fn) { this.onRemoteAction = fn; },
    onMatchFound(fn) { this.onMatch = fn; }
  };
  window.net = net;
})();
