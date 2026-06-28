import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  postAppointment,
  postWalkin,
  listAppointments,
  patchStatus,
} from '../controllers/appointment.controller';

const router = Router();

router.use(authenticate);

// Walk-in must come before /:id routes
router.post('/walkin', authorize([Role.ADMIN]), postWalkin);

router.post('/', authorize([Role.ADMIN]), postAppointment);
router.get('/', authorize([Role.ADMIN, Role.DOCTOR]), listAppointments);
router.patch('/:id/status', authorize([Role.ADMIN, Role.DOCTOR]), patchStatus);

export default router;
