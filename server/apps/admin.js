import { Router } from 'express';
import adminRoutes from '../routes/admin.js';
import adminCategoryRoutes from '../routes/adminCategories.js';

/**
 * App de administración. Se monta en /api/admin.
 * Todas las rutas exigen sesión con role='admin'.
 */
const router = Router();

router.use('/categories', adminCategoryRoutes);
router.use('/', adminRoutes);

export default router;
