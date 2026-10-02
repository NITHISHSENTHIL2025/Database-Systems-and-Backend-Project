import { Router } from 'express';
import { asyncRoute } from '../utils/http.js';
import { getHome } from '../services/public.service.js';

const router = Router();
router.get('/home', asyncRoute(async (req, res) => res.json(await getHome())));
router.get('/plans', asyncRoute(async (req, res) => {
  const home = await getHome();
  res.json(home.plans);
}));
export default router;
