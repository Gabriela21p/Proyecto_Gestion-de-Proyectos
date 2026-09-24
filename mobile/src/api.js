// 10.0.2.2 es la forma en que el emulador Android llega al computador anfitrión.
// En un celular físico esta variable debe apuntar a la IP local del computador.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000').replace(/\/$/, '');

// Todas las pantallas usan este cliente para compartir headers, errores legibles
// y el mismo comportamiento cuando la API local no está disponible.
export async function apiRequest(path, { token, method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(`No pudimos conectar con Rolling en ${API_URL}. Revisa la IP y que Docker esté encendido.`);
  }

  const raw = await response.text();
  // Algunos proxies responden texto en los errores. Parsear de forma tolerante
  // evita esconder el problema real detrás de otro fallo de JSON.
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || data.message || `La solicitud falló (${response.status}).`);
  return data;
}

export function buildQuery(values) {
  // Omitimos filtros vacíos para mantener URLs cortas y predecibles.
  const parts = Object.entries(values)
    .filter(([, value]) => value !== '' && value !== false && value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
