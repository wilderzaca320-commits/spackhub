import { Router } from 'express';
import { db } from '../db.js';
import { optionalAuth } from '../auth.js';
import { PROMPT_SELECT } from '../catalog.js';
import { serializePrompt } from './prompts.js';

const router = Router();

/** Portada con métricas reales calculadas desde SQLite. */
router.get('/', optionalAuth, (req, res) => {
  const prompts = db
    .prepare("SELECT COUNT(*) AS total FROM prompts WHERE status = 'approved'")
    .get().total;

  const reviews = db
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(AVG(r.rating), 0) AS average
       FROM reviews r
       JOIN prompts p ON p.id = r.prompt_id
       WHERE p.status = 'approved'`
    )
    .get();

  const users = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;

  const onlineNow = db
    .prepare(
      `SELECT COUNT(DISTINCT user_id) AS total
       FROM user_presence
       WHERE user_id IS NOT NULL AND last_seen >= datetime('now', '-5 minutes')`
    )
    .get().total;

  const trendingTerms = db
    .prepare(
      `SELECT term, COUNT(*) AS uses
       FROM search_log
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY term
       ORDER BY uses DESC, term ASC
       LIMIT 8`
    )
    .all();

  const trendingPromptRows = db
    .prepare(
      `${PROMPT_SELECT}
       JOIN (
         SELECT o.prompt_id, COUNT(*) AS week_sales
         FROM orders o
         WHERE o.created_at >= datetime('now', '-7 days')
         GROUP BY o.prompt_id
       ) w ON w.prompt_id = p.id
       WHERE p.status = 'approved'
       ORDER BY w.week_sales DESC, p.sales_count DESC
       LIMIT 6`
    )
    .all();

  const featuredRows = db
    .prepare(
      `${PROMPT_SELECT}
       WHERE p.status = 'approved'
       ORDER BY p.is_featured DESC, p.sales_count DESC, p.rating DESC, p.id DESC
       LIMIT 3`
    )
    .all();

  res.json({
    stats: {
      prompts,
      users,
      onlineNow,
      rating: Number(reviews.average) || 0,
      reviews: reviews.total,
    },
    trending: {
      terms: trendingTerms,
      prompts: trendingPromptRows.map((row) => serializePrompt(row, req.user)),
    },
    featured: featuredRows.map((row) => serializePrompt(row, req.user)),
  });
});

export default router;
