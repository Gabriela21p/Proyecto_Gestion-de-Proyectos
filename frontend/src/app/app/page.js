'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

const defaultStats = {
  sitios: 0,
  reviews: 0,
  localidades: 0,
  eventos_activos: 0,
  sugerencias_pendientes: 0,
  rating_promedio: 0,
};

const defaultArchitecture = [
  { title: 'Cliente', tone: 'purple', items: [['React Native', 'iOS + Android'], ['Next.js web', 'PWA + SEO'], ['MapLibre GL JS', 'Mapas interactivos']] },
  { title: 'Backend / API', tone: 'green', items: [['Node.js + Fastify', 'API REST + GraphQL'], ['Socket.io', 'Feed y notifs'], ['Redis + BullMQ', 'Cache + jobs']] },
  { title: 'Capa de datos', tone: 'blue', items: [['PostgreSQL + PostGIS', 'Geo + relacional'], ['MongoDB', 'Posts, reviews, feed'], ['Meilisearch', 'Busqueda por nombre/tipo']] },
  { title: 'Mapas y geolocalizacion', tone: 'amber', items: [['OpenStreetMap + Tiles', 'Mapas open source'], ['Overpass API', 'Datos OSM'], ['Nominatim / Pelias', 'Geocodificacion']] },
  { title: 'Infraestructura y servicios', tone: 'red', items: [['Supabase Auth', 'Login social / OTP'], ['Cloudflare R2', 'Fotos y medios'], ['Expo EAS / Vercel', 'Deploy y CI/CD']] },
];

const initialFilters = {
  q: '',
  localidad: '',
  activity: '',
  min_rating: '',
  has_events: false,
  sort: 'recommended',
};

const categoryIcons = [
  ['cafe', 'CF'],
  ['coffee', 'CF'],
  ['restaurante', 'RS'],
  ['restaurant', 'RS'],
  ['gastronomia', 'RS'],
  ['bar', 'BR'],
  ['pub', 'BR'],
  ['cultura', 'CL'],
  ['musica', 'CL'],
  ['taller', 'TL'],
  ['tienda', 'TD'],
  ['shop', 'TD'],
  ['mercado', 'MC'],
  ['hotel', 'HT'],
  ['turismo', 'TR'],
  ['salud', 'SL'],
  ['fitness', 'FT'],
  ['belleza', 'BZ'],
  ['evento', 'EV'],
];

export default function AppPage() {
  const { user, token } = useAuth();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const previousSiteIdsRef = useRef('');
  const selectedSiteIdRef = useRef(null);
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [stats, setStats] = useState(defaultStats);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [activities, setActivities] = useState([]);
  const [architecture, setArchitecture] = useState(defaultArchitecture);
  const [filters, setFilters] = useState(initialFilters);
  const [reviewForm, setReviewForm] = useState({ username: '', rating: 5, titulo: '', comentario: '' });
  const [suggestionForm, setSuggestionForm] = useState({ nombre: '', categoria: '', direccion: '', localidad: '', ciudad: '', descripcion: '', contacto: '', suggested_by: '', latitud: '', longitud: '' });
  const [suggestionPreview, setSuggestionPreview] = useState(null);
  const [toast, setToast] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    selectedSiteIdRef.current = selectedSiteId;
  }, [selectedSiteId]);

  useEffect(() => {
    async function loadBootstrap() {
      const response = await fetch('/api/bootstrap');
      if (!response.ok) return;
      const data = await response.json();
      setStats(data.stats || defaultStats);
      setNeighborhoods(data.neighborhoods || []);
      setActivities(data.activities || []);
      setArchitecture(data.architecture || defaultArchitecture);
    }

    loadBootstrap().catch(() => setToast('No se pudo cargar el catalogo inicial.'));
  }, []);

  useEffect(() => {
    let socket;
    let warnedRealtime = false;

    async function connectRealtime() {
      const { io } = await import('socket.io-client');
      const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:4000';
      socket = io(apiOrigin, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 3,
        reconnectionDelay: 1200,
        timeout: 5000,
      });
      socket.on('rolling:connected', () => setToast('Tiempo real conectado con Socket.io.'));
      socket.on('connect_error', () => {
        if (warnedRealtime) return;
        warnedRealtime = true;
        setToast('Tiempo real no disponible. La app sigue funcionando por API REST.');
      });
      socket.on('review:created', ({ site }) => {
        if (!site) return;
        setSites((current) => current.map((item) => item.id === site.id ? site : item));
        setToast(`Nueva review en ${site.nombre}.`);
      });
      socket.on('suggestion:created', () => setToast('Nueva sugerencia recibida en moderacion.'));
      socket.on('report:created', () => setToast('Nuevo reporte enviado a moderacion.'));
    }

    connectRealtime().catch(() => {});
    return () => socket?.disconnect();
  }, []);

  useEffect(() => {
    async function loadSites() {
      setIsLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== false) params.set(key, value);
      });

      const response = await fetch(`/api/sites?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSites(data);
        setSelectedSiteId((current) => data.some((site) => site.id === current) ? current : data[0]?.id ?? null);
      } else {
        setToast('No se pudo consultar sitios.');
      }
      setIsLoading(false);
    }

    loadSites().catch(() => {
      setIsLoading(false);
      setToast('El backend no esta respondiendo.');
    });
  }, [filters]);

  useEffect(() => {
    if (!selectedSiteId) {
      setSelectedSite(null);
      return;
    }

    async function loadSiteDetail() {
      const response = await fetch(`/api/sites/${selectedSiteId}`);
      if (response.ok) setSelectedSite(await response.json());
    }

    loadSiteDetail().catch(() => {});
  }, [selectedSiteId]);

  const localidades = useMemo(
    () => [...new Set(neighborhoods.map((barrio) => barrio.localidad))],
    [neighborhoods],
  );

  const categories = useMemo(
    () => [...new Set([
      ...sites.map((site) => site.categoria).filter(Boolean),
      ...activities.map((activity) => activity.nombre).filter(Boolean),
    ])],
    [sites, activities],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let isMounted = true;

    async function createMap() {
      const maplibregl = (await import('maplibre-gl')).default;

      if (!isMounted || !mapContainerRef.current || mapRef.current) return;

      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [-74.08, 4.66],
        zoom: 12,
        minZoom: 3,
      });

      mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      mapRef.current.once('load', () => {
        mapRef.current?.resize();
        setMapReady(true);
      });
      mapRef.current.on('error', (event) => {
        setMapError(event?.error?.message || 'No se pudo cargar el mapa.');
      });
    }

    createMap().catch((error) => {
      setMapError(error?.message || 'MapLibre no pudo iniciar.');
    });

    return () => {
      isMounted = false;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    async function syncMarkers() {
      const maplibregl = (await import('maplibre-gl')).default;
      markersRef.current.forEach((marker) => marker.remove());
      const nextIds = sites.map((site) => site.id).join(',');
      const validSites = sites.filter(hasValidCoordinates);
      markersRef.current = validSites.map((site) => {
        const markerElement = document.createElement('button');
        const pinElement = document.createElement('span');
        const iconElement = document.createElement('span');
        markerElement.type = 'button';
        markerElement.className = 'real-map-marker';
        pinElement.className = `real-map-pin ${selectedSiteIdRef.current === site.id ? 'real-map-pin--active' : ''}`;
        iconElement.className = 'real-map-pin__icon';
        markerElement.dataset.siteId = site.id;
        pinElement.dataset.score = formatRating(site.rating_promedio);
        pinElement.dataset.icon = getCategoryIcon(site.categoria);
        pinElement.dataset.category = normalizeCategory(site.categoria);
        pinElement.dataset.events = site.active_events_count > 0 ? 'event' : '';
        iconElement.textContent = getCategoryIcon(site.categoria);
        pinElement.appendChild(iconElement);
        markerElement.appendChild(pinElement);
        markerElement.setAttribute('aria-label', `Ver ${site.nombre}`);
        markerElement.addEventListener('click', () => setSelectedSiteId(site.id));

        return new maplibregl.Marker({ element: markerElement, anchor: 'bottom' })
          .setLngLat([site.longitud, site.latitud])
          .addTo(mapRef.current);
      });

      if (validSites.length > 1 && previousSiteIdsRef.current !== nextIds) {
        const bounds = new maplibregl.LngLatBounds();
        validSites.forEach((site) => bounds.extend([Number(site.longitud), Number(site.latitud)]));
        mapRef.current.fitBounds(bounds, { padding: 86, maxZoom: 13, duration: 600 });
        previousSiteIdsRef.current = nextIds;
      } else if (validSites.length === 1 && previousSiteIdsRef.current !== nextIds) {
        mapRef.current.easeTo({
          center: [Number(validSites[0].longitud), Number(validSites[0].latitud)],
          zoom: 14,
          duration: 500,
        });
        previousSiteIdsRef.current = nextIds;
      } else if (validSites.length === 0) {
        previousSiteIdsRef.current = '';
      }
    }

    syncMarkers();
  }, [sites, mapReady]);

  useEffect(() => {
    markersRef.current.forEach((marker) => {
      const element = marker.getElement();
      const isActive = element.dataset.siteId === String(selectedSiteId);
      element.querySelector('.real-map-pin')?.classList.toggle('real-map-pin--active', isActive);
    });
  }, [selectedSiteId]);

  async function submitReview(event) {
    event.preventDefault();
    if (!selectedSite) return;

    const response = await fetch(`/api/sites/${selectedSite.id}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...reviewForm, rating: Number(reviewForm.rating) }),
    });
    const data = await response.json();

    if (!response.ok) {
      setToast(data.error || 'No se pudo publicar la review.');
      return;
    }

    setReviewForm({ username: '', rating: 5, titulo: '', comentario: '' });
    setSelectedSite(data.sitio);
    setSites((current) => current.map((site) => site.id === data.sitio.id ? data.sitio : site));
    setStats((current) => ({ ...current, reviews: current.reviews + 1 }));
    setToast('Review publicada. La reputacion del sitio se actualizo.');
  }

  async function submitSuggestion(event) {
    event.preventDefault();
    const response = await fetch('/api/site-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ...buildSuggestionPayload(),
        suggested_by: suggestionForm.suggested_by || user?.username || '',
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setToast(data.error || 'No se pudo enviar la sugerencia.');
      return;
    }

    setSuggestionForm({ nombre: '', categoria: '', direccion: '', localidad: '', ciudad: '', descripcion: '', contacto: '', suggested_by: '', latitud: '', longitud: '' });
    setSuggestionPreview(null);
    setStats((current) => ({ ...current, sugerencias_pendientes: current.sugerencias_pendientes + 1 }));
    setToast(data.duplicates?.length ? 'Sitio sugerido con posible duplicado para revision.' : 'Sitio sugerido. Queda en cola de moderacion.');
  }

  function buildSuggestionPayload() {
    return {
      ...suggestionForm,
      latitud: suggestionForm.latitud === '' ? undefined : Number(suggestionForm.latitud),
      longitud: suggestionForm.longitud === '' ? undefined : Number(suggestionForm.longitud),
    };
  }

  async function previewSuggestion() {
    const response = await fetch('/api/site-suggestions/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(buildSuggestionPayload()),
    });
    const data = await response.json();
    if (!response.ok) {
      setToast(data.error || 'No se pudo validar la ubicacion.');
      return;
    }
    setSuggestionPreview(data);
    if (data.suggestion?.latitud && data.suggestion?.longitud) {
      setSuggestionForm((current) => ({
        ...current,
        direccion: current.direccion || data.suggestion.direccion || '',
        localidad: current.localidad || data.suggestion.localidad || '',
        ciudad: current.ciudad || data.suggestion.ciudad || '',
        latitud: String(data.suggestion.latitud),
        longitud: String(data.suggestion.longitud),
      }));
    }
    setToast(data.duplicates?.length ? 'Ubicacion detectada con posibles duplicados.' : 'Ubicacion detectada sin duplicados cercanos.');
  }

  async function reportSelectedSite() {
    if (!selectedSite) return;
    const response = await fetch(`/api/sites/${selectedSite.id}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ reason: 'Datos incorrectos', detail: 'Reporte enviado desde el MVP web.' }),
    });
    setToast(response.ok ? 'Reporte enviado a moderacion.' : 'No se pudo enviar el reporte.');
  }

  return (
    <main className="app-shell">
      <section className="map-experience" aria-label="Mapa comunitario de Rolling">
        <div className="map-canvas">
          <div className="map-surface" ref={mapContainerRef} />
          {mapError && (
            <div className="map-error">
              <strong>Mapa no disponible</strong>
              <span>{mapError}</span>
            </div>
          )}
          {!mapError && !isLoading && sites.length === 0 && (
            <div className="map-empty">
              <strong>Mapa listo para datos reales</strong>
              <span>Agrega negocios desde "Sugerir sitio" y apruebalos en el panel admin.</span>
            </div>
          )}

          <div className="map-brand">
            <strong>Rolling</strong>
            <span>Negocios y planes destacados por la comunidad</span>
          </div>

          <div className="map-stats" aria-label="Resumen de comunidad">
            <div><strong>{stats.sitios}</strong><span>sitios</span></div>
            <div><strong>{stats.rating_promedio}</strong><span>rating</span></div>
            <div><strong>{stats.eventos_activos}</strong><span>eventos</span></div>
          </div>
        </div>

        <aside className="control-panel" aria-label="Explorar sitios">
          <div className="panel-header">
            <span className="eyebrow">MVP conectado</span>
            <h1>Mapa vivo de sitios recomendados por vecinos.</h1>
            <p>
              Rolling prioriza reputacion, reviews utiles, eventos activos y reportes comunitarios
              para descubrir buenos lugares en cada localidad.
            </p>
            {user && (
              <div className="user-badge">
                <strong>{user.username}</strong> · Reputación {user.reputation}
              </div>
            )}
          </div>

          <form className="search-box">
            <label>
              Buscar
              <input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="Cafe, taller, musica..." />
            </label>
            <div className="filter-grid">
              <label>
                Localidad
                <select value={filters.localidad} onChange={(event) => setFilters((current) => ({ ...current, localidad: event.target.value }))}>
                  <option value="">Todas</option>
                  {localidades.map((localidad) => <option value={localidad} key={localidad}>{localidad}</option>)}
                </select>
              </label>
              <label>
                Actividad
                <select value={filters.activity} onChange={(event) => setFilters((current) => ({ ...current, activity: event.target.value }))}>
                  <option value="">Todas</option>
                  {activities.map((activity) => <option value={activity.nombre} key={activity.id}>{activity.nombre}</option>)}
                </select>
              </label>
            </div>
            <div className="filter-grid">
              <label>
                Rating minimo
                <select value={filters.min_rating} onChange={(event) => setFilters((current) => ({ ...current, min_rating: event.target.value }))}>
                  <option value="">Cualquiera</option>
                  <option value="4">4.0+</option>
                  <option value="4.5">4.5+</option>
                  <option value="4.8">4.8+</option>
                </select>
              </label>
              <label>
                Ordenar
                <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}>
                  <option value="recommended">Recomendados</option>
                  <option value="rating">Mejor rating</option>
                  <option value="events">Eventos</option>
                  <option value="new">Recientes</option>
                </select>
              </label>
            </div>
            <label className="toggle-row">
              <input type="checkbox" checked={filters.has_events} onChange={(event) => setFilters((current) => ({ ...current, has_events: event.target.checked }))} />
              Solo sitios con eventos activos
            </label>
          </form>

          {selectedSite && (
            <article className="featured-card">
              <div className="featured-card__top">
                <div>
                  <span>{selectedSite.barrio?.localidad} · {selectedSite.categoria}</span>
                  <h2>{selectedSite.nombre}</h2>
                </div>
                <strong>{formatRating(selectedSite.rating_promedio)}</strong>
              </div>
              <p>{selectedSite.descripcion}</p>
              <div className="meta-row">
                <span>{selectedSite.total_reviews} reviews</span>
                <span>{selectedSite.total_reviews_verificadas} verificadas</span>
                <span>confianza {selectedSite.trust_score}</span>
              </div>
              {selectedSite.active_events?.[0] && <div className="event-pill">{selectedSite.active_events[0].titulo}</div>}
              <div className="action-row">
                <a className="plain-action" href={selectedSite.website || '#'} target="_blank" rel="noopener noreferrer">Sitio web</a>
                <button className="plain-action" type="button" onClick={reportSelectedSite}>Reportar dato</button>
              </div>
            </article>
          )}
        </aside>
      </section>

      <section className="workspace-band">
        <div className="content-grid">
          <section className="panel-section">
            <div className="section-title">
              <span className="eyebrow">Ranking vivo</span>
              <h2>{isLoading ? 'Actualizando mapa...' : `${sites.length} sitios conectados al backend`}</h2>
            </div>
            <div className="site-list">
              {sites.map((site) => (
                <button type="button" className={`site-row ${selectedSiteId === site.id ? 'site-row--active' : ''}`} key={site.id} onClick={() => setSelectedSiteId(site.id)}>
                  <span className="site-row__score">{formatRating(site.rating_promedio)}</span>
                  <span>
                    <strong>{site.nombre}</strong>
                    <small>{site.barrio?.localidad} · {site.categoria} · {site.total_reviews} reviews</small>
                  </span>
                  <span className="site-row__tags">
                    {site.activities.slice(0, 2).map((activity) => <em key={activity.id}>{activity.nombre}</em>)}
                  </span>
                </button>
              ))}
              {!isLoading && sites.length === 0 && (
                <article className="empty-state">
                  <strong>No hay sitios publicados todavia</strong>
                  <span>La base quedo limpia para empezar a nutrir Rolling con negocios reales.</span>
                </article>
              )}
            </div>
          </section>

          <section className="panel-section detail-section">
            <div className="section-title">
              <span className="eyebrow">Ficha comunitaria</span>
              <h2>{selectedSite?.nombre || 'Selecciona un sitio'}</h2>
            </div>
            {selectedSite && (
              <>
                <div className="detail-block">
                  <h3>Eventos activos</h3>
                  <div className="event-list">
                    {(selectedSite.events || []).filter((event) => event.status === 'approved').slice(0, 4).map((event) => (
                      <article className="mini-card" key={event.id}>
                        <strong>{event.titulo}</strong>
                        <span>{event.fecha_inicio} · {event.hora || 'Hora por confirmar'} · {event.costo || 'Costo por confirmar'}</span>
                      </article>
                    ))}
                    {(!selectedSite.events || selectedSite.events.length === 0) && <p className="empty-copy">Este sitio aun no tiene eventos publicados.</p>}
                  </div>
                </div>

                <div className="detail-block">
                  <h3>Reviews recientes</h3>
                  <div className="review-list">
                    {(selectedSite.reviews || []).slice(0, 4).map((review) => (
                      <article className="mini-card" key={review.id}>
                        <strong>{review.rating}.0 · {review.titulo || 'Review comunitaria'}</strong>
                        <p>{review.comentario}</p>
                        <span>{review.user?.username || 'Vecino'} {review.verificada ? '· visita verificada' : ''}</span>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="forms-grid">
          <form className="panel-section form-panel" onSubmit={submitReview}>
            <span className="eyebrow">Aportar review</span>
            <h2>Valora el sitio seleccionado</h2>
            <div className="filter-grid">
              <label>Tu nombre<input value={reviewForm.username} onChange={(event) => setReviewForm((current) => ({ ...current, username: event.target.value }))} placeholder="Vecino Rolling" /></label>
              <label>Rating<select value={reviewForm.rating} onChange={(event) => setReviewForm((current) => ({ ...current, rating: event.target.value }))}>{[5, 4, 3, 2, 1].map((rating) => <option value={rating} key={rating}>{rating}</option>)}</select></label>
            </div>
            <label>Titulo<input value={reviewForm.titulo} onChange={(event) => setReviewForm((current) => ({ ...current, titulo: event.target.value }))} placeholder="Que destaca del lugar" /></label>
            <label>Comentario<textarea value={reviewForm.comentario} onChange={(event) => setReviewForm((current) => ({ ...current, comentario: event.target.value }))} placeholder="Cuenta que viviste, cuando fuiste y por que lo recomiendas." /></label>
            <button className="primary-action" type="submit" disabled={!selectedSite}>Publicar review</button>
          </form>

          <form className="panel-section form-panel" onSubmit={submitSuggestion}>
            <span className="eyebrow">Sugerir sitio</span>
            <h2>Postula un negocio local</h2>
            <div className="filter-grid">
              <label>Nombre<input value={suggestionForm.nombre} onChange={(event) => setSuggestionForm((current) => ({ ...current, nombre: event.target.value }))} /></label>
              <label>Categoria<input value={suggestionForm.categoria} onChange={(event) => setSuggestionForm((current) => ({ ...current, categoria: event.target.value }))} placeholder={categories[0] || 'Cafe'} /></label>
            </div>
            <div className="filter-grid">
              <label>Localidad<input value={suggestionForm.localidad} onChange={(event) => setSuggestionForm((current) => ({ ...current, localidad: event.target.value }))} /></label>
              <label>Ciudad<input value={suggestionForm.ciudad} onChange={(event) => setSuggestionForm((current) => ({ ...current, ciudad: event.target.value }))} placeholder="Bogota" /></label>
            </div>
            <div className="filter-grid">
              <label>Direccion<input value={suggestionForm.direccion} onChange={(event) => setSuggestionForm((current) => ({ ...current, direccion: event.target.value }))} /></label>
              <label>Contacto opcional<input value={suggestionForm.contacto} onChange={(event) => setSuggestionForm((current) => ({ ...current, contacto: event.target.value }))} /></label>
            </div>
            <div className="filter-grid">
              <label>Latitud<input value={suggestionForm.latitud} onChange={(event) => setSuggestionForm((current) => ({ ...current, latitud: event.target.value }))} placeholder="Auto" /></label>
              <label>Longitud<input value={suggestionForm.longitud} onChange={(event) => setSuggestionForm((current) => ({ ...current, longitud: event.target.value }))} placeholder="Auto" /></label>
            </div>
            <label>Por que destacarlo<textarea value={suggestionForm.descripcion} onChange={(event) => setSuggestionForm((current) => ({ ...current, descripcion: event.target.value }))} /></label>
            {suggestionPreview && (
              <div className="geo-preview">
                <strong>{suggestionPreview.suggestion?.latitud ? 'Ubicacion lista' : 'Ubicacion pendiente'}</strong>
                <span>
                  {suggestionPreview.suggestion?.latitud
                    ? `${Number(suggestionPreview.suggestion.latitud).toFixed(5)}, ${Number(suggestionPreview.suggestion.longitud).toFixed(5)}`
                    : 'Agrega direccion o selecciona coordenadas manuales.'}
                </span>
                {suggestionPreview.duplicates?.length > 0 && (
                  <em>Posible duplicado: {suggestionPreview.duplicates[0].nombre} a {suggestionPreview.duplicates[0].distancia_metros}m</em>
                )}
              </div>
            )}
            <div className="action-row">
              <button className="plain-action" type="button" onClick={previewSuggestion}>Validar ubicacion</button>
              <button className="primary-action" type="submit">Enviar a moderacion</button>
            </div>
          </form>
        </div>
      </section>

      <section className="architecture-band" aria-label="Arquitectura Rolling">
        <div className="architecture-header">
          <span className="eyebrow">Arquitectura objetivo</span>
          <h2>Roadmap tecnico para evolucionar el MVP sin rehacerlo.</h2>
        </div>
        <div className="architecture-stack">
          {architecture.map((layer) => (
            <article className={`architecture-layer architecture-layer--${layer.tone}`} key={layer.title}>
              <h3>{layer.title}</h3>
              <div>
                {layer.items.map(([title, description]) => (
                  <span className="architecture-node" key={title}><strong>{title}</strong><small>{description}</small></span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {toast && <button className="toast" type="button" onClick={() => setToast('')}>{toast}</button>}

      <style jsx>{`
        .user-badge {
          background: rgba(102, 126, 234, 0.1);
          border: 1px solid rgba(102, 126, 234, 0.3);
          padding: 0.75rem 1rem;
          border-radius: 6px;
          margin-top: 1rem;
          font-size: 0.875rem;
        }

        .user-badge strong {
          color: #667eea;
        }
      `}</style>
    </main>
  );
}

function hasValidCoordinates(site) {
  return Number.isFinite(Number(site?.latitud)) && Number.isFinite(Number(site?.longitud));
}

function formatRating(value) {
  const numeric = Number(value || 0);
  return numeric > 0 ? numeric.toFixed(1) : 'NEW';
}

function getCategoryIcon(category = '') {
  const normalized = normalizeCategory(category);
  return categoryIcons.find(([key]) => normalized.includes(key))?.[1] || 'LC';
}

function normalizeCategory(category = '') {
  return String(category || 'local').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
