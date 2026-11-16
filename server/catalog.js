/**
 * Catálogo fijo del marketplace: categorías, modelos, planes y paquetes.
 * Se usa en el servidor para validar y en la API para alimentar el front.
 */

export const CATEGORIES = [
  '3D & Esculturas',
  'Fotografía',
  'Marketing & Copy',
  'Desarrollo',
  'Ilustración',
  'Moda & Arquitectura',
];

export const MODELS = [
  'Flux.1 Schnell',
  'Flux.1 Dev',
  'Midjourney v6.1',
  'Claude 3.5 Sonnet',
  'Stable Diffusion XL',
  'GPT-4o',
  'DALL-E 3',
  'DeepSeek V4 Pro',
];

/** Claves de las imágenes locales que puede usar una fórmula. */
export const PREVIEW_KEYS = [
  'cyberTitan',
  'isometricIcon',
  'biomorphicSculpture',
  'scandinavianPavilion',
  'luxuryPerfume',
  'highFashion',
  'cyberpunkRamen',
  'codeTerminal',
  'saasDashboard',
  'animeScenery',
  'robotMascot',
];

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter Explorer',
    badge: 'GRATUITO',
    monthlyUsd: 0,
    annualUsd: 0,
    monthlyCredits: 0,
    description:
      'Para explorar el marketplace y probar el generador sin compromiso. La cuenta nueva ya incluye 100 créditos.',
    features: [
      '100 créditos de bienvenida',
      'Acceso completo al catálogo de prompts',
      'Generador con Gemini o modo simulado',
      'Biblioteca personal de fórmulas compradas',
      'Reseñas y favoritos',
    ],
    cta: 'Plan actual',
  },
  {
    id: 'pro',
    name: 'Pro Creator & Engineer',
    badge: 'MÁS POPULAR',
    monthlyUsd: 19,
    annualUsd: 180,
    monthlyCredits: 600,
    description:
      'Para creadores que publican fórmulas y generan a diario. Incluye créditos mensuales y comisión de venta del 90%.',
    features: [
      '600 créditos acreditados al activar el plan',
      '90% de la venta para el creador (10% de plataforma)',
      'Generador prioritario con Gemini',
      'Publicación ilimitada de prompts',
      'Panel de ventas y métricas del creador',
    ],
    cta: 'Activar Plan Pro',
  },
  {
    id: 'enterprise',
    name: 'Enterprise & Studio',
    badge: 'EQUIPOS & API',
    monthlyUsd: 79,
    annualUsd: 750,
    monthlyCredits: 3000,
    description:
      'Para estudios y empresas: perfil corporativo persistido, pool de créditos amplio y consumo centralizado.',
    features: [
      '3000 créditos acreditados al activar el plan',
      'Perfil de empresa guardado en la base',
      'Consumo y facturación centralizados',
      'Comisión de venta del 90%',
      'Soporte prioritario',
    ],
    cta: 'Activar Enterprise',
  },
];

export const CREDIT_PACKAGES = [
  { id: 'credits-100', credits: 100, priceUsd: 5, label: 'Básico', bonus: 0 },
  { id: 'credits-300', credits: 350, priceUsd: 12, label: 'Más Popular', bonus: 50 },
  { id: 'credits-1000', credits: 1200, priceUsd: 35, label: 'Pro Studio', bonus: 200 },
  { id: 'credits-5000', credits: 6500, priceUsd: 120, label: 'Enterprise', bonus: 1500 },
];

export const GENERATION_COST = 2;

export function findPlan(id) {
  return PLANS.find((plan) => plan.id === id) || null;
}

export function findPackage(id) {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === id) || null;
}

/** Convierte una fila SQLite de prompts + vendedor en un objeto seguro para el front. */
export function publicPrompt(row, { includeMaster = false } = {}) {
  const variables = safeJson(row.variables, []);
  const previewImages = safeJson(row.preview_images, []);
  const tags = safeJson(row.tags, []);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    fullDescription: row.full_description,
    model: row.model,
    category: row.category,
    price: row.price,
    rating: Number(row.rating) || 0,
    reviewsCount: row.reviews_count || 0,
    salesCount: row.sales_count || 0,
    previewImages,
    variables,
    tags,
    negativePrompt: includeMaster ? row.negative_prompt : '',
    masterPrompt: includeMaster ? row.master_prompt : '',
    videoUrl: row.video_url || '',
    status: row.status,
    reviewNote: row.review_note || '',
    featured: !!row.is_featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.seller_id,
      name: row.seller_name || 'Creador',
      company: row.seller_company || '',
      bio: row.seller_bio || '',
      plan: row.seller_plan || 'free',
      avatarKey: row.seller_avatar_key || '',
      joinedAt: row.seller_created_at || '',
      rating: Number(row.seller_rating) || 0,
      sales: row.seller_sales || 0,
      prompts: row.seller_prompts || 0,
    },
  };
}

export function safeJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** SELECT base con los datos del vendedor y sus agregados. */
export const PROMPT_SELECT = `
  SELECT p.*,
         u.name          AS seller_name,
         u.company       AS seller_company,
         u.bio           AS seller_bio,
         u.plan          AS seller_plan,
         u.avatar_key    AS seller_avatar_key,
         u.created_at    AS seller_created_at,
         (SELECT COUNT(*) FROM prompts sp
           WHERE sp.seller_id = p.seller_id AND sp.status = 'approved') AS seller_prompts,
         (SELECT COALESCE(SUM(sp.sales_count), 0) FROM prompts sp
           WHERE sp.seller_id = p.seller_id AND sp.status = 'approved') AS seller_sales,
         (SELECT COALESCE(AVG(sr.rating), 0) FROM reviews sr
           WHERE sr.prompt_id IN (SELECT id FROM prompts sp3 WHERE sp3.seller_id = p.seller_id)) AS seller_rating
  FROM prompts p
  JOIN users u ON u.id = p.seller_id
`;
