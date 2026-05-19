import 'dotenv/config';
import http from 'http';
import { createApp } from './app.js';
import { connectDb, isUsingMemoryDb, stopMemoryDb } from './config/db.js';
import { attachWebSocket } from './websocket.js';

const app = createApp();
const server = http.createServer(app);
attachWebSocket(server);

const port = process.env.PORT || 4000;

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

connectDb()
  .then(() => {
    console.log(`Database connected${isUsingMemoryDb() ? ' (in-memory fallback)' : ''}`);
  })
  .catch((error) => {
    console.error('Database connection failed:', error.message);
  });

function handleShutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => {
    stopMemoryDb()
      .catch(() => {})
      .finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
