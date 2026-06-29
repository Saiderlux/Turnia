import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import api from '../lib/api';
import type { Appointment, AppointmentStatus, Doctor } from '../types';
import { Sidebar } from '../components/Sidebar';
import { WeekSelector } from '../components/WeekSelector';
import { AgendaBoard } from '../components/AgendaBoard';
import { NewAppointmentModal } from '../components/NewAppointmentModal';
import { WalkinModal } from '../components/WalkinModal';
import { formatLongDate } from '../lib/status';

const todayStr = format(new Date(), 'yyyy-MM-dd');

function pendingLoad(appts: Appointment[]): number {
  return appts.filter(
    (a) => a.status !== 'ATTENDED' && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW'
  ).length;
}

export function AdminAgendaPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [date, setDate] = useState(todayStr);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<'new' | 'walkin' | null>(null);

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  // Carga inicial de médicos
  useEffect(() => {
    api
      .get<Doctor[]>('/doctors')
      .then((dr) => {
        setDoctors(dr.data);
        if (dr.data.length > 0) setSelectedDoctorId((cur) => cur || dr.data[0].id);
      })
      .catch(() => setDoctors([]));
  }, []);

  const fetchAppointments = useCallback(async () => {
    if (!selectedDoctorId) return;
    setLoading(true);
    try {
      const res = await api.get<Appointment[]>('/appointments', {
        params: { doctorId: selectedDoctorId, date },
      });
      setAppointments(res.data);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, date]);

  const fetchCounts = useCallback(async () => {
    if (doctors.length === 0) return;
    const entries = await Promise.all(
      doctors.map(async (d) => {
        try {
          const res = await api.get<Appointment[]>('/appointments', {
            params: { doctorId: d.id, date },
          });
          return [d.id, pendingLoad(res.data)] as const;
        } catch {
          return [d.id, 0] as const;
        }
      })
    );
    setCounts(Object.fromEntries(entries));
  }, [doctors, date]);

  // Agenda del médico seleccionado: polling cada 30s
  useEffect(() => {
    fetchAppointments();
    const interval = setInterval(fetchAppointments, 30000);
    return () => clearInterval(interval);
  }, [fetchAppointments]);

  // Cargas del sidebar: al cambiar fecha o lista de médicos
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  async function handleAction(id: string, status: AppointmentStatus, reason?: string) {
    await api.patch(`/appointments/${id}/status`, { status, reason });
    await Promise.all([fetchAppointments(), fetchCounts()]);
  }

  function handleCreated() {
    fetchAppointments();
    fetchCounts();
  }

  const sidebarExtras = (
    <>
      <div className="sidebar-section">
        <WeekSelector selectedDate={date} onSelect={setDate} />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-heading">Médicos</div>
        {doctors.map((d) => {
          const load = counts[d.id] ?? 0;
          const selected = d.id === selectedDoctorId;
          return (
            <button
              key={d.id}
              type="button"
              className={`doctor-item${selected ? ' is-selected' : ''}`}
              onClick={() => setSelectedDoctorId(d.id)}
            >
              <div className="doctor-item-body">
                <div className="doctor-item-name">{d.name}</div>
                <div className="doctor-item-spec">{d.specialty}</div>
              </div>
              <span
                className={`load-badge${selected && load > 0 ? ' is-active' : ''}`}
                title={`${load} pendientes`}
              >
                {load}
              </span>
            </button>
          );
        })}
      </div>

    </>
  );

  // Acciones fijas al fondo del sidebar: no scrollean con la lista de médicos.
  const sidebarActions = (
    <>
      <button type="button" className="btn btn-primary btn-block" onClick={() => setModal('new')}>
        Nueva cita
      </button>
      <button type="button" className="btn btn-outline btn-block" onClick={() => setModal('walkin')}>
        Registrar walk-in
      </button>
    </>
  );

  return (
    <div className="app-shell">
      <Sidebar extras={sidebarExtras} actions={sidebarActions} />

      <main className="main">
        <div className="main-inner">
          <header style={{ marginBottom: '20px' }}>
            <h1 className="t-20 w-600">{selectedDoctor?.name ?? 'Selecciona un médico'}</h1>
            <div className="t-14 muted" style={{ marginTop: '2px' }}>
              {selectedDoctor?.specialty}
              {selectedDoctor && '  ·  '}
              {formatLongDate(parseISO(date))}
            </div>
          </header>

          <AgendaBoard
            appointments={appointments}
            userRole="ADMIN"
            loading={loading}
            onAction={handleAction}
          />
        </div>
      </main>

      {modal === 'new' && selectedDoctor && (
        <NewAppointmentModal
          doctors={doctors}
          defaultDoctorId={selectedDoctorId}
          defaultDate={date}
          onClose={() => setModal(null)}
          onCreated={handleCreated}
        />
      )}
      {modal === 'walkin' && (
        <WalkinModal
          doctors={doctors}
          defaultDoctorId={selectedDoctorId}
          onClose={() => setModal(null)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
