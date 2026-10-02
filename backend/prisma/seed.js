import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function uniqueKey() {
  for (let i=0;i<60;i+=1) {
    const key=String(crypto.randomInt(100000,1000000));
    const exists=await prisma.user.findUnique({ where:{ loginKey:key }, select:{ id:true } });
    if (!exists) return key;
  }
  throw new Error('Unable to generate a unique Gym Key.');
}

async function adminKey() {
  const configured=String(process.env.ADMIN_LOGIN_KEY || '').trim();
  if (!configured) return uniqueKey();
  if (!/^\d{6}$/.test(configured)) throw new Error('ADMIN_LOGIN_KEY must contain exactly 6 digits.');
  const existing=await prisma.user.findUnique({ where:{ loginKey:configured }, select:{ email:true } });
  if (existing && existing.email.toLowerCase() !== String(process.env.ADMIN_EMAIL || 'admin@gymfit.local').toLowerCase()) throw new Error('ADMIN_LOGIN_KEY is already used by another account.');
  return configured;
}

async function ensureAdmin() {
  const email=String(process.env.ADMIN_EMAIL || 'admin@gymfit.local').toLowerCase();
  const password=String(process.env.ADMIN_PASSWORD || '');
  if (password.length < 8) throw new Error('Set ADMIN_PASSWORD in backend/.env with at least 8 characters.');
  const passwordHash=await bcrypt.hash(password,12);
  const existing=await prisma.user.findUnique({ where:{ email } });
  const loginKey=existing?.loginKey || await adminKey();
  const user=existing
    ? await prisma.user.update({ where:{ id:existing.id }, data:{ name:process.env.ADMIN_NAME || 'GymFit Admin', loginKey, passwordHash, role:'ADMIN', status:'ACTIVE' } })
    : await prisma.user.create({ data:{ name:process.env.ADMIN_NAME || 'GymFit Admin', email, loginKey, passwordHash, role:'ADMIN', status:'ACTIVE' } });
  return { email:user.email, loginKey:user.loginKey };
}

async function upsertPlan(data) {
  return prisma.membershipPlan.upsert({
    where:{ slug:data.slug },
    update:{ name:data.name, kind:data.kind, description:data.description, price:data.price, durationDays:data.durationDays, features:data.features, active:true },
    create:data
  });
}

async function seedPlans() {
  await prisma.membershipPlan.updateMany({ where:{ slug:{ notIn:['personal-coaching','ai-coach'] } }, data:{ active:false } });
  await upsertPlan({ name:'Personal Coaching', slug:'personal-coaching', kind:'PERSONAL', description:'A human trainer manages your daily workout, diet, recovery days and progress reviews.', price:2499, durationDays:30, features:['Dedicated trainer assignment','Daily workout plan','Daily diet plan','Rest and recovery days','Progress analytics','Face check-in attendance'], active:true });
  await upsertPlan({ name:'AI Coach', slug:'ai-coach', kind:'AI', description:'Adaptive workouts, nutrition targets and recovery guidance based on your profile and progress.', price:1499, durationDays:30, features:['Adaptive daily workouts','Personalized nutrition targets','Automatic rest-day planning','Progress and consistency analytics','Workout and diet adherence','Face check-in attendance'], active:true });
}

async function main() {
  const admin=await ensureAdmin();
  await seedPlans();
  console.log('GymFit ready.');
  console.log(`Admin email: ${admin.email}`);
  console.log(`Admin Gym Key: ${admin.loginKey}`);
  console.log('Memberships: Personal Coaching, AI Coach');
}

main().catch(error=>{console.error(error);process.exit(1)}).finally(async()=>prisma.$disconnect());
