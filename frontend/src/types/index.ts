export type Role = 'ADMIN' | 'DIRECTOR' | 'DOCTOR';
export type AppointmentType = 'SCHEDULED' | 'WALKIN';
export type AppointmentStatus =
  | 'SCHEDULED'
  | 'WAITING'
  | 'ARRIVED'
  | 'IN_CONSULTATION'
  | 'ATTENDED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  doctorId: string | null;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  slotDuration: number;
  avgDuration: number | null;
  active: boolean;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
}

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  type: AppointmentType;
  status: AppointmentStatus;
  scheduledAt: string | null;
  slotDuration: number;
  checkinAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  doctor: Pick<Doctor, 'id' | 'name' | 'specialty'>;
  patient: Patient;
  createdBy: { id: string; name: string; role: Role };
  cancelledBy: { id: string; name: string; role: Role } | null;
}

export interface DailyReport {
  doctorId: string;
  doctorName: string;
  date: string;
  scheduled: number;
  attended: number;
  cancelled: number;
  noShow: number;
  walkins: number;
  avgRealDuration: number | null;
}
