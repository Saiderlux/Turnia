import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { prisma } from '../utils/prisma';

const router = Router();

router.use(authenticate);

router.get('/', authorize([Role.ADMIN]), async (_req, res, next) => {
  try {
    const patients = await prisma.patient.findMany({
      select: { id: true, name: true, phone: true, email: true, notes: true },
      orderBy: { name: 'asc' },
    });
    res.json(patients);
  } catch (err) {
    next(err);
  }
});

export default router;
