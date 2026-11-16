import { db } from './db.js';

/** Crea una notificación persistente para un usuario. */
export function createNotification(userId, tipo, titulo, mensaje, enlace = '') {
  if (!userId) return null;
  const info = db
    .prepare(
      `INSERT INTO notifications (user_id, tipo, titulo, mensaje, enlace)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, tipo, String(titulo).slice(0, 120), String(mensaje).slice(0, 500), enlace);
  return Number(info.lastInsertRowid);
}
