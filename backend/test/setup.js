import mongoose from 'mongoose';
import { clearMemoryStories } from '../src/controllers/storyController.js';
import { clearLocalStore } from '../src/utils/localStore.js';
import { clearLocalNotifications } from '../src/utils/notifications.js';

process.env.JWT_SECRET = 'test-secret';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URL);
});

afterEach(async () => {
  clearLocalStore();
  clearMemoryStories();
  clearLocalNotifications();
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
