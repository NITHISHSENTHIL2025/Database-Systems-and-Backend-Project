import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncRoute } from '../utils/http.js';
import * as trainer from '../services/trainer.service.js';

const router = Router();
router.use(requireAuth, requireRole('TRAINER'));

const memberParam = z.object({ memberId: z.coerce.number().int().positive() });
const exerciseSchema = z.object({
  exerciseName: z.string().trim().min(2).max(120),
  muscleGroup: z.string().trim().max(80).optional().nullable(),
  sets: z.number().int().min(1).max(20),
  reps: z.string().trim().min(1).max(40),
  targetWeightKg: z.number().min(0).max(500).optional().nullable(),
  restSeconds: z.number().int().min(15).max(600).optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable()
});
const mealSchema = z.object({
  name: z.string().trim().min(2).max(80),
  timeLabel: z.string().trim().max(30).optional().nullable(),
  items: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  calories: z.number().int().min(0).max(3000).optional().nullable(),
  protein: z.number().int().min(0).max(300).optional().nullable(),
  carbs: z.number().int().min(0).max(500).optional().nullable(),
  fat: z.number().int().min(0).max(250).optional().nullable()
});
const dailyPlanSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayType: z.enum(['TRAINING','REST']),
  title: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(800).optional().nullable(),
  calorieTarget: z.number().int().min(1000).max(5000).optional().nullable(),
  proteinTarget: z.number().int().min(0).max(350).optional().nullable(),
  carbsTarget: z.number().int().min(0).max(700).optional().nullable(),
  fatTarget: z.number().int().min(0).max(250).optional().nullable(),
  waterMlTarget: z.number().int().min(500).max(8000).optional().nullable(),
  stepsTarget: z.number().int().min(0).max(50000).optional().nullable(),
  exercises: z.array(exerciseSchema).max(20).default([]),
  meals: z.array(mealSchema).max(8).default([])
});

router.get('/dashboard', asyncRoute(async (req, res) => res.json(await trainer.dashboard(req.user.id))));
router.get('/clients', asyncRoute(async (req, res) => res.json(await trainer.clients(req.user.id))));
router.get('/clients/:memberId', validate(memberParam, 'params'), asyncRoute(async (req, res) => res.json(await trainer.clientDetail(req.user.id, req.params.memberId))));
router.put('/clients/:memberId/daily-plan', validate(memberParam, 'params'), validate(dailyPlanSchema), asyncRoute(async (req, res) => res.json(await trainer.saveDailyPlan(req.user.id, req.params.memberId, req.body))));
router.get('/profile', asyncRoute(async (req, res) => res.json(await trainer.profile(req.user.id))));

export default router;
