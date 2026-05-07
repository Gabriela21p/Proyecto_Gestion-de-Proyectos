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

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (!loading && user) {
      router.push('/app');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      router.push('/app');
    } catch (err) {
      setError(err.message || 'Error al autenticar');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-container">
          <div className="auth-loading">Cargando...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Rolling</h1>
          <p>Mapa comunitario para descubrir, valorar y destacar negocios locales</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          {isRegistering && (
            <label className="form-label">
              <span>Nombre de usuario</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </label>

          <label className="form-label">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength="8"
            />
          </label>

          <button
            type="submit"
            className="primary-action"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isRegistering
                ? 'Registrándose...'
                : 'Iniciando sesión...'
              : isRegistering
              ? 'Crear cuenta'
              : 'Iniciar sesión'}
          </button>

          <button
            type="button"
            className="plain-action"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
          >
            {isRegistering
              ? '¿Ya tienes cuenta? Inicia sesión'
              : '¿No tienes cuenta? Regístrate'}
          </button>
        </form>

        <div className="auth-info">
          <h3>Sobre Rolling</h3>
          <ul>
            <li>✓ Descubre sitios destacables por localidad</li>
            <li>✓ Lee reviews útiles de la comunidad</li>
            <li>✓ Comparte eventos y recomendaciones</li>
            <li>✓ Construye reputación como usuario verificado</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .auth-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .auth-container {
          width: 100%;
          max-width: 400px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          padding: 3rem 2rem;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .auth-header h1 {
          margin: 0;
          font-size: 2rem;
          color: #667eea;
        }

        .auth-header p {
          margin: 0.5rem 0 0;
          color: #666;
          font-size: 0.875rem;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .form-label {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label span {
          font-weight: 600;
          color: #333;
          font-size: 0.875rem;
        }

        .form-label input {
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 1rem;
          transition: border-color 0.2s;
        }

        .form-label input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .primary-action {
          padding: 0.75rem 1.5rem;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .primary-action:hover:not(:disabled) {
          background: #5568d3;
        }

        .primary-action:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .plain-action {
          padding: 0.75rem 1.5rem;
          background: transparent;
          color: #667eea;
          border: 1px solid #667eea;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .plain-action:hover {
          background: rgba(102, 126, 234, 0.05);
        }

        .auth-error {
          padding: 0.75rem;
          background: #fee;
          color: #c33;
          border-radius: 6px;
          font-size: 0.875rem;
          text-align: center;
        }

        .auth-loading {
          text-align: center;
          color: #666;
          padding: 2rem;
        }

        .auth-info {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #eee;
        }

        .auth-info h3 {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .auth-info ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .auth-info li {
          font-size: 0.875rem;
          color: #666;
        }
      `}</style>
    </main>
  );
}
