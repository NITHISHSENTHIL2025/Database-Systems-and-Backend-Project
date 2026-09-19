import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import membersRoutes from './routes/members.routes.js';
import adminRoutes from './routes/admin.routes.js';
import memberRoutes from './routes/member.routes.js';
import { errorHandler } from './middleware/error.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: false }));
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'gym-fitness-api', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/member', memberRoutes);
app.use(errorHandler);

app.listen(env.port, () => console.log(`Gym Fitness API running at http://localhost:${env.port}`));
