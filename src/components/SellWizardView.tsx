import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Check,
  ArrowRight,
  ArrowLeft,
  Video,
  ShieldCheck,
  Eye,
  Layers,
  Loader2,
  Plus,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import type { CatalogResponse } from '../types';
import { api } from '../lib/api';
import { ASSETS } from '../data/assets';

interface SellWizardViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToPanel: () => void;
}

interface VariableRow {
  name: string;
  label: string;
  defaultValue: string;
  options: string;
  description: string;
}

const EMPTY_VARIABLE: VariableRow = {
  name: '',
  label: '',
  defaultValue: '',
  options: '',
  description: '',
};

export const SellWizardView: React.FC<SellWizardViewProps> = ({
  onShowToast,
  onNavigateToPanel,
}) => {
  const [step, setStep] = useState<number>(1);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const [model, setModel] = useState<string>('Flux.1 Schnell');
  const [category, setCategory] = useState<string>('Ilustración');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [fullDescription, setFullDescription] = useState<string>('');
  const [price, setPrice] = useState<string>('25');
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  const [variables, setVariables] = useState<VariableRow[]>([]);

  useEffect(() => {
    api.prompts
      .catalog()
      .then((response) => {
        setCatalog(response);
        const categories: string[] = response.categories;
        const models: string[] = response.models;
        setCategory((current) =>
          categories.includes(current) ? current : categories[0] || current
        );
        setModel((current) => (models.includes(current) ? current : models[0] || current));
      })
      .catch(() => setCatalog(null));
  }, []);

  const previewKeys = Object.keys(ASSETS);

  const toggleImage = (key: string) => {
    setPreviewImages((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : prev.length >= 6 ? prev : [...prev, key]
    );
  };

  const addVariable = () => {
    if (variables.length >= 6) return;
    setVariables((prev) => [...prev, { ...EMPTY_VARIABLE }]);
  };

  const updateVariable = (index: number, field: keyof VariableRow, value: string) => {
    setVariables((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
  };

  const validateStep = (target: number): string | null => {
    if (target > 1) {
      if (title.trim().length < 5 || title.trim().length > 100) {
        return 'El título debe tener entre 5 y 100 caracteres.';
      }
      if (description.trim().length < 20 || description.trim().length > 600) {
        return 'La descripción debe tener entre 20 y 600 caracteres.';
      }
      const parsed = Number(price);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
        return 'El precio debe ser un entero entre 1 y 500 créditos.';
      }
    }
    if (target > 2 && previewImages.length < 1) {
      return 'Elegí al menos una imagen de vista previa.';
    }
    if (target > 3) {
      if (masterPrompt.trim().length < 20) {
        return 'El prompt maestro debe tener al menos 20 caracteres.';
      }
      for (const variable of variables) {
        if (!variable.name.trim()) return 'Cada variable necesita un nombre.';
        if (!/^[a-zA-Z0-9_]+$/.test(variable.name.trim())) {
          return 'Los nombres de variables solo admiten letras, números y guión bajo.';
        }
      }
    }
    return null;
  };

  const next = () => {
    const error = validateStep(step + 1);
    if (error) {
      onShowToast('Revisá el formulario', error, 'error');
      return;
    }
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => setStep((current) => Math.max(1, current - 1));

  const submit = async () => {
    const error = validateStep(4);
    if (error) {
      onShowToast('Revisá el formulario', error, 'error');
      return;
    }
    setSaving(true);
    try {
      const response = await api.prompts.create({
        title: title.trim(),
        description: description.trim(),
        fullDescription: fullDescription.trim() || description.trim(),
        model,
        category,
        price: Number(price),
        masterPrompt: masterPrompt.trim(),
        negativePrompt: negativePrompt.trim(),
        videoUrl: videoUrl.trim(),
        previewImages,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 10),
        variables: variables.map((variable) => ({
          name: variable.name.trim(),
          label: variable.label.trim() || variable.name.trim(),
          defaultValue: variable.defaultValue.trim() || variable.options.split(',')[0]?.trim() || '',
          options: variable.options
            .split(',')
            .map((option) => option.trim())
            .filter(Boolean),
          description: variable.description.trim(),
        })),
      });
      onShowToast('Fórmula enviada a QA', response.message, 'success');
      onNavigateToPanel();
    } catch (err) {
      onShowToast(
        'No se pudo publicar la fórmula',
        err instanceof Error ? err.message : undefined,
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { id: 1, label: 'Detalles' },
    { id: 2, label: 'Galería' },
    { id: 3, label: 'Fórmula' },
    { id: 4, label: 'Publicar' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <div className="text-[11px] font-mono-code font-bold uppercase tracking-widest text-purple-700 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
          PROGRAMA DE CREADORES · 90% PARA VOS
        </div>
        <h1 className="font-space text-3xl font-extrabold text-slate-900 mt-1">Vender un prompt</h1>
        <p className="text-sm text-slate-500 mt-1">
          Completá la ficha, elegí imágenes locales y enviá tu fórmula a la cola de revisión QA.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {steps.map((item, index) => (
          <React.Fragment key={item.id}>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold ${
                step === item.id
                  ? 'bg-slate-900 text-white'
                  : step > item.id
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-white border border-purple-100 text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  step > item.id ? 'bg-emerald-500 text-white' : 'bg-white/20'
                }`}
              >
                {step > item.id ? <Check className="w-3 h-3" /> : item.id}
              </span>
              {item.label}
            </div>
            {index < steps.length - 1 && <div className="flex-1 h-px bg-purple-100" />}
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-purple-100 shadow-xs p-5 sm:p-6">
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <h2 className="font-space font-bold text-slate-900">Detalles de la fórmula</h2>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Título</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, 100))}
                placeholder="Ej: Pabellón de cristal escandinavo con luz volumétrica 8K"
                className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {(catalog?.categories || [category]).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Modelo</label>
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {(catalog?.models || [model]).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Precio (créditos)
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm font-mono-code focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Descripción corta (20–600 caracteres)
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 600))}
                rows={3}
                placeholder="Qué genera, para quién y qué la hace reproducible…"
                className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <div className="text-[10px] text-slate-400 text-right mt-1">{description.length}/600</div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Descripción larga (opcional)
              </label>
              <textarea
                value={fullDescription}
                onChange={(event) => setFullDescription(event.target.value.slice(0, 2000))}
                rows={3}
                placeholder="Contexto, casos de uso, parámetros recomendados…"
                className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4 text-purple-600" />
              <h2 className="font-space font-bold text-slate-900">Galería de muestra</h2>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">
              Elegí hasta 6 imágenes locales. La primera será la portada de tu fórmula.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {previewKeys.map((key) => {
                const table = ASSETS as Record<string, string>;
                const selected = previewImages.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleImage(key)}
                    className={`relative rounded-xl overflow-hidden border-2 transition ${
                      selected ? 'border-purple-600' : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={table[key]} alt={key} className="aspect-square object-cover w-full" />
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] font-mono-code px-1.5 py-0.5 truncate">
                      {key}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <h2 className="font-space font-bold text-slate-900">Prompt maestro y variables</h2>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Prompt maestro (mínimo 20 caracteres)
              </label>
              <textarea
                value={masterPrompt}
                onChange={(event) => setMasterPrompt(event.target.value.slice(0, 4000))}
                rows={5}
                placeholder="La fórmula completa que se desbloquea al comprar. Podés usar variables como [estilo]…"
                className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm font-mono-code focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Negative prompt (opcional)
              </label>
              <textarea
                value={negativePrompt}
                onChange={(event) => setNegativePrompt(event.target.value.slice(0, 1000))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm font-mono-code focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Video demo (URL opcional)
                </label>
                <div className="relative">
                  <Video className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value.slice(0, 500))}
                    placeholder="https://…"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tags (separados por coma)
                </label>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="3d, arquitectura, lujo"
                  className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-slate-600">Variables dinámicas</label>
                <button
                  type="button"
                  onClick={addVariable}
                  className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Agregar variable
                </button>
              </div>

              {variables.map((variable, index) => (
                <div key={index} className="p-3 rounded-xl border border-purple-100 bg-slate-50 mb-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      value={variable.name}
                      onChange={(event) => updateVariable(index, 'name', event.target.value)}
                      placeholder="nombre (ej: estilo)"
                      className="px-2.5 py-2 rounded-lg border border-purple-100 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <input
                      value={variable.label}
                      onChange={(event) => updateVariable(index, 'label', event.target.value)}
                      placeholder="Etiqueta visible"
                      className="px-2.5 py-2 rounded-lg border border-purple-100 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <input
                      value={variable.defaultValue}
                      onChange={(event) => updateVariable(index, 'defaultValue', event.target.value)}
                      placeholder="Valor por defecto"
                      className="px-2.5 py-2 rounded-lg border border-purple-100 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <input
                      value={variable.options}
                      onChange={(event) => updateVariable(index, 'options', event.target.value)}
                      placeholder="Opciones separadas por coma"
                      className="px-2.5 py-2 rounded-lg border border-purple-100 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      value={variable.description}
                      onChange={(event) => updateVariable(index, 'description', event.target.value)}
                      placeholder="Descripción de la variable"
                      className="flex-1 px-2.5 py-2 rounded-lg border border-purple-100 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setVariables((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                      }
                      className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {!variables.length && (
                <div className="text-[11px] text-slate-400">
                  Sin variables: la fórmula se copia tal cual.
                </div>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-purple-600" />
              <h2 className="font-space font-bold text-slate-900">Revisión final</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4">
              <div className="rounded-xl overflow-hidden bg-slate-100 aspect-square">
                {previewImages[0] && (
                  <img
                    src={(ASSETS as Record<string, string>)[previewImages[0]]}
                    alt="Portada"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div>
                <h3 className="font-space text-lg font-bold text-slate-900">{title || 'Sin título'}</h3>
                <p className="text-[11px] text-slate-500 mt-1">{description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-mono-code">
                    {category}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono-code">
                    {model}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-mono-code font-bold">
                    {price} créditos
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-mono-code">
                    {previewImages.length} imágenes
                  </span>
                  {variables.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 text-[10px] font-mono-code">
                      {variables.length} variables
                    </span>
                  )}
                </div>
                <pre className="mt-3 whitespace-pre-wrap font-mono-code text-[10px] text-slate-600 bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {masterPrompt || 'Sin prompt maestro'}
                </pre>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 mt-0.5" />
              Al publicar, la fórmula entra en estado <strong>pendiente</strong>. Un administrador la
              revisa y, si se aprueba, aparece en el marketplace. Recibís el 90% de cada venta.
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-purple-100 flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 1}
            className="px-4 py-2.5 rounded-xl border border-purple-200 text-slate-700 text-xs font-semibold hover:bg-purple-50 disabled:opacity-40 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Atrás
          </button>

          {step < 4 ? (
            <button
              onClick={next}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-semibold transition flex items-center gap-1.5"
            >
              Continuar <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-60 text-white text-xs font-semibold transition flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {saving ? 'Publicando…' : 'Publicar y enviar a QA'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
