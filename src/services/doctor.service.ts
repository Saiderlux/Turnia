import { prisma } from '../utils/prisma';
import { Prisma } from '@prisma/client';

interface AvgResult {
  avg_minutes: number | null;
  total: bigint;
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
