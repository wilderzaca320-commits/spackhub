import { Router } from 'express';
import { db, publicUser } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({
    isSelect: Boolean(row?.is_select),
    selectSince: row?.select_since || null,
    activeRole: publicUser(row).activeRole,
  });
});

router.post('/subscribe', requireAuth, (req, res) => {
  db.prepare(
    "UPDATE users SET is_select = 1, select_since = COALESCE(select_since, datetime('now')) WHERE id = ?"
  ).run(req.user.id);

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.status(201).json({
    isSelect: true,
    selectSince: row.select_since,
    user: publicUser(row),
    message: 'Sparkhub Select activado. Tus beneficios quedaron guardados.',
  });
});

router.delete('/', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET is_select = 0, select_since = NULL WHERE id = ?').run(req.user.id);
  res.json({
    isSelect: false,
    message: 'Sparkhub Select cancelado.',
    user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)),
  });
});

export default router;
