import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncRoute } from '../utils/http.js';
import * as member from '../services/member.service.js';
import { createOrder, verifyOrderForUser } from '../services/cashfree.service.js';

const router = Router();
router.use(requireAuth, requireRole('MEMBER'));

const fitnessGoalSchema = z.enum([
  'MUSCLE_GAIN',
  'FAT_LOSS',
  'STRENGTH',
  'FITNESS'
]);

router.get(
  '/dashboard',
  asyncRoute(async (req, res) =>
    res.json(await member.dashboard(req.user.id))
  )
);

router.get(
  '/today',
  asyncRoute(async (req, res) =>
    res.json(await member.today(req.user.id))
  )
);

router.patch(
  '/today/exercises/:id',
  validate(
    z.object({
      id: z.coerce.number().int().positive()
    }),
    'params'
  ),
  validate(
    z.object({
      status: z.enum([
        'PENDING',
        'COMPLETED',
        'SKIPPED'
      ])
    })
  ),
  asyncRoute(async (req, res) =>
    res.json(
      await member.updateExercise(
        req.user.id,
        req.params.id,
        req.body.status
      )
    )
  )
);

router.patch(
  '/today/meals/:id',
  validate(
    z.object({
      id: z.coerce.number().int().positive()
    }),
    'params'
  ),
  validate(
    z.object({
      status: z.enum([
        'PENDING',
        'DONE',
        'PARTIAL',
        'SKIPPED'
      ])
    })
  ),
  asyncRoute(async (req, res) =>
    res.json(
      await member.updateMeal(
        req.user.id,
        req.params.id,
        req.body.status
      )
    )
  )
);

router.get(
  '/attendance',
  asyncRoute(async (req, res) =>
    res.json(await member.attendance(req.user.id))
  )
);

router.get(
  '/progress',
  asyncRoute(async (req, res) =>
    res.json(
      await member.progress(
        req.user.id,
        Number(req.query.days || 90)
      )
    )
  )
);

router.get(
  '/membership',
  asyncRoute(async (req, res) =>
    res.json(await member.membershipHistory(req.user.id))
  )
);

router.get(
  '/payments',
  asyncRoute(async (req, res) =>
    res.json(await member.payments(req.user.id))
  )
);

router.post(
  '/payments/order',
  validate(
    z.object({
      planId: z.number().int().positive()
    })
  ),
  asyncRoute(async (req, res) =>
    res.status(201).json(
      await createOrder(
        req.user,
        req.body.planId
      )
    )
  )
);

router.get(
  '/payments/verify/:orderId',
  asyncRoute(async (req, res) =>
    res.json(
      await verifyOrderForUser(
        req.user.id,
        req.params.orderId
      )
    )
  )
);

router.get(
  '/profile',
  asyncRoute(async (req, res) =>
    res.json(await member.profile(req.user.id))
  )
);

router.patch(
  '/profile',
  validate(
    z.object({
      name: z
        .string()
        .trim()
        .min(2)
        .max(80),

      phone: z
        .string()
        .trim()
        .regex(/^[0-9+\-\s]{10,16}$/)
        .optional()
        .or(z.literal('')),

      goal: z.union([
        fitnessGoalSchema,
        z.literal('')
      ]),

      age: z
        .number()
        .int()
        .min(18)
        .max(80)
        .optional()
        .nullable(),

      heightCm: z
        .number()
        .min(120)
        .max(230)
        .optional()
        .nullable(),

      weightKg: z
        .number()
        .min(30)
        .max(300)
        .optional()
        .nullable(),

      bodyType: z
        .enum([
          'SLIM',
          'AVERAGE',
          'ATHLETIC',
          'HEAVY'
        ])
        .optional()
        .nullable()
    })
  ),
  asyncRoute(async (req, res) =>
    res.json(
      await member.updateProfile(
        req.user.id,
        req.body
      )
    )
  )
);

const aiSchema = z.object({
  gender: z.enum([
    'MALE',
    'FEMALE',
    'OTHER'
  ]),

  targetWeightKg: z
    .number()
    .min(30)
    .max(300)
    .optional()
    .nullable(),

  experience: z.enum([
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED'
  ]),

  trainingDays: z
    .number()
    .int()
    .min(3)
    .max(6),

  sessionMinutes: z
    .number()
    .int()
    .refine(
      value =>
        [30, 45, 60, 75, 90].includes(value),
      'Choose a supported session duration.'
    ),

  dietPreference: z.enum([
    'VEGETARIAN',
    'NON_VEGETARIAN',
    'VEGAN'
  ]),

  allergies: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable(),

  dislikedFoods: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable(),

  activityLevel: z.enum([
    'LOW',
    'LIGHT',
    'MODERATE',
    'HIGH'
  ]),

  equipmentAccess: z.enum([
    'GYM',
    'HOME',
    'LIMITED'
  ]),

  sleepHours: z
    .number()
    .min(3)
    .max(12)
    .optional()
    .nullable()
});

router.get(
  '/ai-profile',
  asyncRoute(async (req, res) =>
    res.json(await member.getAIProfile(req.user.id))
  )
);

router.put(
  '/ai-profile',
  validate(aiSchema),
  asyncRoute(async (req, res) =>
    res.json(
      await member.saveAIProfile(
        req.user.id,
        req.body
      )
    )
  )
);

router.post(
  '/ai/regenerate',
  asyncRoute(async (req, res) =>
    res.json(await member.regenerateAI(req.user.id))
  )
);

router.patch(
  '/notifications/:id/read',
  validate(
    z.object({
      id: z.coerce.number().int().positive()
    }),
    'params'
  ),
  asyncRoute(async (req, res) =>
    res.json(
      await member.markNotificationRead(
        req.user.id,
        req.params.id
      )
    )
  )
);

export default router;
