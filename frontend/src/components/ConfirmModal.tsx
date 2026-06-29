import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * Modal de confirmación genérico. Sigue el patrón del proyecto: fade 120ms,
 * botón destructivo outline --danger y botón secundario prominente. Si la
 * acción falla, muestra el error inline sin cerrar el modal.
 */
export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Volver',
  onConfirm,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'No se pudo completar la acción.';
      setError(msg);
    } finally {
      setBusy(false);
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
          <h2 className="t-16 w-600">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '4px' }}
          >
            ✕
          </button>
        </header>

        <div style={{ padding: '20px' }}>
          <div className="t-14" style={{ color: 'var(--text-primary)', marginBottom: error ? '12px' : '20px' }}>
            {message}
          </div>

          {error && (
            <div className="error-inline" style={{ marginBottom: '20px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {cancelLabel}
            </button>
            <button type="button" className="btn btn-danger-outline" onClick={handleConfirm} disabled={busy}>
              {busy ? 'Procesando…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
