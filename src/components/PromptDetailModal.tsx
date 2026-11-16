import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Check,
  Copy,
  ShieldCheck,
  Download,
  Star,
  Heart,
  Sparkles,
  Loader2,
  Lock,
  MessageSquare,
  UserCheck,
  ArrowRight,
  ShoppingCart,
} from 'lucide-react';
import type { ApiReview, PromptItem } from '../types';
import { api } from '../lib/api';
import { formatDate, toPromptItem } from '../lib/adapters';
import { useStore } from '../context/StoreContext';

interface PromptDetailModalProps {
  promptId: string;
  onClose: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onUserChanged: () => void | Promise<void>;
  onNavigateToCreator: (id: number) => void;
  onNavigateToHireAuthor: (authorName: string) => void;
}

export const PromptDetailModal: React.FC<PromptDetailModalProps> = ({
  promptId,
  onClose,
  onShowToast,
  isAuthenticated,
  onRequireAuth,
  onUserChanged,
  onNavigateToCreator,
  onNavigateToHireAuthor,
}) => {
  const { refreshAll } = useStore();
  const [prompt, setPrompt] = useState<PromptItem | null>(null);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [buying, setBuying] = useState<boolean>(false);
  const [addingToCart, setAddingToCart] = useState<boolean>(false);
  const [favoriting, setFavoriting] = useState<boolean>(false);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [sendingReview, setSendingReview] = useState<boolean>(false);
  const [selectedVariables, setSelectedVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setActiveImageIndex(0);

    api.prompts
      .detail(promptId)
      .then(({ prompt: apiPrompt, reviews: list }) => {
        if (!alive) return;
        const item = toPromptItem(apiPrompt);
        setPrompt(item);
        setReviews(list);
        const initial: Record<string, string> = {};
        item.variableSlots.forEach((slot) => {
          initial[slot.name] = slot.defaultValue;
        });
        setSelectedVariables(initial);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar la fórmula.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [promptId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const finalPrompt = useMemo(() => {
    if (!prompt) return '';
    let text = prompt.masterPrompt;
    prompt.variableSlots.forEach((slot) => {
      const value = selectedVariables[slot.name] || slot.defaultValue;
      if (!value) return;
      if (text.includes(`[${slot.name}]`)) text = text.split(`[${slot.name}]`).join(value);
      if (text.includes(`{${slot.name}}`)) text = text.split(`{${slot.name}}`).join(value);
    });
    return text;
  }, [prompt, selectedVariables]);

  const handleCopy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      onShowToast('Copiado', message, 'success');
    } catch {
      onShowToast('No se pudo copiar', 'Tu navegador bloqueó el portapapeles.', 'error');
    }
  };

  const handleBuy = async () => {
    if (!prompt) return;
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setBuying(true);
    try {
      const response = await api.prompts.purchase(prompt.id);
      const updated = toPromptItem(response.prompt);
      setPrompt(updated);
      await onUserChanged();
      onShowToast('Compra realizada', response.message, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo completar la compra.';
      if (message.toLowerCase().includes('sesión')) onRequireAuth();
      onShowToast('Compra no realizada', message, 'error');
    } finally {
      setBuying(false);
    }
  };

  const handleAddToCart = async () => {
    if (!prompt) return;
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setAddingToCart(true);
    try {
      const response = await api.cart.add(Number(prompt.id));
      await refreshAll();
      onShowToast('Agregado al carrito', response.message, 'success');
    } catch (err) {
      onShowToast(
        'No se pudo agregar al carrito',
        err instanceof Error ? err.message : undefined,
        'error'
      );
    } finally {
      setAddingToCart(false);
    }
  };

  const handleFavorite = async () => {
    if (!prompt) return;
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setFavoriting(true);
    try {
      const response = await api.prompts.favorite(prompt.id);
      setPrompt({ ...prompt, isFavorited: response.favorited });
      onShowToast(
        response.favorited ? 'Guardado en favoritos' : 'Quitado de favoritos',
        prompt.title,
        'success'
      );
    } catch (err) {
      onShowToast(
        'No se pudo actualizar el favorito',
        err instanceof Error ? err.message : undefined,
        'error'
      );
    } finally {
      setFavoriting(false);
    }
  };

  const handleReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt) return;
    setSendingReview(true);
    try {
      await api.prompts.review(prompt.id, { rating: reviewRating, comment: reviewComment.trim() });
      const detail = await api.prompts.detail(prompt.id);
      setPrompt(toPromptItem(detail.prompt));
      setReviews(detail.reviews);
      setReviewComment('');
      onShowToast('¡Gracias por tu reseña!', 'Tu opinión ya es visible para la comunidad.', 'success');
    } catch (err) {
      onShowToast(
        'No se pudo publicar la reseña',
        err instanceof Error ? err.message : undefined,
        'error'
      );
    } finally {
      setSendingReview(false);
    }
  };

  const downloadWorkflow = () => {
    if (!prompt) return;
    const payload = {
      platform: 'Sparkhub',
      prompt: prompt.title,
      model: prompt.model,
      category: prompt.category,
      masterPrompt: finalPrompt,
      negativePrompt: prompt.negativePrompt,
      variables: prompt.variableSlots,
      specs: prompt.technicalSpecs,
      license: 'Comercial Ilimitada',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sparkhub-${prompt.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast('Workflow descargado', 'Archivo JSON generado.', 'success');
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/60 backdrop-blur-sm">
      <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden my-4">
          <div className="flex items-center justify-between px-5 py-3 border-b border-purple-100">
            <div className="flex items-center gap-2 text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700">
              <Sparkles className="w-3.5 h-3.5" />
              Ficha de fórmula
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loading && (
            <div className="py-24 flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <p className="text-sm">Cargando fórmula…</p>
            </div>
          )}

          {!loading && error && (
            <div className="py-20 text-center px-6">
              <Lock className="w-8 h-8 text-rose-300 mx-auto mb-3" />
              <h2 className="font-space text-xl font-bold text-slate-900">{error}</h2>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 transition"
              >
                Volver
              </button>
            </div>
          )}

          {!loading && prompt && (
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Gallery */}
              <div className="bg-slate-950 p-4 sm:p-5">
                <div className="aspect-square rounded-xl overflow-hidden bg-slate-900">
                  <img
                    src={prompt.previewImages[activeImageIndex] || prompt.previewImages[0]}
                    alt={prompt.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                {prompt.previewImages.length > 1 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {prompt.previewImages.map((image, index) => (
                      <button
                        key={image + index}
                        onClick={() => setActiveImageIndex(index)}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition ${
                          index === activeImageIndex ? 'border-purple-400' : 'border-transparent opacity-60'
                        }`}
                      >
                        <img src={image} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {prompt.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono-code text-slate-300"
                    >
                      #{tag.replace(/\s+/g, '')}
                    </span>
                  ))}
                </div>
                {prompt.videoUrl && (
                  <a
                    href={prompt.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-[11px] text-purple-300 hover:text-white"
                  >
                    <ArrowRight className="w-3 h-3" /> Ver video de demostración
                  </a>
                )}
              </div>

              {/* Info */}
              <div className="p-5 sm:p-6 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-mono-code font-bold uppercase">
                        {prompt.model}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono-code uppercase">
                        {prompt.category}
                      </span>
                      {prompt.status !== 'approved' && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-mono-code font-bold uppercase">
                          {prompt.status === 'pending' ? 'EN REVISIÓN' : prompt.status?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h1 className="font-space text-2xl font-bold text-slate-900 mt-2 leading-tight">
                      {prompt.title}
                    </h1>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">{prompt.description}</p>
                  </div>

                  <button
                    onClick={handleFavorite}
                    disabled={favoriting}
                    className="w-9 h-9 rounded-xl border border-purple-200 flex items-center justify-center text-purple-700 hover:bg-purple-50 transition shrink-0"
                    title={prompt.isFavorited ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                  >
                    <Heart className={`w-4 h-4 ${prompt.isFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>
                </div>

                <button
                  onClick={() => onNavigateToCreator(prompt.author.id)}
                  className="mt-4 flex items-center gap-3 p-2 rounded-xl hover:bg-purple-50 transition text-left"
                >
                  <img
                    src={prompt.author.avatar}
                    alt={prompt.author.name}
                    className="w-9 h-9 rounded-lg object-cover border border-purple-200"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                      {prompt.author.name}
                      <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {prompt.author.company || 'Creador independiente'} · {prompt.author.sales} ventas
                    </div>
                  </div>
                  <div className="flex items-center text-[11px] text-amber-500 font-semibold">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />
                    {prompt.rating.toFixed(1)} ({prompt.reviewsCount})
                  </div>
                </button>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 border border-purple-100 py-2">
                    <div className="text-sm font-bold font-space text-slate-900">{prompt.salesCount}</div>
                    <div className="text-[9px] uppercase font-mono-code text-slate-500">Ventas</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-purple-100 py-2">
                    <div className="text-sm font-bold font-space text-slate-900">{prompt.technicalSpecs.tokenCount}</div>
                    <div className="text-[9px] uppercase font-mono-code text-slate-500">Tokens</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-purple-100 py-2">
                    <div className="text-sm font-bold font-space text-slate-900">{prompt.technicalSpecs.cfg}</div>
                    <div className="text-[9px] uppercase font-mono-code text-slate-500">CFG</div>
                  </div>
                </div>

                {/* Master prompt */}
                <div className="mt-5 rounded-xl border border-purple-100 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-purple-100">
                    <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-slate-600">
                      Prompt maestro
                    </span>
                    {prompt.canReadMaster ? (
                      <button
                        onClick={() => handleCopy(finalPrompt, 'Prompt maestro copiado al portapapeles.')}
                        className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copiado' : 'Copiar'}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Bloqueado
                      </span>
                    )}
                  </div>

                  {prompt.canReadMaster ? (
                    <div className="p-3">
                      <pre className="whitespace-pre-wrap font-mono-code text-[11px] leading-relaxed text-slate-700 max-h-44 overflow-y-auto">
                        {finalPrompt}
                      </pre>
                      {prompt.negativePrompt && (
                        <div className="mt-2 pt-2 border-t border-purple-50">
                          <div className="text-[9px] uppercase font-mono-code text-rose-500 font-bold mb-1">
                            Negative prompt
                          </div>
                          <pre className="whitespace-pre-wrap font-mono-code text-[10px] text-slate-500 max-h-20 overflow-y-auto">
                            {prompt.negativePrompt}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative p-3">
                      <div className="font-mono-code text-[11px] text-slate-400 blur-[2.5px] select-none leading-relaxed">
                        {prompt.description} --ar 16:9 --style cinematic --quality ultra --seed
                        1839201 --detail high --model {prompt.model.toLowerCase().replace(/\s+/g, '-')}
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50">
                        <Lock className="w-4 h-4 text-purple-600 mb-1" />
                        <span className="text-[10px] font-semibold text-slate-700">
                          Comprá la fórmula para desbloquearla
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Variables */}
                {prompt.canReadMaster && prompt.variableSlots.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Personalizá las variables
                    </div>
                    <div className="space-y-2">
                      {prompt.variableSlots.map((slot) => (
                        <div key={slot.name} className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-600 w-24 shrink-0">{slot.label}</span>
                          <select
                            value={selectedVariables[slot.name] || slot.defaultValue}
                            onChange={(event) =>
                              setSelectedVariables((prev) => ({ ...prev, [slot.name]: event.target.value }))
                            }
                            className="flex-1 px-2 py-1.5 text-[11px] rounded-lg border border-purple-100 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-400"
                          >
                            {(slot.options.length ? slot.options : [slot.defaultValue]).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Buy / owner */}
                <div className="mt-auto pt-5">
                  {prompt.isOwner ? (
                    <div className="rounded-xl bg-purple-50 border border-purple-200 p-3 text-xs text-purple-900">
                      Esta fórmula es tuya. Podés editarla desde tu panel de creador.
                    </div>
                  ) : prompt.owned ? (
                    <div className="space-y-2">
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Comprada: la fórmula está desbloqueada.
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleCopy(finalPrompt, 'Prompt maestro copiado al portapapeles.')
                          }
                          className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar prompt
                        </button>
                        <button
                          onClick={downloadWorkflow}
                          className="px-4 py-2.5 rounded-xl border border-purple-200 text-slate-700 text-xs font-semibold hover:bg-purple-50 transition flex items-center gap-2"
                        >
                          <Download className="w-3.5 h-3.5" /> JSON
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handleBuy}
                      disabled={buying}
                      className="w-full py-3 rounded-xl bg-slate-900 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
                    >
                      {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {buying ? 'Procesando compra…' : `Comprar por ${prompt.price} créditos`}
                      </button>
                      <button
                        onClick={handleAddToCart}
                        disabled={addingToCart}
                        className="w-full py-2.5 rounded-xl border border-purple-200 text-slate-700 text-xs font-semibold hover:bg-purple-50 disabled:opacity-60 transition flex items-center justify-center gap-2"
                      >
                        {addingToCart ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShoppingCart className="w-3.5 h-3.5" />
                        )}
                        Agregar al carrito
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => onNavigateToHireAuthor(prompt.author.name)}
                    className="mt-2 w-full py-2.5 rounded-xl border border-purple-200 text-slate-700 text-xs font-semibold hover:bg-purple-50 transition flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Contratar al creador para un encargo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reviews */}
          {!loading && prompt && (
            <div className="border-t border-purple-100 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-space text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  Reseñas verificadas ({reviews.length})
                </h2>
                <div className="flex items-center gap-1 text-amber-500 font-semibold text-sm">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {prompt.rating.toFixed(1)}
                </div>
              </div>

              {prompt.owned && !prompt.isOwner && !prompt.hasReviewed && (
                <form onSubmit={handleReview} className="mb-5 p-4 rounded-xl bg-purple-50/60 border border-purple-100">
                  <div className="text-xs font-semibold text-slate-800 mb-2">
                    Dejá tu reseña (solo compradores verificados)
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setReviewRating(value)}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            value <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value.slice(0, 500))}
                    placeholder="Contá cómo te sirvió la fórmula (opcional)…"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-purple-100 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <button
                    type="submit"
                    disabled={sendingReview}
                    className="mt-2 px-4 py-2 rounded-lg bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 disabled:opacity-60 transition"
                  >
                    {sendingReview ? 'Publicando…' : 'Publicar reseña'}
                  </button>
                </form>
              )}

              {prompt.hasReviewed && (
                <div className="mb-4 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  Ya dejaste tu reseña para esta fórmula.
                </div>
              )}

              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="p-3 rounded-xl bg-slate-50 border border-purple-50">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-slate-800">{review.authorName}</div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star
                            key={value}
                            className={`w-3 h-3 ${
                              value <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                            }`}
                          />
                        ))}
                        <span className="text-[10px] text-slate-400 ml-1">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                ))}
                {!reviews.length && (
                  <div className="text-xs text-slate-400 text-center py-6">
                    Todavía no hay reseñas. Comprá la fórmula y sé el primero en opinar.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
