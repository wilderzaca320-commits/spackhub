import React, { useEffect, useState } from 'react';
import {
  Copy,
  Download,
  Check,
  Sparkles,
  ShieldCheck,
  FileText,
  Clock,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from 'lucide-react';
import type { PromptItem, Transaction } from '../types';
import { api } from '../lib/api';
import { formatDate, formatDateTime, toPromptItem } from '../lib/adapters';

interface LibraryViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onExploreMore: () => void;
  onOpenPrompt: (id: string) => void;
}

interface LibraryEntry {
  prompt: PromptItem;
  purchasedAt: string;
  orderId: number;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onShowToast,
  onExploreMore,
  onOpenPrompt,
}) => {
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tab, setTab] = useState<'formulas' | 'transactions'>('formulas');
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.library.list(), api.library.transactions()])
      .then(([libraryResponse, transactionResponse]) => {
        if (!alive) return;
        setLibrary(
          libraryResponse.items.map((item) => ({
            prompt: toPromptItem(item),
            purchasedAt: item.purchasedAt,
            orderId: item.libraryId,
          }))
        );
        setTransactions(transactionResponse.items);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        onShowToast(
          'No se pudo cargar tu biblioteca',
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

  const handleCopy = async (entry: LibraryEntry) => {
    try {
      await navigator.clipboard.writeText(entry.prompt.masterPrompt);
      setCopiedId(entry.prompt.id);
      window.setTimeout(() => setCopiedId(null), 2200);
      onShowToast(
        'Fórmula copiada',
        `Prompt para ${entry.prompt.model} copiado al portapapeles.`,
        'success'
      );
    } catch {
      onShowToast('No se pudo copiar', 'Tu navegador bloqueó el portapapeles.', 'error');
    }
  };

  const handleDownload = (entry: LibraryEntry) => {
    const payload = {
      platform: 'Sparkhub',
      orderId: entry.orderId,
      purchasedAt: entry.purchasedAt,
      prompt: entry.prompt.title,
      model: entry.prompt.model,
      masterPrompt: entry.prompt.masterPrompt,
      negativePrompt: entry.prompt.negativePrompt,
      variables: entry.prompt.variableSlots,
      specs: entry.prompt.technicalSpecs,
      license: 'Comercial Ilimitada',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sparkhub-library-${entry.prompt.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast('Workflow descargado', 'Archivo JSON con tu fórmula y especificaciones.', 'success');
  };

  const totalInvested = library.reduce((sum, entry) => sum + entry.prompt.price, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            ACCESO DE POR VIDA
          </div>
          <h1 className="font-space text-3xl font-extrabold text-slate-900 mt-1">Mi Biblioteca</h1>
          <p className="text-sm text-slate-500 mt-1">
            Fórmulas compradas con el prompt maestro desbloqueado y workflow exportable.
          </p>
        </div>
        <button
          onClick={onExploreMore}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-semibold transition self-start"
        >
          <Sparkles className="w-3.5 h-3.5" /> Explorar más fórmulas
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs">
          <FileText className="w-4 h-4 text-purple-600 mb-2" />
          <div className="text-2xl font-extrabold font-space text-slate-900">{library.length}</div>
          <div className="text-[10px] uppercase font-mono-code text-slate-500">Fórmulas</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs">
          <Wallet className="w-4 h-4 text-emerald-600 mb-2" />
          <div className="text-2xl font-extrabold font-space text-slate-900">{totalInvested}</div>
          <div className="text-[10px] uppercase font-mono-code text-slate-500">Créditos invertidos</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-cyan-600 mb-2" />
          <div className="text-2xl font-extrabold font-space text-slate-900">100%</div>
          <div className="text-[10px] uppercase font-mono-code text-slate-500">Licencia comercial</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs">
          <Clock className="w-4 h-4 text-amber-600 mb-2" />
          <div className="text-2xl font-extrabold font-space text-slate-900">
            {library.length ? formatDate(library[0].purchasedAt) : '—'}
          </div>
          <div className="text-[10px] uppercase font-mono-code text-slate-500">Última compra</div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-purple-100 pb-3 mb-6">
        <button
          onClick={() => setTab('formulas')}
          className={`px-3 py-1.5 rounded-xl text-xs font-mono-code font-bold transition ${
            tab === 'formulas'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-purple-100 text-slate-600 hover:border-purple-300'
          }`}
        >
          FÓRMULAS ({library.length})
        </button>
        <button
          onClick={() => setTab('transactions')}
          className={`px-3 py-1.5 rounded-xl text-xs font-mono-code font-bold transition ${
            tab === 'transactions'
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-purple-100 text-slate-600 hover:border-purple-300'
          }`}
        >
          MOVIMIENTOS ({transactions.length})
        </button>
      </div>

      {loading && (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <p className="text-sm">Cargando tu biblioteca…</p>
        </div>
      )}

      {!loading && tab === 'formulas' && (
        <>
          {library.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-purple-100">
              <FileText className="w-10 h-10 text-purple-200 mx-auto mb-3" />
              <h2 className="font-space text-xl font-bold text-slate-900">Tu biblioteca está vacía</h2>
              <p className="text-sm text-slate-500 mt-1 mb-5">
                Comprá una fórmula para desbloquear el prompt maestro y descargar el workflow.
              </p>
              <button
                onClick={onExploreMore}
                className="px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
              >
                Explorar prompts
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {library.map((entry) => (
                <div
                  key={entry.prompt.id}
                  className="bg-white rounded-2xl border border-purple-100 shadow-xs hover:shadow-lg hover:shadow-purple-500/10 transition overflow-hidden flex flex-col"
                >
                  <button
                    onClick={() => onOpenPrompt(entry.prompt.id)}
                    className="relative aspect-[16/10] overflow-hidden bg-slate-100 text-left"
                  >
                    <img
                      src={entry.prompt.previewImages[0]}
                      alt={entry.prompt.title}
                      className="w-full h-full object-cover hover:scale-105 transition duration-500"
                    />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/65 text-[10px] font-mono-code text-slate-200">
                      {entry.prompt.model}
                    </span>
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-emerald-600 text-[10px] font-mono-code font-bold text-white flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5" /> DESBLOQUEADO
                    </span>
                  </button>

                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-space font-bold text-sm text-slate-900 line-clamp-1">
                      {entry.prompt.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      {entry.prompt.description}
                    </p>
                    <div className="mt-2 text-[10px] text-slate-400 font-mono-code">
                      Compra: {formatDate(entry.purchasedAt)} · Orden #{entry.orderId}
                    </div>

                    <div className="mt-4 pt-3 border-t border-purple-50 flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(entry)}
                        className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-purple-700 text-white text-[11px] font-semibold transition flex items-center justify-center gap-1.5"
                      >
                        {copiedId === entry.prompt.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiedId === entry.prompt.id ? 'Copiado' : 'Copiar prompt'}
                      </button>
                      <button
                        onClick={() => handleDownload(entry)}
                        className="px-3 py-2 rounded-lg border border-purple-200 text-slate-700 hover:bg-purple-50 transition"
                        title="Descargar workflow JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onOpenPrompt(entry.prompt.id)}
                        className="px-3 py-2 rounded-lg border border-purple-200 text-slate-700 hover:bg-purple-50 transition"
                        title="Ver detalle"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && tab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-purple-100 text-[10px] font-mono-code font-bold uppercase tracking-wider text-slate-600">
            Historial de créditos
          </div>
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">Todavía no hay movimientos.</div>
          ) : (
            <ul className="divide-y divide-purple-50">
              {transactions.map((transaction) => {
                const positive = transaction.amount >= 0;
                return (
                  <li key={transaction.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {positive ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-800">
                          {transaction.description}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono-code">
                          {formatDateTime(transaction.createdAt)} · {transaction.reference}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`font-mono-code text-sm font-bold ${
                        positive ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {positive ? '+' : ''}
                      {transaction.amount}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
