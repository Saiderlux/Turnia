import type { Appointment } from '../types';
import { formatTime12 } from './status';

export interface Slot {
  iso: string;
  label: string;
  occupied: boolean;
}

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 19; // última hora en la que puede comenzar un slot

/**
 * Genera los slots de un día para un médico, marcando como
 * ocupados los que se solapan con citas existentes (Prevención
 * de errores: el selector de hora deshabilita lo ocupado).
 * Trabaja en hora local; existing.scheduledAt viene en ISO/UTC.
 */
export function buildDaySlots(
  dateStr: string,
  slotDuration: number,
  existing: Appointment[]
): Slot[] {
  const [year, month, day] = dateStr.split('-').map(Number);
  const active = existing.filter(
    (a) => a.scheduledAt && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW'
  );

  const ranges = active.map((a) => {
    const start = new Date(a.scheduledAt as string).getTime();
    return { start, end: start + a.slotDuration * 60_000 };
  });

  const slots: Slot[] = [];
  const stepMs = slotDuration * 60_000;
  const cursor = new Date(year, month - 1, day, DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, DAY_END_HOUR, 0, 0, 0);

  while (cursor.getTime() < dayEnd.getTime()) {
    const startMs = cursor.getTime();
    const endMs = startMs + stepMs;
    const occupied = ranges.some((r) => r.start < endMs && r.end > startMs);
    const iso = cursor.toISOString();
    slots.push({ iso, label: formatTime12(iso), occupied });
    cursor.setTime(endMs);
  }

  return slots;
}
