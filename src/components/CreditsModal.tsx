import React, { useEffect, useState } from 'react';
import { Zap, X, ShieldCheck, Loader2 } from 'lucide-react';
import type { CreditPackage } from '../types';
import { api } from '../lib/api';
import { PaymentModal } from './PaymentModal';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onCreditsChanged: (credits: number) => void | Promise<void>;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({
  isOpen,
  onClose,
  currentCredits,
  onShowToast,
  onCreditsChanged,
}) => {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selected, setSelected] = useState<CreditPackage | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelected(null);
      return;
    }
    let alive = true;
    setLoading(true);
    api.billing
      .overview()
      .then((response) => {
        if (alive) setPackages(response.packages);
      })
      .catch((error: unknown) => {
        if (alive) {
          onShowToast(
            'No se pudieron cargar los paquetes',
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
  }, [isOpen]);

  if (!isOpen && !selected) return null;

  const handlePay = async (card: { number: string; holder: string; expiry: string; cvv: string }) => {
    if (!selected) return;
    const response = await api.billing.buyCredits(selected.id, card);
    onShowToast('Pago aprobado', response.message, 'success');
    await onCreditsChanged(response.credits);
    setSelected(null);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden">
            <div className="flex items-start justify-between px-5 py-4 border-b border-purple-100">
              <div>
                <div className="text-[10px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> Billetera de créditos
                </div>
                <h2 className="font-space text-xl font-bold text-slate-900 mt-1">Comprar créditos</h2>
                <p className="text-[11px] text-slate-500">
                  Saldo actual: <strong>{currentCredits} créditos</strong>
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="py-10 flex flex-col items-center gap-2 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                  <p className="text-xs">Cargando paquetes…</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelected(pkg)}
                      className="text-left p-4 rounded-xl border border-purple-100 hover:border-purple-400 hover:bg-purple-50/40 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono-code font-bold uppercase text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                          {pkg.label}
                        </span>
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <div className="mt-2 text-xl font-extrabold font-space text-slate-900">
                        {pkg.credits.toLocaleString()} créditos
                      </div>
                      {pkg.bonus > 0 && (
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          +{pkg.bonus} de regalo
                        </div>
                      )}
                      <div className="mt-2 font-mono-code font-bold text-sm">${pkg.priceUsd} USD</div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 text-[10px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                Pasarela simulada: tarjeta de prueba 4242 4242 4242 4242.
              </div>
            </div>
          </div>
        </div>
      )}

      <PaymentModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Comprar ${selected.credits} créditos` : 'Comprar créditos'}
        subtitle={selected?.label}
        amountUsd={selected?.priceUsd || 0}
        submitLabel="Comprar créditos"
        onPay={handlePay}
      />
    </>
  );
};
