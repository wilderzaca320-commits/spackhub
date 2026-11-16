import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { publicUser } from '../db.js';
import companyRoutes from '../routes/company.js';
import hireRoutes from '../routes/hires.js';

/**
 * App de empresario. Se monta en /api/business.
 * La cuenta corporativa se crea desde el registro (accountType=corporate)
 * y la sesión es la misma cookie httpOnly del resto del marketplace.
 */
const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const account = publicUser(req.user);
  res.json({
    app: 'business',
    roles: ['empresario'],
    accountType: account.accountType,
    activeRole: account.activeRole,
  });
});

router.use('/company', companyRoutes);
router.use('/hires', hireRoutes);

export default router;
