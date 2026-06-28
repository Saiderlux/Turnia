import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const doctorHash = await bcrypt.hash('doctor123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinica.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@clinica.com',
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });

  const doctorsData = [
    { name: 'Dr. Carlos Méndez', specialty: 'Medicina General' },
    { name: 'Dra. Ana López', specialty: 'Pediatría' },
    { name: 'Dr. Roberto García', specialty: 'Cardiología' },
    { name: 'Dra. María Fernández', specialty: 'Dermatología' },
    { name: 'Dr. Luis Martínez', specialty: 'Traumatología' },
    { name: 'Dra. Elena Rodríguez', specialty: 'Ginecología' },
    { name: 'Dr. Jorge Sánchez', specialty: 'Oftalmología' },
    { name: 'Dra. Patricia Torres', specialty: 'Neurología' },
  ];

  await prisma.doctor.deleteMany({});
  const doctors = await Promise.all(
    doctorsData.map((d) => prisma.doctor.create({ data: d }))
  );

  const firstDoctor = doctors[0];

  await prisma.user.upsert({
    where: { email: 'dr.mendez@clinica.com' },
    update: { doctorId: firstDoctor.id },
    create: {
      name: firstDoctor.name,
      email: 'dr.mendez@clinica.com',
      passwordHash: doctorHash,
      role: Role.DOCTOR,
      doctorId: firstDoctor.id,
    },
  });

  await prisma.patient.deleteMany({});
  await prisma.patient.createMany({
    data: [
      { name: 'Juan Pérez', phone: '555-0001', email: 'juan.perez@email.com' },
      { name: 'María González', phone: '555-0002', email: 'maria.g@email.com' },
      { name: 'Carlos Ruiz', phone: '555-0003', notes: 'Alérgico a la penicilina' },
    ],
  });

  console.log('Seed completado:');
  console.log(`  Admin: ${admin.email} / admin123`);
  console.log(`  Doctor: dr.mendez@clinica.com / doctor123 (${firstDoctor.name})`);
  console.log(`  ${doctors.length} médicos, 3 pacientes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
