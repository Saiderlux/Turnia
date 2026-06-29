import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  listDoctors,
  createDoctor,
  patchDoctor,
  patchDoctorStatus,
} from '../controllers/doctor.controller';

const router = Router();

router.use(authenticate);

router.get('/', authorize([Role.ADMIN]), listDoctors);
router.post('/', authorize([Role.ADMIN]), createDoctor);
router.patch('/:id/status', authorize([Role.ADMIN]), patchDoctorStatus);
router.patch('/:id', authorize([Role.ADMIN]), patchDoctor);

export default router;
