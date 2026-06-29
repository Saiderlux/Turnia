import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  listPatients,
  createPatient,
  updatePatient,
  deletePatient,
} from '../controllers/patient.controller';

const router = Router();

router.use(authenticate);

router.get('/', authorize([Role.ADMIN]), listPatients);
router.post('/', authorize([Role.ADMIN]), createPatient);
router.patch('/:id', authorize([Role.ADMIN]), updatePatient);
router.delete('/:id', authorize([Role.ADMIN]), deletePatient);

export default router;
