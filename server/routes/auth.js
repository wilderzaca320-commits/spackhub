import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db, publicUser, homePathFor, rolesFor, usernameFromEmail } from '../db.js';
import { requireAuth, issueSession, clearSession } from '../auth.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos desde esta conexión. Esperá 15 minutos e intentá de nuevo.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Esperá 15 minutos e intentá de nuevo.' },
});

function validateCredentials(email, password) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return 'Ingresá un correo electrónico válido.';
  }
  if (typeof password !== 'string' || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (password.length > 200) {
    return 'La contraseña es demasiado larga.';
  }
  return null;
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim().slice(0, 60);
    const accountType = req.body?.accountType === 'corporate' ? 'corporate' : 'individual';
    const company = accountType === 'corporate' ? String(req.body?.company || '').trim().slice(0, 80) : '';

    const validationError = validateCredentials(email, password);
    if (validationError) return res.status(400).json({ error: validationError });

    if (name && name.length < 2) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo electrónico.' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Username único derivado del correo; el usuario puede cambiarlo en su perfil.
    const usernameTaken = db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE');
    const username = usernameFromEmail(email, (candidate) => Boolean(usernameTaken.get(candidate)));

    // 100 créditos de bienvenida + su transacción, todo en una sola operación.
    const createUser = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO users (email, password_hash, name, username, role, account_type, company, credits, active_role)
           VALUES (?, ?, ?, ?, 'user', ?, ?, 100, ?)`
        )
        .run(
          email,
          hash,
          name || email.split('@')[0],
          username,
          accountType,
          company,
          accountType === 'corporate' ? 'empresario' : 'comprador'
        );

      const userId = Number(info.lastInsertRowid);

      db.prepare(
        `INSERT INTO credit_transactions (user_id, amount, type, description)
         VALUES (?, 100, 'welcome', 'Créditos de bienvenida')`
      ).run(userId);

      return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    });

    const user = createUser();
    issueSession(res, user);

    return res.status(201).json({
      user: publicUser(user),
      redirect: homePathFor(user),
      message: '¡Cuenta creada! Te acreditamos 100 créditos de bienvenida.',
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Completá tu correo y tu contraseña.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Mismo mensaje para correo inexistente y contraseña incorrecta.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    issueSession(res, user);

    return res.json({
      user: publicUser(user),
      redirect: homePathFor(user),
      message: `Bienvenido de nuevo, ${user.name || user.email}.`,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  return res.json({ ok: true, message: 'Sesión cerrada.' });
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user), redirect: homePathFor(req.user) });
});

router.patch('/role', requireAuth, (req, res) => {
  const role = String(req.body?.role || '').trim().toLowerCase();
  const allowed = rolesFor(req.user);

  if (!allowed.includes(role)) {
    return res.status(403).json({ error: 'Tu cuenta no tiene ese rol disponible.' });
  }

  db.prepare('UPDATE users SET active_role = ? WHERE id = ?').run(role, req.user.id);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  return res.json({
    user: publicUser(fresh),
    redirect: homePathFor(fresh),
    message: `Rol activo: ${role}.`,
  });
});

export default router;
