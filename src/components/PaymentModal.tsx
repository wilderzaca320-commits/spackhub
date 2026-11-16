import React, { useEffect, useState } from 'react';
import { CreditCard, Lock, X, ShieldCheck, Loader2 } from 'lucide-react';
import type { CardDetails } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  amountUsd: number;
  submitLabel?: string;
  onPay: (card: CardDetails) => Promise<void>;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function luhnValid(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function formatCardNumber(value: string): string {
  const digits = onlyDigits(value).slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function futureExpiry(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const limit = new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(year, month, 1) > limit;
}

function brandOf(value: string): string {
  const digits = onlyDigits(value);
  if (digits.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  return 'Tarjeta';
}

const EMPTY_CARD: CardDetails = { number: '', holder: '', expiry: '', cvv: '' };

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  amountUsd,
  submitLabel = 'Pagar ahora',
  onPay,
}) => {
  const [card, setCard] = useState<CardDetails>(EMPTY_CARD);
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCard(EMPTY_CARD);
      setError('');
      setProcessing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (field: keyof CardDetails, value: string) => {
    setCard((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const fillTestCard = () => {
    const nextYear = String((new Date().getFullYear() + 2) % 100).padStart(2, '0');
    setCard({
      number: '4242 4242 4242 4242',
      holder: 'NEO VISIONS',
      expiry: `12/${nextYear}`,
      cvv: '123',
    });
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!luhnValid(card.number)) {
      setError('El número de tarjeta no es válido. Probá con 4242 4242 4242 4242.');
      return;
    }
    if (card.holder.trim().length < 3) {
      setError('Ingresá el nombre del titular como figura en la tarjeta.');
      return;
    }
    if (!futureExpiry(card.expiry)) {
      setError('El vencimiento debe tener formato MM/AA y ser una fecha futura.');
      return;
    }
    const cvvLength = brandOf(card.number) === 'American Express' ? 4 : 3;
    if (onlyDigits(card.cvv).length !== cvvLength) {
      setError(`El CVV debe tener ${cvvLength} dígitos.`);
      return;
    }

    setProcessing(true);
    setError('');
    try {
      await onPay({
        number: onlyDigits(card.number),
        holder: card.holder.trim(),
        expiry: card.expiry.trim(),
        cvv: onlyDigits(card.cvv),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el pago.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div>
            <div className="text-[10px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Pasarela segura simulada
            </div>
            <h2 className="font-space text-xl font-bold text-slate-900 mt-1">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="w-8 h-8 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div className="rounded-xl bg-slate-950 text-white p-4 mb-5 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-purple-500/30 blur-2xl" />
            <div className="flex items-center justify-between">
              <CreditCard className="w-6 h-6 text-purple-300" />
              <span className="text-[10px] font-mono-code uppercase tracking-wider text-slate-300">
                {brandOf(card.number)}
              </span>
            </div>
            <div className="mt-4 font-mono-code text-sm tracking-widest text-slate-100">
              {card.number || '•••• •••• •••• ••••'}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-mono-code uppercase text-slate-300">
              <span>{card.holder || 'TITULAR DE LA TARJETA'}</span>
              <span>{card.expiry || 'MM/AA'}</span>
            </div>
          </div>

          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Número de tarjeta
          </label>
          <input
            value={card.number}
            onChange={(event) => update('number', formatCardNumber(event.target.value))}
            inputMode="numeric"
            placeholder="4242 4242 4242 4242"
            className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm font-mono-code focus:outline-none focus:ring-2 focus:ring-purple-400 mb-3"
          />

          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Titular</label>
          <input
            value={card.holder}
            onChange={(event) => update('holder', event.target.value.toUpperCase())}
            placeholder="NOMBRE COMO FIGURA EN LA TARJETA"
            className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-3"
          />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vencimiento</label>
              <input
                value={card.expiry}
                onChange={(event) => update('expiry', formatExpiry(event.target.value))}
                inputMode="numeric"
                placeholder="MM/AA"
                className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm font-mono-code focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">CVV</label>
              <input
                value={card.cvv}
                onChange={(event) => update('cvv', onlyDigits(event.target.value).slice(0, 4))}
                inputMode="numeric"
                placeholder="123"
                className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm font-mono-code focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mb-4 text-xs">
            <button
              type="button"
              onClick={fillTestCard}
              className="text-purple-700 hover:text-purple-900 font-semibold underline decoration-dotted"
            >
              Usar tarjeta de prueba
            </button>
            <span className="font-mono-code font-bold text-slate-900">
              ${amountUsd.toFixed(2)} USD
            </span>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full py-3 rounded-xl bg-slate-900 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {processing ? 'Procesando pago…' : submitLabel}
          </button>

          <p className="text-[10px] text-slate-400 text-center mt-3 leading-relaxed">
            Demostración: no se cobra dinero real. La tarjeta se valida con Luhn, vencimiento y CVV.
          </p>
        </form>
      </div>
    </div>
  );
};
