export type AIModel =
  | 'Flux.1 Schnell'
  | 'Flux.1 Dev'
  | 'Midjourney v6.1'
  | 'Claude 3.5 Sonnet'
  | 'Stable Diffusion XL'
  | 'GPT-4o'
  | 'DALL-E 3'
  | 'DeepSeek V4 Pro';

export type UserRole = 'user' | 'admin';

export type PromptStatus = 'pending' | 'approved' | 'rejected' | 'changes';

export type PromptCategory =
  | '3D & Esculturas'
  | 'Fotografía'
  | 'Marketing & Copy'
  | 'Desarrollo'
  | 'Ilustración'
  | 'Moda & Arquitectura';

export interface NotificationPreferences {
  new_sales: boolean;
  new_favorites: boolean;
  new_followers: boolean;
  new_messages: boolean;
  new_reviews: boolean;
  new_replies: boolean;
  new_items_following: boolean;
  purchase_confirmations: boolean;
  review_reminders: boolean;
  new_credits: boolean;
  abandoned_cart: boolean;
  community_digests: boolean;
  product_updates: boolean;
  select_tips: boolean;
  plan_offers: boolean;
  item_views: boolean;
  item_favorites: boolean;
  item_sales: boolean;
  item_uses: boolean;
  item_downloads: boolean;
  account_milestones: boolean;
  new_subscribers: boolean;
  upload_streak: boolean;
  jobs: boolean;
  invites: boolean;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  username?: string;
  role: UserRole;
  accountType: 'individual' | 'corporate';
  company: string;
  credits: number;
  bio: string;
  plan: string;
  avatarKey: string;
  notificationPrefs?: NotificationPreferences;
  activeRole?: 'comprador' | 'vendedor' | 'empresario' | 'administrador';
  roles?: string[];
  homePath?: string;
  createdAt: string;
}

export interface VariableSlot {
  name: string;
  label: string;
  defaultValue: string;
  options: string[];
  description: string;
}

export interface PromptItem {
  id: string;
  title: string;
  description: string;
  fullDescription: string;
  model: AIModel;
  modelBadge: string;
  price: number;
  originalPrice?: number;
  discountBadge?: string;
  rating: number;
  reviewsCount: number;
  salesCount: number;
  author: {
    id: number;
    name: string;
    handle: string;
    avatar: string;
    avatarKey?: string;
    company?: string;
    bio?: string;
    plan?: string;
    level: string;
    verified: boolean;
    rating: number;
    sales: number;
  };
  previewImages: string[];
  masterPrompt: string;
  negativePrompt?: string;
  variableSlots: VariableSlot[];
  testedSeeds: number[];
  technicalSpecs: {
    seedTestRate: string;
    tokenCount: number;
    aspectRatios: string[];
    cfg: number;
    steps: number;
    compatibility: string[];
    sampler?: string;
  };
  tags: string[];
  category: PromptCategory;
  isTrending?: boolean;
  isBestseller?: boolean;
  isNew?: boolean;
  moneyBackGuarantee: boolean;
  workflowIncluded: boolean;
  // Control de acceso que devuelve la API.
  status?: PromptStatus;
  reviewNote?: string;
  videoUrl?: string;
  owned?: boolean;
  isFavorited?: boolean;
  isOwner?: boolean;
  hasReviewed?: boolean;
  canReadMaster?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Tipos de la API                                                     */
/* ------------------------------------------------------------------ */

export interface ApiPrompt {
  id: number;
  title: string;
  description: string;
  fullDescription: string;
  model: string;
  category: string;
  price: number;
  rating: number;
  reviewsCount: number;
  salesCount: number;
  previewImages: string[];
  variables: VariableSlot[];
  tags: string[];
  negativePrompt: string;
  masterPrompt: string;
  videoUrl: string;
  status: PromptStatus;
  reviewNote: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    name: string;
    company: string;
    bio: string;
    plan: string;
    avatarKey: string;
    joinedAt: string;
    rating: number;
    sales: number;
    prompts: number;
  };
  owned?: boolean;
  isFavorited?: boolean;
  isOwner?: boolean;
  hasReviewed?: boolean;
  canReadMaster?: boolean;
}

export interface ApiReview {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  name: string;
  email: string;
  avatarKey: string;
  authorName: string;
}

export interface CatalogResponse {
  categories: PromptCategory[];
  models: AIModel[];
  previewKeys: string[];
}

export interface PromptListResponse {
  items: ApiPrompt[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  sort: string;
}

export interface PromptDetailResponse {
  prompt: ApiPrompt;
  reviews: ApiReview[];
}

export interface CreatorProfile {
  id: number;
  name: string;
  username?: string;
  company: string;
  bio: string;
  plan: string;
  avatarKey: string;
  joinedAt: string;
  rating: number;
  reviewsCount: number;
  prompts: number;
  sales: number;
  categories: string[];
  specialties: string[];
}

export interface CreatorDetailResponse {
  creator: CreatorProfile;
  prompts: ApiPrompt[];
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  badge: string;
  level: string;
  rating: number;
  reviewsCount: number;
  totalSales: number;
  monthlyEarnings: number;
  specialty: string;
  startingPrice: number;
  description: string;
  samplePrompts: string[];
  responseTime: string;
  verified: boolean;
}

export interface Commission {
  id: string;
  clientName: string;
  clientAvatar?: string;
  title: string;
  aiModel: AIModel;
  budget: number;
  deadline: string;
  status: 'Pendiente' | 'En Negociación' | 'En Progreso' | 'En Revisión' | 'Completado';
  briefDescription: string;
  deliverables: string[];
  createdAt: string;
  escrowSecured: boolean;
}

export interface PurchasedPrompt {
  id: string;
  prompt: PromptItem;
  purchasedAt: string;
  formats: ('JSON' | 'ComfyUI' | 'PDF')[];
  license: 'Comercial Ilimitada' | 'Enterprise Multi-Seat';
  customizedPrompt?: string;
  orderNumber: string;
}

export interface EnterpriseMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: EnterpriseRole;
  status: 'Activo' | 'Invitado';
  lastActive: string;
  formulasCreated: number;
}

export type EnterpriseRole = 'Admin' | 'Prompt Engineer' | 'Diseñador' | 'Revisor IP/Legal';

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  maskedKey?: string;
  createdAt: string;
  lastUsed: string;
  status: 'Activa' | 'Revocada';
  totalCalls: number;
  avgLatencyMs: number;
}

export interface B2BInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  seats: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  status: 'Pagada' | 'Emitida';
  period: string;
}

export interface QASubmission {
  id: string;
  promptTitle: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  model: AIModel;
  submittedAt: string;
  status: 'Pendiente' | 'Aprobado' | 'Subsanación Requerida' | 'Rechazado';
  testImages: string[];
  masterPrompt: string;
  negativePrompt?: string;
  variables: string[];
  videoUrl: string;
  videoTitle: string;
  videoDuration: string;
  checkImagesPassed: boolean;
  checkSyntaxPassed: boolean;
  checkVideoPassed: boolean;
  reviewerNotes?: string;
}

export interface SystemIncident {
  id: string;
  service: string;
  status: 'Operativo' | 'Degradado' | 'Mantenimiento';
  latencyMs: number;
  uptime: string;
  cluster: string;
}

/* ------------------------------------------------------------------ */
/* Encargos, facturación, generador y empresa                          */
/* ------------------------------------------------------------------ */

export interface HireRequest {
  id: number;
  title: string;
  model: AIModel;
  budget: number;
  description: string;
  status: 'Pendiente' | 'En progreso' | 'Entregado' | 'Cancelado';
  createdAt: string;
  clientId: number;
  clientName: string;
  creatorId: number;
  creatorName: string;
  creatorAvatarKey: string;
  creatorCompany: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  badge: string;
  monthlyUsd: number;
  annualUsd: number;
  monthlyCredits: number;
  description: string;
  features: string[];
  cta: string;
}

export interface CreditPackage {
  id: string;
  credits: number;
  priceUsd: number;
  label: string;
  bonus: number;
}

export interface PaymentRecord {
  id: number;
  kind: string;
  reference: string;
  provider: string;
  description: string;
  amountUsd: number;
  credits: number;
  last4: string;
  status: string;
  createdAt: string;
}

export interface BillingOverview {
  plans: PricingPlan[];
  packages: CreditPackage[];
  currentPlan: string;
  payments: PaymentRecord[];
}

export interface CardDetails {
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
}

export interface Generation {
  id: number;
  model: string;
  prompt: string;
  negativePrompt: string;
  result: string;
  engine: 'gemini' | 'mock';
  credits: number;
  previewKey: string;
  createdAt: string;
}

export interface CreatorStats {
  prompts: number;
  sales: number;
  earnings: number;
  withdrawn: number;
  available: number;
  purchases: number;
  favorites: number;
}

export interface Withdrawal {
  id: number;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
}

export interface CreatorDashboard {
  stats: CreatorStats;
  promptsByStatus: {
    pending: number;
    approved: number;
    rejected: number;
    changes: number;
  };
  recentSales: {
    id: number;
    amount: number;
    sellerEarning: number;
    createdAt: string;
    promptId: number;
    title: string;
    buyerName: string;
  }[];
  series: { month: string; label: string; credits: number }[];
  withdrawals: Withdrawal[];
  prompts: ApiPrompt[];
}

export interface ProfileResponse {
  user: AuthUser;
  stats: CreatorStats;
  company: {
    name: string;
    taxId: string;
    billingEmail: string;
    seats: number;
  } | null;
  avatarKeys: string[];
  notifications: NotificationPreferences;
  notificationKeys: string[];
  subscriptions: {
    plan: string;
    planName: string;
    planCredits: number;
    isSelect: boolean;
    selectSince: string | null;
  };
  balances: {
    generationCredits: number;
    selectDownloads: number;
  };
}

export interface CompanyResponse {
  company: {
    name: string;
    taxId: string;
    billingEmail: string;
    seats: number;
  };
  isCorporate: boolean;
}

export interface CompanyMemberApi {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  formulasCreated: number;
  createdAt: string;
}

export interface CompanyKeyApi {
  id: number;
  name: string;
  prefix: string;
  maskedKey?: string;
  status: 'Activa' | 'Revocada';
  totalCalls: number;
  avgLatencyMs: number;
  createdAt: string;
  lastUsed: string;
}

export interface AdminStats {
  users: number;
  prompts: number;
  promptsByStatus: {
    pending: number;
    approved: number;
    rejected: number;
    changes: number;
  };
  orders: number;
  reviews: number;
  creditsCirculating: number;
  revenueCredits: number;
  volumeCredits: number;
  revenueUsd: number;
}

export interface Transaction {
  id: number;
  amount: number;
  type: string;
  description: string;
  reference: string;
  createdAt: string;
}
