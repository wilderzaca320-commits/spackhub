import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { seedAdmin } from './db.js';
import { seedDemoData } from './seed.js';
import { seedCategories, seedPromptCategories } from './categoriesSeed.js';
import authRoutes from './routes/auth.js';
import marketplaceApp from './apps/marketplace.js';
import businessApp from './apps/business.js';
import adminApp from './apps/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PORTADA_URL = process.env.PORTADA_URL || 'http://127.0.0.1:4321/';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Las respuestas de la API nunca se cachean.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sparkhub', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/business', businessApp);
app.use('/api/admin', adminApp);
app.use('/api', marketplaceApp);

// 404 de la API (antes del fallback de la SPA).
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'La ruta de la API no existe.' });
});

// La portada 4321 se conserva como presentación; 3000 la enlaza.
app.get(['/portada', '/portada/*'], (_req, res) => {
  res.redirect(302, PORTADA_URL);
});

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
}

// Fallback de la SPA: cualquier ruta de cliente devuelve index.html.
app.get('*', (req, res) => {
  const indexFile = path.join(DIST, 'index.html');

  if (!fs.existsSync(indexFile)) {
    return res.status(503).type('text/plain').send(
      'La app todavía no está compilada.\n\n' +
        'Ejecutá "npm run build" y volvé a arrancar con "npm start".'
    );
  }

  return res.sendFile(indexFile);
});

// Manejo centralizado de errores: siempre español y JSON en la API.
app.use((error, req, res, _next) => {
  console.error('[api]', error);

  if (req.path.startsWith('/api')) {
    const status = error.status || 500;
    return res.status(status).json({
      error: status === 500 ? 'Ocurrió un error interno del servidor.' : error.message,
    });
  }

  return res.status(500).type('text/plain').send('Error interno del servidor.');
});

seedAdmin();
seedDemoData();
seedCategories();
seedPromptCategories();

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Sparkhub');
  console.log(`  App:     http://localhost:${PORT}/`);
  console.log(`  Portada: http://localhost:${PORT}/portada  ->  ${PORTADA_URL}`);
  console.log(`  API:     http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('  (cierra esta ventana para detener el servidor)');
});
