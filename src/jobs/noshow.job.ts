import cron from 'node-cron';
import { AppointmentStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';

export function startNoshowJob() {
  cron.schedule('* * * * *', async () => {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);

    const citas = await prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.SCHEDULED,
        scheduledAt: { lt: cutoff },
      },
    });

    for (const cita of citas) {
      await prisma.appointment.update({
        where: { id: cita.id },
        data: { status: AppointmentStatus.NO_SHOW },
      });
      await prisma.appointmentEvent.create({
        data: {
          appointmentId: cita.id,
          changedById: null,
          fromStatus: AppointmentStatus.SCHEDULED,
          toStatus: AppointmentStatus.NO_SHOW,
          reason: 'Marcado automáticamente por inasistencia',
        },
      });
    }

    if (citas.length > 0) {
      console.log(`[noshow-job] ${citas.length} cita(s) marcadas como NO_SHOW`);
    }
  });
}
