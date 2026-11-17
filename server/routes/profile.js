import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, publicUser, NOTIFICATION_DEFAULTS, notificationPrefsFrom } from '../db.js';
import { requireAuth, clearSession } from '../auth.js';
import { PREVIEW_KEYS, PROMPT_SELECT, publicPrompt, findPlan } from '../catalog.js';

const router = Router();

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrador',
  'soporte',
  'sparkhub',
  'spackhub',
  'sistema',
  'moderador',
  'api',
  'root',
  'oficial',
]);

function statsFor(userId) {
  const seller = db
    .prepare(
      `SELECT COUNT(*) AS prompts,
              COALESCE(SUM(sales_count), 0) AS sales
       FROM prompts WHERE seller_id = ?`
    )
    .get(userId);

  const earnings = db
    .prepare(
      `SELECT COALESCE(SUM(o.seller_earning), 0) AS total
       FROM orders o JOIN prompts p ON p.id = o.prompt_id
       WHERE p.seller_id = ?`
    )
    .get(userId).total;

  const withdrawn = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM withdrawals WHERE user_id = ? AND status != 'Rechazado'"
    )
    .get(userId).total;

  const purchases = db
    .prepare('SELECT COUNT(*) AS total FROM orders WHERE buyer_id = ?')
    .get(userId).total;

  const favorites = db
    .prepare('SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?')
    .get(userId).total;

  return {
    prompts: seller.prompts,
    sales: seller.sales,
    earnings,
    withdrawn,
    available: Math.max(0, earnings - withdrawn),
    purchases,
    favorites,
  };
}

router.get('/', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const company = db.prepare('SELECT * FROM companies WHERE user_id = ?').get(req.user.id);
  const plan = findPlan(user.plan || 'free') || findPlan('starter');

  return res.json({
    user: publicUser(user),
    stats: statsFor(user.id),
    company: company
      ? {
          name: company.name,
          taxId: company.tax_id,
          billingEmail: company.billing_email,
          seats: company.seats,
        }
      : null,
    avatarKeys: PREVIEW_KEYS,
    notifications: notificationPrefsFrom(user.notification_prefs),
    notificationKeys: Object.keys(NOTIFICATION_DEFAULTS),
    subscriptions: {
      plan: user.plan || 'free',
      planName: plan?.name || 'Starter Explorer',
      planCredits: plan?.monthlyCredits || 0,
      isSelect: Boolean(user.is_select),
      selectSince: user.select_since || null,
    },
    balances: {
      generationCredits: user.credits,
      selectDownloads: 0,
    },
  });
});

router.patch('/', requireAuth, (req, res) => {
  const body = req.body || {};
  const name = body.name === undefined ? undefined : String(body.name).trim();
  const bio = body.bio === undefined ? undefined : String(body.bio).trim();
  const avatarKey = body.avatarKey === undefined ? undefined : String(body.avatarKey).trim();
  const company = body.company === undefined ? undefined : String(body.company).trim();
  const accountType = body.accountType === undefined ? undefined : String(body.accountType).trim();
  const username =
    body.username === undefined ? undefined : String(body.username).trim().toLowerCase();
  const notificationPrefs = body.notificationPrefs;

  if (name !== undefined && (name.length < 2 || name.length > 60)) {
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 60 caracteres.' });
  }
  if (bio !== undefined && bio.length > 400) {
    return res.status(400).json({ error: 'La bio no puede superar 400 caracteres.' });
  }
  if (avatarKey !== undefined && avatarKey !== '' && !PREVIEW_KEYS.includes(avatarKey)) {
    return res.status(400).json({ error: 'Ese avatar no es válido.' });
  }
  if (company !== undefined && company.length > 80) {
    return res.status(400).json({ error: 'El nombre de la empresa no puede superar 80 caracteres.' });
  }
  if (accountType !== undefined && !['individual', 'corporate'].includes(accountType)) {
    return res.status(400).json({ error: 'El tipo de cuenta no es válido.' });
  }

  if (username !== undefined) {
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({
        error:
          'El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números, puntos, guiones o guiones bajos, y empezar y terminar con letra o número.',
      });
    }
    if (RESERVED_USERNAMES.has(username)) {
      return res.status(409).json({ error: 'Ese nombre de usuario está reservado. Elegí otro.' });
    }

    const taken = db
      .prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id <> ?')
      .get(username, req.user.id);
    if (taken) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' });
    }
  }

  if (notificationPrefs !== undefined) {
    if (!notificationPrefs || typeof notificationPrefs !== 'object' || Array.isArray(notificationPrefs)) {
      return res.status(400).json({ error: 'Las preferencias de notificación no son válidas.' });
    }
    const invalid = Object.entries(notificationPrefs).find(
      ([key, value]) => !(key in NOTIFICATION_DEFAULTS) || typeof value !== 'boolean'
    );
    if (invalid) {
      return res.status(400).json({ error: 'Hay una preferencia de notificación no válida.' });
    }
  }

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (bio !== undefined) {
    updates.push('bio = ?');
    params.push(bio);
  }
  if (avatarKey !== undefined) {
    updates.push('avatar_key = ?');
    params.push(avatarKey);
  }
  if (company !== undefined) {
    updates.push('company = ?');
    params.push(company);
  }
  if (accountType !== undefined) {
    updates.push('account_type = ?');
    params.push(accountType);
  }
  if (username !== undefined) {
    updates.push('username = ?');
    params.push(username);
  }
  if (notificationPrefs !== undefined) {
    const merged = notificationPrefsFrom(req.user.notification_prefs);
    for (const [key, value] of Object.entries(notificationPrefs)) {
      merged[key] = value;
    }
    updates.push('notification_prefs = ?');
    params.push(JSON.stringify(merged));
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No enviaste ningún cambio para guardar.' });
  }

  params.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  return res.json({
    message: 'Perfil actualizado.',
    user: publicUser(user),
    notifications: notificationPrefsFrom(user.notification_prefs),
  });
});

/**
 * Eliminación definitiva de la cuenta.
 * Exige contraseña y borra en orden las filas relacionadas para respetar las claves foráneas.
 */
router.delete('/', requireAuth, async (req, res) => {
  const password = String(req.body?.password || '');
  if (!password) {
    return res.status(400).json({ error: 'Escribí tu contraseña para confirmar la eliminación.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.role === 'admin') {
    return res
      .status(403)
      .json({ error: 'La cuenta de administrador no se puede eliminar desde el perfil.' });
  }
  if (!(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'La contraseña no es correcta.' });
  }

  const id = user.id;
  const ownPrompts = 'SELECT id FROM prompts WHERE seller_id = ?';

  const purge = db.transaction(() => {
    db.prepare('DELETE FROM library WHERE user_id = ? OR prompt_id IN (' + ownPrompts + ')').run(id, id);
    db.prepare('DELETE FROM orders WHERE buyer_id = ? OR prompt_id IN (' + ownPrompts + ')').run(id, id);
    db.prepare('DELETE FROM reviews WHERE user_id = ? OR prompt_id IN (' + ownPrompts + ')').run(id, id);
    db.prepare('DELETE FROM favorites WHERE user_id = ? OR prompt_id IN (' + ownPrompts + ')').run(id, id);
    db.prepare('DELETE FROM cart_items WHERE user_id = ? OR prompt_id IN (' + ownPrompts + ')').run(id, id);
    db.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').run(id, id);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM generations WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM hire_requests WHERE client_id = ? OR creator_id = ?').run(id, id);
    db.prepare('DELETE FROM company_members WHERE owner_id = ?').run(id);
    db.prepare('DELETE FROM api_keys WHERE owner_id = ?').run(id);
    db.prepare('DELETE FROM withdrawals WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM credit_transactions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM payments WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM companies WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM user_presence WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM prompts WHERE seller_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });

  purge();
  clearSession(res);

  return res.json({
    ok: true,
    message: 'Tu cuenta y tus datos se eliminaron definitivamente.',
  });
});

/** Panel del creador: ganancias, ventas y estado de sus fórmulas. */
router.get('/dashboard', requireAuth, (req, res) => {
  const stats = statsFor(req.user.id);

  const promptsByStatus = db
    .prepare('SELECT status, COUNT(*) AS total FROM prompts WHERE seller_id = ? GROUP BY status')
    .all(req.user.id)
    .reduce((acc, row) => ({ ...acc, [row.status]: row.total }), {});

  const recentSales = db
    .prepare(
      `SELECT o.id, o.amount, o.seller_earning AS sellerEarning, o.created_at AS createdAt,
              p.id AS promptId, p.title, u.name AS buyerName
       FROM orders o
       JOIN prompts p ON p.id = o.prompt_id
       JOIN users u ON u.id = o.buyer_id
       WHERE p.seller_id = ?
       ORDER BY o.id DESC LIMIT 12`
    )
    .all(req.user.id);

  const monthly = db
    .prepare(
      `SELECT strftime('%Y-%m', o.created_at) AS month,
              COALESCE(SUM(o.seller_earning), 0) AS credits
       FROM orders o JOIN prompts p ON p.id = o.prompt_id
       WHERE p.seller_id = ?
       GROUP BY month ORDER BY month DESC LIMIT 6`
    )
    .all(req.user.id)
    .reverse();

  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const series = monthly.map((row) => {
    const [year, month] = row.month.split('-');
    return { month: row.month, label: `${months[Number(month) - 1]} ${year.slice(2)}`, credits: row.credits };
  });

  const withdrawals = db
    .prepare(
      `SELECT id, amount, method, status, created_at AS createdAt
       FROM withdrawals WHERE user_id = ? ORDER BY id DESC LIMIT 20`
    )
    .all(req.user.id);

  const prompts = db
    .prepare(`${PROMPT_SELECT} WHERE p.seller_id = ? ORDER BY p.updated_at DESC`)
    .all(req.user.id)
    .map((row) => publicPrompt(row, { includeMaster: true }));

  return res.json({
    stats,
    promptsByStatus: {
      pending: promptsByStatus.pending || 0,
      approved: promptsByStatus.approved || 0,
      rejected: promptsByStatus.rejected || 0,
      changes: promptsByStatus.changes || 0,
    },
    recentSales,
    series,
    withdrawals,
    prompts,
  });
});

router.post('/withdraw', requireAuth, (req, res) => {
  const amount = Number(req.body?.amount);
  const method = String(req.body?.method || 'stripe').trim();

  if (!Number.isInteger(amount) || amount < 10) {
    return res.status(400).json({ error: 'El retiro mínimo es de 10 créditos.' });
  }
  if (!['stripe', 'crypto'].includes(method)) {
    return res.status(400).json({ error: 'Elegí un método de retiro válido.' });
  }

  const stats = statsFor(req.user.id);
  if (amount > stats.available) {
    return res.status(400).json({
      error: `Solo podés retirar ${stats.available} créditos disponibles por ahora.`,
    });
  }

  const info = db
    .prepare("INSERT INTO withdrawals (user_id, amount, method, status) VALUES (?, ?, ?, 'Procesando')")
    .run(req.user.id, amount, method);

  return res.status(201).json({
    message: `Retiro de ${amount} créditos solicitado. Se acreditará en 48 horas hábiles.`,
    withdrawal: {
      id: Number(info.lastInsertRowid),
      amount,
      method,
      status: 'Procesando',
      createdAt: new Date().toISOString(),
    },
    stats: statsFor(req.user.id),
  });
});

/** Perfil público de un creador con sus fórmulas aprobadas. */
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Ese creador no existe.' });

  const prompts = db
    .prepare(`${PROMPT_SELECT} WHERE p.seller_id = ? AND p.status = 'approved' ORDER BY p.sales_count DESC`)
    .all(id)
    .map((row) => publicPrompt(row));

  const categories = [...new Set(prompts.map((prompt) => prompt.category))];
  const rating = prompts.reduce((sum, prompt) => sum + prompt.rating * prompt.reviewsCount, 0);
  const reviews = prompts.reduce((sum, prompt) => sum + prompt.reviewsCount, 0);

  return res.json({
    creator: {
      id: user.id,
      name: user.name,
      username: user.username || '',
      company: user.company,
      bio: user.bio,
      plan: user.plan,
      avatarKey: user.avatar_key,
      joinedAt: user.created_at,
      rating: reviews ? Number((rating / reviews).toFixed(2)) : 0,
      reviews,
      stats: statsFor(id),
      categories,
    },
    prompts,
  });
});

export default router;
