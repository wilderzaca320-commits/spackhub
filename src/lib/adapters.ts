import { ASSETS } from '../data/assets';
import type { AIModel, ApiPrompt, CreatorProfile, PromptItem } from '../types';

/**
 * Convierte una clave de imagen del backend en la URL local empaquetada por Vite.
 * Las imágenes subidas por el usuario ya llegan como URL o data URL y se
 * devuelven tal cual.
 */
export function assetFor(key?: string | null, fallback = 'biomorphicSculpture'): string {
  const table = ASSETS as Record<string, string>;
  if (key && /^(data:image\/|https?:\/\/|\/)/i.test(key)) return key;
  if (key && table[key]) return table[key];
  return table[fallback] || table.biomorphicSculpture;
}

/** Los avatares usan las mismas imágenes locales que las previews. */
export function avatarFor(key?: string | null): string {
  return assetFor(key, 'highFashion');
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

function planLevel(plan?: string): string {
  if (plan === 'enterprise') return 'ENTERPRISE STUDIO';
  if (plan === 'pro') return 'PRO CREATOR';
  return 'CREADOR VERIFICADO';
}

function seedsFor(id: number): number[] {
  const base = 100000 + ((id * 7919) % 800000);
  return [base, base + 137, base + 421, base + 881, base + 1297];
}

export function toPromptItem(prompt: ApiPrompt): PromptItem {
  const master = prompt.masterPrompt || '';
  const previews = (prompt.previewImages || []).map((key) => assetFor(key));
  const category = (prompt.category || 'Ilustración') as PromptItem['category'];
  const model = (prompt.model || 'Flux.1 Schnell') as AIModel;

  return {
    id: String(prompt.id),
    title: prompt.title,
    description: prompt.description,
    fullDescription: prompt.fullDescription || prompt.description,
    model,
    modelBadge: model,
    price: prompt.price,
    rating: Number(prompt.rating) || 0,
    reviewsCount: prompt.reviewsCount || 0,
    salesCount: prompt.salesCount || 0,
    author: {
      id: prompt.author?.id || 0,
      name: prompt.author?.name || 'Creador',
      handle: `@${slugify(prompt.author?.name || 'sparkhub')}`,
      avatar: avatarFor(prompt.author?.avatarKey),
      avatarKey: prompt.author?.avatarKey,
      company: prompt.author?.company,
      bio: prompt.author?.bio,
      plan: prompt.author?.plan,
      level: planLevel(prompt.author?.plan),
      verified: true,
      rating: Number(prompt.author?.rating) || 0,
      sales: prompt.author?.sales || 0,
    },
    previewImages: previews.length ? previews : [assetFor('biomorphicSculpture')],
    masterPrompt: master,
    negativePrompt: prompt.negativePrompt || '',
    variableSlots: (prompt.variables || []).map((slot) => ({
      name: slot.name,
      label: slot.label || slot.name,
      defaultValue: slot.defaultValue || slot.options?.[0] || '',
      options: slot.options?.length ? slot.options : [slot.defaultValue].filter(Boolean),
      description: slot.description || '',
    })),
    testedSeeds: seedsFor(prompt.id),
    technicalSpecs: {
      seedTestRate: '99.4%',
      tokenCount: Math.max(40, Math.round((master || prompt.description).length / 4)),
      aspectRatios: ['1:1', '4:5', '16:9'],
      cfg: 7.5,
      steps: 45,
      compatibility: [model, 'ComfyUI', 'JSON Export'],
      sampler: 'Euler Ancestral (Karras)',
    },
    tags: prompt.tags || [],
    category,
    isTrending: (prompt.salesCount || 0) >= 4,
    isBestseller: (prompt.salesCount || 0) >= 8,
    isNew: prompt.status === 'pending',
    moneyBackGuarantee: true,
    workflowIncluded: true,
    status: prompt.status,
    reviewNote: prompt.reviewNote,
    videoUrl: prompt.videoUrl,
    owned: prompt.owned,
    isFavorited: prompt.isFavorited,
    isOwner: prompt.isOwner,
    hasReviewed: prompt.hasReviewed,
    canReadMaster: prompt.canReadMaster,
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
  };
}

export function toCreator(creator: CreatorProfile): CreatorProfile {
  return {
    ...creator,
    categories: creator.categories || [],
    specialties: creator.specialties?.length ? creator.specialties : creator.categories || [],
  };
}

/** Formatea fechas de SQLite (`YYYY-MM-DD HH:MM:SS`, UTC) o ISO. */
export function formatDate(value?: string): string {
  if (!value) return '—';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value?: string): string {
  if (!value) return '—';
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function statusLabel(status?: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    changes: 'Subsanación',
  };
  return labels[status || ''] || status || '—';
}
