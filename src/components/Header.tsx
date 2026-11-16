import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  X,
} from 'lucide-react';
import type { AuthUser } from '../types';
import { api } from '../lib/api';
import { CategoryIcon } from './CategoryIcon';
import { useStore } from '../context/StoreContext';

export interface CategoryNode {
  id: number;
  slug: string;
  nombre: string;
  icono: string;
  orden: number;
  count: number;
  children: CategoryNode[];
}

interface HeaderProps {
  user: AuthUser | null;
  credits: number;
  onOpenCreditsModal: () => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  credits,
  onOpenCreditsModal,
  onOpenAuthModal,
  onLogout,
  searchQuery,
  onSearchChange,
  onShowToast,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    cart,
    notifications,
    unreadNotifications,
    unreadMessages,
    isSelect,
    refreshNotifications,
    refreshMessages,
    refreshSelect,
  } = useStore();

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [megaOpen, setMegaOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { type: string; label: string; detail: string; href: string }[]
  >([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectBusy, setSelectBusy] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const suggestionsTimer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    api.categories
      .list()
      .then((data) => {
        if (alive) setCategories(data.items);
      })
      .catch((error: unknown) => {
        if (alive) setCategoriesError(error instanceof Error ? error.message : 'Error al cargar categorías.');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setMegaOpen(false);
        setNotificationsOpen(false);
        setUserMenuOpen(false);
        setSuggestionsOpen(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (suggestionsTimer.current) window.clearTimeout(suggestionsTimer.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    suggestionsTimer.current = window.setTimeout(() => {
      api.search
        .suggest(q)
        .then((data) => {
          setSuggestions(data.items);
          setSuggestionsOpen(true);
        })
        .catch(() => setSuggestions([]));
    }, 180);
    return () => {
      if (suggestionsTimer.current) window.clearTimeout(suggestionsTimer.current);
    };
  }, [searchQuery]);

  const activeCategory = location.pathname.startsWith('/categoria/')
    ? location.pathname.split('/')[2]
    : '';

  const role = user?.activeRole || 'comprador';
  const canHire = role === 'empresario' || role === 'administrador';
  const isAdmin = user?.role === 'admin';

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setSuggestionsOpen(false);
    setSearchFocused(false);
    navigate('/');
  };

  const toggleSelect = async () => {
    if (!user) {
      onOpenAuthModal();
      return;
    }
    setSelectBusy(true);
    try {
      if (isSelect) {
        await api.select.cancel();
        onShowToast('Sparkhub Select', 'Suscripción cancelada.', 'info');
      } else {
        await api.select.subscribe();
        onShowToast('Sparkhub Select', 'Beneficios activados y guardados.', 'success');
      }
      await refreshSelect();
    } catch (error) {
      onShowToast('No se pudo actualizar Select', error instanceof Error ? error.message : undefined, 'error');
    } finally {
      setSelectBusy(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.notifications.readAll();
      await refreshNotifications();
    } catch (error) {
      onShowToast('No se pudieron marcar', error instanceof Error ? error.message : undefined, 'error');
    }
  };

  const openNotifications = async () => {
    setNotificationsOpen((open) => !open);
    setUserMenuOpen(false);
    if (!notificationsOpen && user) {
      await refreshNotifications();
      await refreshMessages();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0b0713] text-slate-100 border-b border-white/10 shadow-lg shadow-black/20">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
        <div className="flex items-center gap-3 h-16">
          <button
            type="button"
            onClick={() => setMegaOpen((open) => !open)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold transition"
            aria-expanded={megaOpen}
            aria-label="Abrir categorías"
          >
            <Menu className="w-4 h-4" />
            <span className="hidden sm:inline">Categorías</span>
          </button>

          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Sparkles className="w-5 h-5 text-fuchsia-400" />
            <span className="font-space text-xl font-bold bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
              Sparkhub
            </span>
          </Link>

          <form onSubmit={submitSearch} className="relative flex-1 max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              onFocus={() => {
                setSearchFocused(true);
                if (suggestions.length) setSuggestionsOpen(true);
              }}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
              placeholder="Buscar prompts, modelos o categorías"
              aria-label="Buscar en Sparkhub"
              className="w-full h-10 pl-9 pr-12 rounded-xl bg-white/5 border border-white/10 focus:border-fuchsia-400/60 focus:bg-white/10 outline-none text-sm placeholder:text-slate-500 transition"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] px-1.5 py-0.5 rounded border border-white/15 text-slate-400">
              /
            </kbd>

            {suggestionsOpen && searchFocused && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-12 rounded-2xl border border-white/10 bg-[#151022] shadow-2xl shadow-black/40 overflow-hidden">
                {suggestions.slice(0, 8).map((item) => (
                  <button
                    key={`${item.type}-${item.label}-${item.href}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSuggestionsOpen(false);
                      onSearchChange('');
                      navigate(item.href);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-0"
                  >
                    <div className="text-sm font-medium text-slate-100">{item.label}</div>
                    <div className="text-[11px] text-slate-400">{item.detail}</div>
                  </button>
                ))}
              </div>
            )}
          </form>

          <nav className="hidden xl:flex items-center gap-1 text-sm font-medium">
            <Link to="/vender" className="px-2.5 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Crear
            </Link>
            {canHire && (
              <Link to="/creadores" className="px-2.5 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1">
                <Store className="w-4 h-4" /> Contratar
              </Link>
            )}
            <Link to="/vender" className="px-2.5 py-2 rounded-lg hover:bg-white/10">
              Vender
            </Link>
          </nav>

          <div className="flex items-center gap-1">
            <Link
              to="/mensajes"
              className="relative p-2 rounded-xl hover:bg-white/10 text-slate-300"
              aria-label="Mensajes"
            >
              <MessageSquare className="w-5 h-5" />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-fuchsia-500 text-[10px] font-bold text-white grid place-items-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={openNotifications}
                className="relative p-2 rounded-xl hover:bg-white/10 text-slate-300"
                aria-label="Notificaciones"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-violet-500 text-[10px] font-bold text-white grid place-items-center">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-12 w-80 rounded-2xl border border-white/10 bg-[#151022] shadow-2xl shadow-black/50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <span className="text-sm font-semibold">Notificaciones</span>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-[11px] text-fuchsia-300 hover:text-fuchsia-200 flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Marcar leídas
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-400">No tenés notificaciones todavía.</p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.slice(0, 12).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            api.notifications.read(item.id).then(refreshNotifications);
                            setNotificationsOpen(false);
                            if (item.enlace) navigate(item.enlace);
                          }}
                          className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 ${
                            item.leida ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="text-sm font-medium">{item.titulo}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{item.mensaje}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              to="/carrito"
              className="relative p-2 rounded-xl hover:bg-white/10 text-slate-300"
              aria-label="Carrito"
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-white grid place-items-center">
                  {cart.count > 9 ? '9+' : cart.count}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={toggleSelect}
              disabled={selectBusy}
              className={`hidden lg:inline-flex ml-1 items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-white transition ${
                isSelect
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:brightness-110'
              } disabled:opacity-60`}
            >
              <Sparkles className="w-4 h-4" />
              {isSelect ? 'Select activo' : 'Sparkhub Select'}
            </button>

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen((open) => !open);
                    setNotificationsOpen(false);
                  }}
                  className="ml-1 flex items-center gap-2 p-1 rounded-xl hover:bg-white/10"
                  aria-label="Menú de usuario"
                >
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center text-sm font-bold">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-12 w-64 rounded-2xl border border-white/10 bg-[#151022] shadow-2xl shadow-black/50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                      <div className="text-sm font-semibold truncate">{user.name || user.email}</div>
                      <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-400 capitalize">Rol: {role}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            onOpenCreditsModal();
                          }}
                          className="inline-flex items-center gap-1 text-fuchsia-300"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> {credits} créditos
                        </button>
                      </div>
                    </div>
                    <MenuLink to="/biblioteca" icon={<Library className="w-4 h-4" />} onClick={() => setUserMenuOpen(false)}>
                      Mi biblioteca
                    </MenuLink>
                    <MenuLink to="/panel" icon={<LayoutDashboard className="w-4 h-4" />} onClick={() => setUserMenuOpen(false)}>
                      Panel creador
                    </MenuLink>
                    {(role === 'empresario' || isAdmin) && (
                      <MenuLink to="/empresa" icon={<Store className="w-4 h-4" />} onClick={() => setUserMenuOpen(false)}>
                        Empresa
                      </MenuLink>
                    )}
                    {isAdmin && (
                      <MenuLink to="/admin" icon={<Menu className="w-4 h-4" />} onClick={() => setUserMenuOpen(false)}>
                        Administración
                      </MenuLink>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10 border-t border-white/10"
                    >
                      <LogOut className="w-4 h-4" /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="ml-1 px-3.5 py-2 rounded-xl bg-white text-slate-900 text-sm font-bold hover:bg-slate-200 transition"
              >
                Ingresar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#120c1f] border-t border-white/5">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5" aria-label="Categorías">
            {categoriesError && (
              <span className="text-xs text-red-300 px-2">{categoriesError}</span>
            )}
            {categories.map((category) => {
              const active = activeCategory === category.slug;
              return (
                <Link
                  key={category.id}
                  to={`/categoria/${category.slug}`}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition ${
                    active
                      ? 'bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 text-white border border-fuchsia-400/30'
                      : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <CategoryIcon name={category.icono} className="w-4 h-4" />
                  {category.nombre}
                  <span className="text-[10px] text-slate-500">{category.count}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {megaOpen && (
        <div className="absolute left-0 right-0 top-full bg-[#0f0a1a]/98 backdrop-blur border-t border-white/10 shadow-2xl shadow-black/60">
          <div className="max-w-[1400px] mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-space text-lg font-bold">Todas las categorías</h2>
              <button
                type="button"
                onClick={() => setMegaOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10"
                aria-label="Cerrar categorías"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {categories.map((category) => (
                <div key={category.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <Link
                    to={`/categoria/${category.slug}`}
                    onClick={() => setMegaOpen(false)}
                    className="flex items-center justify-between gap-2 mb-2 text-sm font-semibold hover:text-fuchsia-300"
                  >
                    <span className="flex items-center gap-2">
                      <CategoryIcon name={category.icono} className="w-4 h-4" />
                      {category.nombre}
                    </span>
                    <span className="text-[11px] text-slate-500">{category.count}</span>
                  </Link>
                  <ul className="space-y-1">
                    {category.children.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          to={`/categoria/${sub.slug}`}
                          onClick={() => setMegaOpen(false)}
                          className="flex items-center justify-between text-xs text-slate-400 hover:text-white"
                        >
                          <span>{sub.nombre}</span>
                          <span className="text-[10px]">{sub.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

const MenuLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ to, icon, onClick, children }) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white border-t border-white/5"
  >
    {icon}
    {children}
  </Link>
);
