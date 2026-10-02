import crypto from 'crypto';

export async function generateUniqueLoginKey(db) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const loginKey = String(crypto.randomInt(100000, 1000000));
    const exists = await db.user.findUnique({ where: { loginKey }, select: { id: true } });
    if (!exists) return loginKey;
  }
  throw new Error('Could not allocate a unique Gym Key. Please try again.');
}
