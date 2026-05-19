import { User } from '../src/models/User.js';

describe('User model', () => {
  test('rejects invalid email', async () => {
    await expect(User.create({ username: 'bademail', email: 'nope', password: 'secret123' })).rejects.toThrow();
  });

  test('hashes password before save', async () => {
    const user = await User.create({ username: 'hashme', email: 'hash@example.com', password: 'secret123' });
    expect(user.password).not.toBe('secret123');
    await expect(user.comparePassword('secret123')).resolves.toBe(true);
  });
});
