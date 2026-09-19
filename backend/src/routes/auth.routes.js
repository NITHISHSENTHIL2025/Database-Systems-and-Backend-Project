import { Router } from 'express';
import { z } from 'zod';
import { login, me, register } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });
const registration = credentials.extend({ name: z.string().min(2), phone: z.string().optional(), goal: z.string().optional() });
router.post('/login', validate(credentials), login);
router.post('/register', validate(registration), register);
router.get('/me', requireAuth, me);
export default router;
