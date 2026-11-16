import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { createNotification } from '../notify.js';

const router = Router();

class CartError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

router.use(requireAuth);

function cartRows(userId) {
  return db
    .prepare(
      `SELECT p.id, p.title, p.price, p.model, p.preview_images AS previewImages,
              p.rating, p.sales_count AS salesCount, u.name AS sellerName,
              ci.created_at AS addedAt
       FROM cart_items ci
       JOIN prompts p ON p.id = ci.prompt_id
       JOIN users u ON u.id = p.seller_id
       WHERE ci.user_id = ? AND p.status = 'approved'
       ORDER BY ci.id ASC`
    )
    .all(userId)
    .map((row) => ({
      ...row,
      previewImages: JSON.parse(row.previewImages || '[]'),
    }));
}

function cartSummary(userId) {
  const items = cartRows(userId);
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
  return { items, total, credits: user?.credits ?? 0, count: items.length };
}

router.get('/', (req, res) => {
  res.json(cartSummary(req.user.id));
});

router.post('/', (req, res) => {
  const promptId = Number(req.body?.promptId);
  if (!promptId) return res.status(400).json({ error: 'Indicá qué fórmula querés agregar.' });

  const prompt = db
    .prepare("SELECT id, seller_id AS sellerId, title, status FROM prompts WHERE id = ?")
    .get(promptId);
  if (!prompt || prompt.status !== 'approved') {
    return res.status(404).json({ error: 'Esa fórmula no está disponible.' });
  }
  if (prompt.sellerId === req.user.id) {
    return res.status(400).json({ error: 'No podés agregar tu propia fórmula al carrito.' });
  }

  const owned = db
    .prepare('SELECT 1 FROM orders WHERE buyer_id = ? AND prompt_id = ?')
    .get(req.user.id, promptId);
  if (owned) {
    return res.status(409).json({ error: 'Ya compraste esta fórmula. Está en tu biblioteca.' });
  }

  db.prepare('INSERT OR IGNORE INTO cart_items (user_id, prompt_id) VALUES (?, ?)').run(
    req.user.id,
    promptId
  );

  res.status(201).json({
    ...cartSummary(req.user.id),
    message: `"${prompt.title}" se agregó al carrito.`,
  });
});

router.delete('/:promptId', (req, res) => {
  const promptId = Number(req.params.promptId);
  const info = db
    .prepare('DELETE FROM cart_items WHERE user_id = ? AND prompt_id = ?')
    .run(req.user.id, promptId);
  if (!info.changes) return res.status(404).json({ error: 'Esa fórmula no está en tu carrito.' });
  res.json({ ...cartSummary(req.user.id), message: 'Fórmula quitada del carrito.' });
});

router.post('/checkout', (req, res, next) => {
  try {
    const checkout = db.transaction((buyerId) => {
      const items = cartRows(buyerId);
      if (!items.length) throw new CartError(400, 'Tu carrito está vacío.');

      const buyer = db.prepare('SELECT * FROM users WHERE id = ?').get(buyerId);
      const total = items.reduce((sum, item) => sum + item.price, 0);
      if (buyer.credits < total) {
        throw new CartError(
          400,
          `Te faltan ${total - buyer.credits} créditos para pagar el carrito.`
        );
      }

      const purchased = [];
      const skipped = [];

      for (const item of items) {
        const prompt = db.prepare('SELECT * FROM prompts WHERE id = ?').get(item.id);
        if (!prompt || prompt.status !== 'approved' || prompt.seller_id === buyerId) {
          skipped.push({ id: item.id, title: item.title });
          continue;
        }
        if (
          db
            .prepare('SELECT 1 FROM orders WHERE buyer_id = ? AND prompt_id = ?')
            .get(buyerId, prompt.id)
        ) {
          skipped.push({ id: item.id, title: item.title });
          continue;
        }

        const amount = prompt.price;
        const sellerEarning = Math.floor(amount * 0.9);
        const platformFee = amount - sellerEarning;

        db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(amount, buyerId);
        db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(
          sellerEarning,
          prompt.seller_id
        );

        const orderInfo = db
          .prepare(
            `INSERT INTO orders (buyer_id, prompt_id, amount, seller_earning, platform_fee)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(buyerId, prompt.id, amount, sellerEarning, platformFee);

        db.prepare('INSERT INTO library (user_id, prompt_id, order_id) VALUES (?, ?, ?)').run(
          buyerId,
          prompt.id,
          orderInfo.lastInsertRowid
        );
        db.prepare('UPDATE prompts SET sales_count = sales_count + 1 WHERE id = ?').run(prompt.id);

        db.prepare(
          `INSERT INTO credit_transactions (user_id, amount, type, description, reference)
           VALUES (?, ?, 'purchase', ?, ?)`
        ).run(buyerId, -amount, `Compra de "${prompt.title}"`, `prompt:${prompt.id}`);

        db.prepare(
          `INSERT INTO credit_transactions (user_id, amount, type, description, reference)
           VALUES (?, ?, 'sale', ?, ?)`
        ).run(
          prompt.seller_id,
          sellerEarning,
          `Venta de "${prompt.title}" (90%)`,
          `prompt:${prompt.id}`
        );

        createNotification(
          buyerId,
          'compra',
          'Compra realizada',
          `Compraste "${prompt.title}" por ${amount} créditos.`,
          `/prompt/${prompt.id}`
        );
        createNotification(
          prompt.seller_id,
          'venta',
          'Nueva venta',
          `Vendiste "${prompt.title}" y recibiste ${sellerEarning} créditos.`,
          `/prompt/${prompt.id}`
        );

        purchased.push({ id: prompt.id, title: prompt.title, amount });
        db.prepare('DELETE FROM cart_items WHERE user_id = ? AND prompt_id = ?').run(
          buyerId,
          prompt.id
        );
      }

      for (const item of skipped) {
        db.prepare('DELETE FROM cart_items WHERE user_id = ? AND prompt_id = ?').run(
          buyerId,
          item.id
        );
      }

      const updatedBuyer = db.prepare('SELECT credits FROM users WHERE id = ?').get(buyerId);

      return {
        purchased,
        skipped,
        total: purchased.reduce((sum, item) => sum + item.amount, 0),
        credits: updatedBuyer.credits,
      };
    });

    const result = checkout(req.user.id);
    res.status(201).json({
      ...result,
      ...cartSummary(req.user.id),
      message:
        result.purchased.length === 1
          ? 'Compra realizada. La fórmula ya está en tu biblioteca.'
          : `${result.purchased.length} fórmulas compradas. Ya están en tu biblioteca.`,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
