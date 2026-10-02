import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const SESSION_COOKIE = 'gymfit_session';
const DEVICE_COOKIE = 'gymfit_device';
const DAY = 24 * 60 * 60 * 1000;

export function signSession(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email },
    env.jwtSecret,
    { expiresIn: `${env.sessionIdleDays}d`, issuer: 'gymfit', audience: 'gymfit-web' }
  );
}

export function verifySession(token) {
  return jwt.verify(token, env.jwtSecret, { issuer: 'gymfit', audience: 'gymfit-web' });
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite,
    maxAge: env.sessionIdleDays * DAY, path: '/'
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite, path: '/' });
}

export function getSessionToken(req) { return req.cookies?.[SESSION_COOKIE] || null; }

export function setDeviceCookie(res, token) {
  res.cookie(DEVICE_COOKIE, token, {
    httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite,
    maxAge: env.trustedDeviceDays * DAY, path: '/'
  });
}

export function getDeviceToken(req) { return req.cookies?.[DEVICE_COOKIE] || null; }
export function clearDeviceCookie(res) {
  res.clearCookie(DEVICE_COOKIE, { httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite, path: '/' });
}
