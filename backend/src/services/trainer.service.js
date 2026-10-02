import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/http.js';
import { dateKey, addDaysKey } from '../utils/date.js';
import { writeAudit } from './audit.service.js';
import { publishEvent } from './events.service.js';

async function trainerForUser(userId) {
  const trainer = await prisma.trainer.findUnique({
    where: { userId },
    include: { user: true }
  });
  if (!trainer || !trainer.active) throw new AppError(404, 'Trainer profile is not linked to this account.');
  return trainer;
}

async function assertClient(trainerId, memberId) {
  const assignment = await prisma.trainerAssignment.findFirst({
    where: { trainerId, memberId, active: true },
    include: { member: { include: { user: true } } }
  });
  if (!assignment) throw new AppError(403, 'This member is not assigned to you.');
  const now = new Date();
  const personal = await prisma.membership.findFirst({
    where: { memberId, status: 'ACTIVE', startDate: { lte: now }, endDate: { gt: now }, plan: { kind: 'PERSONAL' } },
    select: { id: true }
  });
  if (!personal) {
    await prisma.trainerAssignment.updateMany({ where: { memberId, active: true }, data: { active: false, endDate: now } });
    throw new AppError(403, 'Personal Coaching is not active for this member.');
  }
  return assignment;
}

function completion(plan) {
  if (!plan || plan.dayType !== 'TRAINING' || !plan.exercises.length) return 0;
  return Math.round(plan.exercises.filter(e => e.status === 'COMPLETED').length / plan.exercises.length * 100);
}

export async function dashboard(userId) {
  const trainer = await trainerForUser(userId);
  const todayKey = dateKey();
  const assignments = await prisma.trainerAssignment.findMany({
    where: { trainerId: trainer.id, active: true },
    include: {
      member: {
        include: {
          user: true,
          memberships: { where: { status: 'ACTIVE', startDate: { lte: new Date() }, endDate: { gt: new Date() }, plan: { kind: 'PERSONAL' } }, select: { id: true }, take: 1 },
          dailyPlans: { where: { dateKey: todayKey }, include: { exercises: true, meals: true } },
          bodyMetrics: { orderBy: { recordedAt: 'desc' }, take: 1 }
        }
      }
    },
    orderBy: { startDate: 'desc' }
  });
  const validAssignments = assignments.filter(a => a.member.memberships.length > 0 && a.member.user.status === 'ACTIVE');
  const clients = validAssignments.map(a => {
    const plan = a.member.dailyPlans[0] || null;
    return {
      id: a.member.id,
      name: a.member.user.name,
      goal: a.member.goal,
      phone: a.member.user.phone,
      todayPlan: plan ? { title: plan.title, dayType: plan.dayType, completion: completion(plan) } : null,
      weight: a.member.bodyMetrics[0]?.weightKg || null
    };
  });
  return {
    trainer: { id: trainer.id, name: trainer.name, specialty: trainer.specialty, capacity: trainer.capacity },
    metrics: {
      activeClients: clients.length,
      capacity: trainer.capacity,
      plansToday: clients.filter(c => c.todayPlan).length,
      needsPlan: clients.filter(c => !c.todayPlan).length
    },
    clients
  };
}

export async function clients(userId) {
  const trainer = await trainerForUser(userId);
  const rows = await prisma.trainerAssignment.findMany({
    where: { trainerId: trainer.id, active: true },
    include: {
      member: {
        include: {
          user: true,
          memberships: { where: { status: 'ACTIVE', startDate: { lte: new Date() }, endDate: { gt: new Date() }, plan: { kind: 'PERSONAL' } }, include: { plan: true }, take: 1, orderBy: { endDate: 'desc' } },
          bodyMetrics: { take: 1, orderBy: { recordedAt: 'desc' } }
        }
      }
    },
    orderBy: { startDate: 'desc' }
  });
  return rows.filter(a => a.member.memberships.length > 0 && a.member.user.status === 'ACTIVE').map(a => ({
    id: a.member.id,
    name: a.member.user.name,
    email: a.member.user.email,
    phone: a.member.user.phone,
    goal: a.member.goal,
    membership: a.member.memberships[0]?.plan?.name || null,
    weight: a.member.bodyMetrics[0]?.weightKg || null,
    assignedAt: a.startDate
  }));
}

export async function clientDetail(userId, memberId) {
  const trainer = await trainerForUser(userId);
  const assignment = await assertClient(trainer.id, memberId);
  const start = addDaysKey(dateKey(), -28);
  const [membership, metrics, plans, attendance] = await Promise.all([
    prisma.membership.findFirst({ where: { memberId, status: 'ACTIVE' }, include: { plan: true }, orderBy: { endDate: 'desc' } }),
    prisma.bodyMetric.findMany({ where: { memberId }, orderBy: { recordedAt: 'desc' }, take: 30 }),
    prisma.dailyPlan.findMany({ where: { memberId, dateKey: { gte: start } }, include: { exercises: { orderBy: { position: 'asc' } }, meals: { orderBy: { position: 'asc' } } }, orderBy: { dateKey: 'desc' } }),
    prisma.attendance.findMany({ where: { memberId, dayKey: { gte: start } }, orderBy: { dayKey: 'desc' } })
  ]);
  return {
    member: { id: memberId, name: assignment.member.user.name, email: assignment.member.user.email, phone: assignment.member.user.phone, goal: assignment.member.goal },
    membership: membership ? { name: membership.plan.name, kind: membership.plan.kind, endDate: membership.endDate } : null,
    metrics,
    plans,
    attendance
  };
}

export async function saveDailyPlan(userId, memberId, input) {
  const trainer = await trainerForUser(userId);
  await assertClient(trainer.id, memberId);
  const membership = await prisma.membership.findFirst({
    where: { memberId, status: 'ACTIVE', startDate: { lte: new Date() }, endDate: { gt: new Date() }, plan: { kind: 'PERSONAL' } },
    include: { plan: true },
    orderBy: { endDate: 'desc' }
  });
  if (!membership) throw new AppError(409, 'This member does not have an active Personal Coaching membership.');

  const base = {
    memberId,
    trainerId: trainer.id,
    dateKey: input.dateKey,
    source: 'TRAINER',
    dayType: input.dayType,
    title: input.title,
    notes: input.notes || null,
    generatedReason: 'Assigned by personal trainer.',
    calorieTarget: input.calorieTarget || null,
    proteinTarget: input.proteinTarget || null,
    carbsTarget: input.carbsTarget || null,
    fatTarget: input.fatTarget || null,
    waterMlTarget: input.waterMlTarget || null,
    stepsTarget: input.stepsTarget || null
  };
  const exercises = input.dayType === 'REST' ? [] : (input.exercises || []).map((e, i) => ({
    exerciseName: e.exerciseName,
    muscleGroup: e.muscleGroup || null,
    sets: e.sets,
    reps: e.reps,
    targetWeightKg: e.targetWeightKg || null,
    restSeconds: e.restSeconds || null,
    notes: e.notes || null,
    position: i
  }));
  const meals = (input.meals || []).map((m, i) => ({
    name: m.name,
    timeLabel: m.timeLabel || null,
    items: m.items,
    calories: m.calories || null,
    protein: m.protein || null,
    carbs: m.carbs || null,
    fat: m.fat || null,
    position: i
  }));

  const existing = await prisma.dailyPlan.findUnique({ where: { memberId_dateKey: { memberId, dateKey: input.dateKey } } });
  let row;
  if (existing) {
    row = await prisma.dailyPlan.update({
      where: { id: existing.id },
      data: { ...base, exercises: { deleteMany: {}, create: exercises }, meals: { deleteMany: {}, create: meals } },
      include: { exercises: true, meals: true }
    });
  } else {
    row = await prisma.dailyPlan.create({
      data: { ...base, exercises: { create: exercises }, meals: { create: meals } },
      include: { exercises: true, meals: true }
    });
  }
  await prisma.notification.create({
    data: { userId: assignmentUserId(await assertClient(trainer.id, memberId)), type: 'PLAN', title: 'Your daily plan was updated', body: `${trainer.name} updated ${input.dateKey}: ${input.title}.` }
  });
  await writeAudit({ actorUserId: userId, action: 'TRAINER_DAILY_PLAN', entity: 'DailyPlan', entityId: row.id, metadata: { memberId, dateKey: input.dateKey } });
  publishEvent('plan-updated', { memberId, trainerId: trainer.id, dateKey: input.dateKey });
  return row;
}

function assignmentUserId(assignment) {
  return assignment.member.userId;
}


export async function profile(userId) {
  const trainer = await trainerForUser(userId);
  const activeClients = await prisma.trainerAssignment.count({ where: { trainerId: trainer.id, active: true } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { loginKey: true } });
  return { id: trainer.id, name: trainer.name, email: trainer.email, phone: trainer.phone, specialty: trainer.specialty, bio: trainer.bio, capacity: trainer.capacity, loginKey: user?.loginKey || null, activeClients };
}
