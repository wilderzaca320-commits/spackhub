import React, { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles, Zap, ShieldCheck, HelpCircle, Loader2 } from 'lucide-react';
import type { BillingOverview, CreditPackage, PricingPlan } from '../types';
import { api } from '../lib/api';
import { PaymentModal } from './PaymentModal';

interface PricingViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onUserChanged: () => void | Promise<void>;
}

type Pending =
  | { kind: 'plan'; plan: PricingPlan }
  | { kind: 'credits'; pkg: CreditPackage }
  | null;

export const PricingView: React.FC<PricingViewProps> = ({
  onShowToast,
  isAuthenticated,
  onRequireAuth,
  onUserChanged,
}) => {
  const [annualBilling, setAnnualBilling] = useState<boolean>(true);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pending, setPending] = useState<Pending>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.billing
      .overview()
      .then((response) => {
        if (alive) setOverview(response);
      })
      .catch((error: unknown) => {
        if (alive) {
          onShowToast(
            'No se pudieron cargar los planes',
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
  }, [reloadKey, isAuthenticated]);

  const plans = overview?.plans || [];
  const packages = overview?.packages || [];
  const currentPlan = overview?.currentPlan || 'free';

  const amount = useMemo(() => {
    if (!pending) return 0;
    if (pending.kind === 'credits') return pending.pkg.priceUsd;
    return annualBilling ? pending.plan.annualUsd : pending.plan.monthlyUsd;
  }, [pending, annualBilling]);

  const start = (plan: PricingPlan) => {
    if (plan.id === 'starter' || plan.monthlyUsd === 0) {
      onShowToast(
        'Plan gratuito',
        currentPlan === 'free'
          ? 'Ya estás en el plan Starter con 100 créditos de bienvenida.'
          : 'El plan Starter no requiere pago; tu plan actual se mantiene.',
        'info'
      );
      return;
    }
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setPending({ kind: 'plan', plan });
  };

  const buyPackage = (pkg: CreditPackage) => {
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setPending({ kind: 'credits', pkg });
  };

  const handlePay = async (card: { number: string; holder: string; expiry: string; cvv: string }) => {
    if (!pending) return;
    if (pending.kind === 'credits') {
      const response = await api.billing.buyCredits(pending.pkg.id, card);
      onShowToast('Pago aprobado', response.message, 'success');
    } else {
      const response = await api.billing.activatePlan(
        pending.plan.id,
        annualBilling,
        card
      );
      onShowToast('Plan activado', response.message, 'success');
    }
    await onUserChanged();
    setPending(null);
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100/70 text-purple-900 border border-purple-200/60 text-xs font-mono-code font-semibold mb-4">
          <Sparkles className="w-3 h-3" /> PLANES & CRÉDITOS
        </div>
        <h1 className="font-space text-3xl sm:text-4xl font-extrabold text-slate-900">
          Elegí cómo escalar tu flujo de prompts
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Los planes acreditan créditos al activarse y se pagan con la pasarela simulada. Los prompts
          del marketplace se compran con créditos.
        </p>
        <div className="mt-5 inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-purple-100 shadow-xs">
          <button
            onClick={() => setAnnualBilling(false)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              !annualBilling ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setAnnualBilling(true)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
              annualBilling ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Anual <span className="text-[9px] text-emerald-500 font-bold">-20%</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-16 flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <p className="text-sm">Cargando planes…</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const price = annualBilling ? plan.annualUsd : plan.monthlyUsd;
            const isCurrent =
              (plan.id === 'starter' && currentPlan === 'free') || plan.id === currentPlan;
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl border p-6 flex flex-col ${
                  plan.id === 'pro'
                    ? 'bg-slate-950 text-white border-purple-500/40 shadow-2xl'
                    : 'bg-white text-slate-900 border-purple-100 shadow-xs'
                }`}
              >
                {plan.id === 'pro' && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-purple-600 text-white text-[10px] font-mono-code font-bold uppercase tracking-wider">
                    Más popular
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono-code font-bold uppercase ${
                      plan.id === 'pro'
                        ? 'bg-purple-900/60 text-purple-200'
                        : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {plan.badge}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-mono-code uppercase text-emerald-500 font-bold">
                      Plan actual
                    </span>
                  )}
                </div>
                <h2 className="font-space text-xl font-bold mt-3">{plan.name}</h2>
                <p
                  className={`text-[11px] mt-1 leading-relaxed ${
                    plan.id === 'pro' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {plan.description}
                </p>

                <div className="mt-5 flex items-end gap-1">
                  <span className="text-3xl font-extrabold font-space">${price}</span>
                  <span
                    className={`text-[11px] mb-1 ${
                      plan.id === 'pro' ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    /{annualBilling ? 'año' : 'mes'}
                  </span>
                </div>
                {plan.monthlyCredits > 0 && (
                  <div className="text-[10px] font-mono-code text-amber-500 mt-1">
                    +{plan.monthlyCredits} créditos al activar
                  </div>
                )}

                <ul className="mt-5 space-y-2 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[11px]">
                      <Check
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                          plan.id === 'pro' ? 'text-purple-300' : 'text-purple-600'
                        }`}
                      />
                      <span className={plan.id === 'pro' ? 'text-slate-200' : 'text-slate-600'}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => start(plan)}
                  disabled={isCurrent}
                  className={`mt-6 w-full py-2.5 rounded-xl text-xs font-semibold transition ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : plan.id === 'pro'
                        ? 'bg-white text-slate-950 hover:bg-purple-50'
                        : 'bg-slate-900 hover:bg-purple-700 text-white'
                  }`}
                >
                  {isCurrent ? 'Plan actual' : plan.cta}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Credit packages */}
      {!loading && packages.length > 0 && (
        <div className="mt-14">
          <div className="text-center mb-6">
            <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700">
              RECARGA A DEMANDA
            </div>
            <h2 className="font-space text-2xl font-bold text-slate-900 mt-1">
              Paquetes de créditos
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Comprá créditos cuando quieras. Los créditos se usan para comprar fórmulas y generar.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="p-4 rounded-2xl bg-white border border-purple-100 shadow-xs hover:shadow-md transition flex flex-col"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono-code font-bold uppercase text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                    {pkg.label}
                  </span>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-3 text-2xl font-extrabold font-space text-slate-900">
                  {pkg.credits.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase font-mono-code text-slate-500">créditos</div>
                {pkg.bonus > 0 && (
                  <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                    +{pkg.bonus} de regalo
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-mono-code font-bold text-sm">${pkg.priceUsd}</span>
                  <button
                    onClick={() => buyPackage(pkg)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-purple-700 text-white text-[11px] font-semibold transition"
                  >
                    Comprar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {overview && overview.payments.length > 0 && (
        <div className="mt-12 bg-white rounded-2xl border border-purple-100 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-purple-100 text-[10px] font-mono-code font-bold uppercase tracking-wider text-slate-600">
            Últimos pagos simulados
          </div>
          <ul className="divide-y divide-purple-50">
            {overview.payments.slice(0, 6).map((payment) => (
              <li key={payment.id} className="px-4 py-2.5 flex items-center justify-between text-[11px]">
                <div>
                  <div className="font-semibold text-slate-800">{payment.description}</div>
                  <div className="text-[10px] text-slate-400 font-mono-code">
                    {payment.reference} · •••• {payment.last4}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono-code font-bold text-slate-900">
                    ${payment.amountUsd.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-emerald-600 uppercase font-mono-code">
                    {payment.status}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: ShieldCheck,
            title: 'Pago simulado seguro',
            text: 'La pasarela valida Luhn, vencimiento y CVV. No se cobra dinero real.',
          },
          {
            icon: Zap,
            title: 'Créditos inmediatos',
            text: 'Los créditos se acreditan en la misma transacción que aprueba el pago.',
          },
          {
            icon: HelpCircle,
            title: 'Sin letra chica',
            text: 'Los planes se pueden activar cuando quieras; no hay renovación automática.',
          },
        ].map((item) => (
          <div key={item.title} className="p-4 rounded-2xl bg-white border border-purple-100 flex gap-3">
            <item.icon className="w-4 h-4 text-purple-600 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-slate-900">{item.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{item.text}</div>
            </div>
          </div>
        ))}
      </div>

      <PaymentModal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        title={
          pending?.kind === 'credits'
            ? `Comprar ${pending.pkg.credits} créditos`
            : pending?.kind === 'plan'
              ? `Activar ${pending.plan.name}`
              : 'Pago'
        }
        subtitle={
          pending?.kind === 'credits'
            ? pending.pkg.label
            : pending?.kind === 'plan'
              ? `${annualBilling ? 'Facturación anual' : 'Facturación mensual'}`
              : undefined
        }
        amountUsd={amount}
        submitLabel={pending?.kind === 'credits' ? 'Comprar créditos' : 'Activar plan'}
        onPay={handlePay}
      />
    </div>
  );
};
