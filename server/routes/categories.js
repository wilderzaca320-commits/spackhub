import { Router } from 'express';
import { buildCategoryTree } from '../categoryService.js';

const router = Router();

/** Árbol público: solo categorías activas y contadores reales. */
router.get('/', (_req, res) => {
  res.json({ items: buildCategoryTree() });
});

export default router;
