import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const items = db
    .prepare(
      `SELECT id, tipo, titulo, mensaje, enlace, leida, created_at AS createdAt
       FROM notifications
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 30`
    )
    .all(req.user.id)
    .map((row) => ({ ...row, leida: row.leida === 1 }));

  const unread = db
    .prepare('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND leida = 0')
    .get(req.user.id).total;

  res.json({ items, unread });
});

router.patch('/:id/read', (req, res) => {
  const id = Number(req.params.id);
  const info = db
    .prepare('UPDATE notifications SET leida = 1 WHERE id = ? AND user_id = ?')
    .run(id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Esa notificación no existe.' });
  res.json({ ok: true, message: 'Notificación marcada como leída.' });
});

router.post('/read-all', (req, res) => {
  const info = db
    .prepare('UPDATE notifications SET leida = 1 WHERE user_id = ? AND leida = 0')
    .run(req.user.id);
  res.json({ ok: true, marked: info.changes });
});

export default router;
