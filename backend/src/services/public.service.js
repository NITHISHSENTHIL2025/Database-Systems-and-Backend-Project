import { prisma } from '../config/prisma.js';

export async function getHome() {
  const plans = await prisma.membershipPlan.findMany({
    where: { active: true, slug: { in: ['personal-coaching','ai-coach'] } },
    orderBy: { price: 'asc' }
  });
  return {
    plans: plans.map(p => ({ id: p.id, name: p.name, slug: p.slug, kind: p.kind, description: p.description, price: Number(p.price), durationDays: p.durationDays, features: p.features || [] }))
  };
}
