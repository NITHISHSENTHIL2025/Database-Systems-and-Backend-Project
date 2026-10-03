import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../utils/http.js';

import {
  loginByKey,
  publicUser,
  registerMember,
  requestRecovery,
  verifyRecovery
} from '../services/auth.service.js';

import {
  clearSessionCookie,
  setSessionCookie,
  signSession
} from '../utils/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    message:
      'Too many sign-in attempts. Try again later.'
  }
});

const recoveryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,

  message: {
    message:
      'Too many recovery attempts. Try again later.'
  }
});

const keySchema = z.object({
  loginKey: z
    .string()
    .trim()
    .regex(/^\d{6}$/)
});

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(80),

  email: z
    .string()
    .email(),

  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{10,16}$/)
    .optional()
    .or(z.literal('')),

  goal: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(''))
});

async function keyLogin(
  req,
  res
) {
  const user = await loginByKey(
    req.body.loginKey
  );

  setSessionCookie(
    res,
    signSession(user)
  );

  res.json({
    user: publicUser(user)
  });
}

router.post(
  '/quick-login',
  authLimiter,
  validate(keySchema),
  asyncRoute(keyLogin)
);

router.post(
  '/login',
  authLimiter,
  validate(keySchema),
  asyncRoute(keyLogin)
);

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),

  asyncRoute(async (req, res) => {
    const user =
      await registerMember(req.body);

    setSessionCookie(
      res,
      signSession(user)
    );

    res.status(201).json({
      user: publicUser(user)
    });
  })
);

router.get(
  '/me',
  requireAuth,

  (req, res) => {
    res.json({
      user: req.user
    });
  }
);

router.post(
  '/recovery/request',
  recoveryLimiter,

  validate(
    z.object({
      email: z.string().email()
    })
  ),

  asyncRoute(async (req, res) => {
    res.json(
      await requestRecovery(
        req.body.email
      )
    );
  })
);

router.post(
  '/recovery/verify',
  recoveryLimiter,

  validate(
    z.object({
      email: z.string().email(),

      otp: z
        .string()
        .regex(/^\d{6}$/)
    })
  ),

  asyncRoute(async (req, res) => {
    res.json(
      await verifyRecovery(
        req.body.email,
        req.body.otp
      )
    );
  })
);

router.post(
  '/logout',
  (req, res) => {
    clearSessionCookie(res);

    res.json({
      ok: true
    });
  }
);

export default router;