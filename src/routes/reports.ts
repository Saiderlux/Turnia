import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { getDailyReport } from '../controllers/report.controller';

const router = Router();

router.use(authenticate);

router.get('/daily', authorize([Role.ADMIN, Role.DIRECTOR]), getDailyReport);

export default router;
