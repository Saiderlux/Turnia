import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Estado vacío con ícono, título y acción sugerida. Se usa para
 * 403 (sin permiso), agendas vacías y errores de carga — nunca
 * una pantalla en blanco ni una redirección silenciosa.
 */
export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '56px 24px',
        gap: '8px',
      }}
    >
      {icon && (
        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }} aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="t-16 w-600">{title}</h3>
      {description && (
        <p className="t-14 muted" style={{ maxWidth: '340px' }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '12px' }}>{action}</div>}
    </div>
  );
}
