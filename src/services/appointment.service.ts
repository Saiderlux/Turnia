import { AppointmentStatus, AppointmentType, Role } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ConflictError, NotFoundError, ValidationError, BadRequestError, ForbiddenError } from '../utils/errors';
import { recalculateAvgDuration } from './doctor.service';
import { format } from 'date-fns';

// Minutos de descanso obligatorios entre citas consecutivas de un mismo médico.
const BUFFER_MINUTES = 10;
const BUFFER_MS = BUFFER_MINUTES * 60 * 1000;

type Transitions = Partial<Record<AppointmentStatus, AppointmentStatus[]>>;

const TRANSITIONS: Transitions = {
  [AppointmentStatus.SCHEDULED]: [
    AppointmentStatus.ARRIVED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.WAITING]: [
    AppointmentStatus.IN_CONSULTATION,
    AppointmentStatus.CANCELLED,
  ],
  [AppointmentStatus.ARRIVED]: [
    AppointmentStatus.IN_CONSULTATION,
    AppointmentStatus.CANCELLED,
  ],
  [AppointmentStatus.IN_CONSULTATION]: [
    AppointmentStatus.ATTENDED,
    AppointmentStatus.CANCELLED,
  ],
  [AppointmentStatus.ATTENDED]: [],
  [AppointmentStatus.CANCELLED]: [],
  [AppointmentStatus.NO_SHOW]: [AppointmentStatus.SCHEDULED],
};

function isValidTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

// Etiquetas en español del dominio — equivalente al STATUS_CONFIG del frontend.
// Se usan para construir mensajes de error legibles (no exponer enums al usuario).
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.SCHEDULED]: 'Programada',
  [AppointmentStatus.WAITING]: 'En espera',
  [AppointmentStatus.ARRIVED]: 'Llegó',
  [AppointmentStatus.IN_CONSULTATION]: 'En consulta',
  [AppointmentStatus.ATTENDED]: 'Atendida',
  [AppointmentStatus.CANCELLED]: 'Cancelada',
  [AppointmentStatus.NO_SHOW]: 'No se presentó',
};

export async function createAppointment(
  doctorId: string,
  patientId: string,
  scheduledAt: Date,
  createdById: string
) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) throw new NotFoundError('Médico no encontrado');

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundError('Paciente no encontrado');

  // No se permite agendar en una fecha u hora ya pasada.
  if (scheduledAt.getTime() < Date.now()) {
    throw new BadRequestError('No se puede agendar una cita en una fecha u hora pasada.');
  }

  const slotEnd = new Date(scheduledAt.getTime() + doctor.slotDuration * 60 * 1000);
  // Ventana amplia alrededor del nuevo slot para traer posibles conflictos.
  const windowStart = new Date(scheduledAt.getTime() - 4 * 60 * 60 * 1000);
  const windowEnd = new Date(slotEnd.getTime() + 4 * 60 * 60 * 1000);

  const nearby = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      scheduledAt: { not: null, gte: windowStart, lte: windowEnd },
    },
  });

  // Dos citas deben tener al menos BUFFER_MINUTES entre el fin de una y el inicio
  // de la otra: el médico no atiende back-to-back.
  const conflicts = nearby.filter((a) => {
    const aStart = a.scheduledAt!.getTime();
    const aEnd = aStart + a.slotDuration * 60 * 1000;
    return aEnd + BUFFER_MS > scheduledAt.getTime() && aStart < slotEnd.getTime() + BUFFER_MS;
  });

  if (conflicts.length > 0) {
    const conflictTime = format(conflicts[0].scheduledAt!, 'h:mm a');
    throw new ConflictError(
      `${doctor.name} ya tiene una cita a las ${conflictTime}. ` +
        `Se requieren ${BUFFER_MINUTES} minutos entre citas; elige otro horario.`
    );
  }

  const appointment = await prisma.appointment.create({
    data: {
      doctorId,
      patientId,
      createdById,
      type: AppointmentType.SCHEDULED,
      status: AppointmentStatus.SCHEDULED,
      scheduledAt,
      slotDuration: doctor.slotDuration,
    },
    include: {
      doctor: { select: { id: true, name: true, specialty: true } },
      patient: true,
      createdBy: { select: { id: true, name: true, role: true } },
    },
  });

  await prisma.appointmentEvent.create({
    data: {
      appointmentId: appointment.id,
      changedById: createdById,
      fromStatus: null,
      toStatus: AppointmentStatus.SCHEDULED,
    },
  });

  return appointment;
}

export async function createWalkin(
  doctorId: string,
  patientId: string,
  createdById: string
) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) throw new NotFoundError('Médico no encontrado');

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new NotFoundError('Paciente no encontrado');

  const appointment = await prisma.appointment.create({
    data: {
      doctorId,
      patientId,
      createdById,
      type: AppointmentType.WALKIN,
      status: AppointmentStatus.WAITING,
      scheduledAt: null,
      slotDuration: doctor.slotDuration,
    },
    include: {
      doctor: { select: { id: true, name: true, specialty: true } },
      patient: true,
      createdBy: { select: { id: true, name: true, role: true } },
    },
  });

  await prisma.appointmentEvent.create({
    data: {
      appointmentId: appointment.id,
      changedById: createdById,
      fromStatus: null,
      toStatus: AppointmentStatus.WAITING,
    },
  });

  return appointment;
}

export async function getAppointments(
  doctorId: string,
  date: string,
  requestingUser: { id: string; role: Role; doctorId?: string | null }
) {
  if (requestingUser.role === Role.DOCTOR && requestingUser.doctorId !== doctorId) {
    throw new ForbiddenError('Solo puedes ver tu propia agenda');
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      OR: [
        { scheduledAt: { gte: dayStart, lte: dayEnd } },
        {
          type: AppointmentType.WALKIN,
          scheduledAt: null,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      ],
    },
    include: {
      doctor: { select: { id: true, name: true, specialty: true } },
      patient: true,
      createdBy: { select: { id: true, name: true, role: true } },
      cancelledBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: [
      { scheduledAt: 'asc' },
    ],
  });

  // Walk-ins (no scheduledAt) go last
  const scheduled = appointments.filter((a) => a.scheduledAt !== null);
  const walkins = appointments.filter((a) => a.scheduledAt === null);

  return [...scheduled, ...walkins];
}

export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: AppointmentStatus,
  reason: string | undefined,
  requestingUser: { id: string; role: Role; doctorId?: string | null }
) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) throw new NotFoundError('Cita no encontrada');

  // El doctor solo puede operar sobre citas de su propia agenda (object-level auth)
  if (requestingUser.role === Role.DOCTOR && appointment.doctorId !== requestingUser.doctorId) {
    throw new ForbiddenError('Solo puedes modificar citas de tu propia agenda');
  }

  if (requestingUser.role === Role.DOCTOR && newStatus !== AppointmentStatus.CANCELLED) {
    throw new ForbiddenError('Los médicos solo pueden cancelar citas');
  }

  // La reversión de un no-show es una corrección manual reservada al admin
  if (
    appointment.status === AppointmentStatus.NO_SHOW &&
    newStatus === AppointmentStatus.SCHEDULED &&
    requestingUser.role !== Role.ADMIN
  ) {
    throw new ForbiddenError('Solo un administrador puede revertir un no-show');
  }

  if (!isValidTransition(appointment.status, newStatus)) {
    const fromLabel = STATUS_LABELS[appointment.status];
    const toLabel = STATUS_LABELS[newStatus];
    const isTerminal = (TRANSITIONS[appointment.status] ?? []).length === 0;
    throw new ValidationError(
      isTerminal
        ? `Esta cita ya está "${fromLabel}" y no puede modificarse.`
        : `No se puede cambiar una cita de "${fromLabel}" a "${toLabel}".`
    );
  }

  if (newStatus === AppointmentStatus.CANCELLED && !reason?.trim()) {
    throw new BadRequestError('Se requiere una razón para cancelar la cita');
  }

  const now = new Date();
  const updateData: Record<string, unknown> = { status: newStatus };

  if (newStatus === AppointmentStatus.ARRIVED) updateData.checkinAt = now;
  if (newStatus === AppointmentStatus.IN_CONSULTATION) updateData.startedAt = now;
  if (newStatus === AppointmentStatus.ATTENDED) updateData.endedAt = now;
  if (newStatus === AppointmentStatus.CANCELLED) {
    updateData.cancelledAt = now;
    updateData.cancelledById = requestingUser.id;
    updateData.cancelReason = reason;
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: updateData,
    include: {
      doctor: { select: { id: true, name: true, specialty: true } },
      patient: true,
      createdBy: { select: { id: true, name: true, role: true } },
      cancelledBy: { select: { id: true, name: true, role: true } },
    },
  });

  await prisma.appointmentEvent.create({
    data: {
      appointmentId,
      changedById: requestingUser.id,
      fromStatus: appointment.status,
      toStatus: newStatus,
      reason: reason ?? null,
    },
  });

  if (newStatus === AppointmentStatus.ATTENDED) {
    await recalculateAvgDuration(appointment.doctorId).catch((err) =>
      console.error('[avg-duration] Error recalculating:', err)
    );
  }

  return updated;
}
