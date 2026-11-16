import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { MODELS } from '../catalog.js';

const router = Router();

const STATUSES = ['Pendiente', 'En progreso', 'Entregado', 'Cancelado'];

router.get('/', requireAuth, (req, res) => {
  const items = db
    .prepare(
      `SELECT h.id, h.title, h.model, h.budget, h.description, h.status,
              h.created_at AS createdAt,
              c.id AS clientId, c.name AS clientName,
              r.id AS creatorId, r.name AS creatorName,
              r.avatar_key AS creatorAvatarKey,
              r.company AS creatorCompany
       FROM hire_requests h
       JOIN users c ON c.id = h.client_id
       JOIN users r ON r.id = h.creator_id
       WHERE h.client_id = ? OR h.creator_id = ?
       ORDER BY h.id DESC`
    )
    .all(req.user.id, req.user.id);

  res.json({ items });
});

router.post('/', requireAuth, (req, res) => {
  const creatorId = Number(req.body?.creatorId);
  const title = String(req.body?.title || '').trim();
  const model = String(req.body?.model || '').trim();
  const budget = Number(req.body?.budget);
  const description = String(req.body?.description || '').trim();

  if (!Number.isInteger(creatorId)) {
    return res.status(400).json({ error: 'Elegí un creador para tu encargo.' });
  }
  if (creatorId === req.user.id) {
    return res.status(400).json({ error: 'No podés contratarte a vos mismo.' });
  }

  const creator = db.prepare('SELECT * FROM users WHERE id = ?').get(creatorId);
  if (!creator) return res.status(404).json({ error: 'Ese creador no existe.' });

  if (title.length < 5 || title.length > 100) {
    return res.status(400).json({ error: 'El título del encargo debe tener entre 5 y 100 caracteres.' });
  }
  if (!MODELS.includes(model)) {
    return res.status(400).json({ error: 'Seleccioná un modelo de IA válido.' });
  }
  if (!Number.isFinite(budget) || budget < 0 || budget > 100000) {
    return res.status(400).json({ error: 'Ingresá un presupuesto válido.' });
  }
  if (description.length < 20 || description.length > 1500) {
    return res.status(400).json({ error: 'Describí el encargo con al menos 20 caracteres.' });
  }

  const info = db
    .prepare(
      `INSERT INTO hire_requests (client_id, creator_id, title, model, budget, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, creatorId, title, model, budget, description);

  return res.status(201).json({
    message: `Encargo enviado a ${creator.name}. Te responderá por la plataforma.`,
    hire: db
      .prepare(
        `SELECT h.id, h.title, h.model, h.budget, h.description, h.status,
                h.created_at AS createdAt,
                c.id AS clientId, c.name AS clientName,
                r.id AS creatorId, r.name AS creatorName,
                r.avatar_key AS creatorAvatarKey, r.company AS creatorCompany
         FROM hire_requests h
         JOIN users c ON c.id = h.client_id
         JOIN users r ON r.id = h.creator_id
         WHERE h.id = ?`
      )
      .get(info.lastInsertRowid),
  });
});

router.patch('/:id', requireAuth, (req, res) => {
  const hire = db.prepare('SELECT * FROM hire_requests WHERE id = ?').get(Number(req.params.id));
  if (!hire) return res.status(404).json({ error: 'Ese encargo no existe.' });
  if (hire.client_id !== req.user.id && hire.creator_id !== req.user.id) {
    return res.status(403).json({ error: 'No podés modificar un encargo ajeno.' });
  }

  const status = String(req.body?.status || '').trim();
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `El estado debe ser uno de: ${STATUSES.join(', ')}.` });
  }

  db.prepare('UPDATE hire_requests SET status = ? WHERE id = ?').run(status, hire.id);
  return res.json({ message: `Encargo marcado como "${status}".`, status });
});

export default router;
