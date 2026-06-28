import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { getUser, clearAuth } from '../lib/auth';
import type { Appointment, AppointmentStatus } from '../types';
import { AgendaBoard } from '../components/AgendaBoard';
import { EmptyState } from '../components/EmptyState';
import { formatLongDate } from '../lib/status';

const todayStr = format(new Date(), 'yyyy-MM-dd');

export function DoctorAgendaPage() {
  const user = getUser();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [date, setDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const fetchAppointments = useCallback(async () => {
    if (!user?.doctorId) return;
    setLoading(true);
    try {
      const res = await api.get<Appointment[]>('/appointments', {
        params: { doctorId: user.doctorId, date },
      });
      setAppointments(res.data);
      setForbidden(false);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 403) {
        setForbidden(true);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.doctorId, date]);

  useEffect(() => {
    fetchAppointments();
    const interval = setInterval(fetchAppointments, 30000);
    return () => clearInterval(interval);
  }, [fetchAppointments]);

  async function handleAction(id: string, status: AppointmentStatus, reason?: string) {
    await api.patch(`/appointments/${id}/status`, { status, reason });
    await fetchAppointments();
  }

  function logout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <div>
      <header className="topbar">
        <div className="t-20 w-600" style={{ letterSpacing: '-0.02em' }}>
          Turnia
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="t-14 muted">{user?.name}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="page page-narrow">
        {!user?.doctorId ? (
          <EmptyState
            title="Cuenta sin médico vinculado"
            description="Tu usuario no está asociado a un médico. Contacta al administrador."
          />
        ) : forbidden ? (
          <EmptyState
            title="Sin acceso a esta agenda"
            description="No tienes permiso para ver esta sección."
          />
        ) : (
          <>
            <header
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                marginBottom: '20px',
                gap: '16px',
              }}
            >
              <div>
                <h1 className="t-20 w-600">Tu agenda</h1>
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

            <AgendaBoard
              appointments={appointments}
              userRole="DOCTOR"
              loading={loading}
              onAction={handleAction}
            />
          </>
        )}
      </div>
    </div>
  );
}
