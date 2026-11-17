import React, { useEffect, useMemo, useState } from 'react';
import {
  AtSign,
  BadgeCheck,
  BellRing,
  Bot,
  Check,
  Clock,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Plug,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  User,
  Wand2,
} from 'lucide-react';
import type { NotificationPreferences, ProfileResponse } from '../types';
import { api } from '../lib/api';
import { avatarFor, formatDate } from '../lib/adapters';

interface ProfileSettingsViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onUserChanged: () => void | Promise<void>;
  onLogout: () => void;
  onOpenCreditsModal: () => void;
  onNavigate: (path: string) => void;
  onAccountDeleted: () => void | Promise<void>;
}

type NotificationKey = keyof NotificationPreferences;

interface NotificationItem {
  key: NotificationKey;
  label: string;
  detail: string;
}

const NOTIFICATION_GROUPS: { title: string; detail: string; items: NotificationItem[] }[] = [
  {
    title: 'Ventas y comunidad',
    detail: 'Todo lo que pasa con tus fórmulas y las personas que te siguen.',
    items: [
      { key: 'new_sales', label: 'Nuevas ventas', detail: 'Cuando vendés una fórmula.' },
      { key: 'new_favorites', label: 'Nuevos favoritos', detail: 'Cuando alguien guarda una de tus fórmulas.' },
      { key: 'new_followers', label: 'Nuevos seguidores', detail: 'Cuando alguien empieza a seguirte.' },
      { key: 'new_messages', label: 'Nuevos mensajes', detail: 'Cuando recibís un mensaje de otro usuario.' },
      { key: 'new_reviews', label: 'Nuevas reseñas', detail: 'Cuando recibís una reseña en tus fórmulas.' },
      { key: 'new_replies', label: 'Respuestas a reseñas', detail: 'Cuando responden a una reseña que dejaste.' },
      {
        key: 'new_items_following',
        label: 'Novedades de tus referentes',
        detail: 'Cuando alguien que seguís publica algo nuevo.',
      },
      { key: 'new_subscribers', label: 'Nuevos suscriptores', detail: 'Cuando conseguís un suscriptor de pago.' },
      { key: 'jobs', label: 'Encargos', detail: 'Cuando hay novedades en un encargo en el que participás.' },
      { key: 'invites', label: 'Invitaciones', detail: 'Cuando te invitan a un equipo o a un encargo.' },
    ],
  },
  {
    title: 'Compras y cuenta',
    detail: 'Confirmaciones, créditos y novedades de la plataforma.',
    items: [
      {
        key: 'purchase_confirmations',
        label: 'Confirmaciones de compra',
        detail: 'Cuando comprás una fórmula o un paquete de créditos.',
      },
      { key: 'review_reminders', label: 'Recordatorios de reseña', detail: 'Para dejar tu opinión de lo que compraste.' },
      { key: 'new_credits', label: 'Créditos acreditados', detail: 'Cuando sumamos créditos a tu cuenta.' },
      { key: 'abandoned_cart', label: 'Carrito abandonado', detail: 'Cuando dejás fórmulas sin terminar la compra.' },
      { key: 'community_digests', label: 'Resumen de comunidad', detail: 'Menciones y mensajes destacados de la semana.' },
      { key: 'product_updates', label: 'Novedades y ofertas', detail: 'Funciones nuevas y promociones puntuales.' },
      { key: 'select_tips', label: 'Consejos de Select', detail: 'Recomendaciones y recordatorios de tus descargas Select.' },
      { key: 'plan_offers', label: 'Ofertas de planes', detail: 'Descuentos por tiempo limitado en planes.' },
    ],
  },
  {
    title: 'Hitos y logros',
    detail: 'Celebramos contigo cuando tus métricas crecen.',
    items: [
      { key: 'item_views', label: 'Hitos de visitas', detail: 'Cuando una fórmula alcanza un número de visitas.' },
      { key: 'item_favorites', label: 'Hitos de favoritos', detail: 'Cuando una fórmula suma favoritos.' },
      { key: 'item_sales', label: 'Hitos de ventas', detail: 'Cuando una fórmula alcanza ventas destacadas.' },
      { key: 'item_uses', label: 'Hitos de uso', detail: 'Cuando una fórmula se usa muchas veces.' },
      { key: 'item_downloads', label: 'Hitos de descargas', detail: 'Cuando una fórmula supera descargas.' },
      { key: 'account_milestones', label: 'Hitos de cuenta', detail: 'Cuando desbloqueás un nuevo beneficio.' },
      { key: 'upload_streak', label: 'Racha de publicaciones', detail: 'Recordatorio para mantener tu racha semanal.' },
    ],
  },
];

const SECTIONS = [
  { id: 'perfil', label: 'Perfil público', icon: User },
  { id: 'suscripciones', label: 'Suscripciones', icon: Crown },
  { id: 'creditos', label: 'Créditos', icon: CreditCard },
  { id: 'notificaciones', label: 'Notificaciones', icon: BellRing },
  { id: 'agentes', label: 'Agentes conectados', icon: Plug },
  { id: 'seguridad', label: 'Seguridad', icon: ShieldCheck },
];

const AGENTS = [
  { id: 'claude', name: 'Claude', letter: 'C', detail: 'Usá tus fórmulas dentro de Claude con la app de escritorio.' },
  { id: 'chatgpt', name: 'ChatGPT', letter: 'G', detail: 'Conectá tus prompts al asistente y reutilizalos en segundos.' },
  { id: 'cursor', name: 'Cursor', letter: '⌘', detail: 'Llevá tus fórmulas al editor y generá sin salir del código.' },
];

const fieldClass =
  'w-full rounded-xl border border-purple-100 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100';

const labelClass = 'block text-[11px] font-mono-code font-bold uppercase tracking-wider text-slate-500 mb-1.5';

export const ProfileSettingsView: React.FC<ProfileSettingsViewProps> = ({
  onShowToast,
  onUserChanged,
  onLogout,
  onOpenCreditsModal,
  onNavigate,
  onAccountDeleted,
}) => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectBusy, setSelectBusy] = useState(false);
  const [prefBusy, setPrefBusy] = useState<NotificationKey | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [company, setCompany] = useState('');
  const [avatarKey, setAvatarKey] = useState('');
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const applyProfile = (data: ProfileResponse) => {
    setProfile(data);
    setName(data.user.name || '');
    setUsername(data.user.username || '');
    setBio(data.user.bio || '');
    setCompany(data.company?.name || data.user.company || '');
    setAvatarKey(data.user.avatarKey || '');
    setPrefs(data.notifications);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.profile
      .get()
      .then((data) => {
        if (alive) applyProfile(data);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        onShowToast(
          'No se pudo cargar tu perfil',
          error instanceof Error ? error.message : undefined,
          'error'
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!profile) return false;
    return (
      name !== (profile.user.name || '') ||
      username !== (profile.user.username || '') ||
      bio !== (profile.user.bio || '') ||
      avatarKey !== (profile.user.avatarKey || '') ||
      (profile.user.accountType === 'corporate' &&
        company !== (profile.company?.name || profile.user.company || ''))
    );
  }, [profile, name, username, bio, avatarKey, company]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || saving) return;

    setSaving(true);
    try {
      const payload: Parameters<typeof api.profile.update>[0] = { name, username, bio, avatarKey };
      if (profile.user.accountType === 'corporate') payload.company = company;

      const response = await api.profile.update(payload);
      setProfile((current) =>
        current
          ? { ...current, user: response.user, notifications: response.notifications }
          : current
      );
      await onUserChanged();
      onShowToast('Perfil actualizado', 'Tus datos públicos ya se ven en Sparkhub.', 'success');
    } catch (error) {
      onShowToast(
        'No se pudo guardar el perfil',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePref = async (key: NotificationKey) => {
    if (!prefs || prefBusy) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setPrefBusy(key);

    try {
      const response = await api.profile.update({ notificationPrefs: { [key]: next[key] } });
      setPrefs(response.notifications);
    } catch (error) {
      setPrefs(previous);
      onShowToast(
        'No se pudo guardar la preferencia',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setPrefBusy(null);
    }
  };

  const toggleSelect = async () => {
    if (!profile || selectBusy) return;
    setSelectBusy(true);
    try {
      if (profile.subscriptions.isSelect) {
        const response = await api.select.cancel();
        onShowToast('Sparkhub Select', response.message, 'info');
      } else {
        const response = await api.select.subscribe();
        onShowToast('Sparkhub Select', response.message, 'success');
      }
      const data = await api.profile.get();
      applyProfile(data);
      await onUserChanged();
    } catch (error) {
      onShowToast(
        'No se pudo actualizar Select',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setSelectBusy(false);
    }
  };

  const copyAgentConfig = async (agent: string) => {
    const config = {
      agente: agent,
      api: 'http://127.0.0.1:3200/api',
      autenticacion: 'Clave de API personal (Bearer)',
      instrucciones: 'Creá una clave en Empresa → Claves de API y pegala en la configuración del agente.',
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      onShowToast('Configuración copiada', `Pegala en la configuración de ${agent}.`, 'success');
    } catch {
      onShowToast('No se pudo copiar', 'Tu navegador bloqueó el portapapeles.', 'error');
    }
  };

  const handleDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deleteConfirm || deleting) return;

    setDeleting(true);
    try {
      const response = await api.profile.deleteAccount({ password: deletePassword });
      onShowToast('Cuenta eliminada', response.message, 'info');
      setDeleteOpen(false);
      await onAccountDeleted();
    } catch (error) {
      onShowToast(
        'No se pudo eliminar la cuenta',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        <p className="text-sm">Cargando tu perfil y ajustes…</p>
      </div>
    );
  }

  if (!profile || !prefs) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <TriangleAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h1 className="font-space text-2xl font-bold text-slate-900">No pudimos cargar tu perfil</h1>
        <p className="text-sm text-slate-500 mt-2">Recargá la página o volvé a iniciar sesión.</p>
      </div>
    );
  }

  const { user, subscriptions, balances, avatarKeys } = profile;
  const displayName = user.name || user.email;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            CUENTA Y AJUSTES
          </div>
          <h1 className="font-space text-3xl font-extrabold text-slate-900 mt-1">Mi perfil y ajustes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Administrá cómo te ven los demás, tus suscripciones, créditos y notificaciones.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          Miembro desde {formatDate(user.createdAt)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
        <nav className="lg:sticky lg:top-24 rounded-2xl border border-purple-100 bg-white p-2 shadow-xs">
          <div className="px-3 py-2 text-[10px] font-mono-code font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> Ajustes
          </div>
          <div className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-none">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => goTo(section.id)}
                  className="shrink-0 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-purple-50 hover:text-purple-700 transition text-left"
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="space-y-6 min-w-0">
          {/* Perfil público */}
          <section id="perfil" className="rounded-2xl border border-purple-100 bg-white shadow-xs overflow-hidden scroll-mt-24">
            <div className="px-5 py-4 border-b border-purple-50 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-space text-lg font-bold text-slate-900">Perfil público</h2>
                <p className="text-xs text-slate-500 mt-0.5">Así te ven compradores y creadores en Sparkhub.</p>
              </div>
              <BadgeCheck className="w-5 h-5 text-purple-600" />
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="relative shrink-0">
                  <img
                    src={avatarFor(avatarKey)}
                    alt="Avatar actual"
                    className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md shadow-purple-500/10"
                  />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-900 text-white grid place-items-center">
                    <User className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{displayName}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {username ? `@${username}` : 'Todavía no elegiste un usuario'}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-mono-code font-bold uppercase">
                      {user.role === 'admin' ? 'Administrador' : subscriptions.planName}
                    </span>
                    {subscriptions.isSelect && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-mono-code font-bold uppercase">
                        <Sparkles className="w-3 h-3" /> Select activo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <span className={labelClass}>Elegí tu avatar</span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {avatarKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAvatarKey(key)}
                      className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition ${
                        avatarKey === key
                          ? 'border-purple-600 ring-2 ring-purple-100'
                          : 'border-transparent hover:border-purple-200'
                      }`}
                      title={key}
                    >
                      <img src={avatarFor(key)} alt={key} className="w-14 h-14 object-cover" />
                      {avatarKey === key && (
                        <span className="absolute inset-0 bg-purple-700/25 grid place-items-center">
                          <Check className="w-5 h-5 text-white drop-shadow" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile-name" className={labelClass}>
                    Nombre público
                  </label>
                  <input
                    id="profile-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={60}
                    placeholder="Tu nombre o el de tu estudio"
                    className={fieldClass}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Entre 2 y 60 caracteres.</p>
                </div>
                <div>
                  <label htmlFor="profile-username" className={labelClass}>
                    Nombre de usuario
                  </label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="profile-username"
                      value={username}
                      onChange={(event) =>
                        setUsername(event.target.value.toLowerCase().replace(/\s+/g, ''))
                      }
                      maxLength={30}
                      placeholder="tuusuario"
                      className={`${fieldClass} pl-9`}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    3 a 30 caracteres. Letras, números, punto, guion y guion bajo.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="profile-bio" className={labelClass}>
                  Biografía
                </label>
                <textarea
                  id="profile-bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value.slice(0, 400))}
                  rows={3}
                  placeholder="Contá qué creás, para qué modelos y qué te diferencia."
                  className={`${fieldClass} resize-none`}
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>Se muestra en tu perfil de creador.</span>
                  <span>{bio.length}/400</span>
                </div>
              </div>

              {user.accountType === 'corporate' && (
                <div>
                  <label htmlFor="profile-company" className={labelClass}>
                    Empresa
                  </label>
                  <input
                    id="profile-company"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    maxLength={80}
                    placeholder="Nombre de tu empresa o estudio"
                    className={fieldClass}
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-slate-400">
                  Tu correo ({user.email}) nunca se muestra públicamente.
                </p>
                <button
                  type="submit"
                  disabled={saving || !dirty}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-slate-900 text-white text-xs font-semibold transition"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>

          {/* Suscripciones */}
          <section id="suscripciones" className="rounded-2xl border border-purple-100 bg-white shadow-xs overflow-hidden scroll-mt-24">
            <div className="px-5 py-4 border-b border-purple-50">
              <h2 className="font-space text-lg font-bold text-slate-900">Suscripciones</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tu plan actual y los beneficios activos.</p>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono-code font-bold uppercase tracking-widest text-purple-700">
                    Plan actual
                  </span>
                  <Crown className="w-4 h-4 text-purple-600" />
                </div>
                <div className="font-space text-xl font-bold text-slate-900 mt-2">{subscriptions.planName}</div>
                <p className="text-xs text-slate-500 mt-1">
                  {subscriptions.planCredits > 0
                    ? `${subscriptions.planCredits} créditos al activar el plan.`
                    : 'Plan gratuito con acceso completo al catálogo.'}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('/planes')}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900"
                >
                  Ver planes y precios <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="rounded-xl border border-purple-100 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono-code font-bold uppercase tracking-widest text-slate-500">
                    Sparkhub Select
                  </span>
                  <Sparkles className={`w-4 h-4 ${subscriptions.isSelect ? 'text-emerald-600' : 'text-slate-400'}`} />
                </div>
                <div className="font-space text-lg font-bold text-slate-900 mt-2">
                  {subscriptions.isSelect ? 'Activo' : 'No activo'}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {subscriptions.isSelect
                    ? `Activo desde ${formatDate(subscriptions.selectSince || user.createdAt)}. Descargas y beneficios incluidos.`
                    : 'Activá Select para desbloquear beneficios y descargas extra.'}
                </p>
                <button
                  type="button"
                  onClick={toggleSelect}
                  disabled={selectBusy}
                  className={`mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition disabled:opacity-60 ${
                    subscriptions.isSelect
                      ? 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:brightness-110'
                  }`}
                >
                  {selectBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {subscriptions.isSelect ? 'Cancelar Select' : 'Activar Select'}
                </button>
              </div>
            </div>
          </section>

          {/* Créditos */}
          <section id="creditos" className="rounded-2xl border border-purple-100 bg-white shadow-xs overflow-hidden scroll-mt-24">
            <div className="px-5 py-4 border-b border-purple-50">
              <h2 className="font-space text-lg font-bold text-slate-900">Saldos de créditos</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tus créditos disponibles para generar y comprar fórmulas.</p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-purple-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono-code font-bold uppercase tracking-widest text-slate-500">
                    Créditos de generación
                  </span>
                  <Wand2 className="w-4 h-4 text-purple-600" />
                </div>
                <div className="font-space text-3xl font-extrabold text-slate-900 mt-2">
                  {balances.generationCredits}
                </div>
                <p className="text-xs text-slate-500 mt-1">Cada generación cuesta 2 créditos.</p>
              </div>
              <div className="rounded-xl border border-purple-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono-code font-bold uppercase tracking-widest text-slate-500">
                    Descargas Select
                  </span>
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="font-space text-3xl font-extrabold text-slate-900 mt-2">
                  {balances.selectDownloads}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {subscriptions.isSelect
                    ? 'Tus descargas Select se renuevan con la suscripción.'
                    : 'Activá Select para acceder a descargas incluidas.'}
                </p>
              </div>
            </div>
            <div className="px-5 pb-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenCreditsModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold transition"
              >
                <CreditCard className="w-3.5 h-3.5" /> Comprar créditos
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/biblioteca')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-200 text-slate-700 hover:bg-purple-50 text-xs font-semibold transition"
              >
                Ver movimientos <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>

          {/* Notificaciones */}
          <section id="notificaciones" className="rounded-2xl border border-purple-100 bg-white shadow-xs overflow-hidden scroll-mt-24">
            <div className="px-5 py-4 border-b border-purple-50 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-space text-lg font-bold text-slate-900">Preferencias de notificación</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elegí qué avisos querés recibir. Se guardan al instante.
                </p>
              </div>
              <Mail className="w-5 h-5 text-purple-600" />
            </div>
            <div className="p-5 space-y-6">
              {NOTIFICATION_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="mb-2">
                    <h3 className="text-xs font-mono-code font-bold uppercase tracking-wider text-slate-700">
                      {group.title}
                    </h3>
                    <p className="text-[11px] text-slate-400">{group.detail}</p>
                  </div>
                  <div className="rounded-xl border border-purple-100 divide-y divide-purple-50 overflow-hidden">
                    {group.items.map((item) => {
                      const active = prefs[item.key];
                      const busy = prefBusy === item.key;
                      return (
                        <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800">{item.label}</div>
                            <div className="text-[11px] text-slate-400">{item.detail}</div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={active}
                            aria-label={`${item.label}: ${active ? 'activado' : 'desactivado'}`}
                            onClick={() => togglePref(item.key)}
                            disabled={busy}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition disabled:opacity-60 ${
                              active ? 'bg-purple-600' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                                active ? 'left-[22px]' : 'left-0.5'
                              }`}
                            />
                            {busy && (
                              <Loader2 className="absolute inset-0 m-auto w-3 h-3 animate-spin text-white" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Agentes conectados */}
          <section id="agentes" className="rounded-2xl border border-purple-100 bg-white shadow-xs overflow-hidden scroll-mt-24">
            <div className="px-5 py-4 border-b border-purple-50 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-space text-lg font-bold text-slate-900">Agentes conectados</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conectá Claude, ChatGPT o Cursor para buscar y usar tus fórmulas dentro del agente.
                </p>
              </div>
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              {AGENTS.map((agent) => (
                <div key={agent.id} className="rounded-xl border border-purple-100 p-4 flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-lg bg-slate-900 text-white grid place-items-center font-space font-bold">
                      {agent.letter}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{agent.name}</div>
                      <div className="text-[10px] font-mono-code uppercase tracking-wider text-slate-400">
                        No conectado
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 flex-1">{agent.detail}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyAgentConfig(agent.name)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-purple-700 text-white text-[11px] font-semibold transition"
                    >
                      <Copy className="w-3 h-3" /> Copiar config
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('/empresa')}
                      className="px-3 py-2 rounded-lg border border-purple-200 text-slate-700 hover:bg-purple-50 transition"
                      title="Gestionar claves de API"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5">
              <div className="rounded-xl bg-purple-50/60 border border-purple-100 px-4 py-3 text-[11px] text-slate-600 flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <p>
                  Los agentes usan una clave de API personal con encabezado{' '}
                  <code className="font-mono-code text-purple-700">Authorization: Bearer &lt;clave&gt;</code>.
                  Creá o revocá claves desde{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/empresa')}
                    className="font-semibold text-purple-700 hover:underline"
                  >
                    Empresa → Claves de API
                  </button>
                  .
                </p>
              </div>
            </div>
          </section>

          {/* Seguridad */}
          <section id="seguridad" className="rounded-2xl border border-purple-100 bg-white shadow-xs overflow-hidden scroll-mt-24">
            <div className="px-5 py-4 border-b border-purple-50">
              <h2 className="font-space text-lg font-bold text-slate-900">Seguridad y sesión</h2>
              <p className="text-xs text-slate-500 mt-0.5">Controlá tu sesión y la permanencia de tu cuenta.</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-purple-100 p-4">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 grid place-items-center">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Sesión activa</div>
                    <div className="text-[11px] text-slate-400">
                      Cerraste sesión por última vez desde este dispositivo. La sesión dura 7 días.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
                >
                  <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
                </button>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 grid place-items-center shrink-0">
                    <TriangleAlert className="w-4 h-4" />
                  </span>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-rose-800 uppercase font-mono-code tracking-wider">
                      Zona de peligro
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Al eliminar tu cuenta se borran tus fórmulas, compras, mensajes y datos asociados.
                      Esta acción no se puede deshacer.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDeleteOpen(true)}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar mi cuenta
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <form
            onSubmit={handleDelete}
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-rose-100 overflow-hidden"
          >
            <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 grid place-items-center">
                <Trash2 className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-space text-base font-bold text-rose-900">Eliminar cuenta</h3>
                <p className="text-[11px] text-rose-700">No hay vuelta atrás.</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Para confirmar, escribí tu contraseña y marcá la casilla. Se eliminarán tus fórmulas,
                compras, favoritos, mensajes y suscripciones.
              </p>

              <div>
                <label htmlFor="delete-password" className={labelClass}>
                  Contraseña
                </label>
                <input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="Tu contraseña actual"
                  autoComplete="current-password"
                  className={fieldClass}
                  required
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-200"
                />
                Entiendo que esta acción es permanente y que no podré recuperar mi cuenta.
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeletePassword('');
                    setDeleteConfirm(false);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!deleteConfirm || !deletePassword || deleting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold transition"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
