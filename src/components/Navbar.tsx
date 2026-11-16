import React from 'react';
import {
  Sparkles,
  Search,
  Zap,
  User,
  ChevronDown,
  Plus,
  LogOut,
  LayoutDashboard,
  Library,
  ShieldCheck,
} from 'lucide-react';
import type { AuthUser } from '../types';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  user: AuthUser | null;
  credits: number;
  onOpenCreditsModal: () => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  user,
  credits,
  onOpenCreditsModal,
  onOpenAuthModal,
  onLogout,
  searchQuery,
  onSearchChange,
}) => {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  const navItems = [
    { id: 'explore', label: 'Explorar Prompts' },
    { id: 'generator', label: 'Generador IA', badge: 'En Vivo' },
    { id: 'sell', label: 'Vender Prompts' },
    { id: 'creator-studio', label: 'Panel Creador' },
    { id: 'hire', label: 'Top Creadores' },
    { id: 'library', label: 'Mi Biblioteca' },
    { id: 'enterprise', label: 'Empresa' },
    { id: 'admin-qa', label: 'Revisor QA', badge: 'Admin', soloAdmin: true },
    { id: 'pricing', label: 'Planes' },
  ].filter((item) => !item.soloAdmin || user?.role === 'admin');

  const inicial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();
  const esAdmin = user?.role === 'admin';

  const irA = (tab: string) => {
    setUserMenuOpen(false);
    onSelectTab(tab);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-purple-100/80 transition-all">
      {/* Barra superior de estado y sesión */}
      <div className="bg-gradient-to-r from-purple-50 via-slate-50 to-purple-50/50 border-b border-purple-100/40 px-4 py-1.5 text-[11px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono-code text-purple-700 font-semibold tracking-wider uppercase">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SPARKHUB // KÁBAL ENGINE V4.2
          </span>
          <span className="text-slate-300">|</span>
          <span className="hidden md:inline text-slate-500">
            Descubre • Crea • Comparte fórmulas de Inteligencia Artificial
          </span>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-purple-200 text-purple-900">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  esAdmin ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
              <span className="font-space text-xs">
                {esAdmin ? 'Administrador' : 'Usuario'}
                <span className="text-slate-300 mx-1">·</span>
                <span className="max-w-[160px] truncate inline-block align-bottom">
                  {user.name || user.email}
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Visitante</span>
              <button
                onClick={onOpenAuthModal}
                className="font-semibold text-purple-700 hover:text-purple-900 hover:underline"
              >
                Iniciar sesión
              </button>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Servidor local · sin conexión</span>
          </div>
        </div>
      </div>

      {/* Barra principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <div
            className="flex items-center gap-3 shrink-0 cursor-pointer"
            onClick={() => onSelectTab('explore')}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 border border-purple-400/40 transform transition hover:scale-105">
              <span className="font-space font-bold text-xl tracking-tighter">S</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-space font-bold text-xl tracking-tight text-slate-900">
                  Spark
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
                    hub
                  </span>
                </span>
                <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 font-bold">
                  EXP // 2026
                </span>
              </div>
            </div>
          </div>

          {/* Buscador */}
          <div className="hidden lg:flex items-center flex-1 max-w-xs relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar fórmulas, modelos o tags..."
              className="w-full pl-9 pr-12 py-1.5 text-xs bg-slate-50/80 border border-purple-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:bg-white text-slate-800 placeholder-slate-400 transition"
            />
            <span className="absolute right-3 text-[10px] font-mono-code text-slate-400 bg-white border border-slate-200 px-1 py-0.5 rounded shadow-2xs">
              ⌘K
            </span>
          </div>

          {/* Navegación */}
          <nav className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`relative px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'text-purple-900 bg-purple-100/70 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-purple-800 hover:bg-purple-50/50'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded-full bg-purple-600 text-white font-mono-code">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Acciones */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenCreditsModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200/70 text-purple-900 hover:bg-purple-100/70 transition shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 text-purple-600 fill-purple-600" />
              <div className="text-left">
                <span className="text-xs font-bold font-mono-code">{user ? credits : '—'}</span>
                <span className="text-[10px] text-purple-600 ml-1 font-medium">CRÉDITOS</span>
              </div>
              <Plus className="w-3 h-3 text-purple-500 ml-0.5 hover:rotate-90 transition-transform" />
            </button>

            <button
              onClick={() => onSelectTab('sell')}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 text-white text-xs font-semibold shadow-md shadow-purple-600/20 hover:shadow-purple-600/35 hover:scale-[1.02] active:scale-95 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Vender Prompt</span>
            </button>

            {/* Cuenta */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((abierto) => !abierto)}
                  className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl border border-purple-200 bg-white hover:border-purple-300 hover:shadow-xs transition"
                  title="Cuenta y sesión"
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                      esAdmin
                        ? 'bg-gradient-to-tr from-rose-600 to-orange-500'
                        : 'bg-gradient-to-tr from-purple-700 to-indigo-600'
                    }`}
                  >
                    {inicial}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-1 w-64 bg-white rounded-2xl shadow-xl border border-purple-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-purple-100/70 mb-1">
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {user.name || user.email}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-mono-code font-bold px-1.5 py-0.5 rounded ${
                            esAdmin
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {esAdmin ? 'ADMIN' : 'USUARIO'}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-purple-700 font-mono-code">
                          <Zap className="w-3 h-3 fill-purple-600 text-purple-600" />
                          {user.credits} créditos
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => irA(esAdmin ? 'admin-qa' : 'creator-studio')}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs text-slate-700 hover:bg-purple-50 transition"
                    >
                      <LayoutDashboard className="w-4 h-4 text-purple-600" />
                      {esAdmin ? 'Panel de administración' : 'Panel creador'}
                    </button>
                    <button
                      onClick={() => irA('library')}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs text-slate-700 hover:bg-purple-50 transition"
                    >
                      <Library className="w-4 h-4 text-purple-600" />
                      Mi Biblioteca
                    </button>
                    {esAdmin && (
                      <button
                        onClick={() => irA('admin-qa')}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs text-slate-700 hover:bg-purple-50 transition"
                      >
                        <ShieldCheck className="w-4 h-4 text-rose-600" />
                        Revisar prompts (QA)
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs text-rose-600 hover:bg-rose-50 transition mt-1 border-t border-purple-100/70 pt-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="w-9 h-9 rounded-xl border border-purple-200 bg-white flex items-center justify-center text-slate-700 hover:text-purple-700 hover:border-purple-300 hover:shadow-xs transition"
                title="Iniciar sesión o crear cuenta"
              >
                <User className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Pestañas móviles */}
        <div className="flex xl:hidden overflow-x-auto py-2 gap-1 border-t border-purple-100/60 no-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-1 text-xs rounded-lg shrink-0 font-medium transition ${
                currentTab === item.id
                  ? 'bg-purple-600 text-white font-semibold'
                  : 'text-slate-600 hover:bg-purple-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
