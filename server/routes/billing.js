import { Router } from 'express';
import { db, publicUser } from '../db.js';
import { requireAuth, optionalAuth } from '../auth.js';
import { PLANS, CREDIT_PACKAGES, findPlan, findPackage } from '../catalog.js';
import { paymentProvider, PaymentError } from '../payments.js';

const router = Router();

router.get('/', optionalAuth, (req, res) => {
  const payments = req.user
    ? db
        .prepare(
          `SELECT id, kind, reference, provider, description, amount_usd AS amountUsd,
                  credits, last4, status, created_at AS createdAt
           FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 20`
        )
        .all(req.user.id)
    : [];

  res.json({
    plans: PLANS,
    packages: CREDIT_PACKAGES,
    currentPlan: req.user?.plan || 'free',
    payments,
  });
});

router.get('/payments', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, kind, reference, provider, description, amount_usd AS amountUsd,
              credits, last4, status, created_at AS createdAt
       FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 50`
    )
    .all(req.user.id);
  res.json({ items: rows });
});

function validateCard(card) {
  if (!card || typeof card !== 'object') {
    return 'Ingresá los datos de la tarjeta para continuar.';
  }
  if (!card.number || !card.holder || !card.expiry || !card.cvv) {
    return 'Completá número, titular, vencimiento y CVV.';
  }
  return null;
}

/** Compra de un paquete de créditos con la pasarela simulada. */
router.post('/credits', requireAuth, async (req, res, next) => {
  try {
    const pkg = findPackage(String(req.body?.packageId || ''));
    if (!pkg) return res.status(400).json({ error: 'Ese paquete de créditos no existe.' });

    const cardError = validateCard(req.body?.card);
    if (cardError) return res.status(400).json({ error: cardError });

    const charge = await paymentProvider.charge({
      amount: pkg.priceUsd,
      description: `Paquete de ${pkg.credits} créditos Sparkhub (${pkg.label})`,
      card: req.body.card,
    });

    const apply = db.transaction(() => {
      db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(
        pkg.credits,
        req.user.id
      );

      const payment = db
        .prepare(
          `INSERT INTO payments
            (user_id, kind, reference, provider, description, amount_usd, credits, last4, status)
           VALUES (?, 'credits', ?, ?, ?, ?, ?, ?, 'paid')`
        )
        .run(
          req.user.id,
          charge.reference,
          charge.provider,
          charge.description,
          pkg.priceUsd,
          pkg.credits,
          charge.last4
        );

      db.prepare(
        `INSERT INTO credit_transactions (user_id, amount, type, description, reference)
         VALUES (?, ?, 'purchase', ?, ?)`
      ).run(
        req.user.id,
        pkg.credits,
        `Compra de ${pkg.credits} créditos (${pkg.label})`,
        charge.reference
      );

      return db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    });

    const user = apply();

    return res.status(201).json({
      message: `Pago aprobado. Sumaste ${pkg.credits} créditos (${charge.brand} •••• ${charge.last4}).`,
      credits: user.credits,
      user: publicUser(user),
      payment: {
        reference: charge.reference,
        brand: charge.brand,
        last4: charge.last4,
        amountUsd: pkg.priceUsd,
        credits: pkg.credits,
      },
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
});

/** Activación de un plan con la pasarela simulada. */
router.post('/plan', requireAuth, async (req, res, next) => {
  try {
    const plan = findPlan(String(req.body?.planId || ''));
    if (!plan) return res.status(400).json({ error: 'Ese plan no existe.' });
    if (plan.id === 'starter') {
      return res.status(400).json({ error: 'El plan Starter no requiere pago ni activación.' });
    }

    const annual = Boolean(req.body?.annual);
    const amount = annual ? plan.annualUsd : plan.monthlyUsd;

    const cardError = validateCard(req.body?.card);
    if (cardError) return res.status(400).json({ error: cardError });

    const charge = await paymentProvider.charge({
      amount,
      description: `Plan ${plan.name} (${annual ? 'anual' : 'mensual'})`,
      card: req.body.card,
    });

    const apply = db.transaction(() => {
      db.prepare('UPDATE users SET plan = ?, credits = credits + ? WHERE id = ?').run(
        plan.id,
        plan.monthlyCredits,
        req.user.id
      );

      db.prepare(
        `INSERT INTO payments
          (user_id, kind, reference, provider, description, amount_usd, credits, last4, status)
         VALUES (?, 'plan', ?, ?, ?, ?, ?, ?, 'paid')`
      ).run(
        req.user.id,
        charge.reference,
        charge.provider,
        charge.description,
        amount,
        plan.monthlyCredits,
        charge.last4
      );

      db.prepare(
        `INSERT INTO credit_transactions (user_id, amount, type, description, reference)
         VALUES (?, ?, 'plan', ?, ?)`
      ).run(
        req.user.id,
        plan.monthlyCredits,
        `Activación del plan ${plan.name}`,
        charge.reference
      );

      return db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    });

    const user = apply();

    return res.status(201).json({
      message: `Plan ${plan.name} activado. Sumaste ${plan.monthlyCredits} créditos.`,
      user: publicUser(user),
      plan,
      payment: {
        reference: charge.reference,
        brand: charge.brand,
        last4: charge.last4,
        amountUsd: amount,
      },
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return res.status(error.status).json({ error: error.message });
    }
    return next(error);
  }
});

export default router;
