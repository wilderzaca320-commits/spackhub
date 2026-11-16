import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { PROMPT_SELECT, publicPrompt } from '../catalog.js';
import { createNotification } from '../notify.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/status', (req, res) => {
  res.json({ ok: true, admin: req.user.email });
});

router.get('/stats', (_req, res) => {
  const count = (sql, ...params) => db.prepare(sql).get(...params).total;

  const promptsByStatus = db
    .prepare('SELECT status, COUNT(*) AS total FROM prompts GROUP BY status')
    .all()
    .reduce((acc, row) => ({ ...acc, [row.status]: row.total }), {});

  const revenue = db.prepare('SELECT COALESCE(SUM(platform_fee), 0) AS total FROM orders').get().total;
  const volume = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM orders').get().total;
  const paid = db.prepare("SELECT COALESCE(SUM(amount_usd), 0) AS total FROM payments WHERE status = 'paid'").get().total;

  return res.json({
    users: count('SELECT COUNT(*) AS total FROM users'),
    prompts: count('SELECT COUNT(*) AS total FROM prompts'),
    promptsByStatus: {
      pending: promptsByStatus.pending || 0,
      approved: promptsByStatus.approved || 0,
      rejected: promptsByStatus.rejected || 0,
      changes: promptsByStatus.changes || 0,
    },
    orders: count('SELECT COUNT(*) AS total FROM orders'),
    reviews: count('SELECT COUNT(*) AS total FROM reviews'),
    creditsCirculating: count('SELECT COALESCE(SUM(credits), 0) AS total FROM users'),
    revenueCredits: revenue,
    volumeCredits: volume,
    revenueUsd: Number(paid.toFixed(2)),
  });
});

/** Cola de revisión QA con el prompt maestro visible para el administrador. */
router.get('/qa', (req, res) => {
  const status = String(req.query.status || 'pending');
  const allowed = ['pending', 'changes', 'rejected', 'approved'];
  const filter = allowed.includes(status) ? status : 'pending';

  const rows = db
    .prepare(`${PROMPT_SELECT} WHERE p.status = ? ORDER BY p.updated_at ASC`)
    .all(filter);

  return res.json({
    items: rows.map((row) => ({
      ...publicPrompt(row, { includeMaster: true }),
      canReadMaster: true,
    })),
    status: filter,
  });
});

router.post('/qa/:id/review', (req, res) => {
  const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(Number(req.params.id));
  if (!prompt) return res.status(404).json({ error: 'Esa fórmula no existe.' });

  const action = String(req.body?.action || '').trim();
  const note = String(req.body?.note || '').trim().slice(0, 600);

  if (!['approve', 'reject', 'changes'].includes(action)) {
    return res.status(400).json({ error: 'Indicá una acción válida: approve, reject o changes.' });
  }
  if ((action === 'reject' || action === 'changes') && note.length < 5) {
    return res.status(400).json({ error: 'Escribí una nota de al menos 5 caracteres para el creador.' });
  }

  const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'changes';

  db.prepare(
    `UPDATE prompts
     SET status = ?, review_note = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(status, note, prompt.id);

  const notice = {
    approved: {
      tipo: 'prompt_aprobado',
      titulo: 'Fórmula aprobada',
      mensaje: `"${prompt.title}" ya está publicada en el marketplace.`,
    },
    rejected: {
      tipo: 'prompt_rechazado',
      titulo: 'Fórmula rechazada',
      mensaje: `"${prompt.title}" fue rechazada. ${note}`,
    },
    changes: {
      tipo: 'prompt_rechazado',
      titulo: 'Cambios solicitados',
      mensaje: `"${prompt.title}" necesita cambios. ${note}`,
    },
  }[status];

  if (notice) {
    createNotification(prompt.seller_id, notice.tipo, notice.titulo, notice.mensaje, `/prompt/${prompt.id}`);
  }

  const messages = {
    approve: 'Fórmula aprobada y publicada en el marketplace.',
    reject: 'Fórmula rechazada. El creador verá la nota.',
    changes: 'Se pidieron cambios al creador.',
  };

  return res.json({
    ok: true,
    status,
    message: messages[action],
    prompt: publicPrompt(
      db.prepare(`${PROMPT_SELECT} WHERE p.id = ?`).get(prompt.id),
      { includeMaster: true }
    ),
  });
});

const MAX_FEATURED = 3;

router.patch('/prompts/:id/featured', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id, status, is_featured AS isFeatured FROM prompts WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Esa fórmula no existe.' });
  if (row.status !== 'approved') {
    return res.status(400).json({ error: 'Solo las fórmulas aprobadas pueden destacarse.' });
  }

  const featured = req.body?.featured === undefined ? !row.isFeatured : Boolean(req.body.featured);

  if (featured && !row.isFeatured) {
    const current = db
      .prepare("SELECT COUNT(*) AS total FROM prompts WHERE is_featured = 1 AND status = 'approved'")
      .get().total;
    if (current >= MAX_FEATURED) {
      return res.status(409).json({
        error: `Ya hay ${MAX_FEATURED} fórmulas destacadas. Quitá una antes de agregar otra.`,
      });
    }
  }

  db.prepare('UPDATE prompts SET is_featured = ? WHERE id = ?').run(featured ? 1 : 0, id);
  return res.json({
    ok: true,
    id,
    isFeatured: featured,
    message: featured ? 'Fórmula destacada en la portada.' : 'Fórmula quitada de destacados.',
  });
});

router.get('/users', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.account_type AS accountType, u.company,
              u.credits, u.plan, u.avatar_key AS avatarKey, u.created_at AS createdAt,
              (SELECT COUNT(*) FROM prompts p WHERE p.seller_id = u.id) AS prompts,
              (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id) AS purchases
       FROM users u
       ORDER BY u.id ASC`
    )
    .all();

  return res.json({ items: rows });
});

export default router;
