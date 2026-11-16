import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Users,
  FileText,
  Sparkles,
  Star,
  RefreshCw,
  ClipboardCheck,
} from 'lucide-react';
import type { AdminStats, PromptItem } from '../types';
import { api } from '../lib/api';
import { avatarFor, formatDate, statusLabel, toPromptItem } from '../lib/adapters';

interface AdminQAViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

type StatusFilter = 'pending' | 'changes' | 'approved' | 'rejected';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'changes', label: 'Cambios pedidos' },
  { id: 'approved', label: 'Aprobadas' },
  { id: 'rejected', label: 'Rechazadas' },
];

interface AdminUser {
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
}

export const AdminQAView: React.FC<AdminQAViewProps> = ({ onShowToast }) => {
  const [tab, setTab] = useState<'qa' | 'users'>('qa');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [items, setItems] = useState<PromptItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [checkImages, setCheckImages] = useState<boolean>(true);
  const [checkSyntax, setCheckSyntax] = useState<boolean>(true);
  const [checkVideo, setCheckVideo] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    api.admin
      .stats()
      .then((response) => {
        if (alive) setStats(response);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (tab !== 'qa') return;
    let alive = true;
    setLoading(true);
    api.admin
      .qa(status)
      .then((response) => {
        if (!alive) return;
        const list = response.items.map(toPromptItem);
        setItems(list);
        setSelectedId((current) => {
          if (current && list.some((item) => item.id === current)) return current;
          return list[0]?.id ?? null;
        });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setItems([]);
        onShowToast(
          'No se pudo cargar la cola QA',
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
  }, [tab, status, reloadKey]);

  useEffect(() => {
    if (tab !== 'users') return;
    let alive = true;
    setLoading(true);
    api.admin
      .users()
      .then((response) => {
        if (alive) setUsers(response.items);
      })
      .catch((error: unknown) => {
        if (alive) {
          onShowToast(
            'No se pudieron cargar los usuarios',
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
  }, [tab, reloadKey]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  useEffect(() => {
    setNote('');
    setCheckImages(true);
    setCheckSyntax(true);
    setCheckVideo(true);
  }, [selectedId, status]);

  const review = async (action: 'approve' | 'reject' | 'changes') => {
    if (!selected) return;
    if (action === 'approve' && !(checkImages && checkSyntax && checkVideo)) {
      onShowToast(
        'Checklist incompleto',
        'Marcá las tres verificaciones antes de aprobar la fórmula.',
        'error'
      );
      return;
    }
    setProcessing(true);
    try {
      const response = await api.admin.review(selected.id, action, note);
      onShowToast('Revisión guardada', response.message, 'success');
      setReloadKey((key) => key + 1);
    } catch (error) {
      onShowToast(
        'No se pudo guardar la revisión',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            CONTROL DE CALIDAD
          </div>
          <h1 className="font-space text-3xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-purple-700" /> Panel de Administración
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Revisá fórmulas antes de publicarlas y monitoreá la actividad de la plataforma.
          </p>
        </div>
        <button
          onClick={() => setReloadKey((key) => key + 1)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-purple-200 text-slate-700 text-xs font-semibold hover:border-purple-400 transition self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Usuarios', value: stats.users },
            { label: 'Fórmulas', value: stats.prompts },
            { label: 'Pendientes', value: stats.promptsByStatus.pending, accent: 'text-amber-600' },
            { label: 'Órdenes', value: stats.orders },
            { label: 'Reseñas', value: stats.reviews },
            { label: 'Ingresos USD', value: `$${stats.revenueUsd}` },
          ].map((card) => (
            <div key={card.label} className="p-3 rounded-xl bg-white border border-purple-100">
              <div className={`text-lg font-extrabold font-space ${card.accent || 'text-slate-900'}`}>
                {card.value}
              </div>
              <div className="text-[9px] uppercase font-mono-code text-slate-500">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-purple-100 pb-3 mb-6">
        <button
          onClick={() => setTab('qa')}
          className={`px-3 py-1.5 rounded-xl text-xs font-mono-code font-bold transition flex items-center gap-1.5 ${
            tab === 'qa'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-purple-100 text-slate-600 hover:border-purple-300'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" /> COLA QA
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-3 py-1.5 rounded-xl text-xs font-mono-code font-bold transition flex items-center gap-1.5 ${
            tab === 'users'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-purple-100 text-slate-600 hover:border-purple-300'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> USUARIOS
        </button>
      </div>

      {tab === 'qa' && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {STATUS_TABS.map((item) => (
              <button
                key={item.id}
                onClick={() => setStatus(item.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                  status === item.id
                    ? 'bg-purple-700 text-white'
                    : 'bg-white border border-purple-100 text-slate-600 hover:border-purple-300'
                }`}
              >
                {item.label}
                {stats && (
                  <span className="ml-1 opacity-70">({stats.promptsByStatus[item.id]})</span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <p className="text-sm">Cargando revisiones…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-purple-100">
              <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
              <h2 className="font-space text-lg font-bold text-slate-900">
                No hay fórmulas en este estado
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                La cola de {statusLabel(status).toLowerCase()} está vacía.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
              <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left p-3 rounded-xl border transition flex gap-3 ${
                      selectedId === item.id
                        ? 'bg-purple-50 border-purple-300'
                        : 'bg-white border-purple-100 hover:border-purple-200'
                    }`}
                  >
                    <img
                      src={item.previewImages[0]}
                      alt={item.title}
                      className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">{item.title}</div>
                      <div className="text-[10px] text-slate-500 truncate">{item.author.name}</div>
                      <div className="text-[9px] font-mono-code text-slate-400">
                        {formatDate(item.updatedAt)} · {item.category}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {selected && (
                <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className="bg-slate-950 p-4">
                      <div className="aspect-video rounded-lg overflow-hidden bg-slate-900">
                        <img
                          src={selected.previewImages[0]}
                          alt={selected.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {selected.previewImages.slice(0, 4).map((image, index) => (
                          <img
                            key={image + index}
                            src={image}
                            alt=""
                            className="aspect-square rounded object-cover opacity-80"
                          />
                        ))}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-mono-code font-bold">
                          {selected.model}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono-code">
                          {selected.category}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono-code font-bold">
                          {statusLabel(selected.status)}
                        </span>
                      </div>
                      <h2 className="font-space text-lg font-bold text-slate-900 mt-2">{selected.title}</h2>
                      <p className="text-[11px] text-slate-500 mt-1">{selected.description}</p>

                      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-600">
                        <img
                          src={avatarFor(selected.author.avatarKey)}
                          alt={selected.author.name}
                          className="w-6 h-6 rounded-full object-cover border border-purple-200"
                        />
                        <span className="font-semibold">{selected.author.name}</span>
                        <span className="text-slate-400">· {selected.price} créditos</span>
                      </div>

                      {selected.reviewNote && (
                        <div className="mt-3 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                          Nota previa: {selected.reviewNote}
                        </div>
                      )}

                      <div className="mt-3 space-y-2">
                        {[
                          { label: 'Imágenes de muestra verificadas', value: checkImages, set: setCheckImages },
                          { label: 'Sintaxis y variables válidas', value: checkSyntax, set: setCheckSyntax },
                          { label: 'Video / demo revisado', value: checkVideo, set: setCheckVideo },
                        ].map((check) => (
                          <label
                            key={check.label}
                            className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={check.value}
                              onChange={(event) => check.set(event.target.checked)}
                              className="w-3.5 h-3.5 accent-purple-700"
                            />
                            {check.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-purple-100 p-4">
                    <div className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Prompt maestro
                    </div>
                    <pre className="whitespace-pre-wrap font-mono-code text-[10px] text-slate-700 bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {selected.masterPrompt}
                    </pre>

                    <div className="mt-3">
                      <label className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-slate-600">
                        Nota para el creador
                      </label>
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value.slice(0, 600))}
                        rows={2}
                        placeholder="Obligatoria para rechazar o pedir cambios…"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-purple-100 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => review('approve')}
                        disabled={processing}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar y publicar
                      </button>
                      <button
                        onClick={() => review('changes')}
                        disabled={processing}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Pedir cambios
                      </button>
                      <button
                        onClick={() => review('reject')}
                        disabled={processing}
                        className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold transition flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rechazar
                      </button>
                      {processing && <Loader2 className="w-4 h-4 animate-spin text-purple-600 self-center" />}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-2xl border border-purple-100 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-purple-100">
              <tr className="text-[10px] font-mono-code uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Créditos</th>
                <th className="px-4 py-3">Fórmulas</th>
                <th className="px-4 py-3">Compras</th>
                <th className="px-4 py-3">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-purple-50/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={avatarFor(user.avatarKey)}
                        alt={user.name}
                        className="w-7 h-7 rounded-full object-cover border border-purple-200"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">{user.name}</div>
                        <div className="text-[10px] text-slate-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono-code ${
                        user.role === 'admin'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.plan}</td>
                  <td className="px-4 py-3 font-mono-code font-bold text-slate-900">{user.credits}</td>
                  <td className="px-4 py-3 text-slate-600">{user.prompts}</td>
                  <td className="px-4 py-3 text-slate-600">{user.purchases}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && !loading && (
            <div className="py-10 text-center text-xs text-slate-400">No hay usuarios.</div>
          )}
        </div>
      )}

      <div className="mt-8 p-4 rounded-2xl bg-white border border-purple-100 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Aprobar una fórmula la publica al instante en el marketplace. Rechazar o pedir cambios
          exige una nota que el creador verá en su panel. Todo queda auditado en la base SQLite.
        </p>
        <Star className="w-4 h-4 text-amber-400 ml-auto" />
      </div>
    </div>
  );
};
