import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

function companyFor(user) {
  const row = db.prepare('SELECT * FROM companies WHERE user_id = ?').get(user.id);
  if (row) {
    return {
      name: row.name,
      taxId: row.tax_id,
      billingEmail: row.billing_email,
      seats: row.seats,
    };
  }
  return {
    name: user.company || '',
    taxId: '',
    billingEmail: user.email,
    seats: 5,
  };
}

router.get('/', requireAuth, (req, res) => {
  res.json({ company: companyFor(req.user), isCorporate: req.user.account_type === 'corporate' });
});

router.put('/', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const taxId = String(req.body?.taxId || '').trim().slice(0, 40);
  const billingEmail = String(req.body?.billingEmail || '').trim().toLowerCase();
  const seats = Math.min(500, Math.max(1, Number(req.body?.seats) || 5));

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ error: 'El nombre de la empresa debe tener entre 2 y 80 caracteres.' });
  }
  if (billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
    return res.status(400).json({ error: 'Ingresá un email de facturación válido.' });
  }

  const save = db.transaction(() => {
    db.prepare(
      `INSERT INTO companies (user_id, name, tax_id, billing_email, seats)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         name = excluded.name,
         tax_id = excluded.tax_id,
         billing_email = excluded.billing_email,
         seats = excluded.seats,
         updated_at = datetime('now')`
    ).run(req.user.id, name, taxId, billingEmail || req.user.email, seats);

    db.prepare("UPDATE users SET company = ?, account_type = 'corporate', active_role = 'empresario' WHERE id = ?").run(
      name,
      req.user.id
    );
  });

  save();

  return res.json({ message: 'Perfil de empresa guardado.', company: companyFor({ ...req.user, company: name }) });
});

/* ----------------------------- Miembros ----------------------------- */

router.get('/members', requireAuth, (req, res) => {
  const items = db
    .prepare(
      `SELECT id, name, email, role, status, formulas_created AS formulasCreated,
              created_at AS createdAt
       FROM company_members WHERE owner_id = ? ORDER BY id ASC`
    )
    .all(req.user.id);

  res.json({ items });
});

router.post('/members', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = String(req.body?.role || 'Prompt Engineer').trim().slice(0, 40);

  if (name.length < 2) return res.status(400).json({ error: 'Ingresá el nombre del miembro.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Ingresá un email válido para invitar.' });
  }

  const exists = db
    .prepare('SELECT 1 FROM company_members WHERE owner_id = ? AND email = ?')
    .get(req.user.id, email);
  if (exists) {
    return res.status(409).json({ error: 'Ese email ya fue invitado al equipo.' });
  }

  const info = db
    .prepare("INSERT INTO company_members (owner_id, name, email, role, status) VALUES (?, ?, ?, ?, 'Invitado')")
    .run(req.user.id, name, email, role);

  return res.status(201).json({
    message: `Invitación enviada a ${email}.`,
    member: db
      .prepare(
        `SELECT id, name, email, role, status, formulas_created AS formulasCreated,
                created_at AS createdAt
         FROM company_members WHERE id = ?`
      )
      .get(info.lastInsertRowid),
  });
});

router.patch('/members/:id', requireAuth, (req, res) => {
  const member = db
    .prepare('SELECT * FROM company_members WHERE id = ? AND owner_id = ?')
    .get(Number(req.params.id), req.user.id);
  if (!member) return res.status(404).json({ error: 'Ese miembro no existe.' });

  const role = req.body?.role === undefined ? member.role : String(req.body.role).trim().slice(0, 40);
  const status =
    req.body?.status === undefined ? member.status : String(req.body.status).trim().slice(0, 30);

  db.prepare('UPDATE company_members SET role = ?, status = ? WHERE id = ?').run(
    role,
    status,
    member.id
  );

  return res.json({
    message: 'Miembro actualizado.',
    member: db
      .prepare(
        `SELECT id, name, email, role, status, formulas_created AS formulasCreated,
                created_at AS createdAt
         FROM company_members WHERE id = ?`
      )
      .get(member.id),
  });
});

router.delete('/members/:id', requireAuth, (req, res) => {
  const info = db
    .prepare('DELETE FROM company_members WHERE id = ? AND owner_id = ?')
    .run(Number(req.params.id), req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Ese miembro no existe.' });
  return res.json({ message: 'Miembro eliminado del equipo.' });
});

/* ----------------------------- API keys ----------------------------- */

router.get('/keys', requireAuth, (req, res) => {
  const items = db
    .prepare(
      `SELECT id, name, prefix, status, total_calls AS totalCalls,
              avg_latency_ms AS avgLatencyMs, created_at AS createdAt, last_used AS lastUsed
       FROM api_keys WHERE owner_id = ? ORDER BY id DESC`
    )
    .all(req.user.id)
    .map((key) => ({ ...key, maskedKey: `${key.prefix}${'•'.repeat(18)}` }));

  res.json({ items });
});

router.post('/keys', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (name.length < 2 || name.length > 40) {
    return res.status(400).json({ error: 'El nombre de la clave debe tener entre 2 y 40 caracteres.' });
  }

  const secret = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  const prefix = secret.slice(0, 16);

  const info = db
    .prepare("INSERT INTO api_keys (owner_id, name, prefix, status) VALUES (?, ?, ?, 'Activa')")
    .run(req.user.id, name, prefix);

  return res.status(201).json({
    message: 'Clave creada. Guardala ahora: no se vuelve a mostrar completa.',
    key: secret,
    item: db
      .prepare(
        `SELECT id, name, prefix, status, total_calls AS totalCalls,
                avg_latency_ms AS avgLatencyMs, created_at AS createdAt, last_used AS lastUsed
         FROM api_keys WHERE id = ?`
      )
      .get(info.lastInsertRowid),
  });
});

router.patch('/keys/:id', requireAuth, (req, res) => {
  const key = db
    .prepare('SELECT * FROM api_keys WHERE id = ? AND owner_id = ?')
    .get(Number(req.params.id), req.user.id);
  if (!key) return res.status(404).json({ error: 'Esa clave no existe.' });

  const status = String(req.body?.status || '').trim();
  if (!['Activa', 'Revocada'].includes(status)) {
    return res.status(400).json({ error: 'El estado debe ser Activa o Revocada.' });
  }

  db.prepare('UPDATE api_keys SET status = ? WHERE id = ?').run(status, key.id);
  return res.json({ message: `Clave ${status.toLowerCase()}.`, status });
});

router.delete('/keys/:id', requireAuth, (req, res) => {
  const info = db
    .prepare('DELETE FROM api_keys WHERE id = ? AND owner_id = ?')
    .run(Number(req.params.id), req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'Esa clave no existe.' });
  return res.json({ message: 'Clave eliminada.' });
});

export default router;
