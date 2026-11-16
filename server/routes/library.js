import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { PROMPT_SELECT, publicPrompt } from '../catalog.js';

const router = Router();

/** Biblioteca: fórmulas compradas, con el prompt maestro desbloqueado. */
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `${PROMPT_SELECT}
       JOIN library l ON l.prompt_id = p.id
       JOIN orders o ON o.id = l.order_id
       WHERE l.user_id = ?
       ORDER BY l.created_at DESC`
    )
    .all(req.user.id);

  const purchasedAt = db.prepare(
    'SELECT created_at FROM library WHERE user_id = ? AND prompt_id = ?'
  );

  const items = rows.map((row) => {
    const library = purchasedAt.get(req.user.id, row.id);
    return {
      ...publicPrompt(row, { includeMaster: true }),
      purchasedAt: library?.created_at || row.created_at,
      libraryId: row.id,
    };
  });

  return res.json({ items, total: items.length });
});

/** Historial de movimientos de créditos. */
router.get('/transactions', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, amount, type, description, reference, created_at AS createdAt
       FROM credit_transactions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 80`
    )
    .all(req.user.id);

  return res.json({ items: rows });
});

export default router;
