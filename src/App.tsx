import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, useParams, Link, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { ExploreView } from './components/ExploreView';
import { CategoryView } from './components/CategoryView';
import { CartView } from './components/CartView';
import { MessagesView } from './components/MessagesView';
import { PromptDetailModal } from './components/PromptDetailModal';
import { GeneratorView } from './components/GeneratorView';
import { SellWizardView } from './components/SellWizardView';
import { CreatorStudioView } from './components/CreatorStudioView';
import { HireCreatorsView } from './components/HireCreatorsView';
import { LibraryView } from './components/LibraryView';
import { EnterpriseView } from './components/EnterpriseView';
import { AdminQAView } from './components/AdminQAView';
import { PricingView } from './components/PricingView';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { CreatorProfileView } from './components/CreatorProfileView';
import { AuthModal } from './components/AuthModal';
import { CreditsModal } from './components/CreditsModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Footer } from './components/Footer';
import { RutaAdmin, RutaPrivada } from './components/Guards';
import { useAuth } from './context/AuthContext';
import { PromptItem } from './types';
import { api } from './lib/api';

/** Rutas reales de la app: la barra y el pie navegan con estos ids. */
const RUTA_POR_TAB: Record<string, string> = {
  explore: '/',
  generator: '/generador',
  sell: '/vender',
  'creator-studio': '/panel',
  hire: '/creadores',
  library: '/biblioteca',
  enterprise: '/empresa',
  'admin-qa': '/admin',
  pricing: '/planes',
};

const NotFound: React.FC = () => (
  <div className="max-w-3xl mx-auto px-6 py-24 text-center">
    <div className="text-[11px] font-mono-code text-purple-700 font-bold tracking-widest uppercase mb-3">
      404
    </div>
    <h1 className="font-space text-3xl font-bold text-slate-900 mb-3">Esta página no existe</h1>
    <p className="text-sm text-slate-500 mb-6">
      El enlace puede estar mal escrito o la fórmula ya no está publicada.
    </p>
    <Link
      to="/"
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
    >
      Volver a Explorar
    </Link>
  </div>
);

/** /prompt/:id — ficha completa de la fórmula. */
const PromptDetailRoute: React.FC<{
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onUserChanged: () => void | Promise<void>;
  onNavigateToCreator: (id: number) => void;
  onNavigateToHireAuthor: (authorName: string) => void;
}> = ({
  onShowToast,
  isAuthenticated,
  onRequireAuth,
  onUserChanged,
  onNavigateToCreator,
  onNavigateToHireAuthor,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-space text-2xl font-bold text-slate-900 mb-3">Fórmula no encontrada</h1>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
        >
          Volver a Explorar
        </button>
      </div>
    );
  }

  return (
    <PromptDetailModal
      promptId={id}
      onClose={() => navigate('/')}
      onShowToast={onShowToast}
      isAuthenticated={isAuthenticated}
      onRequireAuth={onRequireAuth}
      onUserChanged={onUserChanged}
      onNavigateToCreator={onNavigateToCreator}
      onNavigateToHireAuthor={onNavigateToHireAuthor}
    />
  );
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refresh, setUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<'signup' | 'signin'>('signup');
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState<boolean>(false);
  const [preselectedHireAuthor, setPreselectedHireAuthor] = useState<string>('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [exploreKey, setExploreKey] = useState<number>(0);

  const credits = user?.credits ?? 0;
  const isAuthenticated = !!user;

  const irATab = (tab: string) => {
    navigate(RUTA_POR_TAB[tab] || '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (
    title: string,
    message?: string,
    type: 'success' | 'error' | 'info' = 'success'
  ) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const openAuth = (message?: string) => {
    setIsAuthModalOpen(true);
    if (message) showToast('Iniciá sesión', message, 'info');
  };

  const requireAuth = () => openAuth('Necesitás una cuenta para continuar.');

  const abrirCreditos = () => {
    if (!user) {
      openAuth('Necesitás una cuenta para comprar créditos.');
      return;
    }
    setIsCreditsModalOpen(true);
  };

  const applyCredits = (nextCredits: number) => {
    setUser((prev) => (prev ? { ...prev, credits: nextCredits } : prev));
  };

  const handleUserChanged = async () => {
    await refresh();
    setExploreKey((key) => key + 1);
  };

  const handleQuickBuy = async (prompt: PromptItem) => {
    if (!user) {
      openAuth('Necesitás una cuenta para comprar esta fórmula.');
      return;
    }
    if (prompt.owned || prompt.isOwner) {
      navigate(`/prompt/${prompt.id}`);
      return;
    }

    try {
      const response = await api.prompts.purchase(prompt.id);
      applyCredits(response.credits);
      setExploreKey((key) => key + 1);
      showToast('Compra realizada', response.message, 'success');
    } catch (error) {
      showToast(
        'Compra no realizada',
        error instanceof Error ? error.message : 'No se pudo completar la compra.',
        'error'
      );
    }
  };

  const handleNavigateToHireAuthor = (authorName: string) => {
    setPreselectedHireAuthor(authorName);
    navigate('/creadores');
  };

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Sesión cerrada', 'Tu sesión se cerró correctamente.', 'info');
      navigate('/');
    } catch {
      showToast('No se pudo cerrar sesión', 'Probá de nuevo en unos segundos.', 'error');
    }
  };

  const handleAccountDeleted = async () => {
    await refresh();
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Cuenta eliminada', 'Tus datos se borraron definitivamente.', 'info');
  };

  // Atajo Ctrl/Cmd + K para buscar.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/');
        setTimeout(() => {
          const input = document.querySelector('input[type="text"]') as HTMLInputElement;
          if (input) input.focus();
        }, 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // La portada (4321) enlaza con /?auth=login o /?auth=signup.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const auth = params.get('auth');
    if (auth !== 'login' && auth !== 'signup') return;

    setAuthInitialMode(auth === 'login' ? 'signin' : 'signup');
    setIsAuthModalOpen(true);

    params.delete('auth');
    const query = params.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ''}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return (
    <div className="min-h-screen bg-[#fcf8ff] text-slate-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <Header
        user={user}
        credits={credits}
        onOpenCreditsModal={abrirCreditos}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onShowToast={showToast}
      />

      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={
              <ExploreView
                key={exploreKey}
                onSelectPrompt={(p) => navigate(`/prompt/${p.id}`)}
                onNavigateToSell={() => navigate('/vender')}
                onNavigateToGenerator={() => navigate('/generador')}
                onNavigateToHire={() => navigate('/creadores')}
                onOpenCreator={(id) => navigate(`/creador/${id}`)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onOpenQuickBuy={handleQuickBuy}
                onShowToast={showToast}
                isAuthenticated={isAuthenticated}
                onRequireAuth={requireAuth}
              />
            }
          />
          <Route
            path="/categoria/:slug"
            element={
              <CategoryView
                onSelectPrompt={(prompt) => navigate(`/prompt/${prompt.id}`)}
                onShowToast={showToast}
              />
            }
          />
          <Route
            path="/carrito"
            element={
              <CartView onShowToast={showToast} onOpenCreditsModal={abrirCreditos} />
            }
          />
          <Route path="/mensajes" element={<MessagesView onShowToast={showToast} />} />
          <Route path="/mensajes/:userId" element={<MessagesView onShowToast={showToast} />} />
          <Route
            path="/prompt/:id"
            element={
              <PromptDetailRoute
                onShowToast={showToast}
                isAuthenticated={isAuthenticated}
                onRequireAuth={requireAuth}
                onUserChanged={handleUserChanged}
                onNavigateToCreator={(id) => navigate(`/creador/${id}`)}
                onNavigateToHireAuthor={handleNavigateToHireAuthor}
              />
            }
          />
          <Route
            path="/generador"
            element={
              <RutaPrivada
                onOpenAuth={() => setIsAuthModalOpen(true)}
                titulo="Generador de IA"
                detalle="Iniciá sesión para usar el generador y consumir tus créditos."
              >
                <GeneratorView
                  credits={credits}
                  onShowToast={showToast}
                  onOpenCreditsModal={abrirCreditos}
                  onCreditsChanged={applyCredits}
                />
              </RutaPrivada>
            }
          />
          <Route
            path="/vender"
            element={
              <RutaPrivada
                onOpenAuth={() => setIsAuthModalOpen(true)}
                titulo="Vender un prompt"
                detalle="Creá tu cuenta para publicar fórmulas y cobrar el 90% de cada venta."
              >
                <SellWizardView
                  onShowToast={showToast}
                  onNavigateToPanel={() => navigate('/panel')}
                />
              </RutaPrivada>
            }
          />
          <Route
            path="/panel"
            element={
              <RutaPrivada
                onOpenAuth={() => setIsAuthModalOpen(true)}
                titulo="Panel del creador"
                detalle="Iniciá sesión para ver tus prompts, ventas y ganancias."
              >
                <CreatorStudioView
                  onShowToast={showToast}
                  onNavigateToSell={() => navigate('/vender')}
                  onOpenPrompt={(id) => navigate(`/prompt/${id}`)}
                />
              </RutaPrivada>
            }
          />
          <Route
            path="/creadores"
            element={
              <HireCreatorsView
                onShowToast={showToast}
                preselectedAuthor={preselectedHireAuthor}
                isAuthenticated={isAuthenticated}
                onRequireAuth={requireAuth}
                onOpenCreator={(id) => navigate(`/creador/${id}`)}
              />
            }
          />
          <Route
            path="/creador/:id"
            element={
              <CreatorProfileView
                onSelectPrompt={(p) => navigate(`/prompt/${p.id}`)}
                onHire={handleNavigateToHireAuthor}
              />
            }
          />
          <Route
            path="/biblioteca"
            element={
              <RutaPrivada
                onOpenAuth={() => setIsAuthModalOpen(true)}
                titulo="Mi Biblioteca"
                detalle="Iniciá sesión para acceder a las fórmulas que compraste."
              >
                <LibraryView
                  onShowToast={showToast}
                  onExploreMore={() => navigate('/')}
                  onOpenPrompt={(id) => navigate(`/prompt/${id}`)}
                />
              </RutaPrivada>
            }
          />
          <Route
            path="/ajustes"
            element={
              <RutaPrivada
                onOpenAuth={() => setIsAuthModalOpen(true)}
                titulo="Mi perfil y ajustes"
                detalle="Iniciá sesión para editar tu perfil, suscripciones y notificaciones."
              >
                <ProfileSettingsView
                  onShowToast={showToast}
                  onUserChanged={handleUserChanged}
                  onLogout={handleLogout}
                  onOpenCreditsModal={abrirCreditos}
                  onNavigate={(path) => navigate(path)}
                  onAccountDeleted={handleAccountDeleted}
                />
              </RutaPrivada>
            }
          />
          <Route
            path="/perfil"
            element={<Navigate to="/ajustes" replace />}
          />
          <Route
            path="/empresa"
            element={
              <RutaPrivada
                onOpenAuth={() => setIsAuthModalOpen(true)}
                titulo="Sección Empresa"
                detalle="Iniciá sesión para gestionar tu equipo y tus claves de API."
              >
                <EnterpriseView onShowToast={showToast} onUserChanged={handleUserChanged} />
              </RutaPrivada>
            }
          />
          <Route
            path="/admin"
            element={
              <RutaAdmin onOpenAuth={() => setIsAuthModalOpen(true)}>
                <AdminQAView onShowToast={showToast} />
              </RutaAdmin>
            }
          />
          <Route
            path="/planes"
            element={
              <PricingView
                onShowToast={showToast}
                isAuthenticated={isAuthenticated}
                onRequireAuth={requireAuth}
                onUserChanged={handleUserChanged}
              />
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer onSelectTab={irATab} />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onShowToast={showToast}
        initialMode={authInitialMode}
      />

      <CreditsModal
        isOpen={isCreditsModalOpen}
        onClose={() => setIsCreditsModalOpen(false)}
        currentCredits={credits}
        onShowToast={showToast}
        onCreditsChanged={async (nextCredits) => {
          applyCredits(nextCredits);
          await refresh();
          setExploreKey((key) => key + 1);
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
