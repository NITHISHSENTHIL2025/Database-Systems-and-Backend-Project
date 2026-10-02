import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../config/prisma.js';
import { subscribeEvents } from '../services/events.service.js';
import { asyncRoute } from '../utils/http.js';

const router = Router();

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  let memberId = null;
  let trainerId = null;
  const trainerClientIds = new Set();

  if (req.user.role === 'MEMBER') {
    const member = await prisma.member.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    memberId = member?.id || null;
  } else if (req.user.role === 'TRAINER') {
    const trainer = await prisma.trainer.findUnique({
      where: { userId: req.user.id },
      include: { trainerAssignments: { where: { active: true }, select: { memberId: true } } }
    });
    trainerId = trainer?.id || null;
    trainer?.trainerAssignments.forEach(a => trainerClientIds.add(a.memberId));
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  function canReceive(event) {
    if (req.user.role === 'ADMIN') return true;
    if (req.user.role === 'MEMBER') return Boolean(memberId && Number(event.data?.memberId) === memberId);
    if (req.user.role === 'TRAINER') {
      if (trainerId && Number(event.data?.trainerId) === trainerId) {
        if (event.data?.memberId) trainerClientIds.add(Number(event.data.memberId));
        return true;
      }
      return Boolean(event.data?.memberId && trainerClientIds.has(Number(event.data.memberId)));
    }
    return false;
  }

  const unsubscribe = subscribeEvents(event => {
    if (!canReceive(event)) return;
    res.write(`event: update\ndata: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
}));

export default router;
