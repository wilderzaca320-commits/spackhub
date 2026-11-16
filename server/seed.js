import bcrypt from 'bcryptjs';
import { db } from './db.js';

/**
 * Datos de demostración idempotentes: dos vendedores y doce fórmulas.
 * Se ejecuta al arrancar; si ya existen, no duplica nada.
 */

const DEMO_PASSWORD = 'Demo12345';

const DEMO_USERS = [
  {
    email: 'neo@sparkhub.local',
    name: 'NeoVisions',
    bio: 'Estudio de arte generativo especializado en 3D anamórfico, escultura digital y fotografía de producto.',
    company: 'NeoVisions Studio',
    avatarKey: 'highFashion',
    plan: 'pro',
    credits: 2000,
  },
  {
    email: 'atelier@sparkhub.local',
    name: 'Atelier Nord',
    bio: 'Arquitectura, moda editorial y sistemas visuales minimalistas. Fórmulas probadas en producción.',
    company: 'Atelier Nord',
    avatarKey: 'scandinavianPavilion',
    plan: 'pro',
    credits: 2000,
  },
];

const PROMPTS = [
  {
    seller: 0,
    title: 'Cyber Anamorphic 3D Character',
    description:
      'Personajes 3D con refracción cristalina y dispersión óptica. Optimizado para Flux.1 Schnell & Dev.',
    fullDescription:
      'Esta fórmula entrega anamorfismo espacial y refracción hiperrealista. Ajustá personaje, aumento óptico y paleta de iluminación volumétrica. Incluye negative prompt probado para evitar anatomía deforme y texturas planas.',
    model: 'Flux.1 Schnell',
    category: '3D & Esculturas',
    price: 4,
    status: 'approved',
    featured: 1,
    sales: 4,
    masterPrompt:
      'Cyber anamorphic 3D character of a [SUBJECT], crystalline refraction, optical dispersion, volumetric [LIGHTING] lighting, ultra-detailed octane render, [COLOR_PALETTE] palette, shallow depth of field, 8k --ar 4:5 --stylize 350',
    negativePrompt: 'blurry, distorted anatomy, flat textures, oversaturated low poly, plastic skin',
    previewImages: ['cyberTitan', 'biomorphicSculpture'],
    tags: ['3d', 'character', 'flux', 'refraction'],
    variables: [
      {
        name: 'SUBJECT',
        label: 'Sujeto',
        defaultValue: 'cyber samurai with translucent armor',
        options: ['cyber samurai with translucent armor', 'ethereal android dancer', 'desert nomad with glass visor'],
        description: 'Personaje principal de la escena.',
      },
      {
        name: 'LIGHTING',
        label: 'Iluminación',
        defaultValue: 'neon cyan and magenta',
        options: ['neon cyan and magenta', 'warm studio rim light', 'cold lunar backlight'],
        description: 'Paleta y dirección de la luz.',
      },
      {
        name: 'COLOR_PALETTE',
        label: 'Paleta',
        defaultValue: 'iridescent titanium',
        options: ['iridescent titanium', 'oil slick black', 'pearl and cobalt'],
        description: 'Colores dominantes del render.',
      },
    ],
  },
  {
    seller: 1,
    title: 'Isometric SaaS Icon System',
    description:
      'Set de iconos isométricos consistentes para dashboards y landing pages. Estilo limpio y escalable.',
    fullDescription:
      'Genera iconos isométricos coherentes con una misma grilla, sombras suaves y paleta corporativa. Ideal para productos SaaS que necesitan ilustraciones rápidas sin perder consistencia.',
    model: 'DALL-E 3',
    category: 'Ilustración',
    price: 3,
    status: 'approved',
    featured: 0,
    sales: 4,
    masterPrompt:
      'Isometric 3D icon of a [OBJECT], clean vector-like edges, soft ambient occlusion, [PALETTE] palette, floating on a plain background, consistent 30-degree grid, high detail, no text',
    negativePrompt: 'photorealism, harsh shadows, inconsistent perspective, clutter, text, watermark',
    previewImages: ['isometricIcon', 'saasDashboard'],
    tags: ['iconos', 'isometric', 'saas', 'ui'],
    variables: [
      {
        name: 'OBJECT',
        label: 'Objeto',
        defaultValue: 'analytics chart with floating bars',
        options: ['analytics chart with floating bars', 'cloud server stack', 'calendar with notification bell'],
        description: 'Concepto que representa el icono.',
      },
      {
        name: 'PALETTE',
        label: 'Paleta',
        defaultValue: 'indigo and white',
        options: ['indigo and white', 'emerald and slate', 'coral and cream'],
        description: 'Colores de marca del set.',
      },
    ],
  },
  {
    seller: 1,
    title: 'Scandinavian Glass Pavilion',
    description:
      'Arquitectura conceptual nórdica: pabellones de cristal, luz volumétrica y materiales honestos.',
    fullDescription:
      'Fórmula para planos arquitectónicos conceptuales y pabellones de cristal flotante. Funciona mejor con Midjourney v6.1 y referencias de luz natural difusa. Incluye variables de material, clima y encuadre.',
    model: 'Midjourney v6.1',
    category: 'Moda & Arquitectura',
    price: 5,
    status: 'approved',
    featured: 1,
    sales: 4,
    masterPrompt:
      'Minimalist Scandinavian glass pavilion in a [LANDSCAPE], [MATERIAL] structure, diffuse nordic daylight, volumetric fog, architectural photography, [CAMERA] lens, muted palette, hyperrealistic --ar 16:9 --style raw --v 6.1',
    negativePrompt: 'clutter, baroque ornament, neon colors, people, text, low resolution',
    previewImages: ['scandinavianPavilion', 'luxuryPerfume'],
    tags: ['arquitectura', 'minimalismo', 'midjourney', 'cristal'],
    variables: [
      {
        name: 'LANDSCAPE',
        label: 'Entorno',
        defaultValue: 'frozen lake at dawn',
        options: ['frozen lake at dawn', 'pine forest clearing', 'quiet urban courtyard'],
        description: 'Contexto natural o urbano.',
      },
      {
        name: 'MATERIAL',
        label: 'Material',
        defaultValue: 'fluted glass and pale oak',
        options: ['fluted glass and pale oak', 'polished concrete and steel', 'translucent acrylic and travertine'],
        description: 'Materialidad dominante.',
      },
      {
        name: 'CAMERA',
        label: 'Óptica',
        defaultValue: '24mm tilt-shift',
        options: ['24mm tilt-shift', '50mm documentary', '85mm compressed'],
        description: 'Lente y perspectiva.',
      },
    ],
  },
  {
    seller: 0,
    title: 'Biomorphic Iridescent Sculpture',
    description:
      'Esculturas orgánicas flotantes con refracción líquida y trazas de partículas. Resultado editorial.',
    fullDescription:
      'Crea esculturas biomórficas imposibles para portadas, editoriales y key visuals. La fórmula controla la tensión entre materiales líquidos y metálicos, además de la energía ambiental.',
    model: 'Flux.1 Dev',
    category: '3D & Esculturas',
    price: 6,
    status: 'approved',
    featured: 1,
    sales: 4,
    masterPrompt:
      'Biomorphic [MATERIAL] sculpture floating in [ENVIRONMENT], iridescent refraction, high-energy particle traces, ethereal titanium hues, museum lighting, macro detail, cinematic composition, 8k --ar 1:1',
    negativePrompt: 'flat shading, low poly, identifiable object, text, logo, muddy colors',
    previewImages: ['biomorphicSculpture', 'cyberTitan'],
    tags: ['escultura', '3d', 'editorial', 'abstracto'],
    variables: [
      {
        name: 'MATERIAL',
        label: 'Material',
        defaultValue: 'liquid chrome and opal glass',
        options: ['liquid chrome and opal glass', 'pearlescent ceramic', 'oxidized titanium and resin'],
        description: 'Acabado de la escultura.',
      },
      {
        name: 'ENVIRONMENT',
        label: 'Entorno',
        defaultValue: 'liquid helium pool',
        options: ['liquid helium pool', 'zero-gravity white void', 'dark obsidian gallery'],
        description: 'Fondo y atmósfera.',
      },
    ],
  },
  {
    seller: 1,
    title: 'High Fashion Runway Portrait',
    description:
      'Retratos de pasarela con luz dura, piel real y dirección editorial. Look de campaña de lujo.',
    fullDescription:
      'Pensada para campañas de moda y beauty. La fórmula prioriza textura de piel, iluminación de flash directo y composición de revista. Probada con Midjourney v6.1.',
    model: 'Midjourney v6.1',
    category: 'Moda & Arquitectura',
    price: 7,
    status: 'approved',
    featured: 0,
    sales: 4,
    masterPrompt:
      'High fashion runway portrait of a [SUBJECT], [GARMENT], direct flash lighting, glossy skin texture, strong shadows, editorial magazine composition, [BACKDROP] backdrop, 85mm lens, kodak portra grain --ar 3:4 --style raw --v 6.1',
    negativePrompt: 'plastic skin, over-smoothing, extra fingers, deformed hands, text, watermark',
    previewImages: ['highFashion', 'luxuryPerfume'],
    tags: ['moda', 'retrato', 'editorial', 'lujo'],
    variables: [
      {
        name: 'SUBJECT',
        label: 'Modelo',
        defaultValue: 'androgynous model with slicked hair',
        options: ['androgynous model with slicked hair', 'model with braided updo', 'model with freckles and buzz cut'],
        description: 'Descripción del modelo.',
      },
      {
        name: 'GARMENT',
        label: 'Prenda',
        defaultValue: 'oversized black leather trench',
        options: ['oversized black leather trench', 'sheer silver slip dress', 'structured ivory blazer'],
        description: 'Vestuario principal.',
      },
      {
        name: 'BACKDROP',
        label: 'Fondo',
        defaultValue: 'seamless charcoal',
        options: ['seamless charcoal', 'brushed aluminum', 'deep burgundy velvet'],
        description: 'Set fotográfico.',
      },
    ],
  },
  {
    seller: 0,
    title: 'Luxury Perfume Editorial',
    description:
      'Bodegones de perfume con vidrio, agua y luz cinematográfica. Listo para e-commerce premium.',
    fullDescription:
      'Fórmula de producto para fragancias y cosmética. Controla el tipo de vidrio, el líquido y la superficie para lograr un bodegón consistente en toda la campaña.',
    model: 'Flux.1 Schnell',
    category: 'Fotografía',
    price: 4,
    status: 'approved',
    featured: 0,
    sales: 0,
    masterPrompt:
      'Luxury perfume bottle made of [GLASS] glass, [LIQUID] liquid, resting on [SURFACE], dramatic cinematic lighting, water droplets, macro product photography, soft reflections, premium e-commerce, 8k --ar 4:5',
    negativePrompt: 'cheap plastic, cluttered background, text, label errors, oversaturated, blurry',
    previewImages: ['luxuryPerfume', 'highFashion'],
    tags: ['producto', 'perfume', 'fotografía', 'lujo'],
    variables: [
      {
        name: 'GLASS',
        label: 'Vidrio',
        defaultValue: 'smoked amber',
        options: ['smoked amber', 'frosted clear', 'deep emerald'],
        description: 'Tipo de vidrio del frasco.',
      },
      {
        name: 'LIQUID',
        label: 'Líquido',
        defaultValue: 'golden',
        options: ['golden', 'translucent turquoise', 'rose'],
        description: 'Color del contenido.',
      },
      {
        name: 'SURFACE',
        label: 'Superficie',
        defaultValue: 'wet black marble',
        options: ['wet black marble', 'rippled water', 'raw travertine'],
        description: 'Base del bodegón.',
      },
    ],
  },
  {
    seller: 0,
    title: 'Cyberpunk Ramen Alley',
    description:
      'Escenarios nocturnos lluviosos con neones, vapor y densidad atmosférica. Estética anime cinematográfica.',
    fullDescription:
      'Genera callejones cyberpunk con capas de profundidad, carteles ilegibles y lluvia volumetrica. Excelente para fondos de juego, cómic y animación.',
    model: 'Stable Diffusion XL',
    category: 'Ilustración',
    price: 3,
    status: 'approved',
    featured: 0,
    sales: 4,
    masterPrompt:
      'Cyberpunk ramen alley at night, [WEATHER], neon signs in [COLOR] tones, steam rising from food stalls, crowded background bokeh, cinematic anime style, dramatic perspective, ultra detailed, 8k',
    negativePrompt: 'daylight, empty street, western architecture, text errors, low detail',
    previewImages: ['cyberpunkRamen', 'animeScenery'],
    tags: ['cyberpunk', 'anime', 'escenario', 'nocturno'],
    variables: [
      {
        name: 'WEATHER',
        label: 'Clima',
        defaultValue: 'heavy rain',
        options: ['heavy rain', 'light drizzle', 'post-storm mist'],
        description: 'Condición atmosférica.',
      },
      {
        name: 'COLOR',
        label: 'Neones',
        defaultValue: 'magenta and cyan',
        options: ['magenta and cyan', 'acid green and violet', 'warm red and gold'],
        description: 'Paleta de letreros.',
      },
    ],
  },
  {
    seller: 1,
    title: 'Senior Code Review Assistant',
    description:
      'Prompt de sistema para revisiones de código con severidad, impacto y parches sugeridos.',
    fullDescription:
      'Convierte cualquier modelo en un revisor senior consistente. Devuelve hallazgos priorizados, explicación de impacto y un parche mínimo. Ideal para equipos que quieren estandarizar code review.',
    model: 'Claude 3.5 Sonnet',
    category: 'Desarrollo',
    price: 5,
    status: 'approved',
    featured: 1,
    sales: 4,
    masterPrompt:
      'Actúa como un ingeniero senior especializado en [STACK]. Revisá el siguiente código y devolvé: 1) hallazgos ordenados por severidad (bloqueante, mayor, menor), 2) impacto concreto en producción, 3) un parche mínimo por hallazgo. No inventes APIs. Si falta contexto, pedilo antes de asumir.\n\nCódigo:\n[CODE]',
    negativePrompt: '',
    previewImages: ['codeTerminal', 'saasDashboard'],
    tags: ['dev', 'code review', 'claude', 'sistema'],
    variables: [
      {
        name: 'STACK',
        label: 'Stack',
        defaultValue: 'TypeScript + React',
        options: ['TypeScript + React', 'Node.js + Express', 'Python + FastAPI', 'Go'],
        description: 'Tecnología del proyecto.',
      },
      {
        name: 'CODE',
        label: 'Código',
        defaultValue: '// pegá tu código aquí',
        options: [],
        description: 'Bloque de código a revisar.',
      },
    ],
  },
  {
    seller: 0,
    title: 'SaaS Dashboard Copy Pack',
    description:
      'Copys de interfaz, onboarding y emails para productos SaaS. Tono claro, directo y medible.',
    fullDescription:
      'Paquete de instrucciones para generar microcopy consistente en dashboards, empty states, onboarding y emails transaccionales. Incluye guía de tono y restricciones de longitud.',
    model: 'GPT-4o',
    category: 'Marketing & Copy',
    price: 4,
    status: 'approved',
    featured: 0,
    sales: 0,
    masterPrompt:
      'Escribí microcopy para un producto SaaS llamado [PRODUCT] dirigido a [AUDIENCE]. Tono: [TONE]. Generá: títulos de dashboard, empty states, 3 pasos de onboarding, y un email de bienvenida. Máximo 12 palabras por título y 40 por párrafo. Sin superlativos vacíos.',
    negativePrompt: '',
    previewImages: ['saasDashboard', 'codeTerminal'],
    tags: ['copy', 'saas', 'ux', 'gpt'],
    variables: [
      {
        name: 'PRODUCT',
        label: 'Producto',
        defaultValue: 'una plataforma de analítica para e-commerce',
        options: ['una plataforma de analítica para e-commerce', 'un CRM para estudios de diseño', 'una app de finanzas personales'],
        description: 'Producto o servicio.',
      },
      {
        name: 'AUDIENCE',
        label: 'Audiencia',
        defaultValue: 'fundadores no técnicos',
        options: ['fundadores no técnicos', 'equipos de growth', 'agencias boutique'],
        description: 'A quién le habla.',
      },
      {
        name: 'TONE',
        label: 'Tono',
        defaultValue: 'cercano y profesional',
        options: ['cercano y profesional', 'minimalista y seco', 'entusiasta y energético'],
        description: 'Voz de marca.',
      },
    ],
  },
  {
    seller: 1,
    title: 'Anime Scenery Backgrounds',
    description:
      'Fondos de paisaje anime con luz de hora dorada y composición cinematográfica.',
    fullDescription:
      'Fórmula para fondos de animación y visual novels. Controla estación, hora del día y punto de fuga. Pensada para mantener consistencia entre escenas.',
    model: 'Flux.1 Dev',
    category: 'Ilustración',
    price: 3,
    status: 'pending',
    featured: 0,
    sales: 0,
    masterPrompt:
      'Anime scenery background of a [PLACE] in [SEASON], golden hour lighting, dramatic clouds, detailed foliage, [MOOD] atmosphere, Makoto Shinkai inspired, cinematic wide shot, no characters, 8k',
    negativePrompt: 'characters, text, low detail, photorealistic, western cartoon',
    previewImages: ['animeScenery', 'cyberpunkRamen'],
    tags: ['anime', 'fondo', 'paisaje', 'ilustración'],
    variables: [
      {
        name: 'PLACE',
        label: 'Lugar',
        defaultValue: 'rural train station',
        options: ['rural train station', 'rooftop garden', 'seaside shrine'],
        description: 'Escenario principal.',
      },
      {
        name: 'SEASON',
        label: 'Estación',
        defaultValue: 'late summer',
        options: ['late summer', 'cherry blossom spring', 'first snow winter'],
        description: 'Época del año.',
      },
      {
        name: 'MOOD',
        label: 'Clima emocional',
        defaultValue: 'nostalgic',
        options: ['nostalgic', 'hopeful', 'melancholic'],
        description: 'Tono emocional de la escena.',
      },
    ],
  },
  {
    seller: 0,
    title: 'Robot Mascot Brand Kit',
    description:
      'Mascota robótica 3D con expresiones y poses consistentes para marcas tech.',
    fullDescription:
      'Genera una mascota robótica coherente en múltiples poses y expresiones, con guía de materiales y paleta. Ideal para branding tecnológico y onboarding gamificado.',
    model: 'DALL-E 3',
    category: 'Marketing & Copy',
    price: 6,
    status: 'pending',
    featured: 0,
    sales: 0,
    masterPrompt:
      'Cute 3D robot mascot named [NAME], [BODY] body, [EXPRESSION] expression, [POSE] pose, soft studio lighting, brand-friendly rounded shapes, consistent character sheet, plain [BACKGROUND] background, high detail',
    negativePrompt: 'scary, weapon, text, inconsistent proportions, realistic human hands',
    previewImages: ['robotMascot', 'isometricIcon'],
    tags: ['mascota', 'branding', 'robot', '3d'],
    variables: [
      {
        name: 'NAME',
        label: 'Nombre',
        defaultValue: 'Bolt',
        options: ['Bolt', 'Momo', 'Pixel'],
        description: 'Nombre de la mascota.',
      },
      {
        name: 'BODY',
        label: 'Cuerpo',
        defaultValue: 'white ceramic and mint accents',
        options: ['white ceramic and mint accents', 'brushed steel and orange', 'translucent blue gel'],
        description: 'Materiales y color.',
      },
      {
        name: 'EXPRESSION',
        label: 'Expresión',
        defaultValue: 'friendly smile',
        options: ['friendly smile', 'curious head tilt', 'celebrating'],
        description: 'Estado de ánimo.',
      },
      {
        name: 'POSE',
        label: 'Pose',
        defaultValue: 'waving hello',
        options: ['waving hello', 'holding a lightbulb', 'sitting cross-legged'],
        description: 'Acción del personaje.',
      },
      {
        name: 'BACKGROUND',
        label: 'Fondo',
        defaultValue: 'soft lavender',
        options: ['soft lavender', 'transparent white', 'deep navy'],
        description: 'Color de fondo.',
      },
    ],
  },
  {
    seller: 1,
    title: 'DeepSeek Refactor Playbook',
    description:
      'Playbook para refactorizar código legacy con pasos verificables y tests antes/después.',
    fullDescription:
      'Instrucciones paso a paso para refactorizar sin romper comportamiento. Incluye caracterización de tests, criterios de salida y plantilla de reporte.',
    model: 'DeepSeek V4 Pro',
    category: 'Desarrollo',
    price: 2,
    status: 'rejected',
    featured: 0,
    sales: 0,
    reviewNote: 'Falta el prompt maestro completo y una muestra de resultado verificable.',
    masterPrompt: 'Refactorizá este código.',
    negativePrompt: '',
    previewImages: ['codeTerminal', 'animeScenery'],
    tags: ['dev', 'refactor', 'deepseek'],
    variables: [],
  },
];

function ensureDemoUser(data) {
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
  if (existing) return existing;

  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const create = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO users
          (email, password_hash, name, role, account_type, company, credits, bio, plan, avatar_key)
         VALUES (?, ?, ?, 'user', 'individual', ?, ?, ?, ?, ?)`
      )
      .run(
        data.email,
        hash,
        data.name,
        data.company,
        data.credits,
        data.bio,
        data.plan,
        data.avatarKey
      );
    const userId = info.lastInsertRowid;
    db.prepare(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES (?, ?, 'welcome', 'Créditos de bienvenida (demo)')`
    ).run(userId, data.credits);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  });

  return create();
}

function ensurePrompt(sellerId, data) {
  const existing = db
    .prepare('SELECT * FROM prompts WHERE seller_id = ? AND title = ?')
    .get(sellerId, data.title);
  if (existing) return existing;

  const info = db
    .prepare(
      `INSERT INTO prompts
        (seller_id, title, description, full_description, model, category, price,
         master_prompt, negative_prompt, variables, preview_images, tags, status,
         review_note, sales_count, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sellerId,
      data.title,
      data.description,
      data.fullDescription,
      data.model,
      data.category,
      data.price,
      data.masterPrompt,
      data.negativePrompt,
      JSON.stringify(data.variables),
      JSON.stringify(data.previewImages),
      JSON.stringify(data.tags),
      data.status,
      data.reviewNote || '',
      data.sales || 0,
      data.featured || 0
    );
  return db.prepare('SELECT * FROM prompts WHERE id = ?').get(info.lastInsertRowid);
}

function ensurePurchase(buyerId, prompt, rating, comment) {
  const existing = db
    .prepare('SELECT * FROM orders WHERE buyer_id = ? AND prompt_id = ?')
    .get(buyerId, prompt.id);
  if (existing) return existing;

  const order = db.transaction(() => {
    const sellerEarning = Math.floor(prompt.price * 0.9);
    const platformFee = prompt.price - sellerEarning;

    const info = db
      .prepare(
        `INSERT INTO orders (buyer_id, prompt_id, amount, seller_earning, platform_fee)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(buyerId, prompt.id, prompt.price, sellerEarning, platformFee);

    db.prepare('INSERT INTO library (user_id, prompt_id, order_id) VALUES (?, ?, ?)').run(
      buyerId,
      prompt.id,
      info.lastInsertRowid
    );

    db.prepare('UPDATE prompts SET sales_count = sales_count + 1 WHERE id = ?').run(prompt.id);
    db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(prompt.price, buyerId);
    db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(
      sellerEarning,
      prompt.seller_id
    );

    db.prepare(
      `INSERT INTO credit_transactions (user_id, amount, type, description, reference)
       VALUES (?, ?, 'purchase', ?, ?)`
    ).run(buyerId, -prompt.price, `Compra demo de "${prompt.title}"`, `prompt:${prompt.id}`);

    db.prepare(
      `INSERT INTO credit_transactions (user_id, amount, type, description, reference)
       VALUES (?, ?, 'sale', ?, ?)`
    ).run(
      prompt.seller_id,
      sellerEarning,
      `Venta demo de "${prompt.title}" (90%)`,
      `prompt:${prompt.id}`
    );

    const review = db
      .prepare('INSERT INTO reviews (prompt_id, user_id, rating, comment) VALUES (?, ?, ?, ?)')
      .run(prompt.id, buyerId, rating, comment);

    const stats = db
      .prepare('SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average FROM reviews WHERE prompt_id = ?')
      .get(prompt.id);

    db.prepare('UPDATE prompts SET rating = ?, reviews_count = ? WHERE id = ?').run(
      Number(stats.average.toFixed(2)),
      stats.count,
      prompt.id
    );

    return review;
  });

  return order();
}

export function seedDemoData() {
  const users = DEMO_USERS.map(ensureDemoUser);
  const byTitle = new Map();

  for (const data of PROMPTS) {
    const row = ensurePrompt(users[data.seller].id, data);
    byTitle.set(data.title, row);
  }

  // Compras cruzadas para que la biblioteca, las reseñas y el panel de creador
  // tengan datos reales desde el primer arranque.
  const neo = users[0];
  const atelier = users[1];

  const atelierPrompts = ['Isometric SaaS Icon System', 'Scandinavian Glass Pavilion', 'Senior Code Review Assistant'];
  const neoPrompts = ['Cyber Anamorphic 3D Character', 'Biomorphic Iridescent Sculpture', 'SaaS Dashboard Copy Pack'];

  atelierPrompts.forEach((title, index) => {
    const prompt = byTitle.get(title);
    if (prompt) {
      ensurePurchase(
        neo.id,
        prompt,
        index === 2 ? 5 : 4,
        index === 2 ? 'Estructura impecable. Lo uso en cada revisión del equipo.' : 'Muy consistente, funciona desde la primera generación.'
      );
    }
  });

  neoPrompts.forEach((title, index) => {
    const prompt = byTitle.get(title);
    if (prompt) {
      ensurePurchase(
        atelier.id,
        prompt,
        index === 1 ? 5 : 4,
        index === 1 ? 'Resultado editorial sin retoques. Vale cada crédito.' : 'Buen punto de partida, las variables ahorran mucho tiempo.'
      );
    }
  });

  return users.map((user) => db.prepare('SELECT * FROM users WHERE id = ?').get(user.id));
}
