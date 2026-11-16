import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, optionalAuth } from '../auth.js';
import {
  CATEGORIES,
  MODELS,
  PREVIEW_KEYS,
  PROMPT_SELECT,
  publicPrompt,
} from '../catalog.js';
import { categoryIdsForSlug, findCategoryBySlug, buildCategoryTree } from '../categoryService.js';
import { LEGACY_MAP } from '../categoriesSeed.js';

const router = Router();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function findRow(id) {
  return db.prepare(`${PROMPT_SELECT} WHERE p.id = ?`).get(Number(id));
}

function accessFor(row, user) {
  if (!row) {
    return { owned: false, isFavorited: false, isOwner: false, hasReviewed: false, canReadMaster: false };
  }

  if (!user) {
    return { owned: false, isFavorited: false, isOwner: false, hasReviewed: false, canReadMaster: false };
  }

  const owned = !!db
    .prepare('SELECT 1 FROM orders WHERE buyer_id = ? AND prompt_id = ?')
    .get(user.id, row.id);
  const isFavorited = !!db
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND prompt_id = ?')
    .get(user.id, row.id);
  const hasReviewed = !!db
    .prepare('SELECT 1 FROM reviews WHERE user_id = ? AND prompt_id = ?')
    .get(user.id, row.id);
  const isOwner = row.seller_id === user.id;
  const canReadMaster = owned || isOwner || user.role === 'admin';

  return { owned, isFavorited, isOwner, hasReviewed, canReadMaster };
}

export function serializePrompt(row, user) {
  const access = accessFor(row, user);
  const categories = db
    .prepare(
      `SELECT c.id, c.slug, c.nombre, c.parent_id AS parentId, c.icono
       FROM prompt_categories pc
       JOIN categories c ON c.id = pc.category_id
       WHERE pc.prompt_id = ?
       ORDER BY c.parent_id IS NOT NULL, c.orden`
    )
    .all(row.id);
  return {
    ...publicPrompt(row, { includeMaster: access.canReadMaster }),
    categories,
    owned: access.owned,
    isFavorited: access.isFavorited,
    isOwner: access.isOwner,
    hasReviewed: access.hasReviewed,
    canReadMaster: access.canReadMaster,
  };
}

function parseVariables(input) {
  if (input === undefined) return { value: [] };
  if (!Array.isArray(input)) return { error: 'Las variables deben enviarse como una lista.' };
  if (input.length > 12) return { error: 'Una fórmula puede tener como máximo 12 variables.' };

  const variables = [];
  for (const slot of input) {
    if (!slot || typeof slot !== 'object') {
      return { error: 'Cada variable debe tener nombre, etiqueta y opciones.' };
    }
    const name = String(slot.name || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!name) return { error: 'Todas las variables necesitan un nombre válido.' };

    const options = Array.isArray(slot.options)
      ? slot.options.map((option) => String(option).trim()).filter(Boolean).slice(0, 40)
      : [];
    const defaultValue = String(slot.defaultValue || options[0] || '').trim();

    variables.push({
      name,
      label: String(slot.label || name).trim().slice(0, 80),
      defaultValue,
      options: options.length ? options : defaultValue ? [defaultValue] : [],
      description: String(slot.description || '').trim().slice(0, 180),
    });
  }
  return { value: variables };
}

function resolveCategories(body) {
  const rawId = body?.categoryId;
  if (rawId !== undefined && rawId !== null && rawId !== '') {
    const categoryId = Number(rawId);
    const parent = db
      .prepare('SELECT id, nombre, parent_id AS parentId FROM categories WHERE id = ? AND activa = 1')
      .get(categoryId);
    if (!parent || parent.parentId) {
      return { error: 'Seleccioná una categoría principal válida.' };
    }

    const validSubs = db
      .prepare('SELECT id FROM categories WHERE parent_id = ? AND activa = 1')
      .all(categoryId)
      .map((row) => row.id);
    const subs = Array.isArray(body?.subcategoryIds)
      ? [...new Set(body.subcategoryIds.map(Number).filter(Number.isInteger))]
      : [];

    if (subs.length < 1) return { error: 'Seleccioná al menos una subcategoría.' };
    if (subs.some((id) => !validSubs.includes(id))) {
      return { error: 'Alguna de las subcategorías no pertenece a la categoría elegida.' };
    }

    return {
      value: {
        categoryId: parent.id,
        subcategoryIds: subs,
        categoryName: parent.nombre,
      },
    };
  }

  // Compatibilidad con clientes anteriores que enviaban solo el nombre.
  const category = String(body?.category || '').trim();
  const [mainSlug, subSlug] = LEGACY_MAP[category] || [];
  const main = mainSlug ? findCategoryBySlug(mainSlug) : null;
  const sub = subSlug ? findCategoryBySlug(subSlug) : null;

  return {
    value: {
      categoryId: main?.id ?? null,
      subcategoryIds: sub ? [sub.id] : [],
      categoryName: main?.nombre || category,
    },
  };
}

function savePromptCategories(promptId, categories) {
  db.prepare('DELETE FROM prompt_categories WHERE prompt_id = ?').run(promptId);
  if (!categories.categoryId) return;
  const insert = db.prepare(
    'INSERT OR IGNORE INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)'
  );
  insert.run(promptId, categories.categoryId);
  for (const subId of categories.subcategoryIds) insert.run(promptId, subId);
}

function validatePromptBody(body) {
  const title = String(body?.title || '').trim();
  const description = String(body?.description || '').trim();
  const fullDescription = String(body?.fullDescription || '').trim();
  const model = String(body?.model || '').trim();
  const category = String(body?.category || '').trim();
  const masterPrompt = String(body?.masterPrompt || '').trim();
  const negativePrompt = String(body?.negativePrompt || '').trim();
  const price = Number(body?.price);
  const videoUrl = String(body?.videoUrl || '').trim().slice(0, 500);

  if (title.length < 5 || title.length > 100) {
    return { error: 'El título debe tener entre 5 y 100 caracteres.' };
  }
  if (description.length < 20 || description.length > 600) {
    return { error: 'La descripción debe tener entre 20 y 600 caracteres.' };
  }
  if (fullDescription.length > 2000) {
    return { error: 'La descripción larga no puede superar 2000 caracteres.' };
  }
  if (!MODELS.includes(model)) {
    return { error: 'Seleccioná un modelo de IA válido.' };
  }
  const categories = resolveCategories(body);
  if (categories.error) return { error: categories.error };
  if (!Number.isInteger(price) || price < 1 || price > 500) {
    return { error: 'El precio debe ser un número entero de créditos entre 1 y 500.' };
  }
  if (masterPrompt.length < 20 || masterPrompt.length > 4000) {
    return { error: 'El prompt maestro debe tener entre 20 y 4000 caracteres.' };
  }
  if (negativePrompt.length > 1000) {
    return { error: 'El prompt negativo no puede superar 1000 caracteres.' };
  }

  const parsedVariables = parseVariables(body?.variables);
  if (parsedVariables.error) return { error: parsedVariables.error };

  const previewImages = Array.isArray(body?.previewImages)
    ? body.previewImages.map((key) => String(key).trim()).filter(Boolean)
    : [];
  if (previewImages.length < 1) {
    return { error: 'Elegí al menos una imagen de vista previa.' };
  }
  if (previewImages.some((key) => !PREVIEW_KEYS.includes(key))) {
    return { error: 'Alguna de las imágenes elegidas no es válida.' };
  }

  const tags = Array.isArray(body?.tags)
    ? body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 10)
    : [];

  return {
    value: {
      title,
      description,
      fullDescription: fullDescription || description,
      model,
      category: categories.value.categoryName,
      price,
      masterPrompt,
      negativePrompt,
      videoUrl,
      variables: parsedVariables.value,
      previewImages: previewImages.slice(0, 6),
      tags,
      categoryId: categories.value.categoryId,
      subcategoryIds: categories.value.subcategoryIds,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Catálogo público                                                    */
/* ------------------------------------------------------------------ */

router.get('/catalog', (_req, res) => {
  res.json({
    categories: CATEGORIES,
    tree: buildCategoryTree(),
    models: MODELS,
    previewKeys: PREVIEW_KEYS,
  });
});

const SORT_ALIASES = {
  popular: 'trending',
  nuevo: 'newest',
  precio: 'price_asc',
  'precio-desc': 'price_desc',
  rating: 'rating',
  ventas: 'sales',
};

const SORTS = {
  trending: 'p.is_featured DESC, p.sales_count DESC, p.rating DESC',
  newest: 'p.created_at DESC',
  rating: 'p.rating DESC, p.reviews_count DESC',
  sales: 'p.sales_count DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
};

router.get('/', optionalAuth, (req, res) => {
  const search = String(req.query.q ?? req.query.search ?? '').trim();
  const categoryInput = String(req.query.category || '').trim();
  const subInput = String(req.query.sub || '').trim();
  const model = String(req.query.model || '').trim();
  const rawSort = String(req.query.sort || 'trending');
  const sortKey = SORT_ALIASES[rawSort] || rawSort;
  const sort = SORTS[sortKey] ? sortKey : 'trending';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 12));
  const offset = (page - 1) * limit;
  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);

  const where = ["p.status = 'approved'"];
  const params = [];
  let activeCategory = null;

  if (search) {
    where.push('(p.title LIKE ? OR p.description LIKE ? OR p.tags LIKE ? OR u.name LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  if (subInput && subInput !== 'all') {
    const sub = findCategoryBySlug(subInput);
    if (sub && sub.parentId) {
      where.push('EXISTS (SELECT 1 FROM prompt_categories pc WHERE pc.prompt_id = p.id AND pc.category_id = ?)');
      params.push(sub.id);
      activeCategory = findCategoryBySlug(categoryInput) || null;
    } else {
      where.push('0 = 1');
    }
  } else if (categoryInput && categoryInput !== 'all') {
    const tree = categoryIdsForSlug(categoryInput);
    if (tree) {
      const placeholders = tree.ids.map(() => '?').join(', ');
      where.push(
        `EXISTS (SELECT 1 FROM prompt_categories pc WHERE pc.prompt_id = p.id AND pc.category_id IN (${placeholders}))`
      );
      params.push(...tree.ids);
      activeCategory = tree.category;
    } else if (CATEGORIES.includes(categoryInput)) {
      // Compatibilidad con categorías de texto anteriores a la migración.
      where.push('p.category = ?');
      params.push(categoryInput);
    } else {
      where.push('0 = 1');
    }
  }

  if (model && model !== 'all' && MODELS.includes(model)) {
    where.push('p.model = ?');
    params.push(model);
  }
  if (Number.isFinite(minPrice) && minPrice >= 0) {
    where.push('p.price >= ?');
    params.push(minPrice);
  }
  if (Number.isFinite(maxPrice) && maxPrice >= 0) {
    where.push('p.price <= ?');
    params.push(maxPrice);
  }

  const whereSql = where.join(' AND ');
  const total = db
    .prepare(
      `SELECT COUNT(*) AS total FROM prompts p JOIN users u ON u.id = p.seller_id WHERE ${whereSql}`
    )
    .get(...params).total;

  const rows = db
    .prepare(`${PROMPT_SELECT} WHERE ${whereSql} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  return res.json({
    items: rows.map((row) => serializePrompt(row, req.user)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    sort,
    category: activeCategory ? { slug: activeCategory.slug, nombre: activeCategory.nombre } : null,
  });
});

router.get('/favorites', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `${PROMPT_SELECT}
       JOIN favorites f ON f.prompt_id = p.id
       WHERE f.user_id = ? AND p.status = 'approved'
       ORDER BY f.created_at DESC`
    )
    .all(req.user.id);

  return res.json({ items: rows.map((row) => serializePrompt(row, req.user)) });
});

router.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(`${PROMPT_SELECT} WHERE p.seller_id = ? ORDER BY p.updated_at DESC`)
    .all(req.user.id);

  return res.json({ items: rows.map((row) => serializePrompt(row, req.user)) });
});

/* ------------------------------------------------------------------ */
/* Detalle, compra, reseñas y favoritos                                */
/* ------------------------------------------------------------------ */

router.get('/:id', optionalAuth, (req, res) => {
  const row = findRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Esa fórmula no existe.' });

  const isOwner = req.user && row.seller_id === req.user.id;
  const isAdmin = req.user?.role === 'admin';
  if (row.status !== 'approved' && !isOwner && !isAdmin) {
    return res.status(404).json({ error: 'Esa fórmula no está publicada.' });
  }

  const reviews = db
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt,
              u.name, u.email, u.avatar_key AS avatarKey
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.prompt_id = ?
       ORDER BY r.created_at DESC
       LIMIT 30`
    )
    .all(row.id)
    .map((review) => ({
      ...review,
      authorName: review.name || review.email.split('@')[0],
      avatarKey: review.avatarKey || '',
    }));

  return res.json({ prompt: serializePrompt(row, req.user), reviews });
});

router.post('/', requireAuth, (req, res) => {
  const result = validatePromptBody(req.body);
  if (result.error) return res.status(400).json({ error: result.error });

  const data = result.value;
  const info = db
    .prepare(
      `INSERT INTO prompts
        (seller_id, title, description, full_description, model, category, price,
         master_prompt, negative_prompt, variables, preview_images, tags, status, video_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(
      req.user.id,
      data.title,
      data.description,
      data.fullDescription,
      data.model,
      data.category,
      data.price,
      data.masterPrompt,
      data.negativePrompt,
      JSON.stringify(data.variables),
      JSON.stringify(data.previewImages),
      JSON.stringify(data.tags),
      data.videoUrl
    );

  savePromptCategories(Number(info.lastInsertRowid), data);

  const row = findRow(info.lastInsertRowid);
  return res.status(201).json({
    prompt: serializePrompt(row, req.user),
    message: 'Tu fórmula entró a la cola de revisión QA. Te avisaremos cuando esté publicada.',
  });
});

router.patch('/:id', requireAuth, (req, res) => {
  const row = findRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Esa fórmula no existe.' });
  if (row.seller_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No podés editar una fórmula que no te pertenece.' });
  }

  const result = validatePromptBody({ ...publicPrompt(row, { includeMaster: true }), ...req.body });
  if (result.error) return res.status(400).json({ error: result.error });

  const data = result.value;
  db.prepare(
    `UPDATE prompts SET
       title = ?, description = ?, full_description = ?, model = ?, category = ?, price = ?,
       master_prompt = ?, negative_prompt = ?, variables = ?, preview_images = ?, tags = ?,
       video_url = ?, status = CASE WHEN ? = 'admin' THEN status ELSE 'pending' END,
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    data.title,
    data.description,
    data.fullDescription,
    data.model,
    data.category,
    data.price,
    data.masterPrompt,
    data.negativePrompt,
    JSON.stringify(data.variables),
    JSON.stringify(data.previewImages),
    JSON.stringify(data.tags),
    data.videoUrl,
    req.user.role,
    row.id
  );

  savePromptCategories(row.id, data);

  return res.json({
    prompt: serializePrompt(findRow(row.id), req.user),
    message:
      req.user.role === 'admin'
        ? 'Fórmula actualizada.'
        : 'Fórmula actualizada y reenviada a revisión QA.',
  });
});

router.post('/:id/purchase', requireAuth, (req, res, next) => {
  try {
    const purchase = db.transaction((buyerId, promptId) => {
      const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(promptId);
      if (!prompt || prompt.status !== 'approved') {
        throw new HttpError(404, 'Esa fórmula no está disponible para comprar.');
      }
      if (prompt.seller_id === buyerId) {
        throw new HttpError(400, 'No podés comprar tu propia fórmula.');
      }

      const existing = db
        .prepare('SELECT id FROM orders WHERE buyer_id = ? AND prompt_id = ?')
        .get(buyerId, promptId);
      if (existing) {
        throw new HttpError(409, 'Ya compraste esta fórmula. Está en tu biblioteca.');
      }

      const buyer = db.prepare('SELECT * FROM users WHERE id = ?').get(buyerId);
      if (buyer.credits < prompt.price) {
        throw new HttpError(
          400,
          `Te faltan ${prompt.price - buyer.credits} créditos para comprar esta fórmula.`
        );
      }

      const amount = prompt.price;
      const sellerEarning = Math.floor(amount * 0.9);
      const platformFee = amount - sellerEarning;

      db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(amount, buyerId);
      db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(
        sellerEarning,
        prompt.seller_id
      );

      const orderInfo = db
        .prepare(
          `INSERT INTO orders (buyer_id, prompt_id, amount, seller_earning, platform_fee)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(buyerId, promptId, amount, sellerEarning, platformFee);

      db.prepare(
        `INSERT INTO library (user_id, prompt_id, order_id) VALUES (?, ?, ?)`
      ).run(buyerId, promptId, orderInfo.lastInsertRowid);

      db.prepare('UPDATE prompts SET sales_count = sales_count + 1 WHERE id = ?').run(promptId);

      db.prepare(
        `INSERT INTO credit_transactions (user_id, amount, type, description, reference)
         VALUES (?, ?, 'purchase', ?, ?)`
      ).run(
        buyerId,
        -amount,
        `Compra de "${prompt.title}"`,
        `prompt:${promptId}`
      );

      db.prepare(
        `INSERT INTO credit_transactions (user_id, amount, type, description, reference)
         VALUES (?, ?, 'sale', ?, ?)`
      ).run(
        prompt.seller_id,
        sellerEarning,
        `Venta de "${prompt.title}" (90%)`,
        `prompt:${promptId}`
      );

      const updatedBuyer = db.prepare('SELECT * FROM users WHERE id = ?').get(buyerId);

      return {
        orderId: Number(orderInfo.lastInsertRowid),
        amount,
        sellerEarning,
        platformFee,
        credits: updatedBuyer.credits,
      };
    });

    const result = purchase(req.user.id, Number(req.params.id));
    const row = findRow(req.params.id);

    return res.status(201).json({
      ...result,
      prompt: serializePrompt(row, req.user),
      message: '¡Compra realizada! La fórmula ya está en tu biblioteca.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
});

router.post('/:id/reviews', requireAuth, (req, res) => {
  const promptId = Number(req.params.id);
  const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(promptId);
  if (!prompt || prompt.status !== 'approved') {
    return res.status(404).json({ error: 'Esa fórmula no está publicada.' });
  }
  if (prompt.seller_id === req.user.id) {
    return res.status(403).json({ error: 'No podés reseñar tu propia fórmula.' });
  }

  const bought = db
    .prepare('SELECT 1 FROM orders WHERE buyer_id = ? AND prompt_id = ?')
    .get(req.user.id, promptId);
  if (!bought) {
    return res.status(403).json({ error: 'Solo los compradores verificados pueden dejar una reseña.' });
  }

  const rating = Number(req.body?.rating);
  const comment = String(req.body?.comment || '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'La calificación debe ser un entero entre 1 y 5.' });
  }
  if (comment.length > 500) {
    return res.status(400).json({ error: 'El comentario no puede superar 500 caracteres.' });
  }

  const existing = db
    .prepare('SELECT id FROM reviews WHERE user_id = ? AND prompt_id = ?')
    .get(req.user.id, promptId);
  if (existing) {
    return res.status(409).json({ error: 'Ya dejaste una reseña para esta fórmula.' });
  }

  const save = db.transaction(() => {
    db.prepare(
      'INSERT INTO reviews (prompt_id, user_id, rating, comment) VALUES (?, ?, ?, ?)'
    ).run(promptId, req.user.id, rating, comment);

    const stats = db
      .prepare('SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average FROM reviews WHERE prompt_id = ?')
      .get(promptId);

    db.prepare(
      'UPDATE prompts SET rating = ?, reviews_count = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(Number(stats.average.toFixed(2)), stats.count, promptId);

    return stats;
  });

  const stats = save();
  return res.status(201).json({
    message: '¡Gracias por tu reseña!',
    rating: Number(stats.average.toFixed(2)),
    reviewsCount: stats.count,
  });
});

router.post('/:id/favorite', requireAuth, (req, res) => {
  const promptId = Number(req.params.id);
  const prompt = db.prepare('SELECT 1 FROM prompts WHERE id = ?').get(promptId);
  if (!prompt) return res.status(404).json({ error: 'Esa fórmula no existe.' });

  const existing = db
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND prompt_id = ?')
    .get(req.user.id, promptId);

  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND prompt_id = ?').run(req.user.id, promptId);
    return res.json({ favorited: false, message: 'Fórmula quitada de favoritos.' });
  }

  db.prepare('INSERT INTO favorites (user_id, prompt_id) VALUES (?, ?)').run(req.user.id, promptId);
  return res.json({ favorited: true, message: 'Fórmula guardada en favoritos.' });
});

export default router;
