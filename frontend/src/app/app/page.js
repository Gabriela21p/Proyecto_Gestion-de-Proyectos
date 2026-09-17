'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

const BOGOTA_CENTER = [-74.0721, 4.6486];
const BOGOTA_BOUNDS = [[-74.231, 4.471], [-73.985, 4.839]];
const initialFilters = { q: '', localidad: '', activity: '', min_rating: '', has_events: false, sort: 'recommended' };

export default function ExplorePage() {
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
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

  useEffect(() => {
    fetch('/api/bootstrap').then((r) => r.ok ? r.json() : null).then((data) => {
      if (!data) return;
      setStats(data.stats || {});
      setNeighborhoods(data.neighborhoods || []);
      setActivities(data.activities || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function loadSites() {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== false) params.set(key, String(value));
      });
      params.set('localidad', filters.localidad || '');
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
    if (!selectedId) {
      setSelected(null);
      return;
    }
    fetch(`/api/sites/${selectedId}`).then((r) => r.ok ? r.json() : null).then(setSelected).catch(() => {});
  }, [selectedId]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    let mounted = true;
    async function bootMap() {
      const maplibregl = (await import('maplibre-gl')).default;
      if (!mounted) return;
      const map = new maplibregl.Map({
        container: mapNode.current,
        style: {
          version: 8,
          sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap contributors' } },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
        },
        center: BOGOTA_CENTER,
        zoom: 11.4,
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
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    async function draw() {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = sites.filter(hasCoords).map((site) => {
        const el = document.createElement('button');
        el.className = `rolling-pin ${site.id === selectedId ? 'rolling-pin--active' : ''}`;
        el.innerHTML = `<span>${categoryGlyph(site.categoria)}</span><b>${Number(site.rating_promedio || 0).toFixed(1)}</b>`;
        el.title = site.nombre;
        el.addEventListener('click', () => setSelectedId(site.id));
        return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([site.longitud, site.latitud]).addTo(mapRef.current);
      });
    }
    draw();
    return () => { cancelled = true; };
  }, [sites, selectedId, mapReady]);

  useEffect(() => {
    if (!selected || !hasCoords(selected) || !mapRef.current) return;
    mapRef.current.easeTo({ center: [selected.longitud, selected.latitud], zoom: 14, duration: 650 });
  }, [selected]);

  const localidades = useMemo(() => [...new Set(neighborhoods.map((n) => n.localidad).filter(Boolean))].sort(), [neighborhoods]);

  return (
    <main className="bogota-explorer">
      <section className="explorer-map">
        <div ref={mapNode} className="explorer-map__surface" />
        <div className="map-vignette" />
        {mapError && <div className="glass-alert">{mapError}</div>}

        <div className="liquid-search glass-card">
          <div className="liquid-search__heading">
            <span className="live-dot" />
            <div><strong>Explorar Bogotá</strong><small>Locales verificados por la comunidad</small></div>
          </div>
          <input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="¿Qué quieres encontrar hoy?" />
          <div className="filter-chips">
            <select value={filters.localidad} onChange={(e) => setFilters((f) => ({ ...f, localidad: e.target.value }))}>
              <option value="">Toda Bogotá</option>
              {localidades.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={filters.activity} onChange={(e) => setFilters((f) => ({ ...f, activity: e.target.value }))}>
              <option value="">Cualquier categoría</option>
              {activities.map((item) => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}
            </select>
            <select value={filters.min_rating} onChange={(e) => setFilters((f) => ({ ...f, min_rating: e.target.value }))}>
              <option value="">Cualquier rating</option><option value="4">4.0+</option><option value="4.5">4.5+</option>
            </select>
          </div>
        </div>

        <div className="map-kpis glass-card">
          <div><strong>{stats.sitios || 0}</strong><span>locales</span></div>
          <div><strong>{stats.rating_promedio || 0}</strong><span>rating</span></div>
          <div><strong>{stats.eventos_activos || 0}</strong><span>eventos</span></div>
        </div>

        <Link href="/app/registrar" className="floating-register neumorphic-button">+ Registrar un local</Link>
      </section>

      <aside className="explorer-drawer glass-card">
        <div className="drawer-head">
          <div><span className="eyebrow">BOGOTÁ D.C.</span><h1>Lugares para descubrir</h1></div>
          <span className="result-count">{loading ? '…' : sites.length}</span>
        </div>

        <div className="site-scroll">
          {sites.map((site) => (
            <button key={site.id} className={`place-card liquid-card ${site.id === selectedId ? 'place-card--active' : ''}`} onClick={() => setSelectedId(site.id)}>
              <span className="place-icon">{categoryGlyph(site.categoria)}</span>
              <span className="place-copy">
                <strong>{site.nombre}</strong>
                <small>{site.barrio?.localidad || 'Bogotá'} · {site.categoria}</small>
                <span className="place-meta">★ {Number(site.rating_promedio || 0).toFixed(1)} · {site.total_reviews || 0} reseñas</span>
              </span>
              <span className="chevron">›</span>
            </button>
          ))}
          {!loading && sites.length === 0 && <div className="empty-liquid"><strong>Aún no hay locales con esos filtros</strong><span>Prueba otra búsqueda o registra el primero.</span></div>}
        </div>

        {selected && (
          <div className="selected-preview liquid-card">
            <div className="preview-top"><div><span>{selected.categoria}</span><h2>{selected.nombre}</h2></div><b>★ {Number(selected.rating_promedio || 0).toFixed(1)}</b></div>
            <p>{selected.descripcion || 'Este lugar todavía está construyendo su historia dentro de Rolling.'}</p>
            <div className="preview-actions">
              <Link href={`/app/locales/${selected.id}`} className="primary-glass-action">Ver ficha</Link>
              <Link href={`/app/locales/${selected.id}/clasificar`} className="soft-action">Clasificar</Link>
            </div>
          </div>
        )}
      </aside>

      <style jsx global>{`
        .bogota-explorer{height:calc(100vh - 65px);display:grid;grid-template-columns:minmax(0,1fr) 390px;background:#dfe7e3;overflow:hidden}.explorer-map{position:relative;min-width:0;overflow:hidden}.explorer-map__surface{position:absolute;inset:0}.map-vignette{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(12,18,28,.22),transparent 28%,transparent 75%,rgba(12,18,28,.08));z-index:1}.glass-card{background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(255,255,255,.52));border:1px solid rgba(255,255,255,.72);box-shadow:0 20px 50px rgba(32,43,58,.16),inset 0 1px 0 rgba(255,255,255,.95);backdrop-filter:blur(24px) saturate(145%);-webkit-backdrop-filter:blur(24px) saturate(145%)}.liquid-search{position:absolute;z-index:5;top:24px;left:24px;width:min(600px,calc(100% - 48px));border-radius:24px;padding:16px}.liquid-search__heading{display:flex;align-items:center;gap:10px;margin-bottom:12px}.liquid-search__heading>div{display:grid}.liquid-search__heading strong{font-size:.95rem}.liquid-search__heading small{color:#6b7280;font-size:.72rem}.live-dot{width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 0 5px rgba(16,185,129,.13)}.liquid-search input{width:100%;height:48px;border:0;border-radius:15px;padding:0 16px;background:rgba(248,250,252,.78);box-shadow:inset 5px 5px 12px rgba(30,41,59,.07),inset -5px -5px 12px rgba(255,255,255,.85);outline:none}.filter-chips{display:flex;gap:8px;margin-top:10px}.filter-chips select{min-width:0;flex:1;border:1px solid rgba(148,163,184,.24);border-radius:12px;background:rgba(255,255,255,.62);padding:9px 10px;color:#334155;font-size:.77rem}.map-kpis{position:absolute;z-index:4;left:24px;bottom:24px;border-radius:18px;padding:11px 14px;display:flex;gap:18px}.map-kpis div{display:grid;text-align:center}.map-kpis strong{font-size:1rem}.map-kpis span{font-size:.65rem;color:#64748b;text-transform:uppercase;letter-spacing:.08em}.floating-register{position:absolute;z-index:4;right:24px;bottom:24px}.neumorphic-button{background:#edf2f1;color:#273244;border-radius:16px;padding:13px 17px;font-weight:800;box-shadow:8px 8px 18px rgba(66,79,92,.22),-8px -8px 18px rgba(255,255,255,.9);transition:.2s}.neumorphic-button:hover{transform:translateY(-2px)}.explorer-drawer{position:relative;z-index:6;border-radius:0;border-top:0;border-bottom:0;border-right:0;padding:20px;overflow:hidden;display:flex;flex-direction:column}.drawer-head{display:flex;align-items:flex-start;justify-content:space-between;padding:6px 4px 15px}.drawer-head h1{font-size:1.35rem;margin:3px 0}.eyebrow{font-size:.66rem;font-weight:900;letter-spacing:.14em;color:#6366f1}.result-count{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;background:rgba(255,255,255,.7);box-shadow:4px 4px 10px rgba(71,85,105,.12),-4px -4px 10px rgba(255,255,255,.9);font-weight:900}.site-scroll{display:grid;gap:9px;overflow:auto;padding:2px 4px 18px}.liquid-card{border:1px solid rgba(255,255,255,.75);background:linear-gradient(145deg,rgba(255,255,255,.68),rgba(244,247,250,.48));box-shadow:0 9px 22px rgba(51,65,85,.08),inset 0 1px 0 #fff;backdrop-filter:blur(14px)}.place-card{width:100%;display:grid;grid-template-columns:45px 1fr auto;align-items:center;text-align:left;gap:10px;border-radius:17px;padding:11px;transition:.2s}.place-card:hover,.place-card--active{transform:translateX(-3px);background:linear-gradient(135deg,rgba(238,242,255,.94),rgba(255,255,255,.72));border-color:rgba(99,102,241,.35);box-shadow:0 12px 30px rgba(79,70,229,.12),inset 0 1px 0 #fff}.place-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#fff,#e9eef3);box-shadow:5px 5px 12px rgba(71,85,105,.13),-5px -5px 12px #fff;font-size:1.1rem}.place-copy{display:grid;gap:2px;min-width:0}.place-copy strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.place-copy small{color:#64748b}.place-meta{font-size:.72rem;color:#4f46e5;font-weight:700}.chevron{font-size:1.4rem;color:#94a3b8}.selected-preview{margin-top:auto;border-radius:21px;padding:15px}.preview-top{display:flex;justify-content:space-between;gap:12px}.preview-top span{font-size:.7rem;text-transform:uppercase;color:#6366f1;font-weight:900}.preview-top h2{margin:3px 0 8px;font-size:1.2rem}.preview-top b{color:#f59e0b}.selected-preview p{font-size:.82rem;color:#64748b;line-height:1.5;margin-bottom:13px}.preview-actions{display:flex;gap:8px}.primary-glass-action,.soft-action{flex:1;text-align:center;border-radius:12px;padding:10px 12px;font-weight:800;font-size:.8rem}.primary-glass-action{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 8px 18px rgba(79,70,229,.24)}.soft-action{background:rgba(255,255,255,.66);box-shadow:inset 0 0 0 1px rgba(148,163,184,.2)}.rolling-pin{border:0;background:transparent;display:grid;justify-items:center;filter:drop-shadow(0 5px 8px rgba(15,23,42,.26));transform-origin:bottom;transition:.15s}.rolling-pin span{display:grid;place-items:center;width:38px;height:38px;border:3px solid rgba(255,255,255,.9);border-radius:50% 50% 50% 8px;transform:rotate(-45deg);background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}.rolling-pin span::first-letter{transform:rotate(45deg)}.rolling-pin b{margin-top:3px;border-radius:8px;background:rgba(17,24,39,.88);color:#fff;padding:2px 5px;font-size:.62rem}.rolling-pin--active{transform:scale(1.18)}.rolling-pin--active span{background:linear-gradient(135deg,#f59e0b,#ef4444)}.empty-liquid{display:grid;gap:5px;text-align:center;padding:28px 15px;border-radius:18px;background:rgba(255,255,255,.42);color:#64748b}.empty-liquid strong{color:#334155}.glass-alert{position:absolute;z-index:10;left:24px;bottom:90px;background:rgba(254,226,226,.88);border:1px solid rgba(239,68,68,.2);backdrop-filter:blur(18px);padding:12px 14px;border-radius:14px;color:#991b1b}
        @media(max-width:980px){.bogota-explorer{grid-template-columns:1fr;height:auto;min-height:calc(100vh - 100px);overflow:visible}.explorer-map{height:62vh;min-height:520px}.explorer-drawer{border-radius:28px 28px 0 0;margin-top:-25px;min-height:420px}.liquid-search{top:14px;left:14px;width:calc(100% - 28px)}.filter-chips{overflow:auto}.filter-chips select{min-width:150px}.map-kpis{left:14px;bottom:70px}.floating-register{right:14px;bottom:14px}}
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
  const lat = Number(site?.latitud); const lng = Number(site?.longitud);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 4.471 && lat <= 4.839 && lng >= -74.231 && lng <= -73.985;
}

function categoryGlyph(category) {
  const value = String(category || '').toLowerCase();
  if (value.includes('cafe')) return '☕';
  if (value.includes('rest')) return '🍽';
  if (value.includes('bar')) return '🍸';
  if (value.includes('cultur') || value.includes('muse')) return '🎭';
  if (value.includes('tienda') || value.includes('shop')) return '🛍';
  if (value.includes('parque')) return '🌿';
  return '●';
}
