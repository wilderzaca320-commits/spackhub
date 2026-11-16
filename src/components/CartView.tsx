import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Loader2,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import type { CartResponse } from '../lib/api';
import { assetFor } from '../lib/adapters';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

interface CartViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onOpenCreditsModal: () => void;
}

export const CartView: React.FC<CartViewProps> = ({ onShowToast, onOpenCreditsModal }) => {
  const { user, refresh } = useAuth();
  const { refreshAll } = useStore();
  const navigate = useNavigate();

  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.cart
      .get()
      .then((data) => {
        if (alive) setCart(data);
      })
      .catch((error: unknown) => {
        if (alive) {
          onShowToast(
            'No se pudo cargar el carrito',
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
  }, []);

  const handleRemove = async (promptId: number) => {
    setRemoving(promptId);
    try {
      const data = await api.cart.remove(promptId);
      setCart(data);
      await refreshAll();
      onShowToast('Fórmula quitada', data.message, 'info');
    } catch (error) {
      onShowToast(
        'No se pudo quitar',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setRemoving(null);
    }
  };

  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      const result = await api.cart.checkout();
      setCart(result);
      await Promise.all([refresh(), refreshAll()]);
      onShowToast('Compra realizada', result.message, 'success');
      if (result.purchased.length) navigate('/biblioteca');
    } catch (error) {
      onShowToast(
        'Compra no realizada',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setCheckingOut(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-purple-300" />
        <h1 className="font-space text-2xl font-bold text-slate-900 mb-3">Tu carrito</h1>
        <p className="text-sm text-slate-500 mb-6">Iniciá sesión para ver las fórmulas que guardaste.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
        >
          Volver a Explorar
        </Link>
      </div>
    );
  }

  const items = cart?.items ?? [];
  const total = cart?.total ?? 0;
  const credits = cart?.credits ?? user.credits ?? 0;
  const missing = Math.max(0, total - credits);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            CHECKOUT SEGURO
          </div>
          <h1 className="font-space text-3xl font-bold text-slate-900 mt-1">Tu carrito</h1>
          <p className="text-sm text-slate-500 mt-1">
            {items.length === 1 ? '1 fórmula lista para comprar' : `${items.length} fórmulas listas para comprar`}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-purple-100 shadow-sm">
          <Wallet className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-slate-900">{credits} créditos</span>
          <button
            type="button"
            onClick={onOpenCreditsModal}
            className="text-xs font-bold text-purple-700 hover:text-purple-900"
          >
            Cargar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-purple-100 bg-white p-12 text-center shadow-sm">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-purple-200" />
          <h2 className="font-space text-xl font-bold text-slate-900 mb-2">El carrito está vacío</h2>
          <p className="text-sm text-slate-500 mb-6">
            Explorá la portada y agregá fórmulas para comprarlas juntas.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
          >
            Explorar fórmulas <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="flex gap-4 p-4 rounded-2xl bg-white border border-purple-100 shadow-sm"
              >
                <Link
                  to={`/prompt/${item.id}`}
                  className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-purple-50"
                >
                  <img
                    src={assetFor(item.previewImages[0])}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/prompt/${item.id}`}
                    className="font-semibold text-slate-900 hover:text-purple-700 line-clamp-2"
                  >
                    {item.title}
                  </Link>
                  <div className="text-xs text-slate-500 mt-1">
                    {item.model} · por {item.sellerName || 'Creador'}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      {item.rating ? item.rating.toFixed(1) : 'Nuevo'}
                    </span>
                    <span>{item.salesCount} ventas</span>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between shrink-0">
                  <span className="font-space text-lg font-bold text-slate-900">{item.price}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    disabled={removing === item.id}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {removing === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Quitar
                  </button>
                </div>
              </article>
            ))}
          </div>

          <aside className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm lg:sticky lg:top-32">
            <h2 className="font-space text-lg font-bold text-slate-900 mb-4">Resumen</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <dt>Fórmulas</dt>
                <dd>{items.length}</dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>Subtotal</dt>
                <dd>{total} créditos</dd>
              </div>
              <div className="flex justify-between text-slate-600">
                <dt>Tu saldo</dt>
                <dd>{credits} créditos</dd>
              </div>
              {missing > 0 && (
                <div className="flex justify-between text-red-600 font-semibold">
                  <dt>Te faltan</dt>
                  <dd>{missing} créditos</dd>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-purple-100 text-base font-bold text-slate-900">
                <dt>Total</dt>
                <dd>{total} créditos</dd>
              </div>
            </dl>

            {missing > 0 ? (
              <button
                type="button"
                onClick={onOpenCreditsModal}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold hover:brightness-110 transition"
              >
                <Wallet className="w-4 h-4" /> Cargar {missing} créditos
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCheckout}
                disabled={checkingOut || items.length === 0}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-700 text-white text-sm font-bold hover:bg-purple-800 disabled:opacity-60 transition"
              >
                {checkingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {checkingOut ? 'Procesando…' : 'Comprar todo'}
              </button>
            )}

            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Las fórmulas quedan en tu biblioteca para siempre. El creador recibe el 90% de cada venta.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
};
