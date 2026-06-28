import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === 'ADMIN') navigate('/admin/agenda');
      else if (user.role === 'DIRECTOR') navigate('/admin/reportes');
      else navigate('/doctor/agenda');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'No se pudo iniciar sesión. Revisa tu conexión.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--surface)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ marginBottom: '28px' }}>
          <div className="t-28 w-600" style={{ letterSpacing: '-0.02em' }}>
            Turnia
          </div>
          <div className="t-14 muted" style={{ marginTop: '2px' }}>
            Sistema de agenda clínica
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ padding: '24px' }}>
          <div className="field" style={{ marginBottom: '16px' }}>
            <label className="label" htmlFor="email">
              Correo
            </label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="field" style={{ marginBottom: '20px' }}>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>

          {/* Reservar el espacio del error para no desplazar el layout */}
          <div style={{ minHeight: '20px', marginTop: '12px' }}>
            {error && (
              <p className="t-13" style={{ color: 'var(--danger)', fontSize: '13px' }}>
                {error}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
