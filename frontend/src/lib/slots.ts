import type { Appointment } from '../types';
import { formatTime12 } from './status';

export interface Slot {
  iso: string;
  label: string;
  occupied: boolean;
  past: boolean;
}

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 19; // última hora en la que puede comenzar un slot
// Minutos de descanso entre citas — debe coincidir con el backend.
const BUFFER_MINUTES = 10;

/**
 * Genera los slots de un día para un médico. La cadencia es
 * slotDuration + BUFFER_MINUTES (10 min de descanso entre citas), y un slot
 * se marca:
 *  - occupied: si se solapa con una cita existente respetando el descanso
 *  - past: si su hora ya pasó (no se puede agendar en el pasado)
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
  const slotMs = slotDuration * 60_000;
  const bufferMs = BUFFER_MINUTES * 60_000;
  const stepMs = slotMs + bufferMs; // cadencia: cita + descanso
  const now = Date.now();
  const cursor = new Date(year, month - 1, day, DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, DAY_END_HOUR, 0, 0, 0);

  while (cursor.getTime() < dayEnd.getTime()) {
    const startMs = cursor.getTime();
    const endMs = startMs + slotMs;
    // Conflicto si el descanso de 10 min no se respeta a ninguno de los lados.
    const occupied = ranges.some((r) => r.end + bufferMs > startMs && r.start < endMs + bufferMs);
    const iso = cursor.toISOString();
    slots.push({ iso, label: formatTime12(iso), occupied, past: startMs <= now });
    cursor.setTime(startMs + stepMs);
  }

  return slots;
}
