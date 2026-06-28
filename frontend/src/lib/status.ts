import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AppointmentStatus } from '../types';

/* ============================================================
   STATUS_CONFIG — única fuente de verdad para color y label
   de estado en todo el frontend. No duplicar en otro lugar.
   ============================================================ */
export interface StatusEntry {
  label: string;
  color: string;
  bg: string;
}

export const STATUS_CONFIG: Record<AppointmentStatus, StatusEntry> = {
  SCHEDULED: { label: 'Programada', color: 'var(--border)', bg: 'transparent' },
  WAITING: { label: 'En espera', color: '#8B5CF6', bg: '#F5F3FF' },
  ARRIVED: { label: 'Llegó', color: '#3B82F6', bg: '#EFF6FF' },
  IN_CONSULTATION: { label: 'En consulta', color: 'var(--accent)', bg: 'var(--accent-light)' },
  ATTENDED: { label: 'Atendida', color: 'var(--text-muted)', bg: 'var(--surface)' },
  CANCELLED: { label: 'Cancelada', color: 'var(--danger)', bg: 'var(--danger-light)' },
  NO_SHOW: { label: 'No se presentó', color: 'var(--warning)', bg: 'var(--warning-light)' },
};

/* ============================================================
   Transiciones válidas — refleja la máquina de estados del
   backend (appointment.service.ts). Determina qué botones de
   acción se muestran según el estado actual.
   ============================================================ */
export const VALID_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  SCHEDULED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  WAITING: ['IN_CONSULTATION', 'CANCELLED'],
  ARRIVED: ['IN_CONSULTATION', 'CANCELLED'],
  IN_CONSULTATION: ['ATTENDED', 'CANCELLED'],
  ATTENDED: [],
  CANCELLED: [],
  NO_SHOW: ['SCHEDULED'],
};

export function getValidTransitions(status: AppointmentStatus): AppointmentStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}

/* ============================================================
   ACTION_CONFIG — cada transición tiene un label exacto de lo
   que va a pasar (Control y libertad). No un genérico
   "cambiar estado". El variant mapea a clases de botón.
   ============================================================ */
export type ActionVariant = 'primary' | 'danger-outline' | 'ghost';

export interface ActionEntry {
  label: string;
  variant: ActionVariant;
}

export const ACTION_CONFIG: Record<AppointmentStatus, ActionEntry> = {
  ARRIVED: { label: 'Registrar llegada', variant: 'primary' },
  IN_CONSULTATION: { label: 'Iniciar consulta', variant: 'primary' },
  ATTENDED: { label: 'Marcar atendida', variant: 'primary' },
  CANCELLED: { label: 'Cancelar cita', variant: 'danger-outline' },
  NO_SHOW: { label: 'No se presentó', variant: 'ghost' },
  SCHEDULED: { label: 'Revertir a programada', variant: 'ghost' },
  WAITING: { label: 'En espera', variant: 'ghost' },
};

/* ============================================================
   Helpers de formato — mundo real: 12h AM/PM y fechas en
   español. No exponer enums ni ISO al usuario.
   ============================================================ */
export function formatTime12(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const time = format(d, 'h:mm');
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  return `${time} ${ampm}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Hoy, lunes 28 de junio" o "Miércoles 1 de julio" */
export function formatLongDate(date: Date): string {
  const long = capitalize(format(date, "EEEE d 'de' MMMM", { locale: es }));
  return isToday(date) ? `Hoy, ${long.charAt(0).toLowerCase()}${long.slice(1)}` : long;
}

/** "lun 28" — etiqueta corta para el selector de semana */
export function formatWeekday(date: Date): { weekday: string; day: string } {
  return {
    weekday: capitalize(format(date, 'EEE', { locale: es })).replace('.', ''),
    day: format(date, 'd'),
  };
}
