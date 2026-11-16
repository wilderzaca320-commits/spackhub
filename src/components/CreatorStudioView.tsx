import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Wallet,
  Sparkles,
  Loader2,
  Plus,
  ArrowUpRight,
  Clock,
  FileText,
  X,
} from 'lucide-react';
import type { CreatorDashboard, PromptItem } from '../types';
import { api } from '../lib/api';
import { formatDate, statusLabel, toPromptItem } from '../lib/adapters';

interface CreatorStudioViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToSell: () => void;
  onOpenPrompt: (id: string) => void;
}

export const CreatorStudioView: React.FC<CreatorStudioViewProps> = ({
  onShowToast,
  onNavigateToSell,
  onOpenPrompt,
}) => {
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [tab, setTab] = useState<'prompts' | 'sales' | 'withdrawals'>('prompts');
  const [showWithdraw, setShowWithdraw] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'stripe' | 'crypto'>('stripe');
  const [sending, setSending] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.profile
      .dashboard()
      .then((response) => {
        if (!alive) return;
        setDashboard(response);
        setAmount(String(response.stats.available));
      })
      .catch((error: unknown) => {
        if (!alive) return;
        onShowToast(
          'No se pudo cargar tu panel',
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
  }, [reloadKey]);

  const handleWithdraw = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dashboard) return;
    const parsed = Number(amount);
    if (!Number.isInteger(parsed) || parsed < 10) {
      onShowToast('Retiro inválido', 'El retiro mínimo es de 10 créditos.', 'error');
      return;
    }
    if (parsed > dashboard.stats.available) {
      onShowToast(
        'Saldo insuficiente',
        `Solo tenés ${dashboard.stats.available} créditos disponibles.`,
        'error'
      );
      return;
    }
    setSending(true);
    try {
      const response = await api.profile.withdraw({ amount: parsed, method });
      onShowToast('Retiro solicitado', response.message, 'success');
      setShowWithdraw(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      onShowToast(
        'No se pudo solicitar el retiro',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  const prompts: PromptItem[] = (dashboard?.prompts || []).map(toPromptItem);
  const maxSeries = Math.max(1, ...(dashboard?.series || []).map((point) => point.credits));

  if (loading && !dashboard) {
    return (
      <div className="py-24 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        <p className="text-sm">Cargando tu panel de creador…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            CREATOR STUDIO
          </div>
          <h1 className="font-space text-3xl font-extrabold text-slate-900 mt-1">Panel de Creador</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tus fórmulas, ventas, ganancias y retiros simulados en un solo lugar.
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <button
            onClick={() => setShowWithdraw(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-purple-200 text-slate-700 text-xs font-semibold hover:border-purple-400 transition"
          >
            <Wallet className="w-3.5 h-3.5" /> Retirar créditos
          </button>
          <button
            onClick={onNavigateToSell}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva fórmula
          </button>
        </div>
      </div>

      {dashboard && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-purple-950 text-white shadow-lg">
              <Wallet className="w-4 h-4 text-emerald-400 mb-2" />
              <div className="text-2xl font-extrabold font-space">{dashboard.stats.available}</div>
              <div className="text-[10px] uppercase font-mono-code text-slate-300">
                Créditos disponibles
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs">
              <DollarSign className="w-4 h-4 text-emerald-600 mb-2" />
              <div className="text-2xl font-extrabold font-space text-slate-900">
                {dashboard.stats.earnings}
              </div>
              <div className="text-[10px] uppercase font-mono-code text-slate-500">
                Ganancias totales
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs">
              <TrendingUp className="w-4 h-4 text-purple-600 mb-2" />
              <div className="text-2xl font-extrabold font-space text-slate-900">
                {dashboard.stats.sales}
              </div>
              <div className="text-[10px] uppercase font-mono-code text-slate-500">Ventas</div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs">
              <FileText className="w-4 h-4 text-cyan-600 mb-2" />
              <div className="text-2xl font-extrabold font-space text-slate-900">
                {dashboard.stats.prompts}
              </div>
              <div className="text-[10px] uppercase font-mono-code text-slate-500">Fórmulas</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-purple-100 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-space font-bold text-slate-900 text-sm">Ganancias por mes</h2>
                <span className="text-[10px] font-mono-code text-slate-400">CRÉDITOS NETOS (90%)</span>
              </div>
              {dashboard.series.length ? (
                <div className="flex items-end gap-3 h-36">
                  {dashboard.series.map((point) => (
                    <div key={point.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[9px] font-mono-code text-slate-500">{point.credits}</div>
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-purple-700 to-purple-400"
                        style={{ height: `${Math.max(6, (point.credits / maxSeries) * 100)}%` }}
                      />
                      <div className="text-[9px] font-mono-code text-slate-400">{point.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-36 flex items-center justify-center text-xs text-slate-400">
                  Todavía no registraste ventas.
                </div>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-white border border-purple-100 shadow-xs">
              <h2 className="font-space font-bold text-slate-900 text-sm mb-3">Estado de la cola QA</h2>
              <div className="space-y-2">
                {[
                  { key: 'approved' as const, label: 'Aprobadas', color: 'bg-emerald-500' },
                  { key: 'pending' as const, label: 'Pendientes', color: 'bg-amber-500' },
                  { key: 'changes' as const, label: 'Cambios', color: 'bg-orange-500' },
                  { key: 'rejected' as const, label: 'Rechazadas', color: 'bg-rose-500' },
                ].map((row) => (
                  <div key={row.key} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${row.color}`} />
                    <span className="text-[11px] text-slate-600 flex-1">{row.label}</span>
                    <span className="font-mono-code text-xs font-bold text-slate-900">
                      {dashboard.promptsByStatus[row.key]}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-purple-50 text-[10px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-purple-500" />
                Las fórmulas nuevas pasan por QA antes de publicarse.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-purple-100 pb-3 mb-5">
            {(
              [
                { id: 'prompts' as const, label: `MIS FÓRMULAS (${prompts.length})` },
                { id: 'sales' as const, label: `VENTAS (${dashboard.recentSales.length})` },
                { id: 'withdrawals' as const, label: `RETIROS (${dashboard.withdrawals.length})` },
              ]
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono-code font-bold transition ${
                  tab === item.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-purple-100 text-slate-600 hover:border-purple-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'prompts' && (
            <div className="space-y-2">
              {prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="p-3 rounded-xl bg-white border border-purple-100 flex items-center gap-3 hover:border-purple-300 transition cursor-pointer"
                  onClick={() => onOpenPrompt(prompt.id)}
                >
                  <img
                    src={prompt.previewImages[0]}
                    alt={prompt.title}
                    className="w-14 h-14 rounded-lg object-cover bg-slate-100"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-slate-900 truncate">{prompt.title}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-mono-code font-bold uppercase ${
                          prompt.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : prompt.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : prompt.status === 'changes'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {statusLabel(prompt.status)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {prompt.category} · {prompt.model} · {prompt.price} créditos
                    </div>
                    {prompt.reviewNote && (
                      <div className="text-[10px] text-amber-700 mt-0.5 truncate">
                        QA: {prompt.reviewNote}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono-code text-slate-900">
                      {prompt.salesCount}
                    </div>
                    <div className="text-[9px] uppercase font-mono-code text-slate-400">ventas</div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              ))}
              {!prompts.length && (
                <div className="py-14 text-center bg-white rounded-2xl border border-purple-100">
                  <Sparkles className="w-8 h-8 text-purple-200 mx-auto mb-3" />
                  <h3 className="font-space text-lg font-bold text-slate-900">Todavía no publicaste</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Creá tu primera fórmula y enviála a revisión QA.
                  </p>
                  <button
                    onClick={onNavigateToSell}
                    className="px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 transition"
                  >
                    Vender un prompt
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'sales' && (
            <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden">
              {dashboard.recentSales.length ? (
                <ul className="divide-y divide-purple-50">
                  {dashboard.recentSales.map((sale) => (
                    <li key={sale.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{sale.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono-code">
                          {sale.buyerName} · {formatDate(sale.createdAt)} · orden #{sale.id}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono-code text-emerald-600">
                          +{sale.sellerEarning}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono-code">
                          de {sale.amount} cr
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  Todavía no hay ventas registradas.
                </div>
              )}
            </div>
          )}

          {tab === 'withdrawals' && (
            <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden">
              {dashboard.withdrawals.length ? (
                <ul className="divide-y divide-purple-50">
                  {dashboard.withdrawals.map((withdrawal) => (
                    <li key={withdrawal.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-slate-800">
                          Retiro vía {withdrawal.method}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono-code">
                          {formatDate(withdrawal.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold font-mono-code text-slate-900">
                          {withdrawal.amount} cr
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-mono-code font-bold uppercase">
                          {withdrawal.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  Todavía no solicitaste retiros.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showWithdraw && dashboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <form
            onSubmit={handleWithdraw}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-purple-100 p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-space text-lg font-bold text-slate-900">Retirar ganancias</h2>
                <p className="text-[11px] text-slate-500">
                  Disponible: {dashboard.stats.available} créditos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowWithdraw(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Monto</label>
            <input
              type="number"
              min={10}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm font-mono-code focus:outline-none focus:ring-2 focus:ring-purple-400 mb-3"
            />

            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Método</label>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as 'stripe' | 'crypto')}
              className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-4"
            >
              <option value="stripe">Stripe (simulado)</option>
              <option value="crypto">Crypto wallet (simulado)</option>
            </select>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              {sending ? 'Procesando…' : 'Solicitar retiro'}
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Mínimo 10 créditos. Se acredita en 48 horas hábiles (simulado).
            </p>
          </form>
        </div>
      )}
    </div>
  );
};
