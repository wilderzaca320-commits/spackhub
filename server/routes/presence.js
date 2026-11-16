import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

/** Latido de presencia: una fila por usuario, actualizada cada 60 s por el front. */
router.post('/', requireAuth, (req, res) => {
  const sessionId = `user:${req.user.id}`;
  db.prepare(
    `INSERT INTO user_presence (session_id, user_id, last_seen)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(session_id) DO UPDATE SET
       user_id = excluded.user_id,
       last_seen = excluded.last_seen`
  ).run(sessionId, req.user.id);

  res.json({ ok: true, lastSeen: new Date().toISOString() });
});

/** Usuarios con actividad en los últimos 5 minutos. */
router.get('/', (_req, res) => {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT user_id) AS online
       FROM user_presence
       WHERE user_id IS NOT NULL AND last_seen >= datetime('now', '-5 minutes')`
    )
    .get();
  res.json({ onlineNow: row.online });
});

export default router;
