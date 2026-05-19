import mongoose from 'mongoose';

let memoryServerPromise;
let usingMemoryDb = false;

mongoose.set('bufferCommands', false);

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export function isUsingMemoryDb() {
  return usingMemoryDb;
}

export async function stopMemoryDb() {
  if (!memoryServerPromise) return;
  const memoryServer = await memoryServerPromise;
  await memoryServer.stop();
  memoryServerPromise = undefined;
  usingMemoryDb = false;
}

function shouldFallbackToMemory(uri, error) {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.MONGODB_DISABLE_MEMORY_FALLBACK === 'true') return false;
  if (process.env.MONGODB_ENABLE_MEMORY_FALLBACK === 'false') return false;
  if (uri === 'memory' || uri === 'inmemory') return true;
  if (process.env.MONGODB_ENABLE_MEMORY_FALLBACK === 'true') return true;

  const localFallbackEnabled = process.env.ENABLE_LOCAL_FALLBACK === 'true';
  const looksLikeNetworkBlocked = ['EACCES', 'ECONNREFUSED', 'ETIMEOUT', 'ENETUNREACH'].includes(error?.code)
    || String(error?.message || '').includes('querySrv');
  const isSrvUri = typeof uri === 'string' && uri.startsWith('mongodb+srv://');

  return Boolean(localFallbackEnabled && isSrvUri && looksLikeNetworkBlocked);
}

export async function connectDb(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required');
  if (isDbConnected()) return mongoose.connection;

  if (uri === 'memory' || uri === 'inmemory') {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServerPromise ??= MongoMemoryServer.create({
      instance: {
        dbName: process.env.MONGODB_DB_NAME || 'mini_instagram'
      }
    });
    const memoryServer = await memoryServerPromise;
    uri = memoryServer.getUri();
    usingMemoryDb = true;
    process.env.MONGODB_URI = uri;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    if (uri !== 'memory' && uri !== 'inmemory') usingMemoryDb = false;
  } catch (error) {
    if (!shouldFallbackToMemory(uri, error)) throw error;
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServerPromise ??= MongoMemoryServer.create({
      instance: {
        dbName: process.env.MONGODB_DB_NAME || 'mini_instagram'
      }
    });
    const memoryServer = await memoryServerPromise;
    const memoryUri = memoryServer.getUri();
    usingMemoryDb = true;
    process.env.MONGODB_URI = memoryUri;
    await mongoose.connect(memoryUri, { serverSelectionTimeoutMS: 8000 });
  }
  return mongoose.connection;
}
