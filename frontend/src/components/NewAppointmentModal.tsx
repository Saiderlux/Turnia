import { useState, useEffect, type FormEvent } from 'react';
import api from '../lib/api';
import type { Appointment, Doctor, Patient } from '../types';
import { buildDaySlots, type Slot } from '../lib/slots';
import { PatientSearchSelect } from './PatientSearchSelect';

interface Props {
  doctors: Doctor[];
  defaultDoctorId: string;
  defaultDate: string; // yyyy-MM-dd
  onClose: () => void;
  onCreated: () => void;
}

export function NewAppointmentModal({
  doctors,
  defaultDoctorId,
  defaultDate,
  onClose,
  onCreated,
}: Props) {
  const [doctorId, setDoctorId] = useState(defaultDoctorId);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [slotIso, setSlotIso] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const doctor = doctors.find((d) => d.id === doctorId);

  // Recalcular slots cuando cambia médico o fecha
  useEffect(() => {
    if (!doctorId || !date || !doctor) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlotIso('');
    api
      .get<Appointment[]>('/appointments', { params: { doctorId, date } })
      .then((res) => {
        if (cancelled) return;
        setSlots(buildDaySlots(date, doctor.slotDuration, res.data));
      })
      .catch(() => {
        if (!cancelled) setSlots(buildDaySlots(date, doctor.slotDuration, []));
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId, date, doctor]);

  const canSubmit = Boolean(doctorId && selectedPatient && slotIso) && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/appointments', { doctorId, patientId: selectedPatient!.id, scheduledAt: slotIso });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'No se pudo agendar la cita.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 className="t-16 w-600">Nueva cita</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '4px' }}
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div className="field" style={{ marginBottom: '16px' }}>
            <label className="label" htmlFor="na-doctor">Médico</label>
            <select id="na-doctor" className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.specialty}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: '16px' }}>
            <label className="label">Paciente</label>
            <PatientSearchSelect selectedPatient={selectedPatient} onSelect={setSelectedPatient} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: error ? '12px' : '20px' }}>
            <div className="field">
              <label className="label" htmlFor="na-date">Fecha</label>
              <input id="na-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="label" htmlFor="na-time">Hora</label>
              <select
                id="na-time"
                className="input"
                value={slotIso}
                onChange={(e) => setSlotIso(e.target.value)}
                disabled={loadingSlots || slots.length === 0}
              >
                <option value="">{loadingSlots ? 'Cargando…' : 'Elegir hora…'}</option>
                {slots.map((s) => (
                  <option key={s.iso} value={s.iso} disabled={s.occupied}>
                    {s.label}
                    {s.occupied ? '  — ocupado' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="error-inline" style={{ marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? 'Agendando…' : 'Agendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
