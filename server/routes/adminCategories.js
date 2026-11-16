import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { buildCategoryTree } from '../categoryService.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

const MAX_NAME = 60;
const MAX_SLUG = 80;

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG);
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateBody(body, { partial = false } = {}) {
  const data = {};

  if (!partial || body?.nombre !== undefined) {
    const nombre = String(body?.nombre || '').trim();
    if (nombre.length < 2 || nombre.length > MAX_NAME) {
      return { error: `El nombre debe tener entre 2 y ${MAX_NAME} caracteres.` };
    }
    data.nombre = nombre;
  }

  if (!partial || body?.slug !== undefined) {
    const slug = slugify(body?.slug || body?.nombre);
    if (slug.length < 2) return { error: 'El identificador (slug) no es válido.' };
    data.slug = slug;
  }

  if (!partial || body?.icono !== undefined) {
    const icono = String(body?.icono || '').trim();
    if (!/^[A-Za-z][A-Za-z0-9]{1,39}$/.test(icono)) {
      return { error: 'El icono debe ser un nombre de icono de lucide-react.' };
    }
    data.icono = icono;
  }

  if (!partial || body?.parentId !== undefined) {
    const raw = body?.parentId;
    if (raw === null || raw === undefined || raw === '') {
      data.parentId = null;
    } else {
      const parentId = parseId(raw);
      if (!parentId) return { error: 'La categoría padre no es válida.' };
      const parent = db
        .prepare('SELECT id, parent_id AS parentId FROM categories WHERE id = ?')
        .get(parentId);
      if (!parent) return { error: 'La categoría padre no existe.' };
      if (parent.parentId) return { error: 'Solo se permiten dos niveles de categorías.' };
      data.parentId = parentId;
    }
  }

  if (body?.orden !== undefined) {
    const orden = Number(body.orden);
    if (!Number.isInteger(orden) || orden < 0) {
      return { error: 'El orden debe ser un número entero mayor o igual a 0.' };
    }
    data.orden = orden;
  }

  if (body?.activa !== undefined) {
    data.activa = body.activa ? 1 : 0;
  }

  return { value: data };
}

router.get('/', (_req, res) => {
  res.json({ items: buildCategoryTree({ includeInactive: true }) });
});

router.post('/', (req, res) => {
  const result = validateBody(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  const data = result.value;

  const exists = db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(data.slug);
  if (exists) return res.status(409).json({ error: 'Ya existe una categoría con ese identificador.' });

  const orden =
    data.orden ??
    (db
      .prepare(
        `SELECT COALESCE(MAX(orden), 0) + 1 AS next FROM categories
         WHERE parent_id IS ${data.parentId ? '?' : 'NULL'}`
      )
      .get(...(data.parentId ? [data.parentId] : [])).next || 1);

  const info = db
    .prepare(
      `INSERT INTO categories (slug, nombre, icono, parent_id, orden, activa)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(data.slug, data.nombre, data.icono, data.parentId, orden, data.activa ?? 1);

  res.status(201).json({
    id: Number(info.lastInsertRowid),
    message: 'Categoría creada.',
  });
});

router.patch('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'El identificador de la categoría no es válido.' });

  const current = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Esa categoría no existe.' });

  const result = validateBody(req.body, { partial: true });
  if (result.error) return res.status(400).json({ error: result.error });
  const data = result.value;

  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === id) {
      return res.status(400).json({ error: 'Una categoría no puede ser su propia padre.' });
    }
    const hasChildren = db.prepare('SELECT 1 FROM categories WHERE parent_id = ? LIMIT 1').get(id);
    if (hasChildren) {
      return res.status(400).json({ error: 'Una categoría con subcategorías no puede ser subcategoría.' });
    }
  }

  if (data.slug && data.slug !== current.slug) {
    const exists = db.prepare('SELECT 1 FROM categories WHERE slug = ? AND id <> ?').get(data.slug, id);
    if (exists) return res.status(409).json({ error: 'Ya existe otra categoría con ese identificador.' });
  }

  const next = {
    slug: data.slug ?? current.slug,
    nombre: data.nombre ?? current.nombre,
    icono: data.icono ?? current.icono,
    parent_id: data.parentId !== undefined ? data.parentId : current.parent_id,
    orden: data.orden ?? current.orden,
    activa: data.activa ?? current.activa,
  };

  db.prepare(
    `UPDATE categories
     SET slug = ?, nombre = ?, icono = ?, parent_id = ?, orden = ?, activa = ?
     WHERE id = ?`
  ).run(next.slug, next.nombre, next.icono, next.parent_id, next.orden, next.activa, id);

  res.json({ id, message: 'Categoría actualizada.' });
});

router.post('/reorder', (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Enviá una lista de categorías con su nuevo orden.' });
  }

  const parsed = [];
  for (const item of items) {
    const id = parseId(item?.id);
    const orden = Number(item?.orden);
    if (!id || !Number.isInteger(orden) || orden < 0) {
      return res.status(400).json({ error: 'Cada categoría necesita un id y un orden válidos.' });
    }
    const parentId = item?.parentId === null || item?.parentId === undefined ? null : parseId(item.parentId);
    if (item?.parentId !== null && item?.parentId !== undefined && !parentId) {
      return res.status(400).json({ error: 'La categoría padre no es válida.' });
    }
    parsed.push({ id, orden, parentId });
  }

  const update = db.prepare('UPDATE categories SET orden = ?, parent_id = ? WHERE id = ?');
  db.transaction(() => {
    for (const item of parsed) update.run(item.orden, item.parentId, item.id);
  })();

  res.json({ ok: true, message: 'Orden guardado.' });
});

router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'El identificador de la categoría no es válido.' });

  const current = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Esa categoría no existe.' });

  db.transaction(() => {
    db.prepare('UPDATE categories SET activa = 0 WHERE id = ?').run(id);
    db.prepare('UPDATE categories SET activa = 0 WHERE parent_id = ?').run(id);
  })();

  res.json({ ok: true, message: 'Categoría desactivada.' });
});

export default router;
