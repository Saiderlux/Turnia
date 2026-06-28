import { useState } from 'react';
import type { Appointment, AppointmentStatus, Role } from '../types';
import { StatusChip } from './StatusChip';
import { CancelModal } from './CancelModal';
import {
  STATUS_CONFIG,
  ACTION_CONFIG,
  getValidTransitions,
  formatTime12,
  type ActionVariant,
} from '../lib/status';

interface Props {
  appointment: Appointment;
  userRole: Role;
  onAction: (id: string, status: AppointmentStatus, reason?: string) => Promise<void>;
}

const VARIANT_CLASS: Record<ActionVariant, string> = {
  primary: 'btn-primary',
  'danger-outline': 'btn-danger-outline',
  ghost: 'btn-ghost',
};

/**
 * El elemento signature del sistema. La barra lateral de color
 * (3px) es el indicador primario de estado; el chip lo confirma
 * en lenguaje humano. Los botones de acción son contextuales:
 * solo los válidos para el estado actual, con label exacto.
 */
export function AppointmentRow({ appointment, userRole, onAction }: Props) {
  const [showCancel, setShowCancel] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<AppointmentStatus | null>(null);

  const { status, type, patient, scheduledAt } = appointment;
  const barColor = STATUS_CONFIG[status].color;
  const isActive = status === 'IN_CONSULTATION';
  const isCancelled = status === 'CANCELLED';

  // El doctor solo puede cancelar; el admin ejecuta todas las transiciones.
  let transitions = getValidTransitions(status);
  if (userRole === 'DOCTOR') {
    transitions = transitions.filter((t) => t === 'CANCELLED');
  }

  async function handleAction(target: AppointmentStatus) {
    if (target === 'CANCELLED') {
      setShowCancel(true);
      return;
    }
    setError('');
    setBusy(target);
    try {
      await onAction(appointment.id, target);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'No se pudo actualizar la cita.';
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className={`appt-row${isActive ? ' is-active' : ''}`}>
        <div className="appt-bar" style={{ background: barColor }} aria-hidden />

        <div className={`appt-time mono${scheduledAt ? '' : ' is-empty'}`}>
          {scheduledAt ? formatTime12(scheduledAt) : '—'}
        </div>

        <div className="appt-patient">
          <div className={`appt-patient-name${isCancelled ? ' is-cancelled' : ''}`}>
            {patient.name}
          </div>
          <div className="appt-meta">
            {type === 'WALKIN' && <span style={{ color: '#8B5CF6' }}>Walk-in · </span>}
            {patient.phone}
            {appointment.cancelReason && ` · Razón: ${appointment.cancelReason}`}
          </div>
        </div>

        <div className="appt-chip-col">
          <StatusChip status={status} />
        </div>

        <div className="appt-actions">
          {error ? (
            <span className="t-12" style={{ color: 'var(--danger)', alignSelf: 'center' }}>
              {error}
            </span>
          ) : (
            transitions.map((target) => {
              const action = ACTION_CONFIG[target];
              return (
                <button
                  key={target}
                  className={`btn btn-sm ${VARIANT_CLASS[action.variant]}`}
                  onClick={() => handleAction(target)}
                  disabled={busy !== null}
                >
                  {busy === target ? '…' : action.label}
                </button>
              );
            })
          )}
        </div>
      </div>

      {showCancel && (
        <CancelModal
          patientName={patient.name}
          onConfirm={(reason) => onAction(appointment.id, 'CANCELLED', reason)}
          onClose={() => setShowCancel(false)}
        />
      )}
    </>
  );
}
