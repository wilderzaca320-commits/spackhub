import { db } from './db.js';

/**
 * Árbol canónico de categorías (mismo orden y semántica que PromptBase).
 * `icono` es el nombre del icono de lucide-react que usa el front.
 */
export const CATEGORY_TREE = [
  {
    slug: 'modelos',
    nombre: 'Modelos',
    icono: 'Box',
    children: [
      { slug: 'midjourney', nombre: 'Midjourney' },
      { slug: 'dall-e', nombre: 'DALL-E' },
      { slug: 'stable-diffusion', nombre: 'Stable Diffusion' },
      { slug: 'flux', nombre: 'Flux' },
      { slug: 'claude', nombre: 'Claude' },
      { slug: 'gpt', nombre: 'GPT' },
      { slug: 'deepseek', nombre: 'DeepSeek' },
    ],
  },
  {
    slug: 'video',
    nombre: 'Video',
    icono: 'Film',
    children: [
      { slug: 'animacion', nombre: 'Animación' },
      { slug: 'cinematica', nombre: 'Cinemática' },
      { slug: 'efectos-visuales', nombre: 'Efectos Visuales' },
      { slug: 'shorts-reels', nombre: 'Shorts & Reels' },
      { slug: 'personajes-video', nombre: 'Personajes de Video' },
      { slug: 'transiciones', nombre: 'Transiciones' },
    ],
  },
  {
    slug: 'apps-juegos',
    nombre: 'Apps y Juegos',
    icono: 'Gamepad2',
    children: [
      { slug: 'assets-2d', nombre: 'Assets 2D' },
      { slug: 'texturas-3d', nombre: 'Texturas 3D' },
      { slug: 'ui-videojuegos', nombre: 'UI de Videojuegos' },
      { slug: 'iconos-apps', nombre: 'Iconos de Apps' },
      { slug: 'sprites', nombre: 'Sprites' },
      { slug: 'fondos-escenario', nombre: 'Fondos de Escenario' },
    ],
  },
  {
    slug: 'impresion-venta',
    nombre: 'Impresión y Venta',
    icono: 'Tag',
    children: [
      { slug: 'patrones-textiles', nombre: 'Patrones Textiles' },
      { slug: 'stickers', nombre: 'Stickers & Pegatinas' },
      { slug: 'cuadros-posters', nombre: 'Cuadros & Pósters' },
      { slug: 'merchandising', nombre: 'Merchandising' },
      { slug: 'papeleria', nombre: 'Papelería & Tarjetas' },
      { slug: 'print-on-demand', nombre: 'Print on Demand' },
    ],
  },
  {
    slug: 'fotos',
    nombre: 'Fotos',
    icono: 'Camera',
    children: [
      { slug: 'retratos-estudio', nombre: 'Retratos de Estudio' },
      { slug: 'fotografia-producto', nombre: 'Fotografía de Producto' },
      { slug: 'moda-editorial', nombre: 'Moda Editorial' },
      { slug: 'paisajes-naturaleza', nombre: 'Paisajes & Naturaleza' },
      { slug: 'macrofotografia', nombre: 'Macrofotografía' },
      { slug: 'fotoperiodismo-calles', nombre: 'Fotoperiodismo & Calles' },
    ],
  },
  {
    slug: 'arte',
    nombre: 'Arte',
    icono: 'Palette',
    children: [
      { slug: 'ilustracion-digital', nombre: 'Ilustración Digital' },
      { slug: 'anime-manga', nombre: 'Anime & Manga' },
      { slug: 'pixel-art', nombre: 'Pixel Art' },
      { slug: 'concept-art', nombre: 'Concept Art & 3D' },
      { slug: 'pintura-oleo', nombre: 'Pintura al Óleo' },
      { slug: 'retratos-artisticos', nombre: 'Retratos Artísticos' },
      { slug: 'cyberpunk-scifi', nombre: 'Cyberpunk & Sci-Fi' },
    ],
  },
  {
    slug: 'logos',
    nombre: 'Logos',
    icono: 'Shapes',
    children: [
      { slug: 'isotipos-minimalistas', nombre: 'Isotipos Minimalistas' },
      { slug: 'emblemas-vintage', nombre: 'Emblemas Vintage' },
      { slug: 'mascotas-marca', nombre: 'Mascotas de Marca' },
      { slug: 'monogramas', nombre: 'Monogramas' },
      { slug: 'tipografia-generativa', nombre: 'Tipografía Generativa' },
      { slug: 'logos-3d', nombre: 'Logos 3D' },
    ],
  },
  {
    slug: 'marketing',
    nombre: 'Marketing',
    icono: 'Briefcase',
    children: [
      { slug: 'redes-sociales', nombre: 'Redes Sociales' },
      { slug: 'anuncios-ads', nombre: 'Anuncios & Ads' },
      { slug: 'email-marketing', nombre: 'Email Marketing' },
      { slug: 'seo-articulos', nombre: 'SEO & Artículos' },
      { slug: 'banners-publicitarios', nombre: 'Banners Publicitarios' },
      { slug: 'landing-pages-web', nombre: 'Landing Pages & Web' },
    ],
  },
  {
    slug: 'fechas-especiales',
    nombre: 'Fechas Especiales',
    icono: 'PartyPopper',
    children: [
      { slug: 'navidad-fin-ano', nombre: 'Navidad & Fin de Año' },
      { slug: 'halloween', nombre: 'Halloween' },
      { slug: 'san-valentin', nombre: 'San Valentín' },
      { slug: 'black-friday', nombre: 'Black Friday & Ofertas' },
      { slug: 'cumpleanos-fiestas', nombre: 'Cumpleaños & Fiestas' },
      { slug: 'estaciones-clima', nombre: 'Estaciones & Clima' },
    ],
  },
];

/** Mapeo de las categorías viejas (texto en `prompts.category`) al árbol nuevo. */
export const LEGACY_MAP = {
  '3D & Esculturas': ['arte', 'concept-art'],
  Fotografía: ['fotos', 'retratos-estudio'],
  'Marketing & Copy': ['marketing', 'redes-sociales'],
  Desarrollo: ['apps-juegos', 'iconos-apps'],
  Ilustración: ['arte', 'ilustracion-digital'],
  'Moda & Arquitectura': ['fotos', 'moda-editorial'],
};

/** Inserta/actualiza las 9 categorías principales y sus subcategorías. */
export function seedCategories() {
  const upsertMain = db.prepare(
    `INSERT INTO categories (slug, nombre, icono, parent_id, orden, activa)
     VALUES (?, ?, ?, NULL, ?, 1)
     ON CONFLICT(slug) DO UPDATE SET
       nombre = excluded.nombre,
       icono = excluded.icono,
       parent_id = NULL,
       orden = excluded.orden`
  );
  const upsertChild = db.prepare(
    `INSERT INTO categories (slug, nombre, icono, parent_id, orden, activa)
     VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT(slug) DO UPDATE SET
       nombre = excluded.nombre,
       icono = excluded.icono,
       parent_id = excluded.parent_id,
       orden = excluded.orden`
  );
  const findId = db.prepare('SELECT id FROM categories WHERE slug = ?');

  db.transaction(() => {
    CATEGORY_TREE.forEach((main, mainIndex) => {
      upsertMain.run(main.slug, main.nombre, main.icono, mainIndex + 1);
      const parent = findId.get(main.slug);
      main.children.forEach((child, childIndex) => {
        upsertChild.run(child.slug, child.nombre, main.icono, parent.id, childIndex + 1);
      });
    });
  })();
}

/**
 * Asigna categoría principal + subcategoría a los prompts que todavía no
 * tienen ninguna relación. Es idempotente y conserva lo que el admin edite.
 */
export function seedPromptCategories() {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO prompt_categories (prompt_id, category_id) VALUES (?, ?)'
  );
  const hasLink = db.prepare('SELECT 1 FROM prompt_categories WHERE prompt_id = ? LIMIT 1');
  const bySlug = db.prepare('SELECT id FROM categories WHERE slug = ?');
  const prompts = db.prepare('SELECT id, category FROM prompts').all();

  db.transaction(() => {
    for (const prompt of prompts) {
      if (hasLink.get(prompt.id)) continue;
      const [mainSlug, subSlug] = LEGACY_MAP[prompt.category] || ['arte', 'ilustracion-digital'];
      const main = bySlug.get(mainSlug);
      if (!main) continue;
      insert.run(prompt.id, main.id);
      const sub = bySlug.get(subSlug);
      if (sub) insert.run(prompt.id, sub.id);
    }
  })();
}
