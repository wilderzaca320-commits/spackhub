import jwt from 'jsonwebtoken';
import { db, publicUser } from './db.js';

export const SESSION_COOKIE = 'sparkhub_session';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FALLBACK_SECRET = 'sparkhub-dev-secret-cambiar-en-dot-env';

// Se lee de forma perezosa: así dotenv ya cargó el .env cuando se usa.
function secret() {
  return process.env.JWT_SECRET || FALLBACK_SECRET;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_MS,
  };
}

/** Firma un JWT y lo guarda en una cookie httpOnly. */
export function issueSession(res, user) {
  const token = jwt.sign({ sub: String(user.id), role: user.role }, secret(), {
    expiresIn: '7d',
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  return token;
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

function readToken(req) {
  const fromCookie = req.cookies?.[SESSION_COOKIE];
  if (fromCookie) return fromCookie;

  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Middleware: exige una sesión válida y deja la fila del usuario en req.user. */
export function requireAuth(req, res, next) {
  const token = readToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Necesitás iniciar sesión para continuar.' });
  }

  try {
    const payload = jwt.verify(token, secret());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(payload.sub));

    if (!user) {
      clearSession(res);
      return res.status(401).json({ error: 'La sesión ya no es válida. Iniciá sesión de nuevo.' });
    }

    req.user = user;
    return next();
  } catch {
    clearSession(res);
    return res.status(401).json({ error: 'La sesión expiró. Iniciá sesión de nuevo.' });
  }
}

/** Middleware: exige un rol concreto ('user' o 'admin'). */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Necesitás iniciar sesión para continuar.' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'No tenés permisos para acceder a este recurso.' });
    }
    return next();
  };
}

/** Adjunta req.user si hay cookie válida, sin bloquear la petición. */
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, secret());
    req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(payload.sub)) || null;
  } catch {
    req.user = null;
  }
  return next();
}

export function currentPublicUser(req) {
  return req.user ? publicUser(req.user) : null;
}
