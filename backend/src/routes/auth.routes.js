import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../utils/http.js';

import {
  loginByKey,
  publicUser,
  requestRegistration,
  verifyRegistration,
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

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message:
      'Too many registration attempts. Try again later.'
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

const fitnessGoalSchema = z.enum([
  'MUSCLE_GAIN',
  'FAT_LOSS',
  'STRENGTH',
  'FITNESS'
]);

const keySchema = z.object({
  loginKey: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Gym Key must contain exactly 6 digits.')
});

const registerRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(80),

  email: z
    .string()
    .trim()
    .email(),

  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{10,16}$/)
    .optional()
    .or(z.literal('')),

  goal: fitnessGoalSchema
});

const registerVerifySchema = z.object({
  email: z
    .string()
    .trim()
    .email(),

  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP must contain exactly 6 digits.')
});

async function keyLogin(req, res) {
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
  '/login',
  authLimiter,
  validate(keySchema),
  asyncRoute(keyLogin)
);

// Kept as a compatibility alias for older frontend builds.
// It now behaves exactly like normal Gym Key login.
router.post(
  '/quick-login',
  authLimiter,
  validate(keySchema),
  asyncRoute(keyLogin)
);

router.post(
  '/register/request',
  registrationLimiter,
  validate(registerRequestSchema),
  asyncRoute(async (req, res) => {
    const result =
      await requestRegistration(req.body);

    res.status(202).json(result);
  })
);

router.post(
  '/register/verify',
  registrationLimiter,
  validate(registerVerifySchema),
  asyncRoute(async (req, res) => {
    const user =
      await verifyRegistration(
        req.body.email,
        req.body.otp
      );

    setSessionCookie(
      res,
      signSession(user)
    );

    res.status(201).json({
      user: publicUser(user),
      loginKey: user.loginKey
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
      email: z
        .string()
        .trim()
        .email()
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
      email: z
        .string()
        .trim()
        .email(),

      otp: z
        .string()
        .trim()
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
