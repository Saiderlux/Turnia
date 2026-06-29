import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { Prisma, Role, AppointmentStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

interface AvgResult {
  avg_minutes: number | null;
  total: bigint;
}

const doctorSelect = {
  id: true,
  name: true,
  specialty: true,
  slotDuration: true,
  avgDuration: true,
  active: true,
} as const;

const TEMP_PASSWORD = 'turnia2024';
const TITLE_TOKENS = ['dr', 'dra', 'doctor', 'doctora', 'lic'];

function validateSlot(value: unknown): number {
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 5 || slot > 180) {
    throw new BadRequestError('La duración del slot debe ser un entero entre 5 y 180 minutos');
  }
  return slot;
}

/** Deriva el local-part del email: nombre.apellido, sin acentos ni títulos. */
function emailLocalPart(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar acentos (marcas combinantes)
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ') // solo letras y espacios
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !TITLE_TOKENS.includes(w));

  if (words.length === 0) return 'doctor';
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : '';
  return last ? `${first}.${last}` : first;
}

const ACTIVE_FUTURE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.ARRIVED,
  AppointmentStatus.IN_CONSULTATION,
];

/** Cuenta las citas futuras aún activas (programadas/en curso) de un médico. */
async function futureActiveCount(doctorId: string): Promise<number> {
  return prisma.appointment.count({
    where: {
      doctorId,
      status: { in: ACTIVE_FUTURE_STATUSES },
      scheduledAt: { gte: new Date() },
    },
  });
}

/**
 * Lista médicos. Por defecto solo activos (para el selector de nueva cita y
 * la agenda); con includeInactive devuelve todos (panel de gestión). Cada
 * médico incluye su conteo de citas futuras activas.
 */
export async function listDoctors(includeInactive = false) {
  const doctors = await prisma.doctor.findMany({
    where: includeInactive ? {} : { active: true },
    select: doctorSelect,
    orderBy: { name: 'asc' },
  });

  const grouped = await prisma.appointment.groupBy({
    by: ['doctorId'],
    where: {
      status: { in: ACTIVE_FUTURE_STATUSES },
      scheduledAt: { gte: new Date() },
    },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((g) => [g.doctorId, g._count._all]));

  return doctors.map((d) => ({ ...d, futureActiveCount: counts.get(d.id) ?? 0 }));
}

export async function setDoctorActive(id: string, active: boolean) {
  const doctor = await prisma.doctor.findUnique({ where: { id } });
  if (!doctor) throw new NotFoundError('Médico no encontrado');

  const updated = await prisma.doctor.update({
    where: { id },
    data: { active },
    select: doctorSelect,
  });

  // Se devuelve el conteo para que el frontend lo muestre en el modal de baja.
  return { ...updated, futureActiveCount: await futureActiveCount(id) };
}

/**
 * Crea un médico y, en la misma transacción, su usuario con rol DOCTOR.
 * El email se deriva del nombre (nombre.apellido@turnia.com); si colisiona,
 * se le agrega un sufijo numérico. La contraseña temporal es turnia2024.
 */
export async function createDoctorWithUser(input: {
  name?: string;
  specialty?: string;
  slotDuration?: number;
}) {
  const name = input.name?.trim();
  const specialty = input.specialty?.trim();
  if (!name) throw new BadRequestError('El nombre del médico es obligatorio');
  if (!specialty) throw new BadRequestError('La especialidad es obligatoria');

  const slot = input.slotDuration === undefined ? 30 : validateSlot(input.slotDuration);
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  const local = emailLocalPart(name);

  const result = await prisma.$transaction(async (tx) => {
    const doctor = await tx.doctor.create({
      data: { name, specialty, slotDuration: slot },
      select: doctorSelect,
    });

    let email = `${local}@turnia.com`;
    let n = 1;
    while (await tx.user.findUnique({ where: { email } })) {
      n += 1;
      email = `${local}${n}@turnia.com`;
    }

    await tx.user.create({
      data: { name, email, passwordHash, role: Role.DOCTOR, doctorId: doctor.id },
    });

    return { doctor, email };
  });

  // Se devuelve el email generado y la contraseña temporal para mostrarlos
  // una sola vez en el panel; el passwordHash nunca se expone.
  return { ...result.doctor, userEmail: result.email, tempPassword: TEMP_PASSWORD };
}

export async function updateSlotDuration(id: string, slotDuration: unknown) {
  const slot = validateSlot(slotDuration);
  const doctor = await prisma.doctor.findUnique({ where: { id } });
  if (!doctor) throw new NotFoundError('Médico no encontrado');

  return prisma.doctor.update({
    where: { id },
    data: { slotDuration: slot },
    select: doctorSelect,
  });
}

export async function recalculateAvgDuration(doctorId: string): Promise<void> {
  const result = await prisma.$queryRaw<AvgResult[]>(
    Prisma.sql`
      SELECT
        AVG(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60) AS avg_minutes,
        COUNT(*) AS total
      FROM "Appointment"
      WHERE "doctorId" = ${doctorId}
        AND "endedAt" IS NOT NULL
        AND "startedAt" IS NOT NULL
        AND EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60 BETWEEN 5 AND 90
    `
  );

  const row = result[0];
  if (row && Number(row.total) >= 10 && row.avg_minutes !== null) {
    await prisma.doctor.update({
      where: { id: doctorId },
      data: { avgDuration: Math.round(Number(row.avg_minutes)) },
    });
  }
}
