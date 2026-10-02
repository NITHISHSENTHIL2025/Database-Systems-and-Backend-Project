import { Router } from 'express';
import express from 'express';
import { asyncRoute } from '../utils/http.js';
import { processWebhook } from '../services/cashfree.service.js';

const router = Router();

router.post('/webhook',
  express.raw({ type: 'application/json', limit: '250kb' }),
  asyncRoute(async (req, res) => {
    const rawBody = req.body.toString('utf8');
    const result = await processWebhook(rawBody, req.headers);
    res.json(result);
  })
);

export default router;
