import { useState, useEffect, useCallback, type FormEvent } from 'react';
import api from '../lib/api';
import type { Doctor } from '../types';
import { Sidebar } from '../components/Sidebar';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';

interface DoctorRow extends Doctor {
  futureActiveCount: number;
}

interface CreatedDoctor extends Doctor {
  userEmail: string;
  tempPassword: string;
}

function extractMsg(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message;
}

export function DoctoresPage() {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Edición inline de slot
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSlot, setEditSlot] = useState('30');
  const [editError, setEditError] = useState('');

  // Baja de médico (modal de confirmación)
  const [deactivateTarget, setDeactivateTarget] = useState<DoctorRow | null>(null);

  // Alta
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [slotDuration, setSlotDuration] = useState('30');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedDoctor | null>(null);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DoctorRow[]>('/doctors', { params: { includeInactive: true } });
      setDoctors(res.data);
    } catch {
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  function startEdit(d: DoctorRow) {
    setEditingId(d.id);
    setEditSlot(String(d.slotDuration));
    setEditError('');
  }

  async function saveSlot(id: string) {
    setEditError('');
    try {
      await api.patch(`/doctors/${id}`, { slotDuration: Number(editSlot) });
      setEditingId(null);
      await fetchDoctors();
    } catch (err) {
      setEditError(extractMsg(err) ?? 'No se pudo actualizar el slot.');
    }
  }

  async function activate(d: DoctorRow) {
    await api.patch(`/doctors/${d.id}/status`, { active: true });
    await fetchDoctors();
  }

  const activeCount = doctors.filter((d) => d.active).length;
  const canSave = Boolean(name.trim() && specialty.trim()) && !saving;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setFormError('');
    setCreated(null);
    try {
      const res = await api.post<CreatedDoctor>('/doctors', {
        name: name.trim(),
        specialty: specialty.trim(),
        slotDuration: Number(slotDuration),
      });
      setCreated(res.data);
      setName('');
      setSpecialty('');
      setSlotDuration('30');
      await fetchDoctors();
    } catch (err) {
      setFormError(extractMsg(err) ?? 'No se pudo registrar el médico.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <div className="main-inner">
          <header style={{ marginBottom: '20px' }}>
            <h1 className="t-20 w-600">Doctores</h1>
            <div className="t-14 muted" style={{ marginTop: '2px' }}>
              {doctors.length} {doctors.length === 1 ? 'médico' : 'médicos'} · {activeCount} activos
            </div>
          </header>

          <div className="mgmt-grid">
            {/* Lista con estado, slot y acciones */}
            <div className="card">
              {loading ? (
                <p className="t-14 muted" style={{ padding: '16px' }}>Cargando…</p>
              ) : doctors.length === 0 ? (
                <EmptyState title="Sin médicos" description="Aún no hay médicos registrados." />
              ) : (
                doctors.map((d) => (
                  <div key={d.id} className="list-row">
                    <div className="list-row-main">
                      <div className="w-500" style={{ fontSize: '14px' }}>{d.name}</div>
                      <div className="t-12 muted">{d.specialty}</div>
                    </div>

                    {editingId === d.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          className="input"
                          type="number"
                          min={5}
                          max={180}
                          value={editSlot}
                          onChange={(e) => setEditSlot(e.target.value)}
                          style={{ width: '76px', height: '32px' }}
                        />
                        <span className="t-12 muted">min</span>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => saveSlot(d.id)}>
                          Guardar
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="state-chip">
                          <span
                            className="state-dot"
                            style={{ background: d.active ? 'var(--accent)' : 'var(--text-muted)' }}
                          />
                          <span style={{ color: d.active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {d.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </span>
                        <span className="t-14 mono">{d.slotDuration} min</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(d)}>
                          Editar slot
                        </button>
                        {d.active ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeactivateTarget(d)}>
                            Desactivar
                          </button>
                        ) : (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => activate(d)}>
                            Activar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
              {editError && (
                <div className="error-inline" style={{ margin: '12px 16px' }}>{editError}</div>
              )}
            </div>

            {/* Alta de médico */}
            <form className="card form-stack" onSubmit={handleCreate}>
              <div className="t-16 w-600">Nuevo médico</div>
              <div className="field">
                <label className="label" htmlFor="d-name">Nombre *</label>
                <input id="d-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="d-spec">Especialidad *</label>
                <input id="d-spec" className="input" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="d-slot">Duración de slot (min) *</label>
                <input
                  id="d-slot"
                  className="input"
                  type="number"
                  min={5}
                  max={180}
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(e.target.value)}
                />
              </div>
              {formError && <div className="error-inline">{formError}</div>}
              {created && (
                <div
                  style={{
                    background: 'var(--accent-light)',
                    border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius-card)',
                    padding: '12px',
                    fontSize: '13px',
                  }}
                >
                  <div className="w-600" style={{ color: 'var(--accent)', marginBottom: '4px' }}>
                    Médico registrado
                  </div>
                  Usuario creado: <span className="mono">{created.userEmail}</span>
                  <br />
                  Contraseña temporal: <span className="mono">{created.tempPassword}</span>
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-block" disabled={!canSave}>
                {saving ? 'Guardando…' : 'Registrar médico'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {deactivateTarget && (
        <ConfirmModal
          title="Desactivar médico"
          confirmLabel="Desactivar"
          message={
            <>
              <strong>{deactivateTarget.name}</strong> tiene {deactivateTarget.futureActiveCount}{' '}
              {deactivateTarget.futureActiveCount === 1 ? 'cita programada' : 'citas programadas'}. Al
              desactivarlo dejará de aparecer en la agenda. Las citas existentes no se cancelan
              automáticamente.
            </>
          }
          onConfirm={async () => {
            await api.patch(`/doctors/${deactivateTarget.id}/status`, { active: false });
            await fetchDoctors();
          }}
          onClose={() => setDeactivateTarget(null)}
        />
      )}
    </div>
  );
}
