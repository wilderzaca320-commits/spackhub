import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN = { email: 'admin@sparkhub.local', password: 'Admin12345' };
const PASSWORD = 'Secreta123';

let child;
let base;
let dbDir;
let serverLog = '';
let userCookie;
let adminCookie;
let secondCookie;
let target;

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {
      // El servidor todavía no escucha; reintentamos.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`El servidor de pruebas no arrancó.\n${serverLog}`);
}

async function api(url, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${base}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });

  const text = await response.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Respuestas no JSON (por ejemplo, el HTML de la SPA).
  }

  const setCookie = response.headers.get('set-cookie');
  return {
    status: response.status,
    data,
    cookie: setCookie ? setCookie.split(';')[0] : null,
    location: response.headers.get('location'),
  };
}

async function register(email, name) {
  const result = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password: PASSWORD, name },
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result;
}

async function credits(cookie) {
  const me = await api('/api/auth/me', { cookie });
  assert.equal(me.status, 200);
  return me.data.user.credits;
}

before(async () => {
  const port = await freePort();
  dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sparkhub-test-'));
  base = `http://127.0.0.1:${port}`;

  child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: path.join(dbDir, 'sparkhub-test.db'),
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
      JWT_SECRET: 'secreto-de-pruebas-integracion',
      GEMINI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', (chunk) => {
    serverLog += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    serverLog += chunk.toString();
  });

  await waitForHealth();
});

after(async () => {
  if (child && !child.killed) child.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (dbDir) {
    try {
      fs.rmSync(dbDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // Windows puede mantener el WAL abierto unos milisegundos más.
    }
  }
});

test('salud, catálogo y redirección de portada', async () => {
  const health = await api('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.ok, true);

  const catalog = await api('/api/prompts/catalog');
  assert.equal(catalog.status, 200);
  assert.equal(catalog.data.categories.length, 6);
  assert.ok(catalog.data.categories.includes('3D & Esculturas'));
  assert.equal(catalog.data.models.length, 8);

  const portada = await fetch(`${base}/portada`, { redirect: 'manual' });
  assert.equal(portada.status, 302);
  assert.match(portada.headers.get('location'), /4321/);
});

test('registro, sesión y errores de login en español', async () => {
  const created = await register('integracion@sparkhub.local', 'Usuario Integración');
  assert.equal(created.data.user.credits, 100);
  assert.ok(created.cookie);
  userCookie = created.cookie;

  const me = await api('/api/auth/me', { cookie: userCookie });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, 'integracion@sparkhub.local');
  assert.equal(me.data.user.role, 'user');

  const logout = await api('/api/auth/logout', { method: 'POST', cookie: userCookie });
  assert.equal(logout.status, 200);

  const wrong = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'integracion@sparkhub.local', password: 'incorrecta' },
  });
  assert.equal(wrong.status, 401);
  assert.match(wrong.data.error, /incorrect/i);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'integracion@sparkhub.local', password: PASSWORD },
  });
  assert.equal(login.status, 200);
  userCookie = login.cookie;
});

test('catálogo público: búsqueda, filtro y paginación', async () => {
  const search = await api('/api/prompts?search=Cyber&sort=price_asc&limit=5');
  assert.equal(search.status, 200);
  assert.ok(search.data.total >= 1);
  assert.ok(search.data.items.length <= 5);
  assert.equal(search.data.sort, 'price_asc');
  for (const prompt of search.data.items) {
    assert.equal(prompt.status, 'approved');
    assert.equal(prompt.masterPrompt, '');
  }

  const filtered = await api(
    `/api/prompts?category=${encodeURIComponent('3D & Esculturas')}&limit=24`
  );
  assert.equal(filtered.status, 200);
  assert.ok(filtered.data.items.length >= 1);
  for (const prompt of filtered.data.items) {
    assert.equal(prompt.category, '3D & Esculturas');
  }

  const secondPage = await api('/api/prompts?page=2&limit=2');
  assert.equal(secondPage.status, 200);
  assert.equal(secondPage.data.page, 2);
  assert.ok(secondPage.data.pages >= 2);
});

test('compra con créditos, desbloqueo del master y biblioteca', async () => {
  const list = await api('/api/prompts?sort=price_asc&limit=1');
  target = list.data.items[0];
  assert.ok(target);

  const before = await credits(userCookie);
  const detail = await api(`/api/prompts/${target.id}`, { cookie: userCookie });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.prompt.masterPrompt, '');
  assert.equal(detail.data.prompt.canReadMaster, false);

  const purchase = await api(`/api/prompts/${target.id}/purchase`, {
    method: 'POST',
    cookie: userCookie,
  });
  assert.equal(purchase.status, 201, JSON.stringify(purchase.data));
  assert.equal(purchase.data.credits, before - target.price);
  assert.ok(purchase.data.prompt.masterPrompt.length > 0);
  assert.equal(purchase.data.prompt.canReadMaster, true);
  assert.equal(purchase.data.platformFee, Math.ceil(target.price * 0.1));

  const library = await api('/api/library', { cookie: userCookie });
  assert.equal(library.status, 200);
  const bought = library.data.items.find((item) => item.id === target.id);
  assert.ok(bought, 'la fórmula comprada debe estar en la biblioteca');
  assert.ok(bought.masterPrompt.length > 0);

  const transactions = await api('/api/library/transactions', { cookie: userCookie });
  assert.ok(
    transactions.data.items.some(
      (item) => item.type === 'purchase' && item.amount === -target.price
    )
  );

  const duplicate = await api(`/api/prompts/${target.id}/purchase`, {
    method: 'POST',
    cookie: userCookie,
  });
  assert.equal(duplicate.status, 409);
});

test('favoritos: agregar y quitar', async () => {
  const added = await api(`/api/prompts/${target.id}/favorite`, {
    method: 'POST',
    cookie: userCookie,
  });
  assert.equal(added.status, 200);
  assert.equal(added.data.favorited, true);

  const favorites = await api('/api/prompts/favorites', { cookie: userCookie });
  assert.ok(favorites.data.items.some((item) => item.id === target.id));

  const removed = await api(`/api/prompts/${target.id}/favorite`, {
    method: 'POST',
    cookie: userCookie,
  });
  assert.equal(removed.data.favorited, false);
});

test('reseñas: solo compradores y sin duplicados', async () => {
  const review = await api(`/api/prompts/${target.id}/reviews`, {
    method: 'POST',
    cookie: userCookie,
    body: { rating: 5, comment: 'Resultados consistentes y fáciles de adaptar.' },
  });
  assert.equal(review.status, 201, JSON.stringify(review.data));
  assert.ok(review.data.reviewsCount >= 1);

  const detail = await api(`/api/prompts/${target.id}`, { cookie: userCookie });
  assert.ok(detail.data.reviews.some((item) => item.rating === 5));

  const duplicate = await api(`/api/prompts/${target.id}/reviews`, {
    method: 'POST',
    cookie: userCookie,
    body: { rating: 4, comment: 'Otra reseña.' },
  });
  assert.equal(duplicate.status, 409);

  const second = await register('integracion.dos@sparkhub.local', 'Segundo Usuario');
  secondCookie = second.cookie;

  const notBuyer = await api(`/api/prompts/${target.id}/reviews`, {
    method: 'POST',
    cookie: secondCookie,
    body: { rating: 5, comment: 'No compré esta fórmula.' },
  });
  assert.equal(notBuyer.status, 403);
});

test('publicación, cola QA y aprobación/rechazo del admin', async () => {
  const created = await api('/api/prompts', {
    method: 'POST',
    cookie: userCookie,
    body: {
      title: 'Fórmula Integración QA',
      description: 'Descripción de prueba con longitud suficiente para validar.',
      fullDescription: 'Detalle de la fórmula usada por los tests de integración.',
      model: 'Flux.1 Schnell',
      category: 'Desarrollo',
      price: 3,
      masterPrompt: 'Actuá como experto y resolvé el problema paso a paso con ejemplos claros.',
      negativePrompt: 'texto borroso, bajo detalle',
      variables: [
        {
          name: 'TEMA',
          label: 'Tema',
          defaultValue: 'testing',
          options: ['testing'],
          description: 'Tema a resolver.',
        },
      ],
      previewImages: ['codeTerminal'],
      tags: ['test', 'qa'],
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.prompt.status, 'pending');
  const promptId = created.data.prompt.id;

  const unpublished = await api(`/api/prompts/${promptId}`);
  assert.equal(unpublished.status, 404);

  const mine = await api('/api/prompts/mine', { cookie: userCookie });
  assert.ok(mine.data.items.some((item) => item.id === promptId && item.status === 'pending'));

  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: ADMIN,
  });
  assert.equal(adminLogin.status, 200);
  adminCookie = adminLogin.cookie;

  const forbidden = await api('/api/admin/stats', { cookie: userCookie });
  assert.equal(forbidden.status, 403);

  const queue = await api('/api/admin/qa', { cookie: adminCookie });
  assert.ok(queue.data.items.some((item) => item.id === promptId));

  const approved = await api(`/api/admin/qa/${promptId}/review`, {
    method: 'POST',
    cookie: adminCookie,
    body: { action: 'approve' },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.prompt.status, 'approved');

  const published = await api(`/api/prompts/${promptId}`);
  assert.equal(published.status, 200);
  assert.equal(published.data.prompt.status, 'approved');
  assert.equal(published.data.prompt.masterPrompt, '');

  const pending = await api('/api/admin/qa?status=pending', { cookie: adminCookie });
  const other = pending.data.items.find((item) => item.id !== promptId);
  assert.ok(other, 'debe quedar otro prompt pendiente del seed');

  const rejected = await api(`/api/admin/qa/${other.id}/review`, {
    method: 'POST',
    cookie: adminCookie,
    body: { action: 'reject', note: 'Falta detalle en las variables.' },
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.data.prompt.status, 'rejected');
  assert.match(rejected.data.prompt.reviewNote, /Falta detalle/);
});

test('paquete de créditos con pasarela simulada', async () => {
  const before = await credits(userCookie);
  const purchase = await api('/api/billing/credits', {
    method: 'POST',
    cookie: userCookie,
    body: {
      packageId: 'credits-100',
      card: {
        number: '4242 4242 4242 4242',
        holder: 'Usuario Integración',
        expiry: '12/30',
        cvv: '123',
      },
    },
  });
  assert.equal(purchase.status, 201, JSON.stringify(purchase.data));
  assert.equal(purchase.data.credits, before + 100);

  const payments = await api('/api/billing/payments', { cookie: userCookie });
  assert.ok(payments.data.items.some((item) => item.credits === 100));

  const invalid = await api('/api/billing/credits', {
    method: 'POST',
    cookie: userCookie,
    body: { packageId: 'credits-100', card: { number: '1' } },
  });
  assert.equal(invalid.status, 400);
  assert.match(invalid.data.error, /Complet/i);
});

test('generador en modo simulado: costo de 2 créditos e historial', async () => {
  const before = await credits(userCookie);
  const generated = await api('/api/ai/generate', {
    method: 'POST',
    cookie: userCookie,
    body: {
      model: 'Flux.1 Schnell',
      prompt: 'A neon city at night with reflections',
      negativePrompt: 'blurry',
    },
  });
  assert.equal(generated.status, 201, JSON.stringify(generated.data));
  assert.equal(generated.data.engine, 'mock');
  assert.equal(generated.data.cost, 2);
  assert.ok(generated.data.generation.result.length > 0);
  assert.equal(await credits(userCookie), before - 2);

  const history = await api('/api/ai/history', { cookie: userCookie });
  assert.ok(history.data.items.some((item) => item.id === generated.data.generation.id));
});

test('empresa: perfil, miembro, API key y retiro mínimo', async () => {
  const saved = await api('/api/company', {
    method: 'PUT',
    cookie: userCookie,
    body: {
      name: 'Estudio Integración SRL',
      taxId: '30-12345678-9',
      billingEmail: 'billing@integracion.local',
      seats: 8,
    },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.company.name, 'Estudio Integración SRL');

  const company = await api('/api/company', { cookie: userCookie });
  assert.equal(company.data.isCorporate, true);
  assert.equal(company.data.company.seats, 8);

  const member = await api('/api/company/members', {
    method: 'POST',
    cookie: userCookie,
    body: { name: 'Marta Integración', email: 'marta@integracion.local', role: 'Diseñador' },
  });
  assert.equal(member.status, 201);

  const members = await api('/api/company/members', { cookie: userCookie });
  assert.ok(members.data.items.some((item) => item.email === 'marta@integracion.local'));

  const key = await api('/api/company/keys', {
    method: 'POST',
    cookie: userCookie,
    body: { name: 'Clave Integración' },
  });
  assert.equal(key.status, 201);
  assert.match(key.data.key, /^sk_live_/);

  const keys = await api('/api/company/keys', { cookie: userCookie });
  assert.ok(keys.data.items.some((item) => item.name === 'Clave Integración'));

  const withdraw = await api('/api/profile/withdraw', {
    method: 'POST',
    cookie: userCookie,
    body: { amount: 5 },
  });
  assert.equal(withdraw.status, 400);
  assert.match(withdraw.data.error, /m[ií]nimo/i);
});

test('errores de la API siempre en español', async () => {
  const missing = await api('/api/ruta-inexistente');
  assert.equal(missing.status, 404);
  assert.match(missing.data.error, /no existe/i);

  const invalid = await api('/api/auth/register', {
    method: 'POST',
    body: { email: 'no-es-email', password: '123' },
  });
  assert.equal(invalid.status, 400);
  assert.equal(typeof invalid.data.error, 'string');
  assert.doesNotMatch(invalid.data.error, /invalid|required|not found|unauthorized/i);
});

test('apps por rol: marketplace, empresa y admin', async () => {
  const market = await api('/api');
  assert.equal(market.status, 200);
  assert.equal(market.data.app, 'marketplace');

  const anonymousBusiness = await api('/api/business');
  assert.equal(anonymousBusiness.status, 401);

  const adminLogin = await api('/api/auth/login', { method: 'POST', body: ADMIN });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.data.redirect, '/admin');
  assert.equal(adminLogin.data.user.activeRole, 'administrador');

  const adminStatus = await api('/api/admin/status', { cookie: adminLogin.cookie });
  assert.equal(adminStatus.status, 200);

  const corp = await api('/api/auth/register', {
    method: 'POST',
    body: {
      email: 'empresa.integracion@sparkhub.local',
      password: PASSWORD,
      name: 'Empresa Integración',
      accountType: 'corporate',
      company: 'Integración SRL',
    },
  });
  assert.equal(corp.status, 201, JSON.stringify(corp.data));
  assert.equal(corp.data.redirect, '/empresa');
  assert.equal(corp.data.user.activeRole, 'empresario');
  assert.ok(corp.data.user.roles.includes('empresario'));

  const business = await api('/api/business', { cookie: corp.cookie });
  assert.equal(business.status, 200);
  assert.equal(business.data.app, 'business');
  assert.equal(business.data.activeRole, 'empresario');

  const switchRole = await api('/api/auth/role', {
    method: 'PATCH',
    cookie: corp.cookie,
    body: { role: 'vendedor' },
  });
  assert.equal(switchRole.status, 200);
  assert.equal(switchRole.data.user.activeRole, 'vendedor');
  assert.equal(switchRole.data.redirect, '/empresa');
});

test('portada real, categorías, carrito, presencia, Select y mensajes', async () => {
  const home = await api('/api/home');
  assert.equal(home.status, 200);
  assert.ok(home.data.stats.prompts >= 1);
  assert.ok(home.data.stats.users >= 1);
  assert.ok(home.data.stats.rating >= 0);
  assert.ok(home.data.stats.reviews >= 0);
  assert.equal(home.data.featured.length, 3);
  assert.ok(Array.isArray(home.data.trending.terms));
  assert.ok(Array.isArray(home.data.trending.prompts));

  const categories = await api('/api/categories');
  assert.equal(categories.status, 200);
  assert.deepEqual(
    categories.data.items.map((item) => item.slug),
    [
      'modelos',
      'video',
      'apps-juegos',
      'impresion-venta',
      'fotos',
      'arte',
      'logos',
      'marketing',
      'fechas-especiales',
    ]
  );
  for (const category of categories.data.items) {
    assert.equal(typeof category.count, 'number');
    assert.ok(Array.isArray(category.children));
  }

  const beat = await api('/api/presence', { method: 'POST', cookie: secondCookie });
  assert.equal(beat.status, 200);
  const online = await api('/api/presence');
  assert.ok(online.data.onlineNow >= 1);

  const list = await api('/api/prompts?limit=24');
  const candidate = list.data.items.find((item) => item.id !== target.id);
  assert.ok(candidate, 'debe haber otra fórmula publicada');

  const added = await api('/api/cart', {
    method: 'POST',
    cookie: secondCookie,
    body: { promptId: candidate.id },
  });
  assert.equal(added.status, 201, JSON.stringify(added.data));
  assert.equal(added.data.count, 1);
  assert.ok(Array.isArray(added.data.items[0].previewImages));

  const cart = await api('/api/cart', { cookie: secondCookie });
  assert.equal(cart.data.count, 1);
  assert.equal(cart.data.total, candidate.price);

  const removed = await api(`/api/cart/${candidate.id}`, {
    method: 'DELETE',
    cookie: secondCookie,
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.count, 0);

  const notifications = await api('/api/notifications', { cookie: secondCookie });
  assert.equal(notifications.status, 200);
  assert.ok(Array.isArray(notifications.data.items));

  const selected = await api('/api/select/subscribe', {
    method: 'POST',
    cookie: secondCookie,
  });
  assert.equal(selected.status, 201, JSON.stringify(selected.data));
  assert.equal(selected.data.isSelect, true);

  const cancelled = await api('/api/select', { method: 'DELETE', cookie: secondCookie });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.isSelect, false);

  const sent = await api('/api/messages', {
    method: 'POST',
    cookie: secondCookie,
    body: { receiverId: candidate.author.id, contenido: 'Hola, tengo una consulta sobre esta fórmula.' },
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.data));

  const inbox = await api('/api/messages', { cookie: secondCookie });
  assert.ok(inbox.data.items.some((item) => item.otherId === candidate.author.id));

  const thread = await api(`/api/messages/${candidate.author.id}`, { cookie: secondCookie });
  assert.ok(thread.data.items.some((item) => item.contenido.includes('consulta')));

  const suggest = await api('/api/search/suggest?q=Cyber');
  assert.equal(suggest.status, 200);
  assert.ok(suggest.data.items.length >= 1);
});
