import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/http.js';
import { writeAudit } from './audit.service.js';
import { generateUniqueLoginKey } from '../utils/loginKey.js';

const DAY = 24 * 60 * 60 * 1000;
const hashDeviceToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');

export function publicUser(user) {
  return { id:user.id, name:user.name, email:user.email, phone:user.phone, role:user.role, loginKey:user.loginKey || null };
}

export async function registerMember(input) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'An account with this email already exists.');
  const passwordHash = await bcrypt.hash(input.password, 12);
  const loginKey = await generateUniqueLoginKey(prisma);
  const user = await prisma.user.create({
    data: { name:input.name.trim(), email, loginKey, phone:input.phone?.trim() || null, passwordHash, role:'MEMBER', member:{ create:{ goal:input.goal?.trim() || null } } }
  });
  await writeAudit({ actorUserId:user.id, action:'REGISTER', entity:'User', entityId:user.id });
  return user;
}

export async function loginByKey(loginKey, password) {
  const key = String(loginKey || '').trim();
  const user = await prisma.user.findUnique({ where: { loginKey:key } });
  if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'Invalid Gym Key or password.');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError(401, 'Invalid Gym Key or password.');
  await writeAudit({ actorUserId:user.id, action:'LOGIN', entity:'User', entityId:user.id, metadata:{ method:'GYM_KEY_PASSWORD' } });
  return user;
}

export async function createTrustedDevice(userId) {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashDeviceToken(rawToken);
  await prisma.trustedDevice.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await prisma.trustedDevice.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + env.trustedDeviceDays * DAY) }
  });
  return rawToken;
}

export async function quickLoginByKey(loginKey, rawDeviceToken) {
  if (!rawDeviceToken) return null;
  const key = String(loginKey || '').trim();
  const user = await prisma.user.findUnique({ where: { loginKey:key } });
  if (!user || user.status !== 'ACTIVE') return null;
  const tokenHash = hashDeviceToken(rawDeviceToken);
  const device = await prisma.trustedDevice.findFirst({ where: { userId:user.id, tokenHash, expiresAt:{ gt:new Date() } } });
  if (!device) return null;
  await prisma.trustedDevice.update({
    where: { id:device.id },
    data: { lastUsedAt:new Date(), expiresAt:new Date(Date.now() + env.trustedDeviceDays * DAY) }
  });
  await writeAudit({ actorUserId:user.id, action:'LOGIN', entity:'User', entityId:user.id, metadata:{ method:'TRUSTED_DEVICE' } });
  return user;
}

export async function changeOwnPassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id:userId } });
  if (!user || user.status !== 'ACTIVE') throw new AppError(404, 'Active user not found.');
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new AppError(400, 'Current password is incorrect.');
  const same = await bcrypt.compare(newPassword, user.passwordHash);
  if (same) throw new AppError(400, 'New password must be different from the current password.');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where:{ id:userId }, data:{ passwordHash } }),
    prisma.trustedDevice.deleteMany({ where:{ userId } })
  ]);
  await writeAudit({ actorUserId:userId, action:'CHANGE_PASSWORD', entity:'User', entityId:userId });
  return { ok:true };
}

function otpHash(userId, purpose, otp) {
  return crypto.createHmac('sha256', env.jwtSecret).update(`${userId}:${purpose}:${otp}`).digest('hex');
}

async function sendRecoveryEmail(user, otp, purpose) {
  if (!env.brevoApiKey || !env.emailFrom) throw new AppError(503, 'Email recovery is temporarily unavailable.');
  const label = purpose === 'GYM_KEY' ? 'Gym Key recovery' : 'password reset';
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:'POST',
    headers:{ 'Accept':'application/json', 'Content-Type':'application/json', 'api-key':env.brevoApiKey },
    body:JSON.stringify({
      sender:{ email:env.emailFrom, name:env.emailFromName },
      to:[{ email:user.email, name:user.name }],
      subject:`GymFit ${label} code`,
      htmlContent:`<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>GymFit</h2><p>Your ${label} code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${otp}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`
    })
  });
  if (!response.ok) throw new AppError(502, 'We could not send the recovery email. Please try again.');
}

export async function requestRecovery(emailInput, purpose) {
  const email = emailInput.toLowerCase();
  const user = await prisma.user.findUnique({ where:{ email } });
  if (!user || user.status !== 'ACTIVE') return { ok:true, message:'If that email belongs to an active account, an OTP has been sent.' };
  const otp = String(crypto.randomInt(100000, 1000000));
  await sendRecoveryEmail(user, otp, purpose);
  await prisma.recoveryCode.create({ data:{ userId:user.id, purpose, codeHash:otpHash(user.id,purpose,otp), expiresAt:new Date(Date.now()+10*60*1000) } });
  return { ok:true, message:'OTP sent to your registered email.' };
}

export async function verifyRecovery(emailInput, purpose, otp, newPassword) {
  const email = emailInput.toLowerCase();
  const user = await prisma.user.findUnique({ where:{ email } });
  if (!user || user.status !== 'ACTIVE') throw new AppError(400, 'Recovery request is invalid or expired.');
  const row = await prisma.recoveryCode.findFirst({ where:{ userId:user.id, purpose, usedAt:null }, orderBy:{ createdAt:'desc' } });
  if (!row || row.expiresAt < new Date()) throw new AppError(400, 'OTP expired. Request a new one.');
  if (row.attempts >= 5) throw new AppError(429, 'Too many incorrect attempts. Request a new OTP.');
  const expected = Buffer.from(otpHash(user.id,purpose,String(otp)));
  const actual = Buffer.from(row.codeHash);
  const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  if (!valid) {
    await prisma.recoveryCode.update({ where:{ id:row.id }, data:{ attempts:{ increment:1 } } });
    throw new AppError(400, 'Incorrect OTP.');
  }
  if (purpose === 'PASSWORD') {
    if (!newPassword || newPassword.length < 8) throw new AppError(400, 'New password must contain at least 8 characters.');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({ where:{ id:user.id }, data:{ passwordHash } }),
      prisma.trustedDevice.deleteMany({ where:{ userId:user.id } }),
      prisma.recoveryCode.update({ where:{ id:row.id }, data:{ usedAt:new Date() } })
    ]);
    await writeAudit({ actorUserId:user.id, action:'RECOVERY_PASSWORD_RESET', entity:'User', entityId:user.id });
    return { ok:true, message:'Password reset successfully. Sign in once with your new password.' };
  }
  await prisma.recoveryCode.update({ where:{ id:row.id }, data:{ usedAt:new Date() } });
  await writeAudit({ actorUserId:user.id, action:'RECOVERY_KEY_REVEALED', entity:'User', entityId:user.id });
  return { ok:true, loginKey:user.loginKey, message:'Gym Key recovered successfully.' };
}
