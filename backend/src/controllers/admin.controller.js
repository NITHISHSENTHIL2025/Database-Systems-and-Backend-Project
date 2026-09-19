import { prisma } from '../config/prisma.js';

export async function listMemberships(req, res, next) {
  try {
    const rows = await prisma.membership.findMany({ include: { member: { include: { user: true } } }, orderBy: { endDate: 'desc' } });
    res.json(rows.map((row) => ({ id: row.id, member: row.member.user.name, plan: row.plan, amount: row.amount, status: row.status, startDate: row.startDate, endDate: row.endDate })));
  } catch (error) { next(error); }
}

export async function listTrainers(req, res, next) {
  try { res.json(await prisma.trainer.findMany({ orderBy: { name: 'asc' } })); } catch (error) { next(error); }
}

export async function createTrainer(req, res, next) {
  try { res.status(201).json(await prisma.trainer.create({ data: req.body })); } catch (error) { next(error); }
}

export async function listAttendance(req, res, next) {
  try {
    const rows = await prisma.attendance.findMany({ include: { member: { include: { user: true } } }, orderBy: { date: 'desc' } });
    res.json(rows.map((row) => ({ id: row.id, member: row.member.user.name, date: row.date, status: row.status })));
  } catch (error) { next(error); }
}

export async function createAttendance(req, res, next) {
  try {
    const date = new Date(req.body.date);
    const normalized = new Date(date); normalized.setSeconds(0, 0);
    const created = await prisma.attendance.create({ data: { memberId: req.body.memberId, date: normalized, status: req.body.status || 'PRESENT' } });
    res.status(201).json(created);
  } catch (error) { next(error); }
}

export async function listWorkouts(req, res, next) {
  try {
    const rows = await prisma.workout.findMany({ include: { member: { include: { user: true } }, trainer: true }, orderBy: { date: 'desc' } });
    res.json(rows.map((row) => ({ id: row.id, title: row.title, member: row.member.user.name, trainer: row.trainer?.name || 'Unassigned', duration: row.duration, date: row.date })));
  } catch (error) { next(error); }
}

export async function createWorkout(req, res, next) {
  try { res.status(201).json(await prisma.workout.create({ data: req.body })); } catch (error) { next(error); }
}

export async function listEquipment(req, res, next) {
  try { res.json(await prisma.equipment.findMany({ orderBy: { name: 'asc' } })); } catch (error) { next(error); }
}

export async function createEquipment(req, res, next) {
  try { res.status(201).json(await prisma.equipment.create({ data: req.body })); } catch (error) { next(error); }
}

export async function updateEquipment(req, res, next) {
  try { res.json(await prisma.equipment.update({ where: { id: Number(req.params.id) }, data: req.body })); } catch (error) { next(error); }
}

export async function listPayments(req, res, next) {
  try {
    const rows = await prisma.payment.findMany({ include: { member: { include: { user: true } }, membership: true }, orderBy: { paidAt: 'desc' } });
    res.json(rows.map((row) => ({ id: row.id, reference: row.reference, member: row.member.user.name, amount: row.amount, status: row.status, paidAt: row.paidAt })));
  } catch (error) { next(error); }
}
