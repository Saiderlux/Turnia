import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { prisma } from '../utils/prisma';

const router = Router();

router.use(authenticate);

router.get('/', authorize([Role.ADMIN]), async (_req, res, next) => {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { active: true },
      select: { id: true, name: true, specialty: true, slotDuration: true, avgDuration: true, active: true },
      orderBy: { name: 'asc' },
    });
    res.json(doctors);
  } catch (err) {
    next(err);
  }
});

export default router;
