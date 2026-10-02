import { prisma } from '../config/prisma.js';
import { getSessionToken, setSessionCookie, signSession, verifySession } from '../utils/auth.js';

export async function requireAuth(req,res,next) {
  try {
    const token = getSessionToken(req);
    if (!token) return res.status(401).json({ message:'Authentication required.' });
    const payload = verifySession(token);
    const user = await prisma.user.findUnique({ where:{ id:Number(payload.sub) } });
    if (!user || user.status !== 'ACTIVE') return res.status(401).json({ message:'Session is no longer valid.' });
    req.user = { id:user.id, name:user.name, email:user.email, phone:user.phone, role:user.role, loginKey:user.loginKey || null };
    // Rolling session: any authenticated activity extends the session by the configured idle window.
    setSessionCookie(res, signSession(user));
    next();
  } catch {
    return res.status(401).json({ message:'Invalid or expired session.' });
  }
}

export function requireRole(...roles) {
  return (req,res,next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message:'You do not have permission for this action.' });
    next();
  };
}
