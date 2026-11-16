import React, { useEffect, useState } from 'react';
import {
  Zap,
  Sparkles,
  RefreshCw,
  Copy,
  Sliders,
  Play,
  Hash,
  Layers,
  Check,
  Loader2,
  History,
  Cpu,
} from 'lucide-react';
import type { Generation } from '../types';
import { api } from '../lib/api';
import { assetFor, formatDateTime } from '../lib/adapters';

interface GeneratorViewProps {
  credits: number;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onOpenCreditsModal: () => void;
  onCreditsChanged: (credits: number) => void | Promise<void>;
}

const GENERATION_COST = 2;

export const GeneratorView: React.FC<GeneratorViewProps> = ({
  credits,
  onShowToast,
  onOpenCreditsModal,
  onCreditsChanged,
}) => {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('Flux.1 Schnell');
  const [promptText, setPromptText] = useState<string>(
    'Biomorphic iridescent sculpture floating in liquid helium, crystalline refraction, high-energy particle traces, ethereal titanium hues'
  );
  const [negativePrompt, setNegativePrompt] = useState<string>(
    'blurry, distorted anatomy, oversaturated low poly, flat textures, noisy background'
  );
  const [result, setResult] = useState<Generation | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const [generating, setGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    api.prompts
      .catalog()
      .then((response) => {
        const list: string[] = response.models;
        setModels(list);
        setSelectedModel((current) => (list.includes(current) ? current : list[0] || current));
      })
      .catch(() => setModels([]));

    api.ai
      .history()
      .then((response) => {
        setHistory(response.items);
        if (response.items.length) setResult(response.items[0]);
      })
      .catch(() => undefined);
  }, []);

  const generate = async () => {
    if (credits < GENERATION_COST) {
      onShowToast(
        'Créditos insuficientes',
        `Necesitás ${GENERATION_COST} créditos para generar.`,
        'error'
      );
      onOpenCreditsModal();
      return;
    }
    if (promptText.trim().length < 5) {
      onShowToast('Prompt muy corto', 'Escribí al menos 5 caracteres.', 'error');
      return;
    }

    setGenerating(true);
    try {
      const response = await api.ai.generate({
        model: selectedModel,
        prompt: promptText.trim(),
        negativePrompt: negativePrompt.trim(),
      });
      setResult(response.generation);
      setHistory((prev) => [response.generation, ...prev].slice(0, 30));
      await onCreditsChanged(response.credits);
      onShowToast(
        response.engine === 'gemini' ? 'Generado con Gemini' : 'Generado en modo local',
        `${response.message} Costo: ${response.cost} créditos.`,
        'success'
      );
    } catch (error) {
      onShowToast(
        'No se pudo generar',
        error instanceof Error ? error.message : undefined,
        'error'
      );
    } finally {
      setGenerating(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      onShowToast('Resultado copiado', 'La fórmula está en el portapapeles.', 'success');
    } catch {
      onShowToast('No se pudo copiar', 'Tu navegador bloqueó el portapapeles.', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            GENERADOR NATIVO EN VIVO
          </div>
          <h1 className="font-space text-3xl font-extrabold text-slate-900 mt-1">Generador de Fórmulas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Mejorá tu prompt con Gemini (o modo simulado local) por {GENERATION_COST} créditos.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <div className="px-4 py-2 rounded-xl bg-white border border-purple-100 text-xs">
            <span className="text-slate-500">Saldo:</span>{' '}
            <strong className="font-mono-code text-slate-900">{credits} cr</strong>
          </div>
          <button
            onClick={onOpenCreditsModal}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" /> Comprar créditos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5">
        <div className="bg-white rounded-2xl border border-purple-100 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-4 h-4 text-purple-600" />
            <h2 className="font-space font-bold text-sm text-slate-900">Configuración</h2>
          </div>

          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Modelo de IA</label>
          <select
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-4"
          >
            {(models.length ? models : [selectedModel]).map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>

          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Descripción de la idea
          </label>
          <textarea
            value={promptText}
            onChange={(event) => setPromptText(event.target.value.slice(0, 4000))}
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-3"
          />
          <div className="text-[10px] text-slate-400 text-right mb-3">{promptText.length}/4000</div>

          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
            Negative prompt (opcional)
          </label>
          <textarea
            value={negativePrompt}
            onChange={(event) => setNegativePrompt(event.target.value.slice(0, 1000))}
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 mb-4"
          />

          <button
            onClick={generate}
            disabled={generating}
            className="w-full py-3 rounded-xl bg-slate-900 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {generating ? 'Generando…' : `Generar fórmula (${GENERATION_COST} créditos)`}
          </button>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-slate-50">
              <Hash className="w-3.5 h-3.5 text-purple-600 mx-auto mb-1" />
              <div className="text-[9px] uppercase font-mono-code text-slate-500">Variables</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50">
              <Layers className="w-3.5 h-3.5 text-purple-600 mx-auto mb-1" />
              <div className="text-[9px] uppercase font-mono-code text-slate-500">Parámetros</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50">
              <Cpu className="w-3.5 h-3.5 text-purple-600 mx-auto mb-1" />
              <div className="text-[9px] uppercase font-mono-code text-slate-500">
                {result?.engine === 'gemini' ? 'Gemini' : 'Local'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-purple-100 shadow-xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-purple-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h2 className="font-space font-bold text-sm text-slate-900">Resultado</h2>
            </div>
            {result && (
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-mono-code font-bold uppercase ${
                  result.engine === 'gemini'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {result.engine === 'gemini' ? 'GEMINI' : 'MOCK LOCAL'}
              </span>
            )}
          </div>

          <div className="p-4 flex-1 flex flex-col">
            {result ? (
              <>
                <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 mb-3">
                  <img
                    src={assetFor(result.previewKey)}
                    alt="Vista previa generada"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono-code text-slate-500">{result.model}</span>
                  <button
                    onClick={copyResult}
                    className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-mono-code text-[11px] leading-relaxed text-slate-700 bg-slate-50 rounded-xl p-3 max-h-72 overflow-y-auto flex-1">
                  {result.result}
                </pre>
                <div className="mt-3 text-[10px] text-slate-400 font-mono-code">
                  {formatDateTime(result.createdAt)} · costo {result.credits} créditos
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                <Sparkles className="w-10 h-10 text-purple-200 mb-3" />
                <h3 className="font-space font-bold text-slate-900 text-sm">Tu fórmula aparecerá acá</h3>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[240px]">
                  Describí la idea, elegí un modelo y presioná Generar. El resultado queda en tu
                  historial.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-purple-600" />
          <h2 className="font-space font-bold text-sm text-slate-900">Historial reciente</h2>
          <span className="text-[10px] font-mono-code text-slate-400">({history.length})</span>
        </div>
        {history.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.slice(0, 9).map((item) => (
              <button
                key={item.id}
                onClick={() => setResult(item)}
                className="text-left p-3 rounded-xl bg-white border border-purple-100 hover:border-purple-300 transition flex gap-3"
              >
                <img
                  src={assetFor(item.previewKey)}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-800 truncate">{item.model}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-2">{item.prompt}</div>
                  <div className="text-[9px] font-mono-code text-slate-400 mt-0.5">
                    {formatDateTime(item.createdAt)} · {item.engine}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400 py-8 text-center bg-white rounded-2xl border border-purple-100">
            Todavía no generaste fórmulas.
          </div>
        )}
      </div>

      <div className="mt-6 p-4 rounded-2xl bg-white border border-purple-100 flex items-start gap-3">
        <RefreshCw className="w-4 h-4 text-purple-600 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Si configurás <code className="font-mono-code text-purple-700">GEMINI_API_KEY</code> en el
          <code className="font-mono-code text-purple-700"> .env</code> del servidor, el generador usa
          Gemini real. Si no hay clave o falla, cae automáticamente al modo simulado local.
        </p>
      </div>
    </div>
  );
};
