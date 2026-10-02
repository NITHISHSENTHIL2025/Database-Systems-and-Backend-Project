import 'dotenv/config';

const list = (value) => (value || '').split(',').map(v => v.trim()).filter(Boolean);
const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  corsOrigins: list(process.env.CORS_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173'),
  cookieSecure: String(process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true',
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  sessionIdleDays: number(process.env.SESSION_IDLE_DAYS, 3),
  trustedDeviceDays: number(process.env.TRUSTED_DEVICE_DAYS, 30),
  adminName: process.env.ADMIN_NAME || 'GymFit Admin',
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@gymfit.local').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  cashfreeMode: process.env.CASHFREE_MODE || 'sandbox',
  cashfreeAppId: process.env.CASHFREE_APP_ID || '',
  cashfreeSecretKey: process.env.CASHFREE_SECRET_KEY || '',
  cashfreeApiVersion: process.env.CASHFREE_API_VERSION || '2025-01-01',
  frontendUrl: process.env.FRONTEND_URL || 'http://127.0.0.1:5173',
  publicApiUrl: process.env.PUBLIC_API_URL || '',
  aiEngine: process.env.AI_ENGINE || 'rules',
  appTimezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  brevoApiKey: process.env.BREVO_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || '',
  emailFromName: process.env.EMAIL_FROM_NAME || 'GymFit',
  faceMatchThreshold: number(process.env.FACE_MATCH_THRESHOLD, 0.52),
  faceAmbiguityGap: number(process.env.FACE_AMBIGUITY_GAP, 0.07)
};

if (!env.databaseUrl || /USER:PASSWORD@HOST|HOST\/DB/.test(env.databaseUrl)) {
  throw new Error('DATABASE_URL is not configured. Put your real PostgreSQL/Neon URL in backend/.env.');
}
if (!env.jwtSecret || env.jwtSecret.length < 32 || env.jwtSecret.includes('replace-me')) {
  throw new Error('JWT_SECRET must be a random value with at least 32 characters.');
}
