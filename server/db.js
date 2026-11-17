import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'sparkhub.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Esquema completo. Se crea una sola vez y es idempotente, así que arrancar
 * el servidor varias veces nunca borra datos.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    name          TEXT    NOT NULL DEFAULT '',
    role          TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    account_type  TEXT    NOT NULL DEFAULT 'individual' CHECK (account_type IN ('individual', 'corporate')),
    company       TEXT    NOT NULL DEFAULT '',
    credits       INTEGER NOT NULL DEFAULT 0,
    bio           TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS prompts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            TEXT    NOT NULL,
    description      TEXT    NOT NULL DEFAULT '',
    full_description TEXT    NOT NULL DEFAULT '',
    model            TEXT    NOT NULL,
    category         TEXT    NOT NULL,
    price            INTEGER NOT NULL DEFAULT 0,
    master_prompt    TEXT    NOT NULL,
    negative_prompt  TEXT    NOT NULL DEFAULT '',
    variables        TEXT    NOT NULL DEFAULT '[]',
    preview_images   TEXT    NOT NULL DEFAULT '[]',
    tags             TEXT    NOT NULL DEFAULT '[]',
    status           TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'changes')),
    review_note      TEXT    NOT NULL DEFAULT '',
    sales_count      INTEGER NOT NULL DEFAULT 0,
    rating           REAL    NOT NULL DEFAULT 0,
    reviews_count    INTEGER NOT NULL DEFAULT 0,
    is_featured      INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id       INTEGER NOT NULL REFERENCES users(id),
    prompt_id      INTEGER NOT NULL REFERENCES prompts(id),
    amount         INTEGER NOT NULL,
    seller_earning INTEGER NOT NULL,
    platform_fee   INTEGER NOT NULL,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (buyer_id, prompt_id)
  );

  CREATE TABLE IF NOT EXISTS library (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt_id  INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, prompt_id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id  INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (prompt_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt_id  INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, prompt_id)
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      INTEGER NOT NULL,
    type        TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    reference   TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT    NOT NULL,
    reference   TEXT    NOT NULL UNIQUE,
    provider    TEXT    NOT NULL DEFAULT 'mock',
    description TEXT    NOT NULL DEFAULT '',
    amount_usd  REAL    NOT NULL DEFAULT 0,
    credits     INTEGER NOT NULL DEFAULT 0,
    last4       TEXT    NOT NULL DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'paid',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS generations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model          TEXT    NOT NULL,
    prompt         TEXT    NOT NULL,
    negative_prompt TEXT   NOT NULL DEFAULT '',
    result         TEXT    NOT NULL DEFAULT '',
    engine         TEXT    NOT NULL DEFAULT 'mock',
    credits        INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hire_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    model       TEXT    NOT NULL,
    budget      REAL    NOT NULL DEFAULT 0,
    description TEXT    NOT NULL DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'Pendiente',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS companies (
    user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL DEFAULT '',
    tax_id        TEXT    NOT NULL DEFAULT '',
    billing_email TEXT    NOT NULL DEFAULT '',
    seats         INTEGER NOT NULL DEFAULT 5,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS company_members (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name             TEXT    NOT NULL,
    email            TEXT    NOT NULL COLLATE NOCASE,
    role             TEXT    NOT NULL DEFAULT 'Prompt Engineer',
    status           TEXT    NOT NULL DEFAULT 'Invitado',
    formulas_created INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (owner_id, email)
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT    NOT NULL,
    prefix         TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'Activa',
    total_calls    INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms REAL    NOT NULL DEFAULT 14.2,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    last_used      TEXT    NOT NULL DEFAULT 'Nunca'
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount     INTEGER NOT NULL,
    method     TEXT    NOT NULL DEFAULT 'stripe',
    status     TEXT    NOT NULL DEFAULT 'Procesando',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt_id  INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, prompt_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo       TEXT    NOT NULL CHECK (tipo IN ('compra', 'venta', 'prompt_aprobado', 'prompt_rechazado', 'sistema')),
    titulo     TEXT    NOT NULL,
    mensaje    TEXT    NOT NULL,
    enlace     TEXT    NOT NULL DEFAULT '',
    leida      INTEGER NOT NULL DEFAULT 0 CHECK (leida IN (0, 1)),
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt_id   INTEGER NULL REFERENCES prompts(id) ON DELETE SET NULL,
    contenido   TEXT    NOT NULL,
    leido       INTEGER NOT NULL DEFAULT 0 CHECK (leido IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS search_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    term       TEXT    NOT NULL,
    user_id    INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_presence (
    session_id TEXT PRIMARY KEY,
    user_id    INTEGER NULL REFERENCES users(id) ON DELETE CASCADE,
    last_seen  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    slug      TEXT    NOT NULL UNIQUE,
    nombre    TEXT    NOT NULL,
    icono     TEXT    NOT NULL,
    parent_id INTEGER NULL REFERENCES categories(id) ON DELETE CASCADE,
    orden     INTEGER NOT NULL DEFAULT 0,
    activa    INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS prompt_categories (
    prompt_id   INTEGER NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (prompt_id, category_id)
  );

  CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
  CREATE INDEX IF NOT EXISTS idx_prompt_categories_category ON prompt_categories(category_id);
  CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, leida);
  CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, leido);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_search_log_created ON search_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_presence_seen ON user_presence(last_seen);
  CREATE INDEX IF NOT EXISTS idx_prompts_status   ON prompts(status);
  CREATE INDEX IF NOT EXISTS idx_prompts_seller   ON prompts(seller_id);
  CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
  CREATE INDEX IF NOT EXISTS idx_orders_buyer     ON orders(buyer_id);
  CREATE INDEX IF NOT EXISTS idx_library_user     ON library(user_id);
  CREATE INDEX IF NOT EXISTS idx_credits_user     ON credit_transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_payments_user    ON payments(user_id);
  CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(user_id);
  CREATE INDEX IF NOT EXISTS idx_hires_client     ON hire_requests(client_id);
  CREATE INDEX IF NOT EXISTS idx_hires_creator    ON hire_requests(creator_id);
  CREATE INDEX IF NOT EXISTS idx_members_owner    ON company_members(owner_id);
  CREATE INDEX IF NOT EXISTS idx_keys_owner       ON api_keys(owner_id);
  CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
`);

/** Agrega una columna si todavía no existe (migraciones seguras al reiniciar). */
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[db] Columna agregada: ${table}.${column}`);
  }
}

ensureColumn('users', 'plan', "TEXT NOT NULL DEFAULT 'free'");
ensureColumn('users', 'avatar_key', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'active_role', "TEXT NOT NULL DEFAULT 'comprador'");
ensureColumn('users', 'select_since', 'TEXT');
ensureColumn('users', 'is_select', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'username', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'notification_prefs', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('prompts', 'video_url', "TEXT NOT NULL DEFAULT ''");

/**
 * El username es único, pero se permite vacío mientras la cuenta no lo define.
 * Un índice parcial deja convivir varias cuentas sin username.
 */
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username <> ''"
);

/** Preferencias de notificación disponibles y sus valores por defecto. */
export const NOTIFICATION_DEFAULTS = {
  new_sales: true,
  new_favorites: true,
  new_followers: true,
  new_messages: true,
  new_reviews: true,
  new_replies: true,
  new_items_following: false,
  purchase_confirmations: true,
  review_reminders: true,
  new_credits: true,
  abandoned_cart: true,
  community_digests: false,
  product_updates: false,
  select_tips: false,
  plan_offers: false,
  item_views: false,
  item_favorites: true,
  item_sales: true,
  item_uses: false,
  item_downloads: false,
  account_milestones: true,
  new_subscribers: true,
  upload_streak: false,
  jobs: true,
  invites: true,
};

/** Normaliza el JSON guardado: solo claves conocidas y valores booleanos. */
export function notificationPrefsFrom(value) {
  let stored = {};
  if (value) {
    try {
      stored = typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
      stored = {};
    }
  }

  const prefs = { ...NOTIFICATION_DEFAULTS };
  for (const key of Object.keys(NOTIFICATION_DEFAULTS)) {
    if (stored && typeof stored[key] === 'boolean') prefs[key] = stored[key];
  }
  return prefs;
}

/** Genera un username válido y libre a partir del correo (migración/registro). */
export function usernameFromEmail(email, isTaken) {
  const base =
    String(email || '')
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 24) || 'usuario';

  let candidate = base;
  let suffix = 1;
  while (isTaken(candidate)) {
    candidate = `${base.slice(0, 24)}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/** Completa el username de cuentas viejas sin tocar las que ya lo tienen. */
function backfillUsernames() {
  const pending = db.prepare("SELECT id, email FROM users WHERE username = ''").all();
  if (!pending.length) return;

  const exists = db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE');
  const update = db.prepare('UPDATE users SET username = ? WHERE id = ?');

  const fill = db.transaction(() => {
    for (const row of pending) {
      const username = usernameFromEmail(row.email, (candidate) => Boolean(exists.get(candidate)));
      update.run(username, row.id);
    }
  });

  fill();
  console.log(`[db] Username generado para ${pending.length} cuenta(s).`);
}

backfillUsernames();

/** Convierte una fila de `users` en el objeto público que consume el front. */
/** Roles disponibles para una cuenta, derivados de su tipo y permisos. */
export function rolesFor(row) {
  if (row.role === 'admin') return ['administrador'];
  const roles = ['comprador', 'vendedor'];
  if (row.account_type === 'corporate') roles.push('empresario');
  return roles;
}

/** Ruta inicial segun el rol activo: cada rol entra a su propia app. */
export function homePathFor(row) {
  if (row.role === 'admin') return '/admin';
  if (row.account_type === 'corporate' || row.active_role === 'empresario') return '/empresa';
  return '/';
}

export function publicUser(row) {
  const roles = rolesFor(row);
  const activeRole =
    row.role === 'admin'
      ? 'administrador'
      : roles.includes(row.active_role)
        ? row.active_role
        : row.account_type === 'corporate'
          ? 'empresario'
          : 'comprador';

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    username: row.username || '',
    role: row.role,
    accountType: row.account_type,
    company: row.company,
    credits: row.credits,
    bio: row.bio,
    plan: row.plan || 'free',
    avatarKey: row.avatar_key || '',
    notificationPrefs: notificationPrefsFrom(row.notification_prefs),
    activeRole,
    roles,
    homePath: homePathFor({ ...row, active_role: activeRole }),
    createdAt: row.created_at,
  };
}

/**
 * Crea o actualiza la cuenta de administrador definida en `.env`.
 * Nadie puede registrarse como admin desde la API: esta es la única vía.
 */
export function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.warn('[db] ADMIN_EMAIL / ADMIN_PASSWORD no configurados: no se creó el administrador.');
    return null;
  }

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!existing) {
    const hash = bcrypt.hashSync(password, 10);
    const create = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO users (email, password_hash, name, role, account_type, credits)
           VALUES (?, ?, 'Administrador', 'admin', 'individual', 1000)`
        )
        .run(email, hash);
      const userId = info.lastInsertRowid;
      db.prepare(
        `INSERT INTO credit_transactions (user_id, amount, type, description)
         VALUES (?, 1000, 'admin_seed', 'Créditos iniciales de administrador')`
      ).run(userId);
      return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    });
    const admin = create();
    console.log(`[db] Administrador creado: ${email}`);
    return admin;
  }

  // Si cambió la contraseña del .env, la sincronizamos sin tocar el resto.
  if (!bcrypt.compareSync(password, existing.password_hash)) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      bcrypt.hashSync(password, 10),
      existing.id
    );
    console.log(`[db] Contraseña del administrador actualizada: ${email}`);
  }

  if (existing.role !== 'admin') {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
    console.log(`[db] Rol de administrador restaurado: ${email}`);
  }

  return db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
}
