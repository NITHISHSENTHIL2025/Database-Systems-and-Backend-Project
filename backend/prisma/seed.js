import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('Admin 123', 12);
  const memberPassword = await bcrypt.hash('Member 123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: { name: 'Gym Admin', role: 'ADMIN', passwordHash: adminPassword },
    create: { name: 'Gym Admin', email: 'admin@gmail.com', passwordHash: adminPassword, role: 'ADMIN' }
  });

  const memberUser = await prisma.user.upsert({
    where: { email: 'member@gmail.com' },
    update: { name: 'Arjun Kumar', role: 'MEMBER', passwordHash: memberPassword },
    create: { name: 'Arjun Kumar', email: 'member@gmail.com', passwordHash: memberPassword, role: 'MEMBER' }
  });

  const member = await prisma.member.upsert({
    where: { userId: memberUser.id },
    update: { phone: '+91 98765 43210', goal: 'Strength & endurance' },
    create: { userId: memberUser.id, phone: '+91 98765 43210', goal: 'Strength & endurance' }
  });

  let trainer = await prisma.trainer.findFirst({ where: { name: 'Rahul Menon' } });
  if (trainer) {
    trainer = await prisma.trainer.update({ where: { id: trainer.id }, data: { speciality: 'Strength Training', phone: '+91 90000 12345' } });
  } else {
    trainer = await prisma.trainer.create({ data: { name: 'Rahul Menon', speciality: 'Strength Training', phone: '+91 90000 12345' } });
  }

  let membership = await prisma.membership.findFirst({ where: { memberId: member.id, plan: 'Pro · 3 Months' } });
  if (!membership) {
    membership = await prisma.membership.create({
      data: {
        memberId: member.id,
        plan: 'Pro · 3 Months',
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 86400000),
        status: 'ACTIVE',
        amount: 4500
      }
    });
  }

  const existingPayment = await prisma.payment.findFirst({ where: { membershipId: membership.id } });
  if (!existingPayment) {
    await prisma.payment.create({
      data: {
        memberId: member.id,
        membershipId: membership.id,
        amount: 4500,
        status: 'PAID',
        reference: `PAY-SEED-${membership.id}`,
        paidAt: new Date()
      }
    });
  }

  const attendanceCount = await prisma.attendance.count({ where: { memberId: member.id } });
  if (attendanceCount === 0) {
    for (let i = 0; i < 4; i += 1) {
      const d = new Date();
      d.setHours(9, 0, 0, 0);
      d.setDate(d.getDate() - i * 2);
      await prisma.attendance.create({ data: { memberId: member.id, date: d, status: 'PRESENT' } });
    }
  }

  const workoutCount = await prisma.workout.count({ where: { memberId: member.id } });
  if (workoutCount === 0) {
    await prisma.workout.createMany({
      data: [
        { memberId: member.id, trainerId: trainer.id, title: 'Upper Body Push', notes: 'Bench press + shoulder press', duration: 52 },
        { memberId: member.id, trainerId: trainer.id, title: 'Lower Body Strength', notes: 'Squat + lunges + calves', duration: 48 }
      ]
    });
  }

  const equipment = [
    ['Power Rack', 'Strength', 'AVAILABLE'],
    ['Treadmill T7', 'Cardio', 'AVAILABLE'],
    ['Cable Machine', 'Strength', 'MAINTENANCE'],
    ['Spin Bike S4', 'Cardio', 'AVAILABLE']
  ];
  for (const [name, category, status] of equipment) {
    const existing = await prisma.equipment.findFirst({ where: { name } });
    if (existing) {
      await prisma.equipment.update({ where: { id: existing.id }, data: { category, status } });
    } else {
      await prisma.equipment.create({ data: { name, category, status } });
    }
  }

  console.log(`Seed complete. Admin: ${admin.email} | Member: ${memberUser.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
