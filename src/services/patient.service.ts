import { prisma } from '../utils/prisma';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors';
import { stripTags } from '../utils/sanitize';

const patientSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  notes: true,
} as const;

export async function listPatients(search?: string) {
  const term = search?.trim();
  const where = term
    ? {
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          { phone: { contains: term } },
        ],
      }
    : {};

  return prisma.patient.findMany({
    where,
    select: patientSelect,
    orderBy: { name: 'asc' },
  });
}

export async function createPatient(input: {
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}) {
  const name = input.name?.trim();
  const phone = input.phone?.trim();

  if (!name) throw new BadRequestError('El nombre del paciente es obligatorio');
  if (!phone) throw new BadRequestError('El teléfono del paciente es obligatorio');

  return prisma.patient.create({
    data: {
      name,
      phone,
      email: input.email?.trim() || null,
      notes: input.notes ? stripTags(input.notes) : null,
    },
    select: patientSelect,
  });
}

export async function updatePatient(
  id: string,
  input: { name?: string; phone?: string; email?: string; notes?: string }
) {
  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Paciente no encontrado');

  const name = input.name?.trim();
  const phone = input.phone?.trim();
  if (!name) throw new BadRequestError('El nombre del paciente es obligatorio');
  if (!phone) throw new BadRequestError('El teléfono del paciente es obligatorio');

  // Los datos del paciente son independientes del estado de sus citas:
  // se permite editar aunque tenga citas futuras activas.
  return prisma.patient.update({
    where: { id },
    data: {
      name,
      phone,
      email: input.email?.trim() || null,
      notes: input.notes ? stripTags(input.notes) : null,
    },
    select: patientSelect,
  });
}

export async function deletePatient(id: string) {
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) throw new NotFoundError('Paciente no encontrado');

  // Solo se permite el borrado físico si no hay ninguna cita asociada
  // (histórica o futura); de lo contrario se conserva por trazabilidad.
  const appointments = await prisma.appointment.count({ where: { patientId: id } });
  if (appointments > 0) {
    throw new ConflictError(
      `No se puede eliminar a ${patient.name} porque tiene citas registradas. ` +
        'Si el paciente ya no es activo, sus datos se conservan por trazabilidad.'
    );
  }

  await prisma.patient.delete({ where: { id } });
  return { id };
}
