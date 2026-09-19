import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { signToken } from '../utils/jwt.js';

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid credentials.' });
  return res.json({ token: signToken(user), user: publicUser(user) });
}

export async function register(req, res, next) {
  try {
    const { name, email, password, phone, goal } = req.body;
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: 'MEMBER',
        member: { create: { phone: phone || null, goal: goal || null } }
      },
      include: { member: true }
    });
    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  res.json({ user: req.user });
}
