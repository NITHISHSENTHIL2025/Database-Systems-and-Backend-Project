import { prisma } from '../config/prisma.js';

export async function overview(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') {
      const [members, activeMemberships, todayAttendance, pendingPayments, equipmentMaintenance] = await Promise.all([
        prisma.member.count(),
        prisma.membership.count({ where: { status: 'ACTIVE' } }),
        prisma.attendance.count({ where: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, status: 'PRESENT' } }),
        prisma.payment.count({ where: { status: 'PENDING' } }),
        prisma.equipment.count({ where: { status: 'MAINTENANCE' } })
      ]);
      return res.json({ role: 'ADMIN', metrics: { members, activeMemberships, todayAttendance, pendingPayments, equipmentMaintenance } });
    }

    const member = await prisma.member.findUnique({ where: { userId: req.user.id }, include: { memberships: { orderBy: { endDate: 'desc' }, take: 1 } } });
    const [attendance, workouts, payments] = await Promise.all([
      prisma.attendance.count({ where: { memberId: member?.id || -1, status: 'PRESENT' } }),
      prisma.workout.count({ where: { memberId: member?.id || -1 } }),
      prisma.payment.count({ where: { memberId: member?.id || -1 } })
    ]);
    res.json({ role: 'MEMBER', metrics: { attendance, workouts, payments }, membership: member?.memberships?.[0] || null });
  } catch (error) {
    next(error);
  }
}
