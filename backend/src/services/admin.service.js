import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/http.js';
import { dateKey, addDaysKey } from '../utils/date.js';
import { writeAudit } from './audit.service.js';
import { publishEvent } from './events.service.js';
import { generateUniqueLoginKey } from '../utils/loginKey.js';

async function syncAllMemberships() {
  const now = new Date();
  await prisma.$transaction([
    prisma.membership.updateMany({ where: { status: 'ACTIVE', endDate: { lt: now } }, data: { status: 'EXPIRED' } }),
    prisma.membership.updateMany({ where: { status: 'SCHEDULED', startDate: { lte: now }, endDate: { gt: now } }, data: { status: 'ACTIVE' } })
  ]);

  const activeAssignments = await prisma.trainerAssignment.findMany({
    where: { active: true },
    include: {
      member: {
        include: {
          memberships: {
            where: { status: 'ACTIVE', startDate: { lte: now }, endDate: { gt: now }, plan: { kind: 'PERSONAL' } },
            select: { id: true }, take: 1
          }
        }
      }
    }
  });
  const staleIds = activeAssignments.filter(a => a.member.memberships.length === 0).map(a => a.id);
  if (staleIds.length) {
    await prisma.trainerAssignment.updateMany({ where: { id: { in: staleIds } }, data: { active: false, endDate: now } });
  }
}

async function activeMembership(memberId) {
  const now = new Date();
  return prisma.membership.findFirst({
    where: { memberId, status: 'ACTIVE', startDate: { lte: now }, endDate: { gt: now } },
    include: { plan: true },
    orderBy: { endDate: 'desc' }
  });
}

async function createAttendance(actorUserId, member, source) {
  const membership = await activeMembership(member.id);
  if (!membership) throw new AppError(409, 'Member does not have an active membership.');
  if (member.user.status !== 'ACTIVE') throw new AppError(409, 'Member account is disabled.');
  const today = dateKey();
  const existing = await prisma.attendance.findUnique({ where: { memberId_dayKey: { memberId: member.id, dayKey: today } } });
  if (existing) {
    return { alreadyCheckedIn: true, attendance: existing, member: { id: member.id, name: member.user.name, loginKey: member.user.loginKey }, membership: membership.plan.name };
  }
  const attendance = await prisma.attendance.create({ data: { memberId: member.id, dayKey: today, source } });
  await writeAudit({ actorUserId, action: `${source}_CHECK_IN`, entity: 'Attendance', entityId: attendance.id, metadata: { memberId: member.id } });
  publishEvent('attendance-updated', { memberId: member.id, dayKey: today, checkInAt: attendance.checkInAt });
  return { alreadyCheckedIn: false, attendance, member: { id: member.id, name: member.user.name, loginKey: member.user.loginKey }, membership: membership.plan.name };
}

export async function dashboard() {
  await syncAllMemberships();
  const today = dateKey();
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthStartDate = new Date(`${monthStart}T00:00:00Z`);
  const [members, activeMemberships, personal, ai, todayAttendance, revenue, trainers, recentPayments, attendance30] = await Promise.all([
    prisma.member.count(),
    prisma.membership.count({ where: { status: 'ACTIVE' } }),
    prisma.membership.count({ where: { status: 'ACTIVE', plan: { kind: 'PERSONAL' } } }),
    prisma.membership.count({ where: { status: 'ACTIVE', plan: { kind: 'AI' } } }),
    prisma.attendance.count({ where: { dayKey: today } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID', paidAt: { gte: monthStartDate } } }),
    prisma.trainer.count({ where: { active: true } }),
    prisma.payment.findMany({ include: { member: { include: { user: true } }, plan: true }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.attendance.findMany({ where: { dayKey: { gte: addDaysKey(today, -29) } }, select: { dayKey: true } })
  ]);
  const byDay = {};
  attendance30.forEach(a => { byDay[a.dayKey] = (byDay[a.dayKey] || 0) + 1; });
  const attendanceSeries = Array.from({ length: 30 }, (_, i) => {
    const key = addDaysKey(today, i - 29);
    return { date: key, value: byDay[key] || 0 };
  });
  return {
    metrics: { members, activeMemberships, personal, ai, todayAttendance, revenueThisMonth: Number(revenue._sum.amount || 0), trainers },
    attendanceSeries,
    recentPayments: recentPayments.map(p => ({ id: p.id, member: p.member.user.name, plan: p.plan.name, amount: Number(p.amount), status: p.status, createdAt: p.createdAt }))
  };
}

export async function listMembers(search = '') {
  await syncAllMemberships();
  const rows = await prisma.member.findMany({
    where: search ? { OR: [
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { phone: { contains: search } } },
      { user: { loginKey: { contains: search } } }
    ] } : undefined,
    include: {
      user: true,
      faceProfile: { select: { id: true, enrolledAt: true, updatedAt: true } },
      memberships: { where: { status: { in: ['ACTIVE','SCHEDULED'] } }, include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 5 },
      trainerAssignments: { where: { active: true }, include: { trainer: true }, take: 1 },
      bodyMetrics: { orderBy: { recordedAt: 'desc' }, take: 1 }
    },
    orderBy: { joinedAt: 'desc' }
  });
  return rows.map(m => {
    const current = m.memberships.find(x => x.status === 'ACTIVE') || m.memberships.find(x => x.status === 'SCHEDULED') || null;
    const next = m.memberships.find(x => x.status === 'SCHEDULED') || null;
    return {
      id: m.id, userId: m.userId, name: m.user.name, email: m.user.email, loginKey: m.user.loginKey, phone: m.user.phone,
      goal: m.goal, userStatus: m.user.status, joinedAt: m.joinedAt, faceEnrolled: Boolean(m.faceProfile), faceEnrolledAt: m.faceProfile?.enrolledAt || null,
      membership: current ? { id: current.id, name: current.plan.name, kind: current.plan.kind, status: current.status, endDate: current.endDate } : null,
      nextMembership: next && next.id !== current?.id ? { id: next.id, name: next.plan.name, kind: next.plan.kind, status: next.status, startDate: next.startDate } : null,
      trainer: m.trainerAssignments[0]?.trainer ? { id: m.trainerAssignments[0].trainer.id, name: m.trainerAssignments[0].trainer.name } : null,
      weight: m.weightKg || m.bodyMetrics[0]?.weightKg || null
    };
  });
}

export async function updateMember(actorUserId, memberId, input) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new AppError(404, 'Member not found.');
  const updated = await prisma.$transaction(async tx => {
    if (input.name !== undefined || input.phone !== undefined || input.userStatus !== undefined) {
      await tx.user.update({
        where: { id: member.userId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
          ...(input.userStatus !== undefined ? { status: input.userStatus } : {})
        }
      });
    }
    return tx.member.update({
      where: { id: memberId },
      data: input.goal !== undefined ? { goal: input.goal?.trim() || null } : {},
      include: { user: true }
    });
  });
  await writeAudit({ actorUserId, action: 'UPDATE_MEMBER', entity: 'Member', entityId: memberId, metadata: input });
  return { id: updated.id, name: updated.user.name, email: updated.user.email, phone: updated.user.phone, goal: updated.goal, userStatus: updated.user.status };
}

export async function listMemberships() {
  await syncAllMemberships();
  return prisma.membership.findMany({ include: { member: { include: { user: true } }, plan: true, payment: true }, orderBy: { createdAt: 'desc' }, take: 300 });
}

export async function updateMembership(actorUserId, id, status) {
  const existing = await prisma.membership.findUnique({ where: { id }, include: { plan: true } });
  if (!existing) throw new AppError(404, 'Membership not found.');
  if (status === 'ACTIVE') {
    const conflict = await prisma.membership.findFirst({ where: { memberId: existing.memberId, id: { not: id }, status: 'ACTIVE' }, select: { id: true } });
    if (conflict) throw new AppError(409, 'This member already has another active membership.');
  }
  const row = await prisma.membership.update({ where: { id }, data: { status }, include: { member: true, plan: true } });
  if (row.plan.kind === 'PERSONAL' && status !== 'ACTIVE') {
    const otherPersonal = await prisma.membership.findFirst({ where: { memberId: row.memberId, id: { not: row.id }, status: 'ACTIVE', startDate: { lte: new Date() }, endDate: { gt: new Date() }, plan: { kind: 'PERSONAL' } }, select: { id: true } });
    if (!otherPersonal) await prisma.trainerAssignment.updateMany({ where: { memberId: row.memberId, active: true }, data: { active: false, endDate: new Date() } });
  }
  await writeAudit({ actorUserId, action: 'UPDATE_MEMBERSHIP', entity: 'Membership', entityId: id, metadata: { status } });
  publishEvent('membership-updated', { memberId: row.memberId, status });
  return row;
}

export async function listPlans() {
  return prisma.membershipPlan.findMany({ where: { slug: { in: ['personal-coaching','ai-coach'] } }, orderBy: { kind: 'asc' } });
}

export async function updatePlan(actorUserId, id, input) {
  const row = await prisma.membershipPlan.findUnique({ where: { id } });
  if (!row || !['personal-coaching','ai-coach'].includes(row.slug)) throw new AppError(404, 'Core membership plan not found.');
  const updated = await prisma.membershipPlan.update({ where: { id }, data: input });
  await writeAudit({ actorUserId, action: 'UPDATE_PLAN', entity: 'MembershipPlan', entityId: id, metadata: input });
  return updated;
}

export async function listTrainers() {
  await syncAllMemberships();
  const rows = await prisma.trainer.findMany({
    include: { user: true, trainerAssignments: { where: { active: true }, select: { id: true } } },
    orderBy: { name: 'asc' }
  });
  return rows.map(t => ({ id: t.id, userId: t.userId, name: t.name, email: t.email, phone: t.phone, specialty: t.specialty, bio: t.bio, capacity: t.capacity, active: t.active, portalLinked: Boolean(t.userId), loginKey: t.user?.loginKey || null, activeClients: t.trainerAssignments.length }));
}

export async function createTrainer(actorUserId, input) {
  const email = input.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new AppError(409, 'A user with this email already exists.');
  const existingTrainer = await prisma.trainer.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(input.password, 12);
  const loginKey = await generateUniqueLoginKey(prisma);
  const result = await prisma.$transaction(async tx => {
    const user = await tx.user.create({ data: { name: input.name, email, loginKey, phone: input.phone || null, passwordHash, role: 'TRAINER', status: 'ACTIVE' } });
    const trainer = existingTrainer
      ? await tx.trainer.update({ where: { id: existingTrainer.id }, data: { userId: user.id, name: input.name, phone: input.phone || null, specialty: input.specialty, bio: input.bio || null, capacity: input.capacity || 20, active: true } })
      : await tx.trainer.create({ data: { userId: user.id, name: input.name, email, phone: input.phone || null, specialty: input.specialty, bio: input.bio || null, capacity: input.capacity || 20, active: true } });
    return { user, trainer };
  });
  await writeAudit({ actorUserId, action: 'CREATE_TRAINER_LOGIN', entity: 'Trainer', entityId: result.trainer.id });
  return { id: result.trainer.id, name: result.trainer.name, email, loginKey, portalLinked: true };
}

export async function updateTrainer(actorUserId, id, input) {
  const trainer = await prisma.trainer.findUnique({ where: { id } });
  if (!trainer) throw new AppError(404, 'Trainer not found.');
  const updated = await prisma.trainer.update({ where: { id }, data: input });
  if (trainer.userId) {
    await prisma.user.update({ where: { id: trainer.userId }, data: { ...(input.name ? { name: input.name } : {}), ...(input.phone !== undefined ? { phone: input.phone || null } : {}), ...(input.active !== undefined ? { status: input.active ? 'ACTIVE' : 'DISABLED' } : {}) } });
  }
  await writeAudit({ actorUserId, action: 'UPDATE_TRAINER', entity: 'Trainer', entityId: id, metadata: input });
  return updated;
}

export async function assignTrainer(actorUserId, memberId, trainerId) {
  await syncAllMemberships();
  const now = new Date();
  const [member, trainer, membership, currentAssignment] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId }, include: { user: true } }),
    prisma.trainer.findUnique({ where: { id: trainerId }, include: { trainerAssignments: { where: { active: true } } } }),
    prisma.membership.findFirst({ where: { memberId, status: 'ACTIVE', startDate: { lte: now }, endDate: { gt: now }, plan: { kind: 'PERSONAL' } }, include: { plan: true } }),
    prisma.trainerAssignment.findFirst({ where: { memberId, active: true } })
  ]);
  if (!member || !trainer) throw new AppError(404, 'Member or trainer not found.');
  if (member.user.status !== 'ACTIVE') throw new AppError(409, 'Member account is disabled.');
  if (!membership) throw new AppError(409, 'Trainer assignment requires an active Personal Coaching membership.');
  if (!trainer.active || !trainer.userId) throw new AppError(409, 'Trainer must have an active trainer portal account.');
  const usesNewSlot = !currentAssignment || currentAssignment.trainerId !== trainerId;
  if (usesNewSlot && trainer.trainerAssignments.length >= trainer.capacity) throw new AppError(409, 'Trainer has reached the configured client capacity.');
  if (currentAssignment?.trainerId === trainerId) return currentAssignment;
  const result = await prisma.$transaction(async tx => {
    await tx.trainerAssignment.updateMany({ where: { memberId, active: true }, data: { active: false, endDate: new Date() } });
    const assignment = await tx.trainerAssignment.create({ data: { memberId, trainerId, active: true } });
    await tx.notification.create({ data: { userId: member.userId, type: 'TRAINER', title: 'Your trainer is assigned', body: `${trainer.name} is now your Personal Coaching trainer.` } });
    return assignment;
  });
  await writeAudit({ actorUserId, action: 'ASSIGN_TRAINER', entity: 'TrainerAssignment', entityId: result.id, metadata: { memberId, trainerId } });
  publishEvent('trainer-assigned', { memberId, trainerId });
  return result;
}

function validDescriptor(value) {
  return Array.isArray(value) && value.length === 128 && value.every(n => Number.isFinite(Number(n)) && Math.abs(Number(n)) <= 5);
}
function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < 128; i += 1) {
    const diff = Number(a[i]) - Number(b[i]);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export async function enrollFace(actorUserId, memberId, descriptors, consent) {
  if (consent !== true) throw new AppError(400, 'Member consent is required for face enrollment.');
  if (!Array.isArray(descriptors) || descriptors.length < 2 || descriptors.length > 5 || !descriptors.every(validDescriptor)) {
    throw new AppError(400, 'Face enrollment requires 2 to 5 valid face samples.');
  }
  const member = await prisma.member.findUnique({ where: { id: memberId }, include: { user: true } });
  if (!member) throw new AppError(404, 'Member not found.');
  const row = await prisma.faceProfile.upsert({
    where: { memberId },
    update: { descriptors, samples: descriptors.length, consentAt: new Date(), enrolledAt: new Date() },
    create: { memberId, descriptors, samples: descriptors.length, consentAt: new Date() }
  });
  await writeAudit({ actorUserId, action: 'FACE_ENROLLED', entity: 'FaceProfile', entityId: row.id, metadata: { memberId, samples: descriptors.length } });
  return { ok: true, member: { id: member.id, name: member.user.name, loginKey: member.user.loginKey }, samples: row.samples, enrolledAt: row.enrolledAt };
}

export async function faceCheckIn(actorUserId, descriptor) {
  if (!validDescriptor(descriptor)) throw new AppError(400, 'Invalid face descriptor.');
  const profiles = await prisma.faceProfile.findMany({
    include: { member: { include: { user: true } } }
  });
  const activeProfiles = profiles.filter(p => p.member.user.status === 'ACTIVE');
  if (!activeProfiles.length) throw new AppError(404, 'No member faces are enrolled yet.');

  const scored = activeProfiles.map(profile => {
    const samples = Array.isArray(profile.descriptors) ? profile.descriptors : [];
    const best = samples.filter(validDescriptor).reduce((min, sample) => Math.min(min, distance(descriptor, sample)), Infinity);
    return { profile, distance: best };
  }).filter(x => Number.isFinite(x.distance)).sort((a, b) => a.distance - b.distance);

  const best = scored[0];
  const second = scored[1];
  if (!best || best.distance > env.faceMatchThreshold) {
    throw new AppError(404, 'Face not recognized. Use Gym Key fallback or enroll the member again.');
  }
  if (second && second.distance - best.distance < env.faceAmbiguityGap) {
    throw new AppError(409, 'Face match is ambiguous. Use Gym Key fallback for this check-in.');
  }

  const result = await createAttendance(actorUserId, best.profile.member, 'FACE');
  return { ...result, match: { distance: Number(best.distance.toFixed(4)), threshold: env.faceMatchThreshold } };
}

export async function keyCheckIn(actorUserId, loginKey) {
  const user = await prisma.user.findUnique({ where: { loginKey: String(loginKey) }, include: { member: true } });
  if (!user?.member || user.role !== 'MEMBER') throw new AppError(404, 'Member Gym Key not found.');
  const member = await prisma.member.findUnique({ where: { id: user.member.id }, include: { user: true } });
  return createAttendance(actorUserId, member, 'GYM_KEY');
}

export async function todayAttendance() {
  const today = dateKey();
  return prisma.attendance.findMany({ where: { dayKey: today }, include: { member: { include: { user: true } } }, orderBy: { checkInAt: 'desc' } });
}

export async function listPayments() {
  return prisma.payment.findMany({ include: { member: { include: { user: true } }, plan: true }, orderBy: { createdAt: 'desc' }, take: 500 });
}
