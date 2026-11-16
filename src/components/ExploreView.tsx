import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Sparkles,
  Star,
  ArrowUpRight,
  CheckCircle2,
  Bookmark,
  Zap,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Heart,
} from 'lucide-react';
import type { CreatorProfile, PromptItem } from '../types';
import { api } from '../lib/api';
import type { HomeResponse } from '../lib/api';
import { avatarFor, toCreator, toPromptItem } from '../lib/adapters';
import { CategoryIcon } from './CategoryIcon';

interface ExploreViewProps {
  onSelectPrompt: (prompt: PromptItem) => void;
  onNavigateToSell: () => void;
  onNavigateToGenerator: () => void;
  onNavigateToHire: () => void;
  onOpenCreator: (id: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenQuickBuy: (prompt: PromptItem) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
}

const SORT_LABELS = [
  { id: 'trending', label: 'Más vendidos' },
  { id: 'rating', label: 'Mejor calificados' },
  { id: 'newest', label: 'Más recientes' },
  { id: 'price_asc', label: 'Menor precio' },
  { id: 'price_desc', label: 'Mayor precio' },
];

interface CategoryNode {
  id: number;
  slug: string;
  nombre: string;
  icono: string;
  orden: number;
  count: number;
  children: CategoryNode[];
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  onSelectPrompt,
  onNavigateToSell,
  onNavigateToGenerator,
  onNavigateToHire,
  onOpenCreator,
  searchQuery,
  onSearchChange,
  onOpenQuickBuy,
  onShowToast,
  isAuthenticated,
  onRequireAuth,
}) => {
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [items, setItems] = useState<PromptItem[]>([]);
  const [favorites, setFavorites] = useState<PromptItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [pages, setPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<string>('trending');
  const [showFavorites, setShowFavorites] = useState<boolean>(false);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(searchQuery);
  const [loading, setLoading] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    api.home()
      .then(setHome)
      .catch(() => setHome(null));
    api.categories
      .list()
      .then(({ items }) => setCategoryTree(items as CategoryNode[]))
      .catch(() => setCategoryTree([]));
    api.creators
      .list()
      .then(({ items: list }) => setCreators(list.map(toCreator)))
      .catch(() => setCreators([]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let alive = true;

    if (showFavorites) {
      if (!isAuthenticated) {
        setShowFavorites(false);
        onRequireAuth();
        return;
      }
      setLoading(true);
      api.prompts
        .favorites()
        .then(({ items: list }) => {
          if (alive) setFavorites(list.map(toPromptItem));
        })
        .catch((error: unknown) => {
          if (alive) {
            onShowToast(
              'No se pudieron cargar tus favoritos',
              error instanceof Error ? error.message : undefined,
              'error'
            );
          }
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    api.prompts
      .list({ search: debouncedSearch, category, sort, page, limit: 12 })
      .then((response) => {
        if (!alive) return;
        setItems(response.items.map(toPromptItem));
        setTotal(response.total);
        setPages(response.pages);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setItems([]);
        setTotal(0);
        onShowToast(
          'No se pudo cargar el catálogo',
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
  }, [debouncedSearch, category, sort, page, showFavorites, isAuthenticated, reloadKey]);

  const visible = useMemo(() => {
    if (!showFavorites) return items;
    const search = debouncedSearch.toLowerCase();
    const activeName = categoryTree.find((item) => item.slug === category)?.nombre;
    return favorites.filter((prompt) => {
      const matchesCategory = category === 'all' || prompt.category === activeName;
      const matchesSearch =
        !search ||
        prompt.title.toLowerCase().includes(search) ||
        prompt.description.toLowerCase().includes(search) ||
        prompt.author.name.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [showFavorites, items, favorites, category, categoryTree, debouncedSearch]);

  const featured = useMemo(() => {
    if (showFavorites) return favorites.slice(0, 3);
    if (!debouncedSearch && category === 'all' && home?.featured.length) {
      return home.featured.map(toPromptItem).slice(0, 3);
    }
    return items.slice(0, 4);
  }, [showFavorites, favorites, items, debouncedSearch, category, home]);

  const toggleFavorite = async (prompt: PromptItem, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    try {
      const response = await api.prompts.favorite(prompt.id);
      const nextValue = response.favorited;
      setItems((prev) =>
        prev.map((item) => (item.id === prompt.id ? { ...item, isFavorited: nextValue } : item))
      );
      setFavorites((prev) =>
        nextValue
          ? prev.some((item) => item.id === prompt.id)
            ? prev
            : [{ ...prompt, isFavorited: true }, ...prev]
          : prev.filter((item) => item.id !== prompt.id)
      );
      onShowToast(
        nextValue ? 'Guardado en favoritos' : 'Quitado de favoritos',
        prompt.title,
        'success'
      );
    } catch (error) {
      onShowToast(
        'No se pudo actualizar el favorito',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    }
  };

  const goToPage = (next: number) => {
    setPage(Math.min(pages, Math.max(1, next)));
    window.scrollTo({ top: 420, behavior: 'smooth' });
  };

  const categories = categoryTree;

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100/70 text-purple-900 border border-purple-200/60 text-xs font-mono-code font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
          SPARKHUB ARCHIVE // {total > 0 ? `${total} FÓRMULAS CERTIFICADAS` : 'MARKETPLACE EN VIVO'}
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 font-space max-w-4xl mx-auto leading-[1.15]">
          Encuentra y vende los mejores <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-indigo-600 to-cyan-600">
            Prompts para IA
          </span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Adquiere fórmulas maestras con reproducibilidad garantizada para Midjourney, ChatGPT,
          Claude 3.5, Flux.1 y Stable Diffusion.
        </p>

        {/* Master Search Bar */}
        <div className="mt-8 max-w-3xl mx-auto bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-xl shadow-purple-500/5 border border-purple-100 flex flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full sm:w-52 shrink-0">
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-purple-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="all">TODAS LAS CATEGORÍAS</option>
              {categories.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.nombre.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Busca por estética, caso de uso o nicho (ej. isométrica 3D, copywriting B2B)…"
              className="w-full pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
            />
          </div>

          <button
            onClick={() => {
              setPage(1);
              setReloadKey((key) => key + 1);
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-space text-xs font-bold tracking-wider uppercase transition shadow-md"
          >
            EXPLORAR →
          </button>
        </div>

        {/* Quick trending tags */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <span className="font-mono-code text-[11px] uppercase tracking-wider text-slate-400">
            TENDENCIAS 7 DÍAS:
          </span>
          {(home?.trending.terms ?? []).length === 0 ? (
            <span className="text-[11px] text-slate-400">Todavía no hay búsquedas registradas.</span>
          ) : (
            home?.trending.terms.map((item) => (
              <button
                key={item.term}
                onClick={() => onSearchChange(item.term)}
                className="px-2.5 py-0.5 rounded-lg bg-white border border-purple-100 text-slate-600 hover:border-purple-300 hover:text-purple-700 transition text-[11px]"
              >
                {item.term}
                <span className="ml-1 text-[9px] text-slate-400">{item.uses}</span>
              </button>
            ))
          )}
        </div>

        {/* Curated Deck */}
        <div className="mt-14 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-xs font-mono-code font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              CURATED DECK // {showFavorites ? 'TUS FAVORITOS' : 'COLECCIÓN ÉLITE'}
            </span>
            <span className="text-xs font-mono-code text-slate-400">
              {featured.length.toString().padStart(2, '0')} DESTACADOS
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {featured.map((prompt) => (
              <div
                key={prompt.id}
                onClick={() => onSelectPrompt(prompt)}
                className="group relative rounded-2xl overflow-hidden bg-slate-900 border border-purple-500/20 shadow-xl cursor-pointer transform hover:-translate-y-1 transition duration-300"
              >
                <div className="aspect-[3/4] relative overflow-hidden">
                  <img
                    src={prompt.previewImages[0]}
                    alt={prompt.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-mono-code font-bold text-white border border-white/10 uppercase">
                      {prompt.model.split(' ')[0]}
                    </span>
                    <span className="text-[10px] font-mono-code text-purple-300 font-bold bg-purple-900/60 px-1.5 py-0.5 rounded">
                      {prompt.price} cr
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 text-left">
                    <h3 className="text-xs font-bold text-white font-space truncate">{prompt.title}</h3>
                    <p className="text-[10px] text-slate-300 truncate mt-0.5">{prompt.author.name}</p>
                  </div>
                </div>
              </div>
            ))}
            {!featured.length && (
              <div className="col-span-2 sm:col-span-3 py-10 text-xs text-slate-400 bg-white/60 rounded-2xl border border-purple-100">
                Todavía no hay fórmulas para mostrar en esta selección.
              </div>
            )}
          </div>
        </div>

        {/* Real-time stats bar */}
        <div className="mt-14 max-w-5xl mx-auto py-6 px-4 bg-white/70 backdrop-blur-md rounded-2xl border border-purple-100/80 shadow-xs grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-space">
              {home?.stats.prompts ?? total}
            </div>
            <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
              Prompts Activos
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-space">
              {home?.stats.users ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
              Usuarios Registrados
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-space">
              {home?.stats.onlineNow ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
              En Línea Ahora
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-space">
              {home?.stats.rating ? `${home.stats.rating.toFixed(1)}★` : '—'}
            </div>
            <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
              Rating Promedio
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-space">
              {home?.stats.reviews ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">
              Reseñas Reales
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog & Filter Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-purple-100 pb-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 no-scrollbar">
            <button
              onClick={() => {
                setShowFavorites(false);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono-code font-bold whitespace-nowrap transition ${
                !showFavorites
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-purple-100 text-slate-600 hover:border-purple-300 hover:text-purple-900'
              }`}
            >
              TODOS
            </button>
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  onRequireAuth();
                  return;
                }
                setShowFavorites(true);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono-code font-bold whitespace-nowrap transition flex items-center gap-1 ${
                showFavorites
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-purple-100 text-slate-600 hover:border-purple-300 hover:text-purple-900'
              }`}
            >
              <Heart className={`w-3 h-3 ${showFavorites ? 'fill-rose-400 text-rose-400' : ''}`} />
              FAVORITOS
            </button>
            {categories.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCategory(item.slug);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono-code font-bold whitespace-nowrap transition inline-flex items-center gap-1.5 ${
                  category === item.slug
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-white border border-purple-100 text-slate-600 hover:border-purple-300 hover:text-purple-900'
                }`}
              >
                <CategoryIcon name={item.icono} className="w-3.5 h-3.5" />
                {item.nombre.toUpperCase()}
                <span className="text-[10px] opacity-60">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>ORDENAR:</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              className="bg-white border border-purple-100 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none"
            >
              {SORT_LABELS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[11px] font-mono-code font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
              {showFavorites ? 'TU COLECCIÓN GUARDADA' : 'ALTA DEMANDA EN TIEMPO REAL'}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-space mt-0.5">
              {showFavorites ? 'Tus Favoritos' : 'Prompts en Tendencia'}
            </h2>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />}
            Mostrando <strong>{showFavorites ? visible.length : total}</strong> fórmulas verificadas
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border border-purple-100 overflow-hidden animate-pulse"
              >
                <div className="aspect-square bg-purple-50" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-purple-50 rounded w-3/4" />
                  <div className="h-2 bg-purple-50 rounded w-full" />
                  <div className="h-2 bg-purple-50 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {visible.map((prompt) => (
              <div
                key={prompt.id}
                onClick={() => onSelectPrompt(prompt)}
                className="group bg-white rounded-2xl border border-purple-100/90 shadow-sm hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-300 transition duration-300 flex flex-col overflow-hidden cursor-pointer"
              >
                <div className="relative aspect-square overflow-hidden bg-slate-100">
                  <img
                    src={prompt.previewImages[0]}
                    alt={prompt.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />

                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono-code font-bold text-white border border-white/10 uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {prompt.modelBadge.split(' ')[0]}
                    </span>

                    <button
                      onClick={(event) => toggleFavorite(prompt, event)}
                      className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/90 transition"
                      title={prompt.isFavorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          prompt.isFavorited ? 'fill-purple-400 text-purple-400' : 'text-white'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-black/65 backdrop-blur-md text-[10px] font-mono-code text-slate-200">
                      {prompt.category}
                    </span>
                    {prompt.owned && (
                      <span className="px-2 py-0.5 rounded bg-emerald-600/90 text-[10px] font-mono-code text-white flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> TUYO
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-space font-bold text-sm text-slate-900 group-hover:text-purple-700 transition line-clamp-1">
                      {prompt.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {prompt.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-purple-50 flex items-center justify-between">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenCreator(prompt.author.id);
                      }}
                      className="flex items-center gap-2 text-left"
                    >
                      <img
                        src={prompt.author.avatar}
                        alt={prompt.author.name}
                        className="w-6 h-6 rounded-full object-cover border border-purple-200"
                      />
                      <div>
                        <div className="text-[11px] font-medium text-slate-800 leading-tight">
                          {prompt.author.name}
                        </div>
                        <div className="flex items-center text-[10px] text-amber-500 font-semibold">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5" />
                          <span>{prompt.rating.toFixed(1)}</span>
                          <span className="text-slate-400 ml-0.5">({prompt.reviewsCount})</span>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono-code text-slate-900">
                        {prompt.price} cr
                      </span>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenQuickBuy(prompt);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-purple-700 text-white text-[11px] font-semibold transition"
                      >
                        {prompt.owned ? 'Ver' : 'Comprar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !visible.length && (
          <div className="py-16 text-center">
            <Sparkles className="w-8 h-8 text-purple-300 mx-auto mb-3" />
            <h3 className="font-space text-lg font-bold text-slate-900">
              No encontramos fórmulas con esos filtros
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Probá con otra categoría o limpiá la búsqueda.
            </p>
            <button
              onClick={() => {
                setCategory('all');
                onSearchChange('');
                setShowFavorites(false);
              }}
              className="px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 transition"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Pagination */}
        {!showFavorites && pages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-2 rounded-xl bg-white border border-purple-200 text-slate-600 disabled:opacity-40 hover:border-purple-400 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: pages }).map((_, index) => (
              <button
                key={index}
                onClick={() => goToPage(index + 1)}
                className={`w-9 h-9 rounded-xl text-xs font-semibold transition ${
                  page === index + 1
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-purple-200 text-slate-600 hover:border-purple-400'
                }`}
              >
                {index + 1}
              </button>
            ))}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === pages}
              className="px-3 py-2 rounded-xl bg-white border border-purple-200 text-slate-600 disabled:opacity-40 hover:border-purple-400 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* How it works */}
        <div className="mt-20 py-12 px-6 sm:px-10 bg-white/80 backdrop-blur-md rounded-3xl border border-purple-100 shadow-sm">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-[11px] font-mono-code font-bold uppercase tracking-wider text-purple-700">
              SIMPLICIDAD & RENDIMIENTO
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-space mt-1">
              Cómo Funciona para Creadores y Compradores
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Nuestra plataforma elimina la fricción entre la concepción de una idea y la ejecución de
              prompts de calibre industrial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Explora o busca',
                text: 'Encuentra prompts verificados con galerías de ejemplos reales. Compara parámetros exactos como seed, aspect ratio y pasos sintácticos.',
                foot: 'Resultados 100% reproducibles',
              },
              {
                step: '02',
                title: 'Copia y ejecuta',
                text: 'Desbloquea instantáneamente la fórmula completa, los marcadores de posición dinámicos e instrucciones paso a paso para integrarlo en tu flujo de trabajo.',
                foot: 'Acceso de por vida a fórmulas',
              },
              {
                step: '03',
                title: 'Monetiza tu talento',
                text: 'Publica tus prompts perfeccionados y quédate con hasta el 90% de cada venta. Recibe pagos simulados directamente en tu panel de creador.',
                foot: 'Comisión líder del 90% para ti',
              },
            ].map((card) => (
              <div key={card.step} className="p-6 rounded-2xl bg-purple-50/50 border border-purple-100/70">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-mono-code font-bold text-xs flex items-center justify-center mb-4">
                  {card.step}
                </div>
                <h3 className="font-space font-bold text-base text-slate-900 mb-2">{card.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{card.text}</p>
                <div className="mt-4 pt-4 border-t border-purple-100/60 flex items-center gap-1.5 text-[11px] text-purple-800 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>{card.foot}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top creators */}
        <div className="mt-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[11px] font-mono-code font-bold uppercase tracking-wider text-purple-700">
                COMUNIDAD DE ÉLITE
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-space mt-0.5">
                Top Prompt Engineers del Mes
              </h2>
            </div>
            <button
              onClick={onNavigateToHire}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
            >
              <span>VER RANKING COMPLETO</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {creators.slice(0, 3).map((creator) => (
              <div
                key={creator.id}
                onClick={() => onOpenCreator(creator.id)}
                className="p-4 rounded-2xl bg-white border border-purple-100 hover:border-purple-300 shadow-xs hover:shadow-md transition flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={avatarFor(creator.avatarKey)}
                      alt={creator.name}
                      className="w-12 h-12 rounded-xl object-cover border border-purple-200"
                    />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">
                      ✓
                    </span>
                  </div>
                  <div>
                    <h4 className="font-space font-bold text-sm text-slate-900">{creator.name}</h4>
                    <p className="text-[11px] text-slate-500">
                      {creator.categories[0] || 'Prompts para IA'}
                    </p>
                    <div className="text-[10px] text-purple-600 font-mono-code mt-0.5">
                      {creator.plan === 'pro' ? 'PRO CREATOR' : creator.plan === 'enterprise' ? 'ENTERPRISE STUDIO' : 'CREADOR VERIFICADO'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-space font-bold text-sm text-emerald-600">{creator.sales}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono-code">VENTAS</div>
                </div>
              </div>
            ))}
            {!creators.length && (
              <div className="md:col-span-3 text-xs text-slate-400 text-center py-8">
                Todavía no hay creadores con fórmulas aprobadas.
              </div>
            )}
          </div>
        </div>

        {/* Sell CTA */}
        <div className="mt-20 p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-2xl relative z-10">
            <span className="text-[11px] font-mono-code font-bold uppercase tracking-wider text-purple-300 bg-purple-900/60 px-3 py-1 rounded-full border border-purple-500/30">
              PROGRAMA PARA CREADORES
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold font-space mt-4 tracking-tight leading-tight">
              ¿Creas prompts de calidad profesional? Empieza a vender hoy mismo.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed">
              Convierte tus fórmulas de prompts en ingresos pasivos. Publicá tu fórmula, pasá la
              revisión de calidad y cobrá el 90% de cada venta.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={onNavigateToSell}
                className="px-6 py-3 rounded-xl bg-white text-slate-950 font-space font-bold text-xs uppercase tracking-wider hover:bg-purple-50 transition shadow-lg flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>ABRIR MI TIENDA DE PROMPTS</span>
              </button>
              <button
                onClick={onNavigateToGenerator}
                className="px-6 py-3 rounded-xl bg-purple-900/50 hover:bg-purple-900/80 text-white border border-purple-400/30 font-space text-xs font-semibold tracking-wider transition flex items-center gap-2"
              >
                <Zap className="w-3.5 h-3.5" />
                PROBAR GENERADOR EN VIVO →
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
