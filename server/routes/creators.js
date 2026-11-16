import { Router } from 'express';
import { db } from '../db.js';
import { PROMPT_SELECT, publicPrompt } from '../catalog.js';

const router = Router();

function mapCreator(row) {
  const categories = row.categories ? String(row.categories).split(',') : [];
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    bio: row.bio,
    plan: row.plan,
    avatarKey: row.avatarKey,
    joinedAt: row.joinedAt,
    rating: Number((row.rating || 0).toFixed ? row.rating.toFixed(2) : row.rating),
    reviewsCount: row.reviewsCount || 0,
    prompts: row.prompts || 0,
    sales: row.sales || 0,
    categories,
    specialties: categories,
  };
}

/** Directorio de creadores con al menos una fórmula publicada. */
router.get('/', (req, res) => {
  const search = String(req.query.search || '').trim();
  const category = String(req.query.category || '').trim();

  const where = [
    "EXISTS (SELECT 1 FROM prompts p WHERE p.seller_id = u.id AND p.status = 'approved')",
  ];
  const params = [];

  if (search) {
    where.push('(u.name LIKE ? OR u.company LIKE ? OR u.bio LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (category && category !== 'all') {
    where.push(
      "EXISTS (SELECT 1 FROM prompts pc WHERE pc.seller_id = u.id AND pc.status = 'approved' AND pc.category = ?)"
    );
    params.push(category);
  }

  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.company, u.bio, u.plan,
              u.avatar_key AS avatarKey, u.created_at AS joinedAt,
              (SELECT COUNT(*) FROM prompts p WHERE p.seller_id = u.id AND p.status = 'approved') AS prompts,
              (SELECT COALESCE(SUM(p.sales_count), 0) FROM prompts p WHERE p.seller_id = u.id AND p.status = 'approved') AS sales,
              (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r
                JOIN prompts p ON p.id = r.prompt_id WHERE p.seller_id = u.id) AS rating,
              (SELECT COUNT(*) FROM reviews r
                JOIN prompts p ON p.id = r.prompt_id WHERE p.seller_id = u.id) AS reviewsCount,
              (SELECT GROUP_CONCAT(DISTINCT p.category) FROM prompts p
                WHERE p.seller_id = u.id AND p.status = 'approved') AS categories
       FROM users u
       WHERE ${where.join(' AND ')}
       ORDER BY sales DESC, rating DESC, u.id ASC`
    )
    .all(...params);

  return res.json({ items: rows.map(mapCreator) });
});

/** Perfil público + fórmulas publicadas. */
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.company, u.bio, u.plan,
              u.avatar_key AS avatarKey, u.created_at AS joinedAt,
              (SELECT COUNT(*) FROM prompts p WHERE p.seller_id = u.id AND p.status = 'approved') AS prompts,
              (SELECT COALESCE(SUM(p.sales_count), 0) FROM prompts p WHERE p.seller_id = u.id AND p.status = 'approved') AS sales,
              (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r
                JOIN prompts p ON p.id = r.prompt_id WHERE p.seller_id = u.id) AS rating,
              (SELECT COUNT(*) FROM reviews r
                JOIN prompts p ON p.id = r.prompt_id WHERE p.seller_id = u.id) AS reviewsCount,
              (SELECT GROUP_CONCAT(DISTINCT p.category) FROM prompts p
                WHERE p.seller_id = u.id AND p.status = 'approved') AS categories
       FROM users u WHERE u.id = ?`
    )
    .get(id);

  if (!row) return res.status(404).json({ error: 'Ese creador no existe.' });

  const prompts = db
    .prepare(
      `${PROMPT_SELECT} WHERE p.seller_id = ? AND p.status = 'approved' ORDER BY p.sales_count DESC`
    )
    .all(id)
    .map((prompt) => publicPrompt(prompt));

  return res.json({ creator: mapCreator(row), prompts });
});

export default router;
