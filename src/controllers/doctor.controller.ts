import { Request, Response, NextFunction } from 'express';
import {
  listDoctors as listDoctorsService,
  createDoctorWithUser,
  updateSlotDuration,
  setDoctorActive,
} from '../services/doctor.service';
import { BadRequestError } from '../utils/errors';

export async function listDoctors(req: Request, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const doctors = await listDoctorsService(includeInactive);
    return res.json(doctors);
  } catch (err) {
    return next(err);
  }
}

export async function createDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const doctor = await createDoctorWithUser(req.body);
    return res.status(201).json(doctor);
  } catch (err) {
    return next(err);
  }
}

export async function patchDoctor(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { slotDuration } = req.body as { slotDuration?: number };
    if (slotDuration === undefined) {
      return next(new BadRequestError('slotDuration es requerido'));
    }
    const doctor = await updateSlotDuration(id, slotDuration);
    return res.json(doctor);
  } catch (err) {
    return next(err);
  }
}

export async function patchDoctorStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { active } = req.body as { active?: boolean };
    if (typeof active !== 'boolean') {
      return next(new BadRequestError('El campo active (boolean) es requerido'));
    }
    const doctor = await setDoctorActive(id, active);
    return res.json(doctor);
  } catch (err) {
    return next(err);
  }
}
