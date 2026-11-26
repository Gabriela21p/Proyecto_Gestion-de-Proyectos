'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { BASEMAP_STYLE } from '@/lib/basemap';

const BOGOTA_CENTER = [-74.0721, 4.6486];
const BOGOTA_BOUNDS = [[-74.231, 4.471], [-73.985, 4.839]];
const initialFilters = { q: '', localidad: '', activity: '', min_rating: '', has_events: false, sort: 'recommended' };

// Esta pantalla coordina dos piezas que deben sentirse como una sola: el listado
// de lugares y el mapa. La selección siempre se refleja en ambos lados.
export default function ExplorePage() {
  const { token } = useAuth();
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const addressMarkerRef = useRef(null);
  const [sites, setSites] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({ sitios: 0, reviews: 0, eventos_activos: 0, rating_promedio: 0 });
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [addressResult, setAddressResult] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    // Bootstrap reúne catálogos y métricas para evitar varias solicitudes
    // pequeñas durante el primer render.
    fetch('/api/bootstrap').then((response) => response.ok ? response.json() : null).then((data) => {
      if (!data) return;
      setStats(data.stats || {});
      setNeighborhoods(data.neighborhoods || []);
      setActivities(data.activities || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function loadSites() {
      // Los filtros viajan al backend para que mapa y lista compartan resultados.
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== false) params.set(key, String(value));
      });
      const response = await fetch(`/api/sites?${params.toString()}`);
      const data = response.ok ? await response.json() : [];
      const bogotaOnly = data.filter(isBogotaSite);
      setSites(bogotaOnly);
      setSelectedId((current) => bogotaOnly.some((site) => site.id === current) ? current : bogotaOnly[0]?.id || null);
      setLoading(false);
    }
    loadSites().catch(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    // La ficha completa sólo se consulta para el lugar que está activo.
    if (!selectedId) {
      setSelected(null);
      return;
    }
    fetch(`/api/sites/${selectedId}`).then((response) => response.ok ? response.json() : null).then(setSelected).catch(() => {});
  }, [selectedId]);

  useEffect(() => {
    // MapLibre se carga en el cliente porque necesita APIs del navegador. La
    // instancia se conserva para no reconstruir el mapa al cambiar filtros.
    if (!mapNode.current || mapRef.current) return;
    let mounted = true;
    async function bootMap() {
      const maplibregl = (await import('maplibre-gl')).default;
      if (!mounted) return;
      const map = new maplibregl.Map({
        container: mapNode.current,
        style: BASEMAP_STYLE,
        center: BOGOTA_CENTER,
        zoom: 11.35,
        minZoom: 10.6,
        maxZoom: 18,
        maxBounds: BOGOTA_BOUNDS,
        pitchWithRotate: false,
        dragRotate: false
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.on('load', () => { setMapReady(true); map.resize(); });
      map.on('error', (event) => setMapError(event?.error?.message || 'No se pudo cargar el mapa'));
      mapRef.current = map;
    }
    bootMap();
    return () => {
      mounted = false;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      addressMarkerRef.current?.remove();
      addressMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    async function drawMarkers() {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = sites.filter(hasCoords).map((site) => {
        const element = document.createElement('button');
        element.className = `rolling-pin ${site.id === selectedId ? 'rolling-pin--active' : ''}`;
        element.innerHTML = `<span>${categoryGlyph(site.categoria)}</span>`;
        element.title = site.nombre;
        element.setAttribute('aria-label', `Ver ${site.nombre}`);
        element.addEventListener('click', () => setSelectedId(site.id));
        return new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([site.longitud, site.latitud]).addTo(mapRef.current);
      });
    }
    drawMarkers();
    return () => { cancelled = true; };
  }, [sites, selectedId, mapReady]);

  useEffect(() => {
    if (!selected || !hasCoords(selected) || !mapRef.current) return;
    mapRef.current.easeTo({ center: [selected.longitud, selected.latitud], zoom: 14.2, duration: 650 });
  }, [selected]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    addressMarkerRef.current?.remove();
    addressMarkerRef.current = null;
    if (!addressResult) return;

    let cancelled = false;
    async function drawAddressMarker() {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !mapRef.current) return;
      const element = document.createElement('div');
      element.className = 'address-search-pin';
      element.innerHTML = '<span>⌖</span>';
      addressMarkerRef.current = new maplibregl.Marker({ element, anchor: 'bottom' })
        .setLngLat([addressResult.longitud, addressResult.latitud])
        .addTo(mapRef.current);
      mapRef.current.easeTo({ center: [addressResult.longitud, addressResult.latitud], zoom: 16, duration: 750 });
    }
    drawAddressMarker();
    return () => { cancelled = true; };
  }, [addressResult, mapReady]);

  async function searchAddress(event) {
    // Preview ubica el punto, pero no registra nada hasta que se confirme.
    event?.preventDefault();
    const address = filters.q.trim();
    if (address.length < 5) {
      setAddressError('Escribe una dirección más completa para ubicarla.');
      return;
    }

    setAddressLoading(true);
    setAddressError('');
    setAddressResult(null);
    try {
      const response = await fetch('/api/site-suggestions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          nombre: 'Ubicación consultada',
          direccion: address,
          ciudad: 'Bogota',
          descripcion: 'Dirección consultada desde el explorador de Rolling.'
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No fue posible ubicar esta dirección.');
      const suggestion = data.suggestion || {};
      if (!suggestion.latitud || !suggestion.longitud) throw new Error('No encontramos un punto preciso. Intenta incluir calle, carrera y número.');
      setSelectedId(null);
      setSelected(null);
      setAddressResult({
        direccion: suggestion.direccion || address,
        localidad: suggestion.localidad || '',
        latitud: Number(suggestion.latitud),
        longitud: Number(suggestion.longitud),
        duplicates: data.duplicates || []
      });
    } catch (error) {
      setAddressError(error.message);
    } finally {
      setAddressLoading(false);
    }
  }

  const localidades = useMemo(() => [...new Set(neighborhoods.map((item) => item.localidad).filter(Boolean))].sort(), [neighborhoods]);
  const hasActiveFilters = Object.values(filters).some((value) => value !== '' && value !== false && value !== 'recommended');
  const registrationHref = addressResult ? `/app/registrar?${new URLSearchParams({
    direccion: addressResult.direccion,
    localidad: addressResult.localidad,
    latitud: String(addressResult.latitud),
    longitud: String(addressResult.longitud)
  }).toString()}` : '/app/registrar';

  return (
    <main className="explore-workspace">
      <aside className="discovery-panel">
        <div className="discovery-intro">
          <span className="city-kicker">Bogotá, Colombia</span>
          <div className="intro-title">
            <h1>Encuentra tu próximo lugar favorito.</h1>
            <span className="result-count" aria-label={`${sites.length} resultados`}>{loading ? '—' : sites.length}</span>
          </div>
          <p>Recomendaciones locales, planes culturales y espacios que vale la pena compartir.</p>
        </div>

        <form className="search-field" onSubmit={searchAddress}>
          <span aria-hidden="true">⌕</span>
          <input aria-label="Buscar lugares o direcciones" value={filters.q} onChange={(event) => { setFilters((current) => ({ ...current, q: event.target.value })); setAddressResult(null); setAddressError(''); }} placeholder="Lugar o dirección en Bogotá..." />
          {filters.q && <button type="button" className="search-clear" onClick={() => { setFilters((current) => ({ ...current, q: '' })); setAddressResult(null); setAddressError(''); }} aria-label="Limpiar búsqueda">×</button>}
          <button type="submit" className="address-search-button" disabled={addressLoading || filters.q.trim().length < 5}>{addressLoading ? '…' : 'Ubicar'}</button>
        </form>
        {addressError && <div className="address-search-error">{addressError}</div>}

        <div className="filter-row">
          <label><span>Zona</span><select value={filters.localidad} onChange={(event) => setFilters((current) => ({ ...current, localidad: event.target.value }))}>
            <option value="">Toda Bogotá</option>
            {localidades.map((item) => <option key={item}>{item}</option>)}
          </select></label>
          <label><span>Plan</span><select value={filters.activity} onChange={(event) => setFilters((current) => ({ ...current, activity: event.target.value }))}>
            <option value="">Todos</option>
            {activities.map((item) => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}
          </select></label>
          <label><span>Orden</span><select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}>
            <option value="recommended">Recomendados</option>
            <option value="rating">Mejor valorados</option>
            <option value="events">Con eventos</option>
          </select></label>
        </div>

        <div className="quick-filters">
          <button className={filters.min_rating === '4' ? 'quick-chip quick-chip--active' : 'quick-chip'} onClick={() => setFilters((current) => ({ ...current, min_rating: current.min_rating === '4' ? '' : '4' }))}>★ 4.0+</button>
          <button className={filters.has_events ? 'quick-chip quick-chip--active' : 'quick-chip'} onClick={() => setFilters((current) => ({ ...current, has_events: !current.has_events }))}>Con eventos</button>
          {hasActiveFilters && <button className="clear-filters" onClick={() => setFilters(initialFilters)}>Limpiar filtros</button>}
        </div>

        <div className="places-list" aria-live="polite">
          {loading && [0, 1, 2].map((item) => <div className="place-skeleton" key={item} />)}
          {!loading && sites.map((site) => (
            <button key={site.id} className={site.id === selectedId ? 'place-card place-card--active' : 'place-card'} onClick={() => setSelectedId(site.id)}>
              <span className="place-card__icon" aria-hidden="true">{categoryGlyph(site.categoria)}</span>
              <span className="place-card__content">
                <span className="place-card__eyebrow">{site.categoria} · {site.barrio?.localidad || 'Bogotá'}</span>
                <strong>{site.nombre}</strong>
                <small>{site.direccion || 'Dirección por confirmar'}</small>
                <span className="place-card__meta">
                  <span>{Number(site.rating_promedio || 0) > 0 ? `★ ${Number(site.rating_promedio).toFixed(1)} · ${site.total_reviews} reseñas` : 'Nuevo en Rolling'}</span>
                  {site.fuente === 'google_places_demo' && <em>Demo · Google Maps</em>}
                </span>
              </span>
              <span className="place-card__arrow" aria-hidden="true">→</span>
            </button>
          ))}
          {!loading && sites.length === 0 && (
            <div className="empty-state-card">
              <span>⌖</span><strong>No encontramos lugares con esos filtros</strong>
              <p>Amplía la zona o limpia la búsqueda para seguir explorando.</p>
              <button onClick={() => setFilters(initialFilters)}>Ver todos los lugares</button>
            </div>
          )}
        </div>
      </aside>

      <section className="map-stage" aria-label="Mapa de lugares en Bogotá">
        <div ref={mapNode} className="map-stage__surface" />
        {mapError && <div className="map-alert">{mapError}</div>}

        <div className="map-status">
          <span className="map-status__dot" />
          <span><strong>{stats.sitios || sites.length}</strong> lugares en comunidad</span>
          <span><strong>{stats.eventos_activos || 0}</strong> eventos activos</span>
        </div>

        {addressResult && (
          <article className="address-confirmation">
            <span className="address-confirmation__kicker">Dirección encontrada</span>
            <h2>{addressResult.direccion}</h2>
            <p>¿Este es el lugar que estabas buscando?</p>
            {addressResult.duplicates.length > 0 ? (
              <div className="address-match">
                <small>Encontramos un lugar registrado cerca</small>
                <strong>{addressResult.duplicates[0].nombre}</strong>
              </div>
            ) : <small className="address-new">Aún no hay un lugar registrado en este punto.</small>}
            <div className="address-confirmation__actions">
              {addressResult.duplicates.length > 0 && <Link href={`/app/locales/${addressResult.duplicates[0].id}`}>Ver lugar existente</Link>}
              <Link href={registrationHref}>Registrar este lugar</Link>
              <button type="button" onClick={() => setAddressResult(null)}>Buscar otra dirección</button>
            </div>
          </article>
        )}

        {!addressResult && selected && (
          <article className="map-preview">
            <div className="map-preview__top">
              <span className="map-preview__icon">{categoryGlyph(selected.categoria)}</span>
              <div><small>{selected.categoria} · {selected.barrio?.localidad}</small><h2>{selected.nombre}</h2></div>
            </div>
            <p>{selected.descripcion || 'Este lugar está empezando a construir su historia dentro de Rolling.'}</p>
            <div className="map-preview__facts">
              <span>{selected.direccion}</span>
              <span>{Number(selected.rating_promedio || 0) > 0 ? `★ ${Number(selected.rating_promedio).toFixed(1)}` : 'Sin reseñas todavía'}</span>
            </div>
            <div className="map-preview__actions">
              <Link href={`/app/locales/${selected.id}`}>Ver ficha completa</Link>
              {selected.website && <a href={selected.website} target="_blank" rel="noreferrer">Abrir en Maps ↗</a>}
            </div>
          </article>
        )}

        <Link href={registrationHref} className="register-fab"><span>＋</span>Agregar un lugar</Link>
      </section>

      <style jsx global>{`
        .explore-workspace{height:calc(100vh - 76px);display:grid;grid-template-columns:minmax(390px,450px) minmax(0,1fr);overflow:hidden;background:#f7f5ef;color:#18231f}.discovery-panel{position:relative;z-index:5;display:flex;flex-direction:column;min-height:0;padding:34px 28px 22px;background:#f8f6f0;border-right:1px solid #deddd5;box-shadow:18px 0 50px rgba(28,42,36,.08)}.city-kicker{display:inline-flex;align-items:center;gap:7px;color:#e25f3f;font-size:var(--fs-info);font-weight:900;letter-spacing:.14em;text-transform:uppercase}.city-kicker::before{content:"";width:20px;height:2px;background:#e25f3f}.intro-title{display:flex;align-items:flex-start;gap:18px}.discovery-intro h1{max-width:350px;margin:10px 0 8px;font-family:var(--font-title);font-size:var(--fs-display);font-weight:500;line-height:1.08;letter-spacing:-.01em}.discovery-intro p{max-width:360px;margin:0 0 22px;color:#64716b;font-size:var(--fs-body);line-height:1.55}.result-count{display:grid;flex:0 0 auto;width:38px;height:38px;margin-top:12px;place-items:center;border-radius:50%;color:#fff;background:#225e49;font-size:var(--fs-info);font-weight:900}.search-field{display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:7px;border:1px solid #d8d9d1;border-radius:14px;padding:0 7px 0 13px;background:#fff;box-shadow:0 7px 22px rgba(28,42,36,.06)}.search-field>span{color:#225e49;font-size:var(--fs-subtitle)}.search-field input{height:48px;min-height:0;border:0;padding:0;background:transparent;outline:0;font-size:var(--fs-body)}.search-clear{display:grid;width:26px;height:26px;place-items:center;border-radius:50%;background:#edf0eb;color:#58645f}.address-search-button{height:34px;border-radius:9px;padding:0 11px;color:#fff;background:#225e49;font-size:var(--fs-comment);font-weight:900}.address-search-button:disabled{opacity:.35}.address-search-error{margin-top:7px;border-left:2px solid #d25d41;padding:5px 8px;color:#9a3f2e;font-size:var(--fs-comment)}.filter-row{display:grid;grid-template-columns:1.05fr .8fr 1fr;gap:8px;margin-top:10px}.filter-row label{display:grid;gap:4px;color:#78827d;font-size:var(--fs-comment);letter-spacing:.08em;text-transform:uppercase}.filter-row select{height:39px;min-height:0;border:1px solid #d8d9d1;border-radius:11px;padding:0 9px;background:#fff;color:#26332d;font-size:var(--fs-info);font-weight:700}.quick-filters{display:flex;align-items:center;gap:7px;min-height:45px;padding:8px 0 10px;border-bottom:1px solid #deddd5}.quick-chip{border:1px solid #d8d9d1;border-radius:999px;padding:7px 10px;background:transparent;color:#52605a;font-size:var(--fs-info);font-weight:800}.quick-chip--active{border-color:#225e49;color:#fff;background:#225e49}.clear-filters{margin-left:auto;padding:6px;background:transparent;color:#c54e34;font-size:var(--fs-comment);font-weight:800}.places-list{display:grid;align-content:start;gap:8px;min-height:0;overflow:auto;padding:10px 4px 28px 0;scrollbar-width:thin}.place-card{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:12px;width:100%;border:1px solid transparent;border-radius:14px;padding:12px;text-align:left;background:transparent;transition:background .18s,border-color .18s,transform .18s,box-shadow .18s}.place-card:hover{background:#fff;border-color:#e2e1da;transform:translateX(2px)}.place-card--active{border-color:#cfd9d3;background:#fff;box-shadow:0 10px 28px rgba(33,57,47,.09)}.place-card__icon{display:grid;width:44px;height:44px;place-items:center;border-radius:12px;color:#1f5b46;background:#e3ece5;font-size:var(--fs-body)}.place-card--active .place-card__icon{color:#fff;background:#225e49}.place-card__content{display:grid;min-width:0;gap:3px}.place-card__eyebrow{color:#d05b3f;font-size:var(--fs-comment);font-weight:900;letter-spacing:.07em;text-transform:uppercase}.place-card__content strong{overflow:hidden;color:#1b2923;font-family:var(--font-title);font-size:var(--fs-body);font-weight:600;text-overflow:ellipsis;white-space:nowrap}.place-card__content small{overflow:hidden;color:#76807b;font-size:var(--fs-info);text-overflow:ellipsis;white-space:nowrap}.place-card__meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:3px;color:#225e49;font-size:var(--fs-comment);font-weight:800}.place-card__meta em{border-radius:999px;padding:3px 6px;color:#5f675a;background:#eef0df;font-size:var(--fs-comment);font-style:normal;text-transform:uppercase}.place-card__arrow{color:#a3aba6;font-size:var(--fs-body)}.place-skeleton{height:78px;border-radius:14px;background:linear-gradient(90deg,#edebe5,#f8f7f2,#edebe5);background-size:200% 100%;animation:shimmer 1.25s infinite}.empty-state-card{display:grid;justify-items:center;gap:8px;margin-top:18px;border:1px dashed #cfd4cd;border-radius:16px;padding:28px 18px;text-align:center;background:#fff}.empty-state-card>span{font-size:var(--fs-title);color:#225e49}.empty-state-card p{margin:0;color:#77817c;font-size:var(--fs-info);line-height:1.45}.empty-state-card button{margin-top:4px;border-radius:999px;padding:9px 13px;color:#fff;background:#225e49;font-size:var(--fs-info);font-weight:800}.map-stage{position:relative;min-width:0;overflow:hidden;background:#f2efe9}.map-stage__surface{position:absolute;inset:0}.map-status{position:absolute;z-index:3;top:20px;left:20px;display:flex;align-items:center;gap:13px;border:1px solid #d9ddd7;border-radius:8px;padding:9px 14px;color:#435149;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12);font-size:var(--fs-info)}.map-status span+span{padding-left:13px;border-left:1px solid #d9ddd7}.map-status__dot{width:8px;height:8px;border-radius:50%;background:#225e49}.map-preview,.address-confirmation{position:absolute;z-index:3;right:22px;bottom:34px;width:min(390px,calc(100% - 44px));border:1px solid #d9ddd7;border-radius:10px;padding:18px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.14)}.map-preview__top{display:grid;grid-template-columns:44px 1fr;align-items:center;gap:11px}.map-preview__icon{display:grid;width:44px;height:44px;place-items:center;border-radius:12px;color:#fff;background:#e36548}.map-preview small{color:#7a837e;font-size:var(--fs-comment);font-weight:800;text-transform:uppercase}.map-preview h2,.address-confirmation h2{margin:5px 0 8px;font-family:var(--font-title);font-size:var(--fs-subtitle);font-weight:600}.map-preview p,.address-confirmation p{margin:12px 0;color:#5f6c65;font-size:var(--fs-info);line-height:1.5}.map-preview__facts{display:flex;flex-wrap:wrap;gap:6px}.map-preview__facts span{border-radius:999px;padding:6px 9px;background:#eceee8;color:#4d5b54;font-size:var(--fs-comment);font-weight:700}.map-preview__actions,.address-confirmation__actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.map-preview__actions a,.address-confirmation__actions a,.address-confirmation__actions button{border-radius:10px;padding:10px;text-align:center;font-size:var(--fs-info);font-weight:900}.map-preview__actions a:first-child,.address-confirmation__actions a{color:#fff;background:#225e49}.map-preview__actions a:last-child{border:1px solid #d7d9d2;background:#fff;color:#39473f}.address-confirmation__kicker{color:#d25d41;font-size:var(--fs-comment);font-weight:900;letter-spacing:.12em;text-transform:uppercase}.address-new{display:block;color:#7c867f;font-size:var(--fs-info)}.address-match{display:grid;gap:3px;border-left:3px solid #dbe9b5;padding:8px 10px;background:#f2f5ec}.address-match small{color:#7a847e;font-size:var(--fs-comment)}.address-match strong{font-size:var(--fs-info)}.address-confirmation__actions button{grid-column:1/-1;border:1px solid #d7d9d2;background:#fff;color:#5a665f}.address-search-pin{display:flex;flex-direction:column;align-items:center;width:40px;height:50px}.address-search-pin span{display:grid;width:38px;height:38px;place-items:center;border:3px solid #fff;border-radius:50%;color:#fff;background:#c4492c;font-size:18px;box-shadow:0 1px 5px rgba(0,0,0,.35);animation:address-pop .28s ease-out}.address-search-pin::after{content:"";margin-top:-3px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:11px solid #c4492c}.register-fab{position:absolute;z-index:3;left:20px;bottom:34px;display:flex;align-items:center;gap:9px;border-radius:8px;padding:8px 15px 8px 8px;color:#fff;background:#19251f;box-shadow:0 2px 8px rgba(0,0,0,.2);font-size:var(--fs-info);font-weight:900}.register-fab span{display:grid;width:30px;height:30px;place-items:center;border-radius:50%;color:#19251f;background:#dbe9b5;font-size:var(--fs-body)}.rolling-pin{display:flex;flex-direction:column;align-items:center;width:32px;height:42px;border:0;padding:0;background:transparent;transform-origin:bottom;transition:transform .16s}.rolling-pin::after{content:"";margin-top:-2px;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid #225e49}.rolling-pin span{display:grid;width:30px;height:30px;place-items:center;border:2px solid #fff;border-radius:50%;color:#fff;background:#225e49;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.35)}.rolling-pin--active{z-index:2;transform:scale(1.2)}.rolling-pin--active::after{border-top-color:#c4492c}.rolling-pin--active span{background:#c4492c}.map-alert{position:absolute;z-index:5;top:70px;left:20px;border-radius:10px;padding:10px 12px;color:#8d2f22;background:#fff0ec;font-size:var(--fs-info)}@keyframes shimmer{to{background-position:-200% 0}}@keyframes address-pop{from{opacity:0;transform:translateY(-12px) scale(.8)}to{opacity:1;transform:none}}
        @media(max-width:980px){.explore-workspace{height:auto;min-height:calc(100vh - 110px);grid-template-columns:1fr;overflow:visible}.discovery-panel{padding:24px 18px 12px;border-right:0}.discovery-intro h1{font-size:var(--fs-display)}.places-list{max-height:390px}.map-stage{min-height:590px}.map-preview{right:14px;bottom:14px}.register-fab{position:absolute;z-index:3;left:20px;bottom:34px;display:flex;align-items:center;gap:9px;border-radius:8px;padding:8px 15px 8px 8px;color:#fff;background:#19251f;box-shadow:0 2px 8px rgba(0,0,0,.2);font-size:var(--fs-info);font-weight:900}.map-status{position:absolute;z-index:3;top:20px;left:20px;display:flex;align-items:center;gap:13px;border:1px solid #d9ddd7;border-radius:8px;padding:9px 14px;color:#435149;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12);font-size:var(--fs-info)}}
        @media(max-width:560px){.filter-row{grid-template-columns:1fr 1fr}.filter-row label:last-child{grid-column:1/-1}.map-status span:last-child{display:none}.map-preview{width:calc(100% - 28px)}.map-preview__actions{grid-template-columns:1fr}.register-fab{position:absolute;z-index:3;left:20px;bottom:34px;display:flex;align-items:center;gap:9px;border-radius:8px;padding:8px 15px 8px 8px;color:#fff;background:#19251f;box-shadow:0 2px 8px rgba(0,0,0,.2);font-size:var(--fs-info);font-weight:900}.map-stage{min-height:650px}}
      `}</style>
    </main>
  );
}

function hasCoords(site) {
  return Number.isFinite(Number(site?.latitud)) && Number.isFinite(Number(site?.longitud));
}

function isBogotaSite(site) {
  const city = String(site?.barrio?.ciudad || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (city.includes('bogota')) return true;
  const lat = Number(site?.latitud);
  const lng = Number(site?.longitud);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 4.471 && lat <= 4.839 && lng >= -74.231 && lng <= -73.985;
}

function categoryGlyph(category) {
  const value = String(category || '').toLowerCase();
  if (value.includes('cafe')) return '☕';
  if (value.includes('rest')) return '🍽';
  if (value.includes('bar')) return '◐';
  if (value.includes('cultur') || value.includes('muse') || value.includes('bibli')) return '◆';
  if (value.includes('mercado') || value.includes('tienda') || value.includes('shop')) return '◫';
  if (value.includes('jardin') || value.includes('parque')) return '✦';
  return '●';
}
