import { WebSocketServer } from 'ws';
import { verifyToken } from './utils/auth.js';

let wss;
const clients = new Map();

function onlineUsersMessage() {
  return {
    type: 'presence',
    users: [...clients.values()].map((client) => ({ id: client.userId, username: client.username }))
  };
}

export function broadcast(payload) {
  if (!wss) return;
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
}

export function sendToUser(userId, payload) {
  if (!wss) return;
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    const identity = clients.get(client);
    if (identity?.userId === String(userId) && client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

export function attachWebSocket(server) {
  wss = new WebSocketServer({ server });
  wss.on('connection', (socket, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    let identity = { sub: socket._socket.remoteAddress, username: 'Guest' };
    try {
      if (token) identity = verifyToken(token);
    } catch {
      identity = { sub: socket._socket.remoteAddress, username: 'Guest' };
    }
    clients.set(socket, { userId: identity.sub, username: identity.username });
    broadcast(onlineUsersMessage());
    socket.on('message', (raw) => {
      const payload = JSON.parse(raw.toString());
      if (payload.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }));
    });
    socket.on('close', () => {
      clients.delete(socket);
      broadcast(onlineUsersMessage());
    });
  });
  return wss;
}
