import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, X, ArrowRight, Loader2, AlertCircle, Gift } from 'lucide-react';
import { ASSETS } from '../data/assets';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  initialMode?: 'signup' | 'signin';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  initialMode = 'signup',
}) => {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [accountType, setAccountType] = useState<'individual' | 'corporate'>('individual');
  const [name, setName] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Todos los hooks van antes del return temprano (reglas de React).
  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setFormError(null);
    setSubmitting(false);
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const cambiarModo = (nuevo: 'signup' | 'signin') => {
    setMode(nuevo);
    setFormError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const correo = email.trim().toLowerCase();

    if (!EMAIL_RE.test(correo)) {
      setFormError('Ingresá un correo electrónico válido.');
      return;
    }
    if (password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setFormError('Las contraseñas no coinciden.');
      return;
    }
    if (mode === 'signup' && name.trim() && name.trim().length < 2) {
      setFormError('El nombre debe tener al menos 2 caracteres.');
      return;
    }

    setSubmitting(true);

    try {
      const sessionUser =
        mode === 'signup'
          ? await register({
              email: correo,
              password,
              name: name.trim(),
              accountType,
              company: accountType === 'corporate' ? company.trim() : '',
            })
          : await login(correo, password);

      onShowToast(
        mode === 'signup' ? '¡Cuenta creada!' : 'Sesión iniciada',
        sessionUser.role === 'admin'
          ? `Bienvenido, ${sessionUser.name || sessionUser.email}. Panel de administración habilitado.`
          : `Bienvenido, ${sessionUser.name || sessionUser.email}. Tenés ${sessionUser.credits} créditos.`,
        'success'
      );

      setPassword('');
      setConfirmPassword('');
      onClose();

      // Redirección por rol: user -> inicio, admin -> panel de administración.
      navigate(sessionUser.homePath || (sessionUser.role === 'admin' ? '/admin' : '/'), {
        replace: true,
      });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'No se pudo completar la operación.';
      setFormError(message);
      onShowToast('No se pudo continuar', message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#fcf8ff] rounded-3xl border border-purple-200 shadow-2xl max-w-4xl w-full overflow-hidden relative my-6">
        {/* Encabezado de marca */}
        <div className="bg-white/80 backdrop-blur-md border-b border-purple-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center text-white font-space font-bold text-base shadow-sm">
              S
            </div>
            <span className="font-space font-bold text-lg text-slate-900 tracking-tight">
              Spark<span className="text-purple-600">hub</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono-code text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sesión segura con cookie httpOnly</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Mascota / marca */}
          <div className="hidden md:block md:col-span-5 rounded-2xl overflow-hidden border border-purple-200/80 bg-slate-950 relative shadow-xl aspect-square">
            <img
              src={ASSETS.robotMascot}
              alt="Mascota oficial de Sparkhub"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
            <div className="absolute bottom-4 left-4 right-4 text-left">
              <div className="text-[10px] font-mono-code text-purple-300 font-bold tracking-widest uppercase">
                MOTOR GENERATIVO
              </div>
              <div className="text-sm font-bold font-space text-white">Sparkhub Core 2026</div>
              <div className="text-[11px] text-slate-300">Descubre • Crea • Comparte</div>
            </div>
          </div>

          {/* Formulario */}
          <div className="md:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-purple-100 shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold font-space text-slate-900">
                  {mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}
                </h2>
                <div className="text-xs text-slate-500 mt-0.5">
                  {mode === 'signup'
                    ? 'Unite al marketplace de fórmulas de IA'
                    : 'Ingresá a tu biblioteca personal de prompts'}
                </div>
              </div>

              {mode === 'signup' && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-mono-code text-[10px] font-bold border border-emerald-200 shrink-0">
                  <Gift className="w-3 h-3" />
                  100 créditos
                </span>
              )}
            </div>

            {mode === 'signup' && (
              <div className="space-y-1">
                <div className="grid grid-cols-2 gap-2 p-1 bg-purple-50/60 rounded-xl border border-purple-100">
                  <button
                    type="button"
                    onClick={() => setAccountType('individual')}
                    className={`py-1.5 text-xs font-space font-bold rounded-lg transition ${
                      accountType === 'individual'
                        ? 'bg-white text-purple-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Creador individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('corporate')}
                    className={`py-1.5 text-xs font-space font-bold rounded-lg transition ${
                      accountType === 'corporate'
                        ? 'bg-white text-purple-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Empresa / Studio
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Es solo un dato de perfil: no cambia tus permisos (siempre podés comprar y vender).
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-mono-code text-slate-600 uppercase font-semibold">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre o el de tu estudio"
                    maxLength={60}
                    className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-purple-100 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-mono-code text-slate-600 uppercase font-semibold">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@empresa.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-purple-100 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition"
                />
              </div>

              {mode === 'signup' && accountType === 'corporate' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-mono-code text-slate-600 uppercase font-semibold">
                    Empresa
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Nombre de la empresa"
                    maxLength={80}
                    className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-purple-100 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-mono-code text-slate-600 uppercase font-semibold">
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50/80 border border-purple-100 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-mono-code text-slate-600 uppercase font-semibold">
                    Confirmar contraseña *
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repetí la contraseña"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50/80 border border-purple-100 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {formError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-purple-700 via-purple-600 to-teal-500 hover:from-purple-800 hover:to-teal-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-space font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-purple-600/20 active:scale-98 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Procesando…</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'signup' ? 'Crear cuenta' : 'Entrar'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-500">
              {mode === 'signup' ? (
                <span>
                  ¿Ya tenés cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => cambiarModo('signin')}
                    className="text-purple-700 font-bold hover:underline"
                  >
                    Iniciar sesión
                  </button>
                </span>
              ) : (
                <span>
                  ¿No tenés cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => cambiarModo('signup')}
                    className="text-purple-700 font-bold hover:underline"
                  >
                    Crear cuenta
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pie legal */}
        <div className="bg-slate-50 border-t border-purple-100 px-6 py-3 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 Sparkhub. Todos los derechos reservados.</span>
          <div className="flex items-center gap-4">
            <span>Cuenta local</span>
            <span>Sin servicios externos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
