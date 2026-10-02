import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../utils/http.js';
import { changeOwnPassword, createTrustedDevice, loginByKey, publicUser, quickLoginByKey, registerMember, requestRecovery, verifyRecovery } from '../services/auth.service.js';
import { clearSessionCookie, getDeviceToken, setDeviceCookie, setSessionCookie, signSession } from '../utils/auth.js';

const router = Router();
const authLimiter = rateLimit({ windowMs:15*60*1000, limit:30, standardHeaders:'draft-8', legacyHeaders:false, message:{ message:'Too many sign-in attempts. Try again later.' } });
const recoveryLimiter = rateLimit({ windowMs:10*60*1000, limit:8, standardHeaders:'draft-8', legacyHeaders:false, message:{ message:'Too many recovery attempts. Try again later.' } });

const keySchema = z.object({ loginKey:z.string().trim().regex(/^\d{6}$/) });
const loginSchema = keySchema.extend({ password:z.string().min(8).max(128) });
const registerSchema = z.object({
  name:z.string().trim().min(2).max(80), email:z.string().email(),
  phone:z.string().trim().regex(/^[0-9+\-\s]{10,16}$/).optional().or(z.literal('')),
  goal:z.string().trim().max(120).optional().or(z.literal('')), password:z.string().min(8).max(128)
});

router.post('/quick-login', authLimiter, validate(keySchema), asyncRoute(async (req,res) => {
  const user = await quickLoginByKey(req.body.loginKey, getDeviceToken(req));
  if (!user) return res.json({ passwordRequired:true });
  setSessionCookie(res, signSession(user));
  return res.json({ passwordRequired:false, user:publicUser(user) });
}));

router.post('/login', authLimiter, validate(loginSchema), asyncRoute(async (req,res) => {
  const user = await loginByKey(req.body.loginKey, req.body.password);
  const deviceToken = await createTrustedDevice(user.id);
  setDeviceCookie(res, deviceToken);
  setSessionCookie(res, signSession(user));
  res.json({ user:publicUser(user) });
}));

router.post('/register', authLimiter, validate(registerSchema), asyncRoute(async (req,res) => {
  const user = await registerMember(req.body);
  const deviceToken = await createTrustedDevice(user.id);
  setDeviceCookie(res, deviceToken);
  setSessionCookie(res, signSession(user));
  res.status(201).json({ user:publicUser(user) });
}));

router.get('/me', requireAuth, (req,res) => res.json({ user:req.user }));
router.post('/password', requireAuth, validate(z.object({ currentPassword:z.string().min(8).max(128), newPassword:z.string().min(8).max(128) })), asyncRoute(async (req,res) => res.json(await changeOwnPassword(req.user.id, req.body.currentPassword, req.body.newPassword))));
router.post('/recovery/request', recoveryLimiter, validate(z.object({ email:z.string().email(), purpose:z.enum(['GYM_KEY','PASSWORD']) })), asyncRoute(async (req,res) => res.json(await requestRecovery(req.body.email, req.body.purpose))));
router.post('/recovery/verify', recoveryLimiter, validate(z.object({ email:z.string().email(), purpose:z.enum(['GYM_KEY','PASSWORD']), otp:z.string().regex(/^\d{6}$/), newPassword:z.string().min(8).max(128).optional() })), asyncRoute(async (req,res) => res.json(await verifyRecovery(req.body.email, req.body.purpose, req.body.otp, req.body.newPassword))));
router.post('/logout', (req,res) => { clearSessionCookie(res); res.json({ ok:true }); });

export default router;
