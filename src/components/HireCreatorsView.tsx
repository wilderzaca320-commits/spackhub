import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ShieldCheck,
  Star,
  Sparkles,
  Clock,
  CheckCircle2,
  Search,
  ArrowRight,
  UserCheck,
  Loader2,
  X,
  Briefcase,
} from 'lucide-react';
import type { CreatorProfile, HireRequest } from '../types';
import { api } from '../lib/api';
import { avatarFor, formatDate, toCreator } from '../lib/adapters';

interface HireCreatorsViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  preselectedAuthor?: string;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onOpenCreator: (id: number) => void;
}

const HIRE_STATUSES = ['Pendiente', 'En progreso', 'Entregado', 'Cancelado'];

export const HireCreatorsView: React.FC<HireCreatorsViewProps> = ({
  onShowToast,
  preselectedAuthor,
  isAuthenticated,
  onRequireAuth,
  onOpenCreator,
}) => {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [hires, setHires] = useState<HireRequest[]>([]);
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [selected, setSelected] = useState<CreatorProfile | null>(null);
  const [showHires, setShowHires] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [sending, setSending] = useState<boolean>(false);
  const [form, setForm] = useState({
    title: '',
    model: 'Flux.1 Schnell',
    budget: '300',
    description: '',
  });
  const preselectedUsed = useRef<boolean>(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.creators
      .list()
      .then((response) => {
        if (!alive) return;
        setCreators(response.items.map(toCreator));
      })
      .catch((error: unknown) => {
        if (!alive) return;
        onShowToast(
          'No se pudo cargar el directorio',
          error instanceof Error ? error.message : undefined,
          'error'
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    api.prompts
      .catalog()
      .then((response) => {
        if (!alive) return;
        setModels(response.models);
        setForm((prev) => ({ ...prev, model: response.models[0] || prev.model }));
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setHires([]);
      return;
    }
    let alive = true;
    api.hires
      .list()
      .then((response) => {
        if (alive) setHires(response.items);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isAuthenticated, reloadKey]);

  useEffect(() => {
    if (preselectedUsed.current || !preselectedAuthor || !creators.length) return;
    const match = creators.find(
      (creator) =>
        creator.name.toLowerCase() === preselectedAuthor.toLowerCase() ||
        preselectedAuthor.toLowerCase().includes(creator.name.toLowerCase())
    );
    if (match) {
      preselectedUsed.current = true;
      openHire(match);
    }
  }, [creators, preselectedAuthor]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    creators.forEach((creator) => creator.categories.forEach((item) => set.add(item)));
    return [...set];
  }, [creators]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return creators.filter((creator) => {
      const matchesSearch =
        !term ||
        creator.name.toLowerCase().includes(term) ||
        creator.company.toLowerCase().includes(term) ||
        creator.bio.toLowerCase().includes(term);
      const matchesCategory = category === 'all' || creator.categories.includes(category);
      return matchesSearch && matchesCategory;
    });
  }, [creators, search, category]);

  function openHire(creator: CreatorProfile) {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setSelected(creator);
    setForm({
      title: '',
      model: models[0] || 'Flux.1 Schnell',
      budget: '300',
      description: '',
    });
  }

  const submitHire = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSending(true);
    try {
      const response = await api.hires.create({
        creatorId: selected.id,
        title: form.title.trim(),
        model: form.model,
        budget: Number(form.budget),
        description: form.description.trim(),
      });
      onShowToast('Encargo enviado', response.message, 'success');
      setSelected(null);
      setShowHires(true);
      setReloadKey((key) => key + 1);
    } catch (error) {
      onShowToast(
        'No se pudo enviar el encargo',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  const updateHire = async (hire: HireRequest, status: string) => {
    try {
      const response = await api.hires.update(hire.id, status);
      onShowToast('Encargo actualizado', response.message, 'success');
      setReloadKey((key) => key + 1);
    } catch (error) {
      onShowToast(
        'No se pudo actualizar el encargo',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
          ENCARGOS A MEDIDA
        </div>
        <h1 className="font-space text-3xl font-extrabold text-slate-900 mt-1">
          Contratar Prompt Engineers
        </h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Enviá un brief, acordá un presupuesto en créditos y seguí el estado del encargo. Los
          creadores verificados responden desde su panel.
        </p>
      </div>

      <div className="bg-white/95 p-2 rounded-2xl shadow-sm border border-purple-100 flex flex-col sm:flex-row items-center gap-2 mb-5">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, estudio o especialidad…"
            className="w-full pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
          />
        </div>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="w-full sm:w-52 px-3 py-2.5 bg-slate-50 border border-purple-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
        >
          <option value="all">TODAS LAS ESPECIALIDADES</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {isAuthenticated && hires.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowHires((value) => !value)}
            className="flex items-center gap-2 text-xs font-semibold text-purple-800 mb-3"
          >
            <Briefcase className="w-3.5 h-3.5" />
            Mis encargos ({hires.length}) {showHires ? '▾' : '▸'}
          </button>
          {showHires && (
            <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden">
              <ul className="divide-y divide-purple-50">
                {hires.map((hire) => (
                  <li key={hire.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900">{hire.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono-code">
                        {hire.clientName} → {hire.creatorName} · {hire.model} · {hire.budget} cr ·{' '}
                        {formatDate(hire.createdAt)}
                      </div>
                    </div>
                    <select
                      value={hire.status}
                      onChange={(event) => updateHire(hire, event.target.value)}
                      className="px-2 py-1 rounded-lg border border-purple-100 bg-slate-50 text-[11px] text-slate-700 focus:outline-none"
                    >
                      {HIRE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <p className="text-sm">Cargando creadores…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((creator) => (
            <div
              key={creator.id}
              className="bg-white rounded-2xl border border-purple-100 shadow-xs hover:shadow-lg hover:border-purple-300 transition overflow-hidden flex flex-col"
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <img
                      src={avatarFor(creator.avatarKey)}
                      alt={creator.name}
                      className="w-14 h-14 rounded-xl object-cover border border-purple-200"
                    />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">
                      ✓
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-space font-bold text-sm text-slate-900 truncate">{creator.name}</h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      {creator.company || 'Creador independiente'}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-[10px] font-semibold text-slate-700">
                        {creator.rating.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-400">({creator.reviewsCount})</span>
                      <span className="ml-2 text-[10px] font-mono-code text-purple-600 uppercase">
                        {creator.plan}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 mt-3 line-clamp-2 leading-relaxed">
                  {creator.bio || 'Especialista en fórmulas de alta reproducibilidad.'}
                </p>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {creator.categories.slice(0, 3).map((item) => (
                    <span
                      key={item}
                      className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[9px] font-mono-code"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div>
                    <div className="text-sm font-bold font-space text-slate-900">{creator.prompts}</div>
                    <div className="text-[9px] uppercase font-mono-code text-slate-400">Fórmulas</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold font-space text-slate-900">{creator.sales}</div>
                    <div className="text-[9px] uppercase font-mono-code text-slate-400">Ventas</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold font-space text-emerald-600">90%</div>
                    <div className="text-[9px] uppercase font-mono-code text-slate-400">Comisión</div>
                  </div>
                </div>
              </div>

              <div className="mt-auto p-4 pt-0 flex gap-2">
                <button
                  onClick={() => openHire(creator)}
                  className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-purple-700 text-white text-[11px] font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <UserCheck className="w-3 h-3" /> Contratar
                </button>
                <button
                  onClick={() => onOpenCreator(creator.id)}
                  className="px-3 py-2 rounded-lg border border-purple-200 text-slate-700 text-[11px] font-semibold hover:bg-purple-50 transition flex items-center gap-1"
                >
                  Ver perfil <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !filtered.length && (
        <div className="py-16 text-center bg-white rounded-2xl border border-purple-100">
          <Sparkles className="w-8 h-8 text-purple-200 mx-auto mb-3" />
          <h3 className="font-space text-lg font-bold text-slate-900">Sin creadores para esa búsqueda</h3>
          <p className="text-xs text-slate-500 mt-1">Probá con otra especialidad o limpiá el filtro.</p>
        </div>
      )}

      <div className="mt-8 p-4 rounded-2xl bg-white border border-purple-100 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Los encargos se registran en la base y ambos lados pueden actualizar el estado (pendiente,
          en progreso, entregado o cancelado). El presupuesto se expresa en créditos.
        </p>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <form
            onSubmit={submitHire}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-purple-100 p-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <img
                  src={avatarFor(selected.avatarKey)}
                  alt={selected.name}
                  className="w-10 h-10 rounded-lg object-cover border border-purple-200"
                />
                <div>
                  <h2 className="font-space text-lg font-bold text-slate-900">Encargo para {selected.name}</h2>
                  <p className="text-[11px] text-slate-500">Presupuesto en créditos · respuesta en 48 h</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Título del encargo</label>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Ej: Serie de retratos editoriales para campaña"
              className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-3"
            />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Modelo</label>
                <select
                  value={form.model}
                  onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Presupuesto (créditos)</label>
                <input
                  type="number"
                  min={0}
                  value={form.budget}
                  onChange={(event) => setForm((prev) => ({ ...prev, budget: event.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm font-mono-code focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>

            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Brief (mínimo 20 caracteres)</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={4}
              placeholder="Describí el objetivo, el estilo, las entregas esperadas y las referencias…"
              className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-4"
            />

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {sending ? 'Enviando…' : 'Enviar encargo'}
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Sin cobro automático: el acuerdo se coordina en la plataforma.
            </p>
          </form>
        </div>
      )}
    </div>
  );
};
