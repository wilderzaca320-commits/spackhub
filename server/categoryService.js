import { db } from './db.js';

/**
 * Construye el árbol de categorías a partir de SQLite.
 * `includeInactive` solo se usa en el panel de administración.
 * El contador de cada nodo cuenta prompts aprobados distintos, incluyendo
 * los de sus subcategorías (por eso se usa IN con los ids del subárbol).
 */
export function buildCategoryTree({ includeInactive = false } = {}) {
  const rows = db
    .prepare(
      `SELECT id, slug, nombre, icono, parent_id AS parentId, orden, activa
       FROM categories
       ${includeInactive ? '' : 'WHERE activa = 1'}
       ORDER BY orden ASC, id ASC`
    )
    .all();

  const byId = new Map();
  for (const row of rows) {
    byId.set(row.id, { ...row, activa: row.activa === 1, count: 0, children: [] });
  }

  const roots = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const countIds = (ids) => {
    if (!ids.length) return 0;
    const placeholders = ids.map(() => '?').join(', ');
    return db
      .prepare(
        `SELECT COUNT(DISTINCT pc.prompt_id) AS total
         FROM prompt_categories pc
         JOIN prompts p ON p.id = pc.prompt_id
         WHERE p.status = 'approved' AND pc.category_id IN (${placeholders})`
      )
      .get(...ids).total;
  };

  const countNode = (node) => {
    for (const child of node.children) {
      child.count = countIds([child.id]);
    }
    node.count = countIds([node.id, ...node.children.map((child) => child.id)]);
    return node;
  };

  return roots.map(countNode);
}

export function findCategoryBySlug(slug) {
  return db
    .prepare('SELECT id, slug, nombre, icono, parent_id AS parentId FROM categories WHERE slug = ? AND activa = 1')
    .get(String(slug || ''));
}

export function categoryIdsForSlug(slug) {
  const category = findCategoryBySlug(slug);
  if (!category) return null;
  const children = db
    .prepare('SELECT id FROM categories WHERE parent_id = ? AND activa = 1')
    .all(category.id)
    .map((row) => row.id);
  return { category, ids: [category.id, ...children] };
}
