import { request } from 'undici';
import { config } from '../config.js';

// Estas consultas siguen disponibles para integraciones antiguas y semillas
// opcionales. La resolución principal de direcciones ya vive en postal472.js.
export async function geocode(query) {
  const url = new URL('/search', config.nominatimUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '8');
  url.searchParams.set('addressdetails', '1');

  const response = await request(url, {
    headers: { 'user-agent': 'Rolling MVP local development' }
  });
  return response.body.json();
}

export async function nearbyOsmBusinesses({ lat, lng, radius = 700 }) {
  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["amenity"](around:${radius},${lat},${lng});
      node["shop"](around:${radius},${lat},${lng});
      node["tourism"](around:${radius},${lat},${lng});
    );
    out center tags 40;
  `;

  const response = await request(config.overpassUrl, {
    method: 'POST',
    body: new URLSearchParams({ data: overpassQuery }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' }
  });
  const payload = await response.body.json();
  return payload.elements || [];
}
