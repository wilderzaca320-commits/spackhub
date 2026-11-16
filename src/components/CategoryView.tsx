import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Loader2, Sparkles, Star } from 'lucide-react';
import { api } from '../lib/api';
import type { PromptItem } from '../types';
import { toPromptItem } from '../lib/adapters';
import { CategoryIcon } from './CategoryIcon';

interface CategoryNode {
  id: number;
  slug: string;
  nombre: string;
  icono: string;
  orden: number;
  count: number;
  children: CategoryNode[];
}

interface CategoryViewProps {
  onSelectPrompt: (prompt: PromptItem) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

const SORT_OPTIONS = [
  { id: 'trending', label: 'Más vendidos' },
  { id: 'rating', label: 'Mejor calificados' },
  { id: 'newest', label: 'Más recientes' },
  { id: 'price_asc', label: 'Menor precio' },
  { id: 'price_desc', label: 'Mayor precio' },
];

export const CategoryView: React.FC<CategoryViewProps> = ({ onSelectPrompt, onShowToast }) => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [items, setItems] = useState<PromptItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('trending');
  const [sub, setSub] = useState('all');
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(true);

  const current = useMemo(() => {
    for (const category of tree) {
      if (category.slug === slug) return { category, parent: null as CategoryNode | null };
      const child = category.children.find((item) => item.slug === slug);
      if (child) return { category: child, parent: category };
    }
    return null;
  }, [tree, slug]);

  useEffect(() => {
    let alive = true;
    setTreeLoading(true);
    api.categories
      .list()
      .then((data) => {
        if (alive) setTree(data.items as CategoryNode[]);
      })
      .catch((error: unknown) => {
        if (alive) {
          onShowToast(
            'No se pudieron cargar las categorías',
            error instanceof Error ? error.message : undefined,
            'error'
          );
        }
      })
      .finally(() => {
        if (alive) setTreeLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
    setSub('all');
  }, [slug]);

  useEffect(() => {
    if (!slug || treeLoading || !current) return;
    let alive = true;
    setLoading(true);
    const isChild = Boolean(current.parent);
    api.prompts
      .list({
        category: isChild ? current.parent?.slug : current.category.slug,
        sub: isChild ? current.category.slug : sub !== 'all' ? sub : undefined,
        sort,
        page,
        limit: 12,
      })
      .then((data) => {
        if (!alive) return;
        setItems(data.items.map(toPromptItem));
        setTotal(data.total);
        setPages(data.pages);
      })
      .catch((error: unknown) => {
        if (alive) {
          onShowToast(
            'No se pudo cargar la categoría',
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
  }, [slug, current, sub, sort, page, treeLoading]);

  if (treeLoading) {
    return (
      <div className="py-24 flex justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-space text-2xl font-bold text-slate-900 mb-3">Categoría no encontrada</h1>
        <p className="text-sm text-slate-500 mb-6">La categoría que buscás no existe o está desactivada.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
        >
          Volver a Explorar
        </Link>
      </div>
    );
  }

  const root = current.parent || current.category;
  const subcategories = current.parent ? current.parent.children : current.category.children;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <nav className="text-xs text-slate-500 mb-4 flex items-center gap-1.5 flex-wrap">
        <Link to="/" className="hover:text-purple-700">
          Inicio
        </Link>
        <span>/</span>
        {current.parent ? (
          <>
            <Link to={`/categoria/${current.parent.slug}`} className="hover:text-purple-700">
              {current.parent.nombre}
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">{current.category.nombre}</span>
          </>
        ) : (
          <span className="text-slate-900 font-medium">{current.category.nombre}</span>
        )}
      </nav>

      <header className="rounded-2xl bg-white border border-purple-100 p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex items-start gap-4">
          <span className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 grid place-items-center shrink-0">
            <CategoryIcon name={root.icono} className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <h1 className="font-space text-3xl font-bold text-slate-900">{root.nombre}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {total} {total === 1 ? 'fórmula publicada' : 'fórmulas publicadas'}
              {current.parent ? ` en ${current.category.nombre}` : ''}
            </p>
          </div>
        </div>

        {subcategories.length > 0 && !current.parent && (
          <div className="flex flex-wrap gap-2 mt-5">
            <button
              type="button"
              onClick={() => setSub('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                sub === 'all'
                  ? 'bg-purple-700 text-white border-purple-700'
                  : 'bg-white text-slate-600 border-purple-100 hover:border-purple-300'
              }`}
            >
              Todas
            </button>
            {subcategories.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => setSub(child.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  sub === child.slug
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-white text-slate-600 border-purple-100 hover:border-purple-300'
                }`}
              >
                {child.nombre}
                <span className="ml-1.5 text-[10px] opacity-70">{child.count}</span>
              </button>
            ))}
          </div>
        )}

        {current.parent && subcategories.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {subcategories.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => navigate(`/categoria/${child.slug}`)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  child.slug === current.category.slug
                    ? 'bg-purple-700 text-white border-purple-700'
                    : 'bg-white text-slate-600 border-purple-100 hover:border-purple-300'
                }`}
              >
                {child.nombre}
                <span className="ml-1.5 text-[10px] opacity-70">{child.count}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex items-center justify-between gap-4 mb-4">
        <span className="text-xs font-mono-code uppercase tracking-wider text-slate-400">
          {items.length} resultados en esta página
        </span>
        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
          className="h-9 px-3 rounded-lg border border-purple-100 bg-white text-xs font-semibold text-slate-700 outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-purple-100 bg-white p-12 text-center shadow-sm">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-purple-200" />
          <h2 className="font-space text-xl font-bold text-slate-900 mb-2">Todavía no hay fórmulas acá</h2>
          <p className="text-sm text-slate-500 mb-6">Sé el primero en publicar en esta categoría.</p>
          <Link
            to="/vender"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
          >
            Vender mi fórmula <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              onClick={() => onSelectPrompt(prompt)}
              className="group text-left rounded-2xl overflow-hidden bg-white border border-purple-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition"
            >
              <div className="aspect-[4/3] relative overflow-hidden bg-purple-50">
                <img
                  src={prompt.previewImages[0]}
                  alt={prompt.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur text-[10px] font-mono-code text-white">
                  {prompt.model}
                </span>
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-purple-900/70 backdrop-blur text-[10px] font-bold text-purple-100">
                  {prompt.price} cr
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 truncate">{prompt.title}</h3>
                <p className="text-xs text-slate-500 truncate mt-1">{prompt.author.name}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    {prompt.rating ? prompt.rating.toFixed(1) : 'Nuevo'}
                  </span>
                  <span>{prompt.salesCount} ventas</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1}
            className="px-3 py-2 rounded-lg bg-white border border-purple-100 text-sm font-semibold disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-500">
            Página {page} de {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(pages, value + 1))}
            disabled={page >= pages}
            className="px-3 py-2 rounded-lg bg-white border border-purple-100 text-sm font-semibold disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};
