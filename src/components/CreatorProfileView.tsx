import React, { useEffect, useState } from 'react';
import { Star, ShieldCheck, Sparkles, Loader2, ArrowLeft, UserCheck, FileText } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CreatorProfile, PromptItem } from '../types';
import { api } from '../lib/api';
import { avatarFor, formatDate, toCreator, toPromptItem } from '../lib/adapters';

interface CreatorProfileViewProps {
  onSelectPrompt: (prompt: PromptItem) => void;
  onHire: (authorName: string) => void;
}

export const CreatorProfileView: React.FC<CreatorProfileViewProps> = ({
  onSelectPrompt,
  onHire,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api.creators
      .detail(id || '')
      .then((response) => {
        if (!alive) return;
        setCreator(toCreator(response.creator));
        setPrompts(response.prompts.map(toPromptItem));
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'No se pudo cargar el creador.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        <p className="text-sm">Cargando perfil del creador…</p>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <h1 className="font-space text-2xl font-bold text-slate-900 mb-2">
          {error || 'Creador no encontrado'}
        </h1>
        <button
          onClick={() => navigate('/creadores')}
          className="px-5 py-2.5 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition"
        >
          Ver todos los creadores
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-700 mb-5 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver
      </button>

      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <img
            src={avatarFor(creator.avatarKey)}
            alt={creator.name}
            className="w-24 h-24 rounded-2xl object-cover border-2 border-white/20"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-space text-3xl font-extrabold">{creator.name}</h1>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono-code uppercase">
                {creator.plan === 'pro' ? 'Pro Creator' : creator.plan === 'enterprise' ? 'Enterprise' : 'Creador'}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1">
              {creator.company || 'Creador independiente'} · Miembro desde {formatDate(creator.joinedAt)}
            </p>
            <p className="text-[12px] text-slate-400 mt-2 max-w-2xl leading-relaxed">{creator.bio}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {creator.categories.map((item) => (
                <span
                  key={item}
                  className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono-code text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-5 text-center">
            <div>
              <div className="text-xl font-extrabold font-space">{creator.prompts}</div>
              <div className="text-[9px] uppercase font-mono-code text-slate-400">Fórmulas</div>
            </div>
            <div>
              <div className="text-xl font-extrabold font-space">{creator.sales}</div>
              <div className="text-[9px] uppercase font-mono-code text-slate-400">Ventas</div>
            </div>
            <div>
              <div className="text-xl font-extrabold font-space flex items-center justify-center gap-1">
                {creator.rating.toFixed(1)}
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              </div>
              <div className="text-[9px] uppercase font-mono-code text-slate-400">
                {creator.reviewsCount} reseñas
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => onHire(creator.name)}
          className="relative mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-950 text-xs font-semibold hover:bg-purple-50 transition"
        >
          <UserCheck className="w-3.5 h-3.5" /> Contratar un encargo
        </button>
      </div>

      <div className="flex items-center justify-between mt-8 mb-4">
        <div>
          <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            CATÁLOGO DEL CREADOR
          </div>
          <h2 className="font-space text-xl font-bold text-slate-900 mt-0.5">
            Fórmulas publicadas ({prompts.length})
          </h2>
        </div>
      </div>

      {prompts.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              onClick={() => onSelectPrompt(prompt)}
              className="group bg-white rounded-2xl border border-purple-100 shadow-sm hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-300 transition overflow-hidden cursor-pointer flex flex-col"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-100">
                <img
                  src={prompt.previewImages[0]}
                  alt={prompt.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/65 text-[10px] font-mono-code text-slate-200">
                  {prompt.category}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-space font-bold text-sm text-slate-900 line-clamp-1">
                    {prompt.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">{prompt.description}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-purple-50 flex items-center justify-between">
                  <div className="flex items-center text-[10px] text-amber-500 font-semibold">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-0.5" />
                    {prompt.rating.toFixed(1)}
                    <span className="text-slate-400 ml-0.5">({prompt.reviewsCount})</span>
                  </div>
                  <span className="text-sm font-bold font-mono-code text-slate-900">
                    {prompt.price} cr
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-white rounded-2xl border border-purple-100">
          <FileText className="w-8 h-8 text-purple-200 mx-auto mb-3" />
          <h3 className="font-space text-lg font-bold text-slate-900">Sin fórmulas aprobadas</h3>
          <p className="text-xs text-slate-500 mt-1">
            Este creador todavía no tiene fórmulas publicadas en el marketplace.
          </p>
        </div>
      )}

      <div className="mt-8 p-4 rounded-2xl bg-white border border-purple-100 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Todas las fórmulas de este creador pasaron por la revisión QA de Sparkhub. La compra
          desbloquea el prompt maestro de forma permanente y el creador recibe el 90% en créditos.
        </p>
      </div>
    </div>
  );
};
