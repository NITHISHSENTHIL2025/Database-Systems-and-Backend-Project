import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';

export async function listMembers(req, res, next) {
  try {
    const members = await prisma.member.findMany({
      include: { user: true, memberships: { orderBy: { endDate: 'desc' }, take: 1 } },
      orderBy: { joinedAt: 'desc' }
    });
    res.json(members.map((member) => ({
      id: member.id,
      name: member.user.name,
      email: member.user.email,
      phone: member.phone,
      goal: member.goal,
      joinedAt: member.joinedAt,
      membership: member.memberships[0] || null
    })));
  } catch (error) { next(error); }
}

export async function createMember(req, res, next) {
  try {
    const { name, email, password, phone, goal, plan, amount } = req.body;
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ message: 'Email is already registered.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: 'MEMBER',
        member: {
          create: {
            phone: phone || null,
            goal: goal || null,
            memberships: plan ? { create: { plan, amount: amount ?? null, startDate: new Date(), endDate: new Date(Date.now() + 30 * 86400000), status: 'ACTIVE' } } : undefined
          }
        }
      },
      include: { member: true }
    });
    res.status(201).json({ id: user.member.id, name: user.name, email: user.email, role: user.role });
  } catch (error) { next(error); }
}
