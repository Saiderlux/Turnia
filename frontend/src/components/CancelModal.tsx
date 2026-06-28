import { useState, type FormEvent } from 'react';

interface Props {
  patientName: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Confirmación antes de cancelar (Control y libertad).
 * Razón obligatoria. El botón destructivo solo es filled aquí,
 * en la confirmación final. El botón secundario es prominente.
 */
export function CancelModal({ patientName, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('La razón es obligatoria para cancelar.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'No se pudo cancelar la cita.';
      setError(msg);
    } finally {
      setLoading(false);
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
          <h2 className="t-16 w-600">Cancelar cita</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '18px',
              lineHeight: 1,
              padding: '4px',
            }}
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <p className="t-14 muted" style={{ marginBottom: '16px' }}>
            Vas a cancelar la cita de <strong style={{ color: 'var(--text-primary)' }}>{patientName}</strong>.
            Esta acción queda registrada con tu nombre y la razón.
          </p>

          <div className="field" style={{ marginBottom: error ? '12px' : '20px' }}>
            <label className="label" htmlFor="cancel-reason">
              Razón de la cancelación <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              id="cancel-reason"
              className="input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. el paciente reagendó por teléfono"
              autoFocus
            />
          </div>

          {error && (
            <div className="error-inline" style={{ marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Volver
            </button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? 'Cancelando…' : 'Cancelar cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
