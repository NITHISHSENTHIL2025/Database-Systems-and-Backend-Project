import { prisma } from '../config/prisma.js';

async function getMemberId(userId) {
  const member = await prisma.member.findUnique({ where: { userId } });
  return member?.id;
}

export async function myMembership(req, res, next) {
  try { const memberId = await getMemberId(req.user.id); res.json(await prisma.membership.findMany({ where: { memberId }, orderBy: { endDate: 'desc' } })); } catch (error) { next(error); }
}
export async function myAttendance(req, res, next) {
  try { const memberId = await getMemberId(req.user.id); res.json(await prisma.attendance.findMany({ where: { memberId }, orderBy: { date: 'desc' } })); } catch (error) { next(error); }
}
export async function myWorkouts(req, res, next) {
  try { const memberId = await getMemberId(req.user.id); res.json(await prisma.workout.findMany({ where: { memberId }, include: { trainer: true }, orderBy: { date: 'desc' } })); } catch (error) { next(error); }
}
export async function myPayments(req, res, next) {
  try { const memberId = await getMemberId(req.user.id); res.json(await prisma.payment.findMany({ where: { memberId }, include: { membership: true }, orderBy: { paidAt: 'desc' } })); } catch (error) { next(error); }
}
