import { Router } from 'express';
import { overview } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.get('/', requireAuth, overview);
export default router;
