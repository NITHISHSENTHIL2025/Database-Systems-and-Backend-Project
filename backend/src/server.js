import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { originGuard, isAllowedOrigin } from './middleware/security.js';
import { errorHandler, notFound } from './middleware/error.js';
import paymentRoutes from './routes/payment.routes.js';
import authRoutes from './routes/auth.routes.js';
import publicRoutes from './routes/public.routes.js';
import memberRoutes from './routes/member.routes.js';
import trainerRoutes from './routes/trainer.routes.js';
import adminRoutes from './routes/admin.routes.js';
import eventsRoutes from './routes/events.routes.js';

const app = express();
app.disable('x-powered-by');
if (env.nodeEnv === 'production') app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed.'));
  },
  credentials: true
}));
app.use(rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many requests. Please slow down.' } }));

// Cashfree webhook needs the untouched raw request body.
app.use('/api/payments', paymentRoutes);
app.use(express.json({ limit: '250kb' }));
app.use(cookieParser());
app.use(originGuard);

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: 'gymfit-api', database: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, service: 'gymfit-api', database: 'unavailable', time: new Date().toISOString() });
  }
});

app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/trainer', trainerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventsRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, '0.0.0.0', () => console.log(`GymFit API running at http://127.0.0.1:${env.port}`));

async function shutdown(signal) {
  console.log(`\n${signal} received. Closing GymFit...`);
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
