'use client';

import { resolveAddressFromDevice472 } from './postal472Client';

let installed = false;

/**
 * Intercepta solamente preview/creacion de site-suggestions.
 * Para Bogota intenta resolver 4-72 desde el navegador y agrega coordenadas
 * oficiales al payload. Si CORS/red falla, deja pasar el request intacto para
 * que el backend use Rolling DB -> 4-72 como fallback local-first.
 */
export function installPostal472FetchInterceptor() {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);

  // Envolvemos fetch de forma conservadora: cualquier llamada ajena al registro
  // de lugares sigue exactamente el camino normal del navegador.
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = String(init?.method || (typeof input !== 'string' ? input?.method : 'GET') || 'GET').toUpperCase();
    const isSuggestionWrite = method === 'POST' && (
      url.endsWith('/api/site-suggestions/preview') ||
      url.endsWith('/api/site-suggestions')
    );

    if (!isSuggestionWrite || !init?.body || typeof init.body !== 'string') {
      return nativeFetch(input, init);
    }

    try {
      const payload = JSON.parse(init.body);
      if (!shouldResolveFromDevice(payload)) return nativeFetch(input, init);

      const result = await resolveAddressFromDevice472({
        address: payload.direccion,
        department: 'BOGOTA D.C.',
        municipality: 'BOGOTA D.C.',
        divipola: '11001',
      });

      if (!result?.lat || !result?.lon) return nativeFetch(input, init);

      const nextPayload = {
        ...payload,
        direccion: result.standard_address || payload.direccion,
        ciudad: payload.ciudad || 'Bogota',
        latitud: Number(result.lat),
        longitud: Number(result.lon),
      };

      return nativeFetch(input, {
        ...init,
        body: JSON.stringify(nextPayload),
        headers: {
          ...(init.headers || {}),
          'X-Rolling-Address-Provider': 'official_472_device',
          'X-Rolling-Postal-Code': result.postal_code || '',
          'X-Rolling-Expanded-Postal-Code': result.expanded_postal_code || '',
          'X-Rolling-Divipola': '11001',
        },
      });
    } catch {
      return nativeFetch(input, init);
    }
  };
}

function shouldResolveFromDevice(payload) {
  if (!payload?.direccion) return false;
  if (Number.isFinite(Number(payload.latitud)) && Number.isFinite(Number(payload.longitud))) return false;

  const city = normalize(payload.ciudad || 'Bogota');
  return !city || city.includes('bogota');
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
