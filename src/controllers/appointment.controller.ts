import { Request, Response, NextFunction } from 'express';
import { AppointmentStatus } from '@prisma/client';
import {
  createAppointment,
  createWalkin,
  getAppointments,
  updateAppointmentStatus,
} from '../services/appointment.service';
import { BadRequestError } from '../utils/errors';

export async function postAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const { doctorId, patientId, scheduledAt } = req.body as {
      doctorId: string;
      patientId: string;
      scheduledAt: string;
    };

    if (!doctorId || !patientId || !scheduledAt) {
      return next(new BadRequestError('doctorId, patientId y scheduledAt son requeridos'));
    }

    const appointment = await createAppointment(
      doctorId,
      patientId,
      new Date(scheduledAt),
      req.user!.id
    );

    return res.status(201).json(appointment);
  } catch (err) {
    return next(err);
  }
}

export async function postWalkin(req: Request, res: Response, next: NextFunction) {
  try {
    const { doctorId, patientId } = req.body as { doctorId: string; patientId: string };

    if (!doctorId || !patientId) {
      return next(new BadRequestError('doctorId y patientId son requeridos'));
    }

    const appointment = await createWalkin(doctorId, patientId, req.user!.id);
    return res.status(201).json(appointment);
  } catch (err) {
    return next(err);
  }
}

export async function listAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const { doctorId, date } = req.query as { doctorId: string; date: string };

    if (!doctorId || !date) {
      return next(new BadRequestError('doctorId y date son requeridos'));
    }

    const appointments = await getAppointments(doctorId, date, req.user!);
    return res.json(appointments);
  } catch (err) {
    return next(err);
  }
}

export async function patchStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { status, reason } = req.body as { status: string; reason?: string };

    if (!status) {
      return next(new BadRequestError('status es requerido'));
    }

    const validStatuses = Object.values(AppointmentStatus) as string[];
    if (!validStatuses.includes(status)) {
      return next(new BadRequestError(`Estado inválido: ${status}`));
    }

    const updated = await updateAppointmentStatus(
      id,
      status as AppointmentStatus,
      reason,
      req.user!
    );
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
}
