import { useState, type FormEvent } from 'react';
import api from '../lib/api';
import type { Doctor, Patient } from '../types';

interface Props {
  doctors: Doctor[];
  patients: Patient[];
  defaultDoctorId: string;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Registro de walk-in: nace en estado "En espera" sin hora.
 * No bloquea slots en la agenda.
 */
export function WalkinModal({ doctors, patients, defaultDoctorId, onClose, onCreated }: Props) {
  const [doctorId, setDoctorId] = useState(defaultDoctorId);
  const [patientId, setPatientId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Boolean(doctorId && patientId) && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/appointments/walkin', { doctorId, patientId });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'No se pudo registrar el walk-in.';
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
          <h2 className="t-16 w-600">Registrar walk-in</h2>
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
          <p className="t-14 muted" style={{ marginBottom: '16px' }}>
            El paciente entra a la cola de espera del médico. El admin lo manda a consulta según los huecos naturales.
          </p>

          <div className="field" style={{ marginBottom: '16px' }}>
            <label className="label" htmlFor="wk-doctor">Médico</label>
            <select id="wk-doctor" className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.specialty}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: error ? '12px' : '20px' }}>
            <label className="label" htmlFor="wk-patient">Paciente</label>
            <select id="wk-patient" className="input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Seleccionar paciente…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.phone}
                </option>
              ))}
            </select>
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
              {submitting ? 'Registrando…' : 'Registrar walk-in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
