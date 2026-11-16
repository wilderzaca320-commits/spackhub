import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { createNotification } from '../notify.js';

const router = Router();

router.use(requireAuth);

function otherUser(id) {
  return db
    .prepare('SELECT id, name, email, avatar_key AS avatarKey FROM users WHERE id = ?')
    .get(id);
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.id, m.contenido, m.leido, m.created_at AS createdAt,
              t.other_id AS otherId, u.name AS otherName, u.email AS otherEmail,
              u.avatar_key AS otherAvatarKey
       FROM messages m
       JOIN (
         SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS other_id,
                MAX(id) AS last_id
         FROM messages
         WHERE sender_id = ? OR receiver_id = ?
         GROUP BY other_id
       ) t ON t.last_id = m.id
       JOIN users u ON u.id = t.other_id
       ORDER BY m.id DESC`
    )
    .all(req.user.id, req.user.id, req.user.id)
    .map((row) => ({ ...row, leido: row.leido === 1 }));

  const unread = db
    .prepare('SELECT COUNT(*) AS total FROM messages WHERE receiver_id = ? AND leido = 0')
    .get(req.user.id).total;

  const conversations = rows.map((row) => ({
    otherId: row.otherId,
    otherName: row.otherName || row.otherEmail.split('@')[0],
    otherAvatarKey: row.otherAvatarKey || '',
    lastMessage: row.contenido,
    lastAt: row.createdAt,
    unread: db
      .prepare(
        'SELECT COUNT(*) AS total FROM messages WHERE receiver_id = ? AND sender_id = ? AND leido = 0'
      )
      .get(req.user.id, row.otherId).total,
  }));

  res.json({ items: conversations, unread });
});

router.get('/:userId', (req, res) => {
  const userId = Number(req.params.userId);
  const other = otherUser(userId);
  if (!other) return res.status(404).json({ error: 'Ese usuario no existe.' });

  db.prepare('UPDATE messages SET leido = 1 WHERE receiver_id = ? AND sender_id = ?').run(
    req.user.id,
    userId
  );

  const items = db
    .prepare(
      `SELECT m.id, m.sender_id AS senderId, m.receiver_id AS receiverId, m.prompt_id AS promptId,
              m.contenido, m.leido, m.created_at AS createdAt
       FROM messages m
       WHERE (m.sender_id = ? AND m.receiver_id = ?)
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.id ASC
       LIMIT 200`
    )
    .all(req.user.id, userId, userId, req.user.id)
    .map((row) => ({ ...row, leido: row.leido === 1, mine: row.senderId === req.user.id }));

  res.json({
    other: {
      id: other.id,
      name: other.name || other.email.split('@')[0],
      avatarKey: other.avatarKey || '',
    },
    items,
  });
});

router.post('/', (req, res) => {
  const receiverId = Number(req.body?.receiverId);
  const contenido = String(req.body?.contenido || '').trim();
  const promptId = req.body?.promptId ? Number(req.body.promptId) : null;

  if (!receiverId) return res.status(400).json({ error: 'Indicá a quién querés escribirle.' });
  if (receiverId === req.user.id) {
    return res.status(400).json({ error: 'No podés enviarte mensajes a vos mismo.' });
  }
  if (contenido.length < 1 || contenido.length > 2000) {
    return res.status(400).json({ error: 'El mensaje debe tener entre 1 y 2000 caracteres.' });
  }

  const receiver = otherUser(receiverId);
  if (!receiver) return res.status(404).json({ error: 'Ese usuario no existe.' });

  if (promptId) {
    const prompt = db.prepare('SELECT id FROM prompts WHERE id = ?').get(promptId);
    if (!prompt) return res.status(400).json({ error: 'La fórmula indicada no existe.' });
  }

  const info = db
    .prepare(
      `INSERT INTO messages (sender_id, receiver_id, prompt_id, contenido)
       VALUES (?, ?, ?, ?)`
    )
    .run(req.user.id, receiverId, promptId, contenido);

  createNotification(
    receiverId,
    'sistema',
    'Nuevo mensaje',
    `${req.user.name || req.user.email} te escribió: ${contenido.slice(0, 120)}`,
    `/mensajes/${req.user.id}`
  );

  res.status(201).json({
    message: 'Mensaje enviado.',
    item: db
      .prepare(
        `SELECT id, sender_id AS senderId, receiver_id AS receiverId, prompt_id AS promptId,
                contenido, leido, created_at AS createdAt
         FROM messages WHERE id = ?`
      )
      .get(info.lastInsertRowid),
  });
});

export default router;
