import { Router } from 'express';
import { db } from '../db.js';
import { optionalAuth } from '../auth.js';

const router = Router();

/** Sugerencias en vivo desde SQLite: fórmulas, categorías y subcategorías. */
router.get('/suggest', optionalAuth, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ items: [] });

  const like = `%${q}%`;

  const prompts = db
    .prepare(
      `SELECT id, title, price, model
       FROM prompts
       WHERE status = 'approved' AND (title LIKE ? OR tags LIKE ?)
       ORDER BY is_featured DESC, sales_count DESC
       LIMIT 6`
    )
    .all(like, like)
    .map((row) => ({
      type: 'prompt',
      id: row.id,
      label: row.title,
      detail: `${row.model} · ${row.price} créditos`,
      href: `/prompt/${row.id}`,
    }));

  const categories = db
    .prepare(
      `SELECT slug, nombre, parent_id AS parentId
       FROM categories
       WHERE activa = 1 AND nombre LIKE ?
       ORDER BY parent_id IS NOT NULL, orden
       LIMIT 4`
    )
    .all(like)
    .map((row) => ({
      type: row.parentId ? 'subcategory' : 'category',
      label: row.nombre,
      detail: row.parentId ? 'Subcategoría' : 'Categoría',
      href: `/categoria/${row.slug}`,
    }));

  db.prepare('INSERT INTO search_log (term, user_id) VALUES (?, ?)').run(
    q.slice(0, 80).toLowerCase(),
    req.user?.id ?? null
  );

  res.json({ items: [...categories, ...prompts] });
});

/** Términos más buscados en los últimos 7 días. */
router.get('/trending', (_req, res) => {
  const items = db
    .prepare(
      `SELECT term, COUNT(*) AS uses
       FROM search_log
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY term
       ORDER BY uses DESC, term ASC
       LIMIT 10`
    )
    .all();
  res.json({ items });
});

export default router;
