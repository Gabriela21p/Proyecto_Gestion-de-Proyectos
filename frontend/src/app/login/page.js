'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/app');
  }, [user, loading, router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (isRegistering) {
        if (!username.trim()) {
          setError('El nombre de usuario es requerido');
          setIsSubmitting(false);
          return;
        }
        await register(username, email, password);
      } else {
        await login(email, password);
      }
      router.replace('/app');
    } catch (err) {
      setError(err.message || 'Error al autenticar');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-preview" aria-hidden="true">
        <div className="auth-preview__map">
          <span className="preview-pin preview-pin--one">4.8</span>
          <span className="preview-pin preview-pin--two">4.6</span>
          <span className="preview-pin preview-pin--three">4.9</span>
        </div>
        <div className="auth-preview__panel">
          <strong>Chapinero</strong>
          <span>5 sitios destacados · 2 eventos activos</span>
        </div>
      </div>

      <section className="auth-container auth-container--overlay" aria-label="Acceso a Rolling">
        <div className="auth-header">
          <h1>Rolling</h1>
          <p>Inicia sesion para explorar el mapa comunitario y valorar negocios locales.</p>
        </div>

        {loading ? (
          <div className="auth-loading">Validando sesion...</div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error">{error}</div>}

            {isRegistering && (
              <label className="form-label">
                <span>Nombre de usuario</span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Tu nombre en Rolling"
                  required
                  minLength="2"
                  maxLength="50"
                />
              </label>
            )}

            <label className="form-label">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                required
              />
            </label>

            <label className="form-label">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimo 8 caracteres"
                required
                minLength="8"
              />
            </label>

            <button type="submit" className="primary-action" disabled={isSubmitting}>
              {isSubmitting
                ? isRegistering ? 'Creando cuenta...' : 'Entrando...'
                : isRegistering ? 'Crear cuenta' : 'Entrar'}
            </button>

            <button
              type="button"
              className="plain-action"
              onClick={() => {
                setIsRegistering((current) => !current);
                setError('');
              }}
            >
              {isRegistering ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}
            </button>
          </form>
        )}

        <div className="auth-info">
          <h3>Identidad comunitaria</h3>
          <ul>
            <li>Las valoraciones quedan asociadas a una cuenta real.</li>
            <li>Tu reputacion aumenta el peso de tus reviews.</li>
            <li>Los reportes y sugerencias entran con trazabilidad.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
