import { useState } from 'react';
import { startOfWeek, addDays, addWeeks, format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatWeekday } from '../lib/status';

interface Props {
  selectedDate: string; // yyyy-MM-dd
  onSelect: (dateStr: string) => void;
}

function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Selector de semana: 7 días, el seleccionado resaltado con --accent. */
export function WeekSelector({ selectedDate, onSelect }: Props) {
  const selected = parseISO(selectedDate);
  const [weekAnchor, setWeekAnchor] = useState(selected);

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthLabel = format(weekStart, 'MMMM yyyy', { locale: es });

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span className="t-12 w-500 muted" style={{ textTransform: 'capitalize' }}>
          {monthLabel}
        </span>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={() => setWeekAnchor((w) => addWeeks(w, -1))}
            style={arrowStyle}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Semana siguiente"
            onClick={() => setWeekAnchor((w) => addWeeks(w, 1))}
            style={arrowStyle}
          >
            ›
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {days.map((d) => {
          const active = isSameDay(d, selected);
          const { weekday, day } = formatWeekday(d);
          return (
            <button
              key={toDateStr(d)}
              type="button"
              onClick={() => onSelect(toDateStr(d))}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                padding: '6px 0',
                border: '1px solid transparent',
                borderRadius: 'var(--radius-chip)',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--white)' : 'var(--text-primary)',
                transition: 'background-color 150ms ease',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  color: active ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                }}
              >
                {weekday}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const arrowStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-chip)',
  background: 'var(--white)',
  color: 'var(--text-muted)',
  fontSize: '14px',
  lineHeight: 1,
};
