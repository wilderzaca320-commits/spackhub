import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Cargando: React.FC<{ texto?: string }> = ({ texto = 'Verificando tu sesión…' }) => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-500">
    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
    <p className="text-sm">{texto}</p>
  </div>
);

export const AccesoRequerido: React.FC<{
  onOpenAuth: () => void;
  titulo?: string;
  detalle?: string;
}> = ({
  onOpenAuth,
  titulo = 'Necesitás iniciar sesión',
  detalle = 'Esta sección es privada. Entrá o creá tu cuenta para continuar.',
}) => (
  <div className="max-w-lg mx-auto px-6 py-20 text-center">
    <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto mb-5">
      <LogIn className="w-6 h-6" />
    </div>
    <h1 className="font-space text-2xl font-bold text-slate-900 mb-2">{titulo}</h1>
    <p className="text-sm text-slate-500 mb-6">{detalle}</p>
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={onOpenAuth}
        className="px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
      >
        Iniciar sesión o registrarme
      </button>
      <Link
        to="/"
        className="px-5 py-2.5 rounded-xl border border-purple-200 text-slate-700 text-sm font-semibold hover:bg-purple-50 transition"
      >
        Volver a Explorar
      </Link>
    </div>
  </div>
);

/** Deja pasar solo con sesión iniciada. */
export const RutaPrivada: React.FC<{
  children: React.ReactNode;
  onOpenAuth: () => void;
  titulo?: string;
  detalle?: string;
}> = ({ children, onOpenAuth, titulo, detalle }) => {
  const { user, loading } = useAuth();

  if (loading) return <Cargando />;
  if (!user) return <AccesoRequerido onOpenAuth={onOpenAuth} titulo={titulo} detalle={detalle} />;

  return <>{children}</>;
};

/** Deja pasar solo al rol admin. Un user ve un 403 y vuelve al inicio. */
export const RutaAdmin: React.FC<{
  children: React.ReactNode;
  onOpenAuth: () => void;
}> = ({ children, onOpenAuth }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [segundos, setSegundos] = useState(4);

  const denegado = !!user && user.role !== 'admin';

  useEffect(() => {
    if (!denegado) return;

    const intervalo = window.setInterval(() => {
      setSegundos((valor) => (valor > 0 ? valor - 1 : 0));
    }, 1000);

    const timeout = window.setTimeout(() => navigate('/', { replace: true }), 4000);

    return () => {
      window.clearInterval(intervalo);
      window.clearTimeout(timeout);
    };
  }, [denegado, navigate]);

  if (loading) return <Cargando texto="Verificando permisos de administrador…" />;
  if (!user) {
    return (
      <AccesoRequerido
        onOpenAuth={onOpenAuth}
        titulo="Panel de administración"
        detalle="Necesitás una cuenta con rol de administrador para entrar acá."
      />
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="text-[11px] font-mono-code text-rose-600 font-bold tracking-widest uppercase mb-2">
          Error 403
        </div>
        <h1 className="font-space text-3xl font-bold text-slate-900 mb-3">Acceso denegado</h1>
        <p className="text-sm text-slate-500 mb-2">
          Tu cuenta ({user.email}) tiene el rol <strong>usuario</strong> y no puede entrar al panel
          de administración.
        </p>
        <p className="text-xs text-slate-400 mb-6">
          Te llevamos al inicio en {segundos} segundo{segundos === 1 ? '' : 's'}…
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
        >
          Volver ahora
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};
