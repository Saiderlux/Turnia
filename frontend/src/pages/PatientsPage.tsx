import { useState, useEffect, useCallback, type FormEvent } from 'react';
import api from '../lib/api';
import type { Patient } from '../types';
import { Sidebar } from '../components/Sidebar';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';

function extractMsg(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message;
}

export function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Formulario: alta cuando editingId es null, edición cuando tiene un id
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);

  const fetchPatients = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const res = await api.get<Patient[]>('/patients', {
        params: term.trim().length >= 2 ? { search: term.trim() } : {},
      });
      setPatients(res.data);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchPatients(search), 250);
    return () => clearTimeout(t);
  }, [search, fetchPatients]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setFormError('');
  }

  function startEdit(p: Patient) {
    setEditingId(p.id);
    setName(p.name);
    setPhone(p.phone);
    setEmail(p.email ?? '');
    setNotes(p.notes ?? '');
    setFormError('');
  }

  const canSave = Boolean(name.trim() && phone.trim()) && !saving;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setFormError('');
    const body = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      if (editingId) {
        await api.patch(`/patients/${editingId}`, body);
      } else {
        await api.post('/patients', body);
      }
      resetForm();
      await fetchPatients(search);
    } catch (err) {
      setFormError(extractMsg(err) ?? 'No se pudo guardar el paciente.');
    } finally {
      setSaving(false);
    }
  }

  const isEditing = editingId !== null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <div className="main-inner">
          <header style={{ marginBottom: '20px' }}>
            <h1 className="t-20 w-600">Pacientes</h1>
            <div className="t-14 muted" style={{ marginTop: '2px' }}>
              {patients.length} {patients.length === 1 ? 'paciente' : 'pacientes'}
            </div>
          </header>

          <div className="mgmt-grid">
            {/* Lista + buscador */}
            <div>
              <input
                className="input"
                placeholder="Buscar por nombre o teléfono…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: '12px' }}
              />
              <div className="card">
                {loading ? (
                  <p className="t-14 muted" style={{ padding: '16px' }}>Cargando…</p>
                ) : patients.length === 0 ? (
                  <EmptyState
                    title="Sin pacientes"
                    description="No hay pacientes que coincidan con la búsqueda."
                  />
                ) : (
                  patients.map((p) => (
                    <div key={p.id} className="list-row">
                      <div className="list-row-main">
                        <div className="w-500" style={{ fontSize: '14px' }}>{p.name}</div>
                        <div className="t-12 muted">
                          {p.phone}
                          {p.email ? `  ·  ${p.email}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}>
                          Editar
                        </button>
                        <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setDeleteTarget(p)}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Formulario de alta / edición */}
            <form className="card form-stack" onSubmit={handleSubmit}>
              <div className="t-16 w-600">{isEditing ? 'Editar paciente' : 'Nuevo paciente'}</div>
              <div className="field">
                <label className="label" htmlFor="p-name">Nombre *</label>
                <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="p-phone">Teléfono *</label>
                <input id="p-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="p-email">Email</label>
                <input id="p-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="p-notes">Notas</label>
                <textarea id="p-notes" className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {formError && <div className="error-inline">{formError}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                {isEditing && (
                  <button type="button" className="btn btn-ghost" onClick={resetForm}>
                    Cancelar
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-block" disabled={!canSave}>
                  {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Registrar paciente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {deleteTarget && (
        <ConfirmModal
          title="Eliminar paciente"
          confirmLabel="Eliminar"
          message={
            <>
              ¿Eliminar a <strong>{deleteTarget.name}</strong>? Esta acción no se puede deshacer.
            </>
          }
          onConfirm={async () => {
            await api.delete(`/patients/${deleteTarget.id}`);
            if (editingId === deleteTarget.id) resetForm();
            await fetchPatients(search);
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
