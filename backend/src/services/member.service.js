import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/http.js';
import { dateKey, addDaysKey } from '../utils/date.js';
import { writeAudit } from './audit.service.js';
import { generateAIWeek, assertAIActive } from './aiCoach.service.js';
import { publishEvent } from './events.service.js';

async function memberForUser(userId) {
  const member = await prisma.member.findUnique({
    where: { userId },
    include: { user: true }
  });
  if (!member) throw new AppError(404, 'Member profile not found.');
  return member;
}

export async function getMemberId(userId) {
  return (await memberForUser(userId)).id;
}

async function syncMemberships(memberId) {
  const now = new Date();
  await prisma.$transaction([
    prisma.membership.updateMany({ where: { memberId, status: 'ACTIVE', endDate: { lt: now } }, data: { status: 'EXPIRED' } }),
    prisma.membership.updateMany({ where: { memberId, status: 'SCHEDULED', startDate: { lte: now }, endDate: { gt: now } }, data: { status: 'ACTIVE' } })
  ]);

  // A trainer may access a member only while Personal Coaching is actually active.
  const personalActive = await prisma.membership.findFirst({
    where: { memberId, status: 'ACTIVE', startDate: { lte: now }, endDate: { gt: now }, plan: { kind: 'PERSONAL' } },
    select: { id: true }
  });
  if (!personalActive) {
    await prisma.trainerAssignment.updateMany({
      where: { memberId, active: true },
      data: { active: false, endDate: now }
    });
  }
}

export async function activeMembership(memberId) {
  await syncMemberships(memberId);
  const now = new Date();
  return prisma.membership.findFirst({
    where: { memberId, status: 'ACTIVE', startDate: { lte: now }, endDate: { gt: now } },
    include: { plan: true },
    orderBy: { endDate: 'desc' }
  });
}

function workoutDone(plan) {
  if (!plan || plan.dayType !== 'TRAINING') return false;
  if (!plan.exercises?.length) return false;
  return plan.exercises.every(e => e.status === 'COMPLETED');
}

function dietPercent(plans) {
  const meals = plans.flatMap(p => p.meals || []);
  if (!meals.length) return 0;
  const score = meals.reduce((sum, m) => sum + (m.status === 'DONE' ? 1 : m.status === 'PARTIAL' ? 0.5 : 0), 0);
  return Math.round(score / meals.length * 100);
}

function calculateStreak(plans) {
  const map = new Map(plans.map(p => [p.dateKey, p]));
  let key = dateKey();
  let streak = 0;
  for (let i = 0; i < 45; i++) {
    const plan = map.get(key);
    if (plan?.dayType === 'REST') {
      key = addDaysKey(key, -1);
      continue;
    }
    if (!plan) {
      key = addDaysKey(key, -1);
      continue;
    }
    if (workoutDone(plan)) {
      streak += 1;
      key = addDaysKey(key, -1);
      continue;
    }
    if (key === dateKey()) {
      key = addDaysKey(key, -1);
      continue;
    }
    break;
  }
  return streak;
}

export async function dashboard(userId) {
  const member = await memberForUser(userId);
  const membership = await activeMembership(member.id);
  const todayKey = dateKey();
  const start28 = addDaysKey(todayKey, -27);

  const [today, plans, attendance, metricRows, trainerAssignment, notifications] = await Promise.all([
    prisma.dailyPlan.findUnique({
      where: { memberId_dateKey: { memberId: member.id, dateKey: todayKey } },
      include: { exercises: { orderBy: { position: 'asc' } }, meals: { orderBy: { position: 'asc' } }, trainer: true }
    }),
    prisma.dailyPlan.findMany({
      where: { memberId: member.id, dateKey: { gte: start28, lte: todayKey } },
      include: { exercises: true, meals: true },
      orderBy: { dateKey: 'desc' }
    }),
    prisma.attendance.findMany({ where: { memberId: member.id, dayKey: { gte: start28 } }, orderBy: { checkInAt: 'desc' } }),
    prisma.bodyMetric.findMany({ where: { memberId: member.id }, orderBy: { recordedAt: 'desc' }, take: 30 }),
    prisma.trainerAssignment.findFirst({ where: { memberId: member.id, active: true }, include: { trainer: true }, orderBy: { startDate: 'desc' } }),
    prisma.notification.findMany({ where: { userId, readAt: null }, orderBy: { createdAt: 'desc' }, take: 5 })
  ]);

  const trainingPlans = plans.filter(p => p.dayType === 'TRAINING');
  const completed = trainingPlans.filter(workoutDone).length;
  const workoutAdherence = trainingPlans.length ? Math.round(completed / trainingPlans.length * 100) : 0;
  const currentMetric = metricRows[0] || null;
  const oldMetric = metricRows.length > 1 ? metricRows[metricRows.length - 1] : null;
  const checkedToday = attendance.some(a => a.dayKey === todayKey);

  return {
    member: { id: member.id, name: member.user.name, email: member.user.email, phone: member.user.phone, goal: member.goal, joinedAt: member.joinedAt },
    membership: membership ? { id: membership.id, kind: membership.plan.kind, name: membership.plan.name, endDate: membership.endDate, status: membership.status } : null,
    trainer: trainerAssignment?.trainer ? { id: trainerAssignment.trainer.id, name: trainerAssignment.trainer.name, specialty: trainerAssignment.trainer.specialty } : null,
    today,
    todayAttendance: { checkedIn: checkedToday, record: attendance.find(a => a.dayKey === todayKey) || null },
    analytics: {
      streak: calculateStreak(plans),
      visits28: attendance.length,
      workoutAdherence,
      dietAdherence: dietPercent(plans),
      scheduledWorkouts: trainingPlans.length,
      completedWorkouts: completed,
      latestWeight: currentMetric?.weightKg || null,
      weightChange: currentMetric && oldMetric ? Number((currentMetric.weightKg - oldMetric.weightKg).toFixed(1)) : null
    },
    weightSeries: metricRows.slice().reverse().map(m => ({ date: m.recordedAt, value: m.weightKg })),
    notifications
  };
}

export async function today(userId) {
  const member = await memberForUser(userId);
  const membership = await activeMembership(member.id);
  const key = dateKey();

  let [plan, attendanceRow] = await Promise.all([
    prisma.dailyPlan.findUnique({
      where: { memberId_dateKey: { memberId: member.id, dateKey: key } },
      include: { exercises: { orderBy: { position: 'asc' } }, meals: { orderBy: { position: 'asc' } }, trainer: true }
    }),
    prisma.attendance.findUnique({ where: { memberId_dayKey: { memberId: member.id, dayKey: key } } })
  ]);

  if (!plan && membership?.plan.kind === 'AI') {
    const profile = await prisma.aIProfile.findUnique({ where: { memberId: member.id } });
    if (profile) {
      await generateAIWeek(member.id, key);
      plan = await prisma.dailyPlan.findUnique({
        where: { memberId_dateKey: { memberId: member.id, dateKey: key } },
        include: { exercises: { orderBy: { position: 'asc' } }, meals: { orderBy: { position: 'asc' } }, trainer: true }
      });
    }
  }

  return {
    membership: membership ? {
      kind: membership.plan.kind,
      name: membership.plan.name,
      endDate: membership.endDate,
      status: membership.status
    } : null,
    attendance: {
      checkedIn: Boolean(attendanceRow),
      checkInAt: attendanceRow?.checkInAt || null,
      checkOutAt: attendanceRow?.checkOutAt || null
    },
    plan
  };
}

export async function updateExercise(userId, exerciseId, status) {
  const memberId = await getMemberId(userId);
  const key = dateKey();
  const row = await prisma.dailyExercise.findFirst({
    where: { id: exerciseId, dailyPlan: { memberId } },
    include: { dailyPlan: { select: { dateKey: true } } }
  });
  if (!row) throw new AppError(404, 'Exercise not found.');
  if (row.dailyPlan.dateKey !== key) throw new AppError(400, 'Only today\'s workout can be updated.');

  const checkedIn = await prisma.attendance.findUnique({
    where: { memberId_dayKey: { memberId, dayKey: key } },
    select: { id: true }
  });
  if (!checkedIn) throw new AppError(403, 'Check in at the gym before logging today\'s workout.');

  const updated = await prisma.dailyExercise.update({
    where: { id: exerciseId },
    data: { status, completedAt: status === 'COMPLETED' ? new Date() : null }
  });
  publishEvent('member-progress', { memberId });
  return updated;
}

export async function updateMeal(userId, mealId, status) {
  const memberId = await getMemberId(userId);
  const row = await prisma.dailyMeal.findFirst({ where: { id: mealId, dailyPlan: { memberId } } });
  if (!row) throw new AppError(404, 'Meal not found.');
  const updated = await prisma.dailyMeal.update({ where: { id: mealId }, data: { status, completedAt: ['DONE','PARTIAL'].includes(status) ? new Date() : null } });
  publishEvent('member-progress', { memberId });
  return updated;
}

export async function attendance(userId) {
  const memberId = await getMemberId(userId);
  return prisma.attendance.findMany({ where: { memberId }, orderBy: { checkInAt: 'desc' }, take: 180 });
}

export async function profile(userId) {
  const member = await memberForUser(userId);
  const [membership, assignment, aiProfile] = await Promise.all([
    activeMembership(member.id),
    prisma.trainerAssignment.findFirst({ where: { memberId: member.id, active: true }, include: { trainer: true } }),
    prisma.aIProfile.findUnique({ where: { memberId: member.id } })
  ]);

  const age = member.age ?? null;
  const heightCm = member.heightCm ?? null;
  const weightKg = member.weightKg ?? null;
  const fitnessProfileComplete = Boolean(age && heightCm && weightKg && member.bodyType);

  return {
    id: member.id,
    name: member.user.name,
    email: member.user.email,
    loginKey: member.user.loginKey || null,
    phone: member.user.phone,
    goal: member.goal,
    age,
    heightCm,
    weightKg,
    bodyType: member.bodyType,
    fitnessProfileComplete,
    joinedAt: member.joinedAt,
    membership: membership ? { kind: membership.plan.kind, name: membership.plan.name, endDate: membership.endDate } : null,
    trainer: assignment?.trainer || null,
    aiProfile
  };
}

export async function updateProfile(userId, input) {
  const member = await memberForUser(userId);
  const nextWeight = input.weightKg ?? null;
  const weightChanged = nextWeight != null && (member.weightKg == null || Math.abs(member.weightKg - nextWeight) > 0.05);

  const updated = await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: { name: input.name.trim(), phone: input.phone?.trim() || null }
    });
    const row = await tx.member.update({
      where: { id: member.id },
      data: {
        goal: input.goal?.trim() || null,
        age: input.age ?? null,
        heightCm: input.heightCm ?? null,
        weightKg: nextWeight,
        bodyType: input.bodyType ?? null
      },
      include: { user: true }
    });
    if (weightChanged) {
      await tx.bodyMetric.create({
        data: { memberId: member.id, recordedByUserId: userId, source: 'MEMBER', weightKg: nextWeight }
      });
    }


    return row;
  });

  if (weightChanged) publishEvent('member-progress', { memberId: member.id });
  await writeAudit({ actorUserId: userId, action: 'UPDATE_PROFILE', entity: 'Member', entityId: member.id });
  return {
    id: updated.id,
    name: updated.user.name,
    email: updated.user.email,
    phone: updated.user.phone,
    goal: updated.goal,
    age: updated.age,
    heightCm: updated.heightCm,
    weightKg: updated.weightKg,
    bodyType: updated.bodyType,
    fitnessProfileComplete: Boolean(updated.age && updated.heightCm && updated.weightKg && updated.bodyType)
  };
}

export async function membershipHistory(userId) {
  const memberId = await getMemberId(userId);
  return prisma.membership.findMany({ where: { memberId }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
}

export async function payments(userId) {
  const memberId = await getMemberId(userId);
  return prisma.payment.findMany({ where: { memberId }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
}

export async function progress(userId, days = 90) {
  const memberId = await getMemberId(userId);
  const rows = await prisma.bodyMetric.findMany({ where: { memberId }, orderBy: { recordedAt: 'desc' }, take: Math.min(365, Math.max(10, days)) });
  const todayKey = dateKey();
  const start = addDaysKey(todayKey, -Math.min(90, days));
  const [plans, attendanceRows] = await Promise.all([
    prisma.dailyPlan.findMany({ where: { memberId, dateKey: { gte: start } }, include: { exercises: true, meals: true }, orderBy: { dateKey: 'asc' } }),
    prisma.attendance.findMany({ where: { memberId, dayKey: { gte: start } }, orderBy: { dayKey: 'asc' } })
  ]);
  return {
    metrics: rows,
    attendance: attendanceRows,
    consistency: {
      workout: plans.filter(p => p.dayType === 'TRAINING').length ? Math.round(plans.filter(workoutDone).length / plans.filter(p => p.dayType === 'TRAINING').length * 100) : 0,
      diet: dietPercent(plans),
      visits: attendanceRows.length,
      streak: calculateStreak(plans)
    }
  };
}


export async function getAIProfile(userId) {
  const memberId = await getMemberId(userId);
  return prisma.aIProfile.findUnique({ where: { memberId } });
}

export async function saveAIProfile(userId, input) {
  const member = await memberForUser(userId);
  await assertAIActive(member.id);
  if (!member.age || !member.heightCm || !member.weightKg || !member.bodyType) {
    throw new AppError(400, 'Complete age, height, weight and body type in Profile before AI Coach setup.');
  }
  const normalized = { ...input };
  const row = await prisma.aIProfile.upsert({
    where: { memberId: member.id },
    update: normalized,
    create: { memberId: member.id, ...normalized }
  });
  await generateAIWeek(member.id, dateKey());
  await writeAudit({ actorUserId: userId, action: 'AI_ONBOARDING_SAVED', entity: 'AIProfile', entityId: row.id });
  return row;
}

export async function regenerateAI(userId) {
  const memberId = await getMemberId(userId);
  return generateAIWeek(memberId, dateKey());
}

export async function markNotificationRead(userId, id) {
  const row = await prisma.notification.findFirst({ where: { id, userId } });
  if (!row) throw new AppError(404, 'Notification not found.');
  return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
}
