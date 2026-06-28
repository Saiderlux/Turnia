import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../lib/api';
import type { DailyReport } from '../types';
import { Sidebar } from '../components/Sidebar';
import { EmptyState } from '../components/EmptyState';
import { formatLongDate } from '../lib/status';

const todayStr = format(new Date(), 'yyyy-MM-dd');

interface MetricRow {
  label: string;
  get: (r: DailyReport) => string | number;
}

const METRICS: MetricRow[] = [
  { label: 'Programadas', get: (r) => r.scheduled },
  { label: 'Atendidas', get: (r) => r.attended },
  { label: 'Canceladas', get: (r) => r.cancelled },
  { label: 'No se presentaron', get: (r) => r.noShow },
  { label: 'Walk-ins', get: (r) => r.walkins },
  { label: 'Duración prom.', get: (r) => (r.avgRealDuration !== null ? `${r.avgRealDuration} min` : '—') },
];

export function ReportesPage() {
  const [date, setDate] = useState(todayStr);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .get<DailyReport[]>('/reports/daily', { params: { date } })
      .then((res) => setReports(Array.isArray(res.data) ? res.data : [res.data]))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main">
        <div className="main-inner">
          <header
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginBottom: '24px',
              gap: '16px',
            }}
          >
            <div>
              <h1 className="t-20 w-600">Reporte del día</h1>
              <div className="t-14 muted" style={{ marginTop: '2px' }}>
                {formatLongDate(parseISO(date))}
              </div>
            </div>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: 'auto' }}
            />
          </header>

          {loading ? (
            <p className="t-14 muted">Cargando…</p>
          ) : reports.length === 0 ? (
            <EmptyState title="Sin datos para este día" description="No hay actividad registrada en la fecha seleccionada." />
          ) : (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '160px' }}>Métrica</th>
                    {reports.map((r) => (
                      <th key={r.doctorId} style={{ minWidth: '120px' }}>
                        {r.doctorName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((m) => (
                    <tr key={m.label}>
                      <td className="metric-label">{m.label}</td>
                      {reports.map((r) => (
                        <td key={r.doctorId} className="metric-value">
                          {m.get(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
