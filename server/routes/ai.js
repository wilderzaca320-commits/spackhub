import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { MODELS, PREVIEW_KEYS, GENERATION_COST } from '../catalog.js';

const router = Router();

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function pickPreviewKey(text) {
  const seed = Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PREVIEW_KEYS[seed % PREVIEW_KEYS.length];
}

function mockGeneration({ model, prompt, negativePrompt }) {
  const negative = negativePrompt.trim()
    ? `\n\nNegative prompt: ${negativePrompt.trim()}`
    : '';

  return [
    `[Modo simulado local — configurá GEMINI_API_KEY para respuestas reales]`,
    ``,
    `Fórmula optimizada para ${model}:`,
    `${prompt.trim()} --model ${model.toLowerCase().replace(/\s+/g, '-')} --quality ultra --style cinematic --detail high`,
    negative,
    ``,
    `Ajustes sugeridos:`,
    `• Reforzá la iluminación y la composición antes de agregar detalles.`,
    `• Mantené el negative prompt para evitar artefactos comunes.`,
    `• Probá dos semillas distintas y compará el resultado antes de publicar.`,
  ].join('\n');
}

async function geminiGeneration({ model, prompt, negativePrompt }) {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) return null;

  const instruction = [
    `Sos un ingeniero de prompts. Mejorá la siguiente fórmula para ${model}.`,
    `Devolvé únicamente la fórmula final, sin explicaciones, lista para pegar.`,
    `Incluí parámetros técnicos relevantes y mantené las variables entre corchetes.`,
    negativePrompt ? `Respetá este negative prompt: ${negativePrompt}.` : '',
    '',
    `Fórmula original:`,
    prompt,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: instruction }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 600 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini respondió ${response.status}`);
  }

  const data = await response.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || '')
    .join('\n')
    .trim();

  return text || null;
}

router.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const model = String(req.body?.model || '').trim();
    const prompt = String(req.body?.prompt || '').trim();
    const negativePrompt = String(req.body?.negativePrompt || '').trim().slice(0, 1000);

    if (!MODELS.includes(model)) {
      return res.status(400).json({ error: 'Seleccioná un modelo de IA válido.' });
    }
    if (prompt.length < 5 || prompt.length > 4000) {
      return res.status(400).json({ error: 'La descripción debe tener entre 5 y 4000 caracteres.' });
    }

    const current = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id);
    if (current.credits < GENERATION_COST) {
      return res.status(400).json({
        error: `Necesitás ${GENERATION_COST} créditos para generar. Comprá un paquete para continuar.`,
      });
    }

    let engine = 'gemini';
    let result = null;

    try {
      result = await geminiGeneration({ model, prompt, negativePrompt });
      if (!result) engine = 'mock';
    } catch (error) {
      console.warn('[ai] Gemini no disponible, usando modo simulado:', error.message);
      engine = 'mock';
    }

    if (!result) {
      result = mockGeneration({ model, prompt, negativePrompt });
    }

    const save = db.transaction(() => {
      const fresh = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id);
      if (fresh.credits < GENERATION_COST) {
        const error = new Error(`Necesitás ${GENERATION_COST} créditos para generar.`);
        error.status = 400;
        throw error;
      }

      db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(
        GENERATION_COST,
        req.user.id
      );

      const info = db
        .prepare(
          `INSERT INTO generations (user_id, model, prompt, negative_prompt, result, engine, credits)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(req.user.id, model, prompt, negativePrompt, result, engine, GENERATION_COST);

      db.prepare(
        `INSERT INTO credit_transactions (user_id, amount, type, description, reference)
         VALUES (?, ?, 'generation', ?, ?)`
      ).run(
        req.user.id,
        -GENERATION_COST,
        `Generación con ${model}`,
        `generation:${info.lastInsertRowid}`
      );

      const credits = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id).credits;

      return {
        id: Number(info.lastInsertRowid),
        model,
        prompt,
        negativePrompt,
        result,
        engine,
        credits,
        previewKey: pickPreviewKey(prompt),
        createdAt: new Date().toISOString(),
      };
    });

    const generation = save();
    return res.status(201).json({
      generation,
      credits: generation.credits,
      cost: GENERATION_COST,
      engine: generation.engine,
      message:
        generation.engine === 'gemini'
          ? 'Fórmula generada con Gemini.'
          : 'Fórmula generada en modo simulado local.',
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    return next(error);
  }
});

router.get('/history', requireAuth, (req, res) => {
  const items = db
    .prepare(
      `SELECT id, model, prompt, negative_prompt AS negativePrompt, result, engine,
              credits, created_at AS createdAt
       FROM generations WHERE user_id = ? ORDER BY id DESC LIMIT 30`
    )
    .all(req.user.id)
    .map((row) => ({ ...row, previewKey: pickPreviewKey(row.prompt) }));

  return res.json({ items });
});

export default router;
