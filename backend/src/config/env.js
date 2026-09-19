import 'dotenv/config';

const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean);

export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  corsOrigins: origins
};

if (!env.databaseUrl) throw new Error('DATABASE_URL is missing.');
if (!env.jwtSecret) throw new Error('JWT_SECRET is missing.');
