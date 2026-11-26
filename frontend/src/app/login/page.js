'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { BASEMAP_STYLE } from '@/lib/basemap';

// Lugares de muestra que se ven detrás del formulario. Son coordenadas reales
// de Bogotá para que el fondo sea un mapa de verdad y no una ilustración.
const PREVIEW_PINS = [
  { lngLat: [-74.1290, 4.6420], label: '4.6', tone: 'green' },
  { lngLat: [-74.1150, 4.6950], label: '4.2', tone: 'green' },
  { lngLat: [-74.0484, 4.6767], label: '4.4', tone: 'green' },
  { lngLat: [-74.0320, 4.6300], label: '4.8', tone: 'coral' },
];

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
    // Evita que una persona ya autenticada vuelva a ver el formulario.
    if (!loading && user) router.replace('/app');
  }, [user, loading, router]);

  async function handleSubmit(event) {
    // Login y registro comparten el formulario para mantener el acceso simple
    // en pantallas pequeñas.
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
        <PreviewMap />
        <div className="auth-preview__panel">
          <strong>Bogotá</strong>
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

// Mapa decorativo y sin interacción: sólo ambienta la pantalla de acceso.
function PreviewMap() {
  const node = useRef(null);

  useEffect(() => {
    let map;
    let cancelled = false;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !node.current) return;
      map = new maplibregl.Map({
        container: node.current,
        style: BASEMAP_STYLE,
        center: [-74.0800, 4.6600],
        zoom: 12.7,
        interactive: false,
        attributionControl: { compact: true }
      });
      PREVIEW_PINS.forEach((pin) => {
        const element = document.createElement('div');
        element.className = `preview-pin preview-pin--${pin.tone}`;
        element.innerHTML = `<span>${pin.label}</span>`;
        new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(pin.lngLat).addTo(map);
      });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return <div ref={node} className="auth-preview__map" />;
}
