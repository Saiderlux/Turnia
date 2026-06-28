import type { Appointment, AppointmentStatus, Role } from '../types';
import { AppointmentRow } from './AppointmentRow';
import { EmptyState } from './EmptyState';

interface Props {
  appointments: Appointment[];
  userRole: Role;
  loading: boolean;
  onAction: (id: string, status: AppointmentStatus, reason?: string) => Promise<void>;
}

const CalendarIcon = (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </svg>
);

function summarize(appts: Appointment[]) {
  const scheduled = appts.filter((a) => a.type === 'SCHEDULED');
  const count = (s: AppointmentStatus) => scheduled.filter((a) => a.status === s).length;
  return {
    programadas: count('SCHEDULED'),
    llegaron: count('ARRIVED'),
    enConsulta: count('IN_CONSULTATION'),
    atendidas: count('ATTENDED'),
    noShow: count('NO_SHOW'),
  };
}

export function AgendaBoard({ appointments, userRole, loading, onAction }: Props) {
  const scheduled = appointments.filter((a) => a.type === 'SCHEDULED');
  const walkins = appointments.filter((a) => a.type === 'WALKIN');
  const s = summarize(appointments);

  const summaryParts = [
    `${s.programadas} programadas`,
    `${s.llegaron} llegaron`,
    `${s.enConsulta} en consulta`,
    `${s.atendidas} atendidas`,
    `${s.noShow} no se presentaron`,
  ];

  return (
    <div>
      <div className="t-14 muted" style={{ marginBottom: '20px' }}>
        {summaryParts.join('  ·  ')}
      </div>

      {/* Citas programadas */}
      <section style={{ marginBottom: '32px' }}>
        <SectionTitle>Citas</SectionTitle>
        {loading && scheduled.length === 0 ? (
          <p className="t-14 muted" style={{ padding: '8px 0' }}>Cargando…</p>
        ) : scheduled.length === 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title="Sin citas programadas"
            description="No hay citas agendadas para este día."
          />
        ) : (
          <div className="appt-list">
            {scheduled.map((a) => (
              <AppointmentRow key={a.id} appointment={a} userRole={userRole} onAction={onAction} />
            ))}
          </div>
        )}
      </section>

      {/* Cola de walk-ins separada */}
      <section>
        <SectionTitle>
          En espera <span className="muted w-400">· walk-ins</span>
        </SectionTitle>
        {walkins.length === 0 ? (
          <p className="t-14 muted" style={{ padding: '8px 0' }}>
            Sin pacientes en espera.
          </p>
        ) : (
          <div className="appt-list">
            {walkins.map((a) => (
              <AppointmentRow key={a.id} appointment={a} userRole={userRole} onAction={onAction} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="t-12 w-600" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '10px' }}>
      {children}
    </h2>
  );
}
