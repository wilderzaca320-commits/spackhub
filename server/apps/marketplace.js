import { Router } from 'express';
import promptRoutes from '../routes/prompts.js';
import categoryRoutes from '../routes/categories.js';
import libraryRoutes from '../routes/library.js';
import billingRoutes from '../routes/billing.js';
import aiRoutes from '../routes/ai.js';
import profileRoutes from '../routes/profile.js';
import creatorRoutes from '../routes/creators.js';
import hireRoutes from '../routes/hires.js';
import companyRoutes from '../routes/company.js';
import cartRoutes from '../routes/cart.js';
import notificationRoutes from '../routes/notifications.js';
import messageRoutes from '../routes/messages.js';
import selectRoutes from '../routes/select.js';
import searchRoutes from '../routes/search.js';
import presenceRoutes from '../routes/presence.js';
import homeRoutes from '../routes/home.js';

/**
 * App de comprador y vendedor (marketplace).
 * Se monta en /api y comparte la sesión con las demás apps.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.json({ app: 'marketplace', roles: ['comprador', 'vendedor'] });
});

router.use('/prompts', promptRoutes);
router.use('/categories', categoryRoutes);
router.use('/library', libraryRoutes);
router.use('/billing', billingRoutes);
router.use('/ai', aiRoutes);
router.use('/profile', profileRoutes);
router.use('/creators', creatorRoutes);
router.use('/hires', hireRoutes);
router.use('/cart', cartRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/select', selectRoutes);
router.use('/search', searchRoutes);
router.use('/presence', presenceRoutes);
router.use('/home', homeRoutes);

// Alias de compatibilidad: la versión oficial de empresa está en /api/business.
router.use('/company', companyRoutes);

export default router;
