import { useState, useEffect, type KeyboardEvent } from 'react';
import api from '../lib/api';
import type { Patient } from '../types';

interface Props {
  selectedPatient: Patient | null;
  onSelect: (patient: Patient | null) => void;
}

function extractMsg(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message;
}

// Evita que Enter dentro del buscador dispare el submit del formulario padre (el modal).
function swallowEnter(e: KeyboardEvent) {
  if (e.key === 'Enter') e.preventDefault();
}

/**
 * Buscador de pacientes para el flujo de agendamiento. Dispara la búsqueda
 * al servidor con mínimo 2 caracteres (nombre o teléfono) y permite registrar
 * un paciente nuevo sin salir del modal. Reemplaza el dropdown estático.
 */
export function PatientSearchSelect({ selectedPatient, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sub-formulario de alta inline
  const [creating, setCreating] = useState(false);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cErr, setCErr] = useState('');
  const [cBusy, setCBusy] = useState(false);

  useEffect(() => {
    if (selectedPatient) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get<Patient[]>('/patients', { params: { search: q } })
        .then((r) => {
          if (!cancelled) {
            setResults(r.data);
            setOpen(true);
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selectedPatient]);

  function choose(p: Patient) {
    onSelect(p);
    setOpen(false);
    setQuery('');
    setCreating(false);
  }

  function openCreate() {
    setCName(query.trim());
    setCPhone('');
    setCEmail('');
    setCErr('');
    setOpen(false);
    setCreating(true);
  }

  async function submitCreate() {
    if (!cName.trim() || !cPhone.trim()) {
      setCErr('Nombre y teléfono son obligatorios.');
      return;
    }
    setCBusy(true);
    setCErr('');
    try {
      const r = await api.post<Patient>('/patients', {
        name: cName.trim(),
        phone: cPhone.trim(),
        email: cEmail.trim() || undefined,
      });
      choose(r.data);
    } catch (err) {
      setCErr(extractMsg(err) ?? 'No se pudo registrar el paciente.');
    } finally {
      setCBusy(false);
    }
  }

  // Paciente ya seleccionado
  if (selectedPatient) {
    return (
      <div className="selected-patient">
        <div style={{ minWidth: 0 }}>
          <div className="w-500" style={{ fontSize: '14px' }}>
            {selectedPatient.name}
          </div>
          <div className="t-12 muted">{selectedPatient.phone}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(null)}>
          Cambiar
        </button>
      </div>
    );
  }

  // Alta inline de paciente nuevo
  if (creating) {
    return (
      <div className="inline-create">
        <div className="t-12 w-500 muted">Nuevo paciente</div>
        <input
          className="input"
          placeholder="Nombre *"
          value={cName}
          onChange={(e) => setCName(e.target.value)}
          onKeyDown={swallowEnter}
          autoFocus
        />
        <input
          className="input"
          placeholder="Teléfono *"
          value={cPhone}
          onChange={(e) => setCPhone(e.target.value)}
          onKeyDown={swallowEnter}
        />
        <input
          className="input"
          placeholder="Email (opcional)"
          type="email"
          value={cEmail}
          onChange={(e) => setCEmail(e.target.value)}
          onKeyDown={swallowEnter}
        />
        {cErr && <div className="error-inline">{cErr}</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>
            Volver a buscar
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={submitCreate} disabled={cBusy}>
            {cBusy ? 'Guardando…' : 'Registrar y seleccionar'}
          </button>
        </div>
      </div>
    );
  }

  // Buscador
  return (
    <div className="search-wrap">
      <input
        className="input"
        placeholder="Buscar por nombre o teléfono…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={swallowEnter}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
      />
      {open && (
        <div className="search-results">
          {loading ? (
            <div className="search-empty">Buscando…</div>
          ) : results.length > 0 ? (
            results.map((p) => (
              <button key={p.id} type="button" className="search-item" onClick={() => choose(p)}>
                <span className="w-500" style={{ fontSize: '14px' }}>
                  {p.name}
                </span>
                <span className="muted" style={{ fontSize: '13px' }}>
                  {'  ·  '}
                  {p.phone}
                </span>
              </button>
            ))
          ) : (
            <div className="search-empty">Sin resultados para «{query.trim()}»</div>
          )}
          <button type="button" className="search-create" onClick={openCreate}>
            + Registrar nuevo paciente
          </button>
        </div>
      )}
      {query.trim().length > 0 && query.trim().length < 2 && (
        <div className="t-12 muted" style={{ marginTop: '4px' }}>
          Escribe al menos 2 caracteres para buscar.
        </div>
      )}
    </div>
  );
}
