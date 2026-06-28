import { Request, Response, NextFunction } from 'express';
import { AppointmentStatus, AppointmentType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { BadRequestError } from '../utils/errors';

export async function getDailyReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, doctorId } = req.query as { date: string; doctorId?: string };

    if (!date) {
      return next(new BadRequestError('date es requerido (YYYY-MM-DD)'));
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const doctors = doctorId
      ? await prisma.doctor.findMany({ where: { id: doctorId } })
      : await prisma.doctor.findMany({ where: { active: true } });

    const reports = await Promise.all(
      doctors.map(async (doctor) => {
        // Count events by toStatus for this doctor on this date
        const events = await prisma.appointmentEvent.findMany({
          where: {
            createdAt: { gte: dayStart, lte: dayEnd },
            appointment: { doctorId: doctor.id },
          },
        });

        const counts = events.reduce(
          (acc, e) => {
            acc[e.toStatus] = (acc[e.toStatus] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        // avgRealDuration: appointments with both timestamps, ended on this date
        const attended = await prisma.appointment.findMany({
          where: {
            doctorId: doctor.id,
            endedAt: { gte: dayStart, lte: dayEnd },
            startedAt: { not: null },
          },
        });

        let avgRealDuration: number | null = null;
        if (attended.length > 0) {
          const durations = attended
            .filter((a) => a.startedAt && a.endedAt)
            .map((a) => (a.endedAt!.getTime() - a.startedAt!.getTime()) / 60000);

          if (durations.length > 0) {
            avgRealDuration = Math.round(
              durations.reduce((sum, d) => sum + d, 0) / durations.length
            );
          }
        }

        // walkins: events where toStatus = WAITING (initial creation of walk-in)
        // but we also need the appointment type to be WALKIN
        const walkinEvents = await prisma.appointmentEvent.findMany({
          where: {
            createdAt: { gte: dayStart, lte: dayEnd },
            toStatus: AppointmentStatus.WAITING,
            appointment: { doctorId: doctor.id, type: AppointmentType.WALKIN },
            fromStatus: null,
          },
        });

        return {
          doctorId: doctor.id,
          doctorName: doctor.name,
          date,
          scheduled: counts[AppointmentStatus.SCHEDULED] ?? 0,
          attended: counts[AppointmentStatus.ATTENDED] ?? 0,
          cancelled: counts[AppointmentStatus.CANCELLED] ?? 0,
          noShow: counts[AppointmentStatus.NO_SHOW] ?? 0,
          walkins: walkinEvents.length,
          avgRealDuration,
        };
      })
    );

    return res.json(doctorId ? reports[0] ?? null : reports);
  } catch (err) {
    return next(err);
  }
}
