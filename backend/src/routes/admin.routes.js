import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncRoute } from '../utils/http.js';
import * as admin from '../services/admin.service.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));
const idParam = z.object({ id: z.coerce.number().int().positive() });
const descriptor = z.array(z.number()).length(128);

router.get('/dashboard', asyncRoute(async (req, res) => res.json(await admin.dashboard())));
router.get('/members', asyncRoute(async (req, res) => res.json(await admin.listMembers(String(req.query.search || '')))));
router.patch('/members/:id', validate(idParam, 'params'), validate(z.object({ name: z.string().trim().min(2).max(80).optional(), phone: z.string().trim().max(20).optional().nullable(), goal: z.string().trim().max(120).optional().nullable(), userStatus: z.enum(['ACTIVE','DISABLED']).optional() })), asyncRoute(async (req, res) => res.json(await admin.updateMember(req.user.id, req.params.id, req.body))));

router.get('/memberships', asyncRoute(async (req, res) => res.json(await admin.listMemberships())));
router.patch('/memberships/:id', validate(idParam, 'params'), validate(z.object({ status: z.enum(['ACTIVE','SCHEDULED','FROZEN','CANCELLED','EXPIRED']) })), asyncRoute(async (req, res) => res.json(await admin.updateMembership(req.user.id, req.params.id, req.body.status))));
router.get('/plans', asyncRoute(async (req, res) => res.json(await admin.listPlans())));
router.patch('/plans/:id', validate(idParam, 'params'), validate(z.object({ name: z.string().trim().min(2).max(80).optional(), description: z.string().trim().min(5).max(500).optional(), price: z.number().positive().optional(), durationDays: z.number().int().min(1).max(3650).optional(), features: z.array(z.string().trim().min(1).max(120)).max(20).optional(), active: z.boolean().optional() })), asyncRoute(async (req, res) => res.json(await admin.updatePlan(req.user.id, req.params.id, req.body))));

router.get('/trainers', asyncRoute(async (req, res) => res.json(await admin.listTrainers())));
router.post('/trainers', validate(z.object({ name: z.string().trim().min(2).max(80), email: z.string().email(), phone: z.string().trim().max(20).optional().or(z.literal('')), specialty: z.string().trim().min(2).max(100), bio: z.string().trim().max(500).optional().or(z.literal('')), capacity: z.number().int().min(1).max(100).optional(), password: z.string().min(8).max(128) })), asyncRoute(async (req, res) => res.status(201).json(await admin.createTrainer(req.user.id, req.body))));
router.patch('/trainers/:id', validate(idParam, 'params'), validate(z.object({ name: z.string().trim().min(2).max(80).optional(), phone: z.string().trim().max(20).optional().nullable(), specialty: z.string().trim().min(2).max(100).optional(), bio: z.string().trim().max(500).optional().nullable(), capacity: z.number().int().min(1).max(100).optional(), active: z.boolean().optional() })), asyncRoute(async (req, res) => res.json(await admin.updateTrainer(req.user.id, req.params.id, req.body))));
router.post('/trainer-assignments', validate(z.object({ memberId: z.number().int().positive(), trainerId: z.number().int().positive() })), asyncRoute(async (req, res) => res.status(201).json(await admin.assignTrainer(req.user.id, req.body.memberId, req.body.trainerId))));

router.get('/attendance/today', asyncRoute(async (req, res) => res.json(await admin.todayAttendance())));
router.post('/face/enroll', validate(z.object({ memberId: z.number().int().positive(), descriptors: z.array(descriptor).min(2).max(5), consent: z.literal(true) })), asyncRoute(async (req, res) => res.status(201).json(await admin.enrollFace(req.user.id, req.body.memberId, req.body.descriptors, req.body.consent))));
router.post('/attendance/face', validate(z.object({ descriptor })), asyncRoute(async (req, res) => res.status(201).json(await admin.faceCheckIn(req.user.id, req.body.descriptor))));
router.post('/attendance/key', validate(z.object({ loginKey: z.string().regex(/^\d{6}$/) })), asyncRoute(async (req, res) => res.status(201).json(await admin.keyCheckIn(req.user.id, req.body.loginKey))));

router.get('/payments', asyncRoute(async (req, res) => res.json(await admin.listPayments())));

export default router;
