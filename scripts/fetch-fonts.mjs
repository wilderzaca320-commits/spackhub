/**
 * Descarga las tipografías desde Google Fonts y las deja locales en
 * public/fonts/ junto con public/fonts/fonts.css.
 *
 * Solo se ejecuta a mano (necesita internet) cuando se quiere actualizar
 * o cambiar una fuente. La app usa los archivos locales y no llama a Google.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const URL =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300..800&family=Space+Grotesk:wght@400..700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0 Safari/537.36';

// Solo los subconjuntos que necesita el español.
const SUBSETS = new Set(['latin', 'latin-ext']);

const outDir = path.resolve('public/fonts');
await mkdir(outDir, { recursive: true });

const css = await fetch(URL, { headers: { 'User-Agent': UA } }).then((r) => {
  if (!r.ok) throw new Error('Google Fonts respondió ' + r.status);
  return r.text();
});

const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];
const usados = new Map(); // url remota -> nombre local
let salida =
  '/* Tipografías locales generadas por scripts/fetch-fonts.mjs (sin Google en runtime). */\n';

for (const [, subset, bloque] of blocks) {
  if (!SUBSETS.has(subset)) continue;

  const familia = /font-family:\s*'([^']+)'/.exec(bloque)[1];
  const estilo = /font-style:\s*(\w+)/.exec(bloque)[1];
  const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/.exec(bloque)[1];

  if (!usados.has(url)) {
    const nombre =
      familia.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      estilo +
      '-' +
      (usados.size + 1) +
      '.woff2';
    const datos = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
    await writeFile(path.join(outDir, nombre), datos);
    usados.set(url, nombre);
    console.log('  ' + nombre + '  (' + Math.round(datos.length / 1024) + ' KB)');
  }

  salida += '\n' + bloque.replace(url, './' + usados.get(url)).replace(/url\(\.\//, 'url(./');
}

await writeFile(path.join(outDir, 'fonts.css'), salida, 'utf8');
console.log('\nListo: ' + usados.size + ' archivos en public/fonts/');
