import type {
  AdminStats,
  ApiKey,
  ApiPrompt,
  ApiReview,
  AuthUser,
  BillingOverview,
  CardDetails,
  CatalogResponse,
  CompanyKeyApi,
  CompanyMemberApi,
  CompanyResponse,
  CreatorDashboard,
  CreatorDetailResponse,
  CreatorProfile,
  Generation,
  HireRequest,
  NotificationPreferences,
  PaymentRecord,
  ProfileResponse,
  PromptDetailResponse,
  PromptListResponse,
  Transaction,
} from '../types';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type JsonBody = object | undefined;

function toQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servidor. Verificá que esté funcionando en el puerto 3000.',
      0
    );
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      (data as { error?: string } | null)?.error ||
      `Ocurrió un error inesperado (HTTP ${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

function post<T>(path: string, body?: JsonBody): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

function patch<T>(path: string, body?: JsonBody): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

function put<T>(path: string, body?: JsonBody): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

function del<T>(path: string, body?: JsonBody): Promise<T> {
  return request<T>(path, {
    method: 'DELETE',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export interface AuthResponse {
  user: AuthUser;
  message?: string;
}

export interface PromptPayload {
  title: string;
  description: string;
  fullDescription: string;
  model: string;
  category: string;
  price: number;
  masterPrompt: string;
  negativePrompt: string;
  videoUrl: string;
  previewImages: string[];
  tags: string[];
  variables: {
    name: string;
    label: string;
    defaultValue: string;
    options: string[];
    description: string;
  }[];
}

export const api = {
  auth: {
    me: () => get<{ user: AuthUser }>('/auth/me'),
    register: (payload: {
      email: string;
      password: string;
      name?: string;
      accountType?: 'individual' | 'corporate';
      company?: string;
    }) => post<AuthResponse>('/auth/register', payload),
    login: (payload: { email: string; password: string }) =>
      post<AuthResponse>('/auth/login', payload),
    setRole: (role: string) =>
      patch<AuthResponse & { redirect: string }>('/auth/role', { role }),
    logout: () => post<{ ok: boolean }>('/auth/logout'),
  },

  categories: {
    list: () =>
      get<{
        items: {
          id: number;
          slug: string;
          nombre: string;
          icono: string;
          orden: number;
          count: number;
          children: {
            id: number;
            slug: string;
            nombre: string;
            icono: string;
            orden: number;
            count: number;
            children: never[];
          }[];
        }[];
      }>('/categories'),
  },

  home: () => get<HomeResponse>('/home'),

  prompts: {
    catalog: () => get<CatalogResponse>('/prompts/catalog'),
    list: (params?: {
      search?: string;
      q?: string;
      category?: string;
      sub?: string;
      model?: string;
      sort?: string;
      page?: number;
      limit?: number;
      minPrice?: number;
      maxPrice?: number;
    }) => get<PromptListResponse>(`/prompts${toQuery(params)}`),
    detail: (id: number | string) => get<PromptDetailResponse>(`/prompts/${id}`),
    mine: () => get<{ items: ApiPrompt[] }>('/prompts/mine'),
    favorites: () => get<{ items: ApiPrompt[] }>('/prompts/favorites'),
    create: (payload: PromptPayload) =>
      post<{ prompt: ApiPrompt; message: string }>('/prompts', payload),
    update: (id: number | string, payload: Partial<PromptPayload>) =>
      patch<{ prompt: ApiPrompt; message: string }>(`/prompts/${id}`, payload),
    purchase: (id: number | string) =>
      post<{
        orderId: number;
        amount: number;
        sellerEarning: number;
        platformFee: number;
        credits: number;
        prompt: ApiPrompt;
        message: string;
      }>(`/prompts/${id}/purchase`, {}),
    review: (id: number | string, payload: { rating: number; comment: string }) =>
      post<{ message: string; rating: number; reviewsCount: number }>(
        `/prompts/${id}/reviews`,
        payload
      ),
    favorite: (id: number | string) =>
      post<{ favorited: boolean; message: string }>(`/prompts/${id}/favorite`, {}),
  },

  library: {
    list: () =>
      get<{ items: (ApiPrompt & { purchasedAt: string; libraryId: number })[]; total: number }>(
        '/library'
      ),
    transactions: () => get<{ items: Transaction[] }>('/library/transactions'),
  },

  admin: {
    status: () => get<{ ok: boolean; admin: string }>('/admin/status'),
    stats: () => get<AdminStats>('/admin/stats'),
    qa: (status: string) =>
      get<{ items: ApiPrompt[]; status: string }>(`/admin/qa${toQuery({ status })}`),
    review: (id: number | string, action: 'approve' | 'reject' | 'changes', note: string) =>
      post<{ ok: boolean; status: string; message: string; prompt: ApiPrompt }>(
        `/admin/qa/${id}/review`,
        { action, note }
      ),
    users: () =>
      get<{
        items: {
          id: number;
          email: string;
          name: string;
          role: string;
          accountType: string;
          company: string;
          credits: number;
          plan: string;
          avatarKey: string;
          createdAt: string;
          prompts: number;
          purchases: number;
        }[];
      }>('/admin/users'),
  },

  billing: {
    overview: () => get<BillingOverview>('/billing'),
    payments: () => get<{ items: PaymentRecord[] }>('/billing/payments'),
    buyCredits: (packageId: string, card: CardDetails) =>
      post<{
        message: string;
        credits: number;
        user: AuthUser;
        payment: {
          reference: string;
          brand: string;
          last4: string;
          amountUsd: number;
          credits: number;
        };
      }>('/billing/credits', { packageId, card }),
    activatePlan: (planId: string, annual: boolean, card: CardDetails) =>
      post<{
        message: string;
        user: AuthUser;
        plan: { id: string; name: string };
        payment: { reference: string; brand: string; last4: string; amountUsd: number };
      }>('/billing/plan', { planId, annual, card }),
  },

  ai: {
    generate: (payload: { model: string; prompt: string; negativePrompt?: string }) =>
      post<{
        generation: Generation;
        credits: number;
        cost: number;
        engine: 'gemini' | 'mock';
        message: string;
      }>('/ai/generate', payload),
    history: () => get<{ items: Generation[] }>('/ai/history'),
  },

  profile: {
    get: () => get<ProfileResponse>('/profile'),
    update: (payload: {
      name?: string;
      username?: string;
      bio?: string;
      avatarKey?: string;
      company?: string;
      accountType?: 'individual' | 'corporate';
      notificationPrefs?: Partial<NotificationPreferences>;
    }) =>
      patch<{
        message: string;
        user: AuthUser;
        notifications: NotificationPreferences;
      }>('/profile', payload),
    deleteAccount: (payload: { password: string }) =>
      del<{ ok: boolean; message: string }>('/profile', payload),
    dashboard: () => get<CreatorDashboard>('/profile/dashboard'),
    withdraw: (payload: { amount: number; method: 'stripe' | 'crypto' }) =>
      post<{ message: string; withdrawal: unknown; stats: CreatorDashboard['stats'] }>(
        '/profile/withdraw',
        payload
      ),
  },

  creators: {
    list: (params?: { search?: string; category?: string }) =>
      get<{ items: CreatorProfile[] }>(`/creators${toQuery(params)}`),
    detail: (id: number | string) => get<CreatorDetailResponse>(`/creators/${id}`),
  },

  hires: {
    list: () => get<{ items: HireRequest[] }>('/hires'),
    create: (payload: {
      creatorId: number;
      title: string;
      model: string;
      budget: number;
      description: string;
    }) => post<{ message: string; hire: HireRequest }>('/hires', payload),
    update: (id: number | string, status: string) =>
      patch<{ message: string; status: string }>(`/hires/${id}`, { status }),
  },

  company: {
    get: () => get<CompanyResponse>('/company'),
    update: (payload: { name: string; taxId: string; billingEmail: string; seats: number }) =>
      put<{ message: string; company: CompanyResponse['company'] }>('/company', payload),
    members: () => get<{ items: CompanyMemberApi[] }>('/company/members'),
    inviteMember: (payload: { name: string; email: string; role: string }) =>
      post<{ message: string; member: CompanyMemberApi }>('/company/members', payload),
    updateMember: (id: number | string, payload: { role?: string; status?: string }) =>
      patch<{ message: string; member: CompanyMemberApi }>(`/company/members/${id}`, payload),
    deleteMember: (id: number | string) =>
      del<{ message: string }>(`/company/members/${id}`),
    keys: () => get<{ items: CompanyKeyApi[] }>('/company/keys'),
    createKey: (name: string) =>
      post<{ message: string; key: string; item: CompanyKeyApi }>('/company/keys', { name }),
    updateKey: (id: number | string, status: 'Activa' | 'Revocada') =>
      patch<{ message: string; status: string }>(`/company/keys/${id}`, { status }),
    deleteKey: (id: number | string) => del<{ message: string }>(`/company/keys/${id}`),
  },

  cart: {
    get: () => get<CartResponse>('/cart'),
    add: (promptId: number) => post<CartResponse & { message: string }>('/cart', { promptId }),
    remove: (promptId: number) =>
      del<CartResponse & { message: string }>(`/cart/${promptId}`),
    checkout: () =>
      post<
        CartResponse & {
          purchased: { id: number; title: string; amount: number }[];
          skipped: { id: number; title: string }[];
          message: string;
        }
      >('/cart/checkout'),
  },

  notifications: {
    list: () => get<{ items: NotificationItem[]; unread: number }>('/notifications'),
    read: (id: number) =>
      patch<{ ok: boolean }>(`/notifications/${id}/read`, {}),
    readAll: () => post<{ ok: boolean; marked: number }>('/notifications/read-all', {}),
  },

  messages: {
    list: () =>
      get<{ items: ConversationItem[]; unread: number }>('/messages'),
    thread: (userId: number) =>
      get<MessageThread>('/messages/' + userId),
    send: (payload: { receiverId: number; contenido: string; promptId?: number }) =>
      post<{ message: string; item: MessageItem }>('/messages', payload),
  },

  select: {
    status: () =>
      get<{ isSelect: boolean; selectSince: string | null }>('/select'),
    subscribe: () =>
      post<{ isSelect: boolean; selectSince: string; user: AuthUser; message: string }>(
        '/select/subscribe',
        {}
      ),
    cancel: () =>
      del<{ isSelect: boolean; message: string; user: AuthUser }>('/select'),
  },

  search: {
    suggest: (q: string) =>
      get<{ items: SuggestionItem[] }>(`/search/suggest${toQuery({ q })}`),
    trending: () =>
      get<{ items: { term: string; uses: number }[] }>('/search/trending'),
  },

  presence: {
    beat: () => post<{ ok: boolean }>('/presence', {}),
    online: () => get<{ onlineNow: number }>('/presence'),
  },

  health: () => get<{ ok: boolean }>('/health'),
};

export interface HomeResponse {
  stats: {
    prompts: number;
    users: number;
    onlineNow: number;
    rating: number;
    reviews: number;
  };
  trending: {
    terms: { term: string; uses: number }[];
    prompts: ApiPrompt[];
  };
  featured: ApiPrompt[];
}

export interface CartItem {
  id: number;
  title: string;
  price: number;
  model: string;
  previewImages: string[];
  rating: number;
  salesCount: number;
  sellerName: string;
  addedAt: string;
}

export interface CartResponse {
  items: CartItem[];
  total: number;
  credits: number;
  count: number;
}

export interface NotificationItem {
  id: number;
  tipo: 'compra' | 'venta' | 'prompt_aprobado' | 'prompt_rechazado' | 'sistema';
  titulo: string;
  mensaje: string;
  enlace: string;
  leida: boolean;
  createdAt: string;
}

export interface ConversationItem {
  otherId: number;
  otherName: string;
  otherAvatarKey: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

export interface MessageItem {
  id: number;
  senderId: number;
  receiverId: number;
  promptId: number | null;
  contenido: string;
  leido: boolean;
  createdAt: string;
  mine?: boolean;
}

export interface MessageThread {
  other: { id: number; name: string; avatarKey: string };
  items: MessageItem[];
}

export interface SuggestionItem {
  type: 'prompt' | 'category' | 'subcategory';
  id?: number;
  label: string;
  detail: string;
  href: string;
}

export type { ApiKey, ApiReview, BillingOverview, PaymentRecord };
