import type { AppointmentStatus } from '../types';
import { STATUS_CONFIG } from '../lib/status';

interface Props {
  status: AppointmentStatus;
}

/**
 * Chip de estado: [barra de color] + [label en español].
 * Siempre en ese orden, en todas las vistas. El color y el
 * label vienen exclusivamente de STATUS_CONFIG.
 */
export function StatusChip({ status }: Props) {
  const { label, color } = STATUS_CONFIG[status];
  return (
    <span className="chip">
      <span className="chip-bar" style={{ background: color }} />
      {label}
    </span>
  );
}
