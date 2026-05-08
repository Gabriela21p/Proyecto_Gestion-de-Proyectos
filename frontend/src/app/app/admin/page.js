'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

const roles = ['neighbor', 'moderator', 'admin'];

export default function AdminPage() {
  const { user, token } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [suggestionStatus, setSuggestionStatus] = useState('pending');
  const [dashboard, setDashboard] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [users, setUsers] = useState([]);
  const [reportFilters, setReportFilters] = useState({ from: '', to: '', localidad: '', ciudad: '', categoria: '' });
  const [userFilters, setUserFilters] = useState({ q: '', role: '', email_verified: '', identity_level: '' });
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const canModerate = user && ['admin', 'moderator'].includes(user.role);
  const canManageUsers = user?.role === 'admin';

  useEffect(() => {
    if (!canModerate || !token) return;
    if (activeView === 'dashboard') loadDashboard();
    if (activeView === 'sites') loadSuggestions();
    if (activeView === 'users' && canManageUsers) loadUsers();
  }, [activeView, canModerate, canManageUsers, token, suggestionStatus]);

  async function apiFetch(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Operacion no disponible');
    return data;
  }

  async function loadDashboard(nextFilters = reportFilters) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      setDashboard(await apiFetch(`/api/admin/dashboard?${params.toString()}`));
    } catch (error) {
      setToast(error.message);
    }
    setLoading(false);
  }

  function applyDashboardFilters(event) {
    event.preventDefault();
    loadDashboard();
  }

  function clearDashboardFilters() {
    const clean = { from: '', to: '', localidad: '', ciudad: '', categoria: '' };
    setReportFilters(clean);
    loadDashboard(clean);
  }

  function exportDashboardReport() {
    if (!dashboard) return;
    const report = {
      generated_at: new Date().toISOString(),
      filters: dashboard.filters,
      metrics: {
        usuarios: dashboard.usuarios,
        sitios: dashboard.sitios,
        reviews: dashboard.reviews,
        sugerencias_pendientes: dashboard.sugerencias_pendientes,
        reportes_abiertos: dashboard.reportes_abiertos,
        feed_posts: dashboard.feed_posts,
        rating_promedio: dashboard.rating_promedio,
        confianza_promedio: dashboard.confianza_promedio,
      },
      monthly: dashboard.monthly || [],
      roles: dashboard.roles || [],
      suggestion_statuses: dashboard.suggestion_statuses || [],
      top_localities: dashboard.top_localities || [],
      top_categories: dashboard.top_categories || [],
      recursos: dashboard.recursos || {},
      servicios: dashboard.servicios || {},
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rolling-reporte-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadSuggestions() {
    setLoading(true);
    try {
      setSuggestions(await apiFetch(`/api/site-suggestions?status=${suggestionStatus}`));
    } catch (error) {
      setToast(error.message);
    }
    setLoading(false);
  }

  async function loadUsers(nextFilters = userFilters) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      setUsers(await apiFetch(`/api/admin/users?${params.toString()}`));
    } catch (error) {
      setToast(error.message);
    }
    setLoading(false);
  }

  function applyUserFilters(event) {
    event.preventDefault();
    loadUsers();
  }

  function clearUserFilters() {
    const clean = { q: '', role: '', email_verified: '', identity_level: '' };
    setUserFilters(clean);
    loadUsers(clean);
  }

  async function moderateSuggestion(id, action) {
    try {
      await apiFetch(`/api/site-suggestions/${id}/${action}`, {
        method: 'POST',
        body: action === 'reject'
          ? JSON.stringify({ reason: 'No cumple criterios de publicacion o parece duplicado.' })
          : JSON.stringify({}),
      });
      setToast(action === 'approve' ? 'Sitio aprobado y publicado en el mapa.' : 'Sugerencia rechazada.');
      setSuggestions((current) => current.filter((item) => item.id !== id));
      loadDashboard();
    } catch (error) {
      setToast(error.message);
    }
  }

  async function updateUserRole(id, role) {
    try {
      const data = await apiFetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setUsers((current) => current.map((item) => item.id === id ? data.user : item));
      setToast(`Rol actualizado a ${role}.`);
      loadDashboard();
    } catch (error) {
      setToast(error.message);
    }
  }

  if (!canModerate) {
    return (
      <main className="admin-page">
        <section className="panel-section admin-empty">
          <span className="eyebrow">Admin</span>
          <h1>Acceso restringido</h1>
          <p>Solo administradores o moderadores pueden entrar al panel operativo.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <div>
          <span className="eyebrow">Panel admin</span>
          <h1>Control de plataforma</h1>
          <p>Monitorea uso, aprueba sitios de la comunidad y administra roles de usuarios.</p>
        </div>
        <div className="admin-tabs">
          {['dashboard', 'sites', ...(canManageUsers ? ['users'] : [])].map((item) => (
            <button
              type="button"
              className={activeView === item ? 'admin-tab admin-tab--active' : 'admin-tab'}
              onClick={() => setActiveView(item)}
              key={item}
            >
              {item === 'dashboard' ? 'Dashboard' : item === 'sites' ? 'Sitios' : 'Usuarios'}
            </button>
          ))}
        </div>
      </section>

      {activeView === 'dashboard' && (
        <section className="admin-list">
          <form className="panel-section report-filter-panel" onSubmit={applyDashboardFilters}>
            <div>
              <span className="eyebrow">Reporteria</span>
              <h2>Filtros del dashboard</h2>
              <p>Segmenta las metricas por periodo, localidad, ciudad o categoria.</p>
            </div>
            <div className="report-filter-grid">
              <label>Desde<input type="date" value={reportFilters.from} onChange={(event) => setReportFilters((current) => ({ ...current, from: event.target.value }))} /></label>
              <label>Hasta<input type="date" value={reportFilters.to} onChange={(event) => setReportFilters((current) => ({ ...current, to: event.target.value }))} /></label>
              <label>Localidad<input value={reportFilters.localidad} onChange={(event) => setReportFilters((current) => ({ ...current, localidad: event.target.value }))} placeholder="Chapinero" /></label>
              <label>Ciudad<input value={reportFilters.ciudad} onChange={(event) => setReportFilters((current) => ({ ...current, ciudad: event.target.value }))} placeholder="Bogota" /></label>
              <label>Categoria<input value={reportFilters.categoria} onChange={(event) => setReportFilters((current) => ({ ...current, categoria: event.target.value }))} placeholder="Cafe" /></label>
            </div>
            <div className="action-row">
              <button className="primary-action" type="submit">Aplicar filtros</button>
              <button className="plain-action" type="button" onClick={clearDashboardFilters}>Limpiar</button>
              <button className="plain-action" type="button" onClick={exportDashboardReport} disabled={!dashboard}>Exportar JSON</button>
            </div>
          </form>
          {loading && <article className="panel-section">Cargando estado...</article>}
          {dashboard && (
            <>
              <div className="admin-metric-grid">
                <Metric label="Usuarios" value={dashboard.usuarios} />
                <Metric label="Sitios" value={dashboard.sitios} />
                <Metric label="Reviews" value={dashboard.reviews} />
                <Metric label="Pendientes" value={dashboard.sugerencias_pendientes} />
                <Metric label="Reportes" value={dashboard.reportes_abiertos} />
                <Metric label="Feed" value={dashboard.feed_posts} />
                <Metric label="Rating" value={dashboard.rating_promedio} />
                <Metric label="Confianza" value={dashboard.confianza_promedio} />
              </div>
              <div className="dashboard-grid">
                <BarChart
                  title="Actividad mensual"
                  description="Altas reales de usuarios, sitios, reviews, sugerencias y reportes por mes."
                  data={dashboard.monthly || []}
                  keys={[
                    ['users', 'Usuarios'],
                    ['sites', 'Sitios'],
                    ['reviews', 'Reviews'],
                    ['suggestions', 'Sugerencias'],
                    ['reports', 'Reportes'],
                  ]}
                />
                <DistributionChart
                  title="Roles de usuarios"
                  description="Composicion actual de permisos en la plataforma."
                  data={dashboard.roles || []}
                  labelKey="role"
                />
                <DistributionChart
                  title="Estado de sugerencias"
                  description="Embudo real de postulaciones comunitarias."
                  data={dashboard.suggestion_statuses || []}
                  labelKey="status"
                />
                <LocalityChart
                  title="Localidades con mas sitios"
                  description="Zonas con mayor inventario aprobado y rating promedio."
                  data={dashboard.top_localities || []}
                />
                <CategoryChart
                  title="Categorias destacadas"
                  description="Categorias con mayor inventario dentro del filtro actual."
                  data={dashboard.top_categories || []}
                />
              </div>
              <div className="dashboard-grid">
                <ServiceHealthChart services={dashboard.servicios || {}} />
                <ResourceChart resources={dashboard.recursos || {}} />
              </div>
            </>
          )}
        </section>
      )}

      {activeView === 'sites' && (
        <section className="admin-list">
          <div className="admin-tabs">
            {['pending', 'approved', 'rejected', 'all'].map((item) => (
              <button
                type="button"
                className={suggestionStatus === item ? 'admin-tab admin-tab--active' : 'admin-tab'}
                onClick={() => setSuggestionStatus(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
          {loading && <article className="panel-section">Cargando sugerencias...</article>}
          {!loading && suggestions.length === 0 && (
            <article className="panel-section admin-empty">
              <h2>No hay sugerencias en esta vista</h2>
              <p>Cuando la comunidad postule negocios apareceran aqui con coordenadas y senales de duplicado.</p>
            </article>
          )}
          {suggestions.map((suggestion) => (
            <article className="panel-section admin-card" key={suggestion.id}>
              <div className="admin-card__main">
                <div>
                  <span className="eyebrow">{suggestion.status}</span>
                  <h2>{suggestion.nombre}</h2>
                  <p>{suggestion.descripcion}</p>
                </div>
                <strong>{suggestion.categoria || 'Sitio local'}</strong>
              </div>
              <div className="admin-meta">
                <span>{suggestion.localidad || 'Localidad por validar'}</span>
                <span>{suggestion.ciudad || 'Ciudad por validar'}</span>
                <span>{suggestion.direccion || 'Direccion por validar'}</span>
                <span>{suggestion.latitud && suggestion.longitud ? `${suggestion.latitud.toFixed(5)}, ${suggestion.longitud.toFixed(5)}` : 'Sin coordenadas'}</span>
                <span>por {suggestion.suggested_by || 'comunidad'}</span>
              </div>
              {suggestion.duplicate_site_name && <div className="admin-warning">Posible duplicado: {suggestion.duplicate_site_name}</div>}
              {suggestion.status === 'pending' && (
                <div className="action-row">
                  <button className="primary-action" type="button" onClick={() => moderateSuggestion(suggestion.id, 'approve')}>Aprobar y publicar</button>
                  <button className="plain-action" type="button" onClick={() => moderateSuggestion(suggestion.id, 'reject')}>Rechazar</button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {activeView === 'users' && canManageUsers && (
        <section className="admin-list">
          <form className="panel-section report-filter-panel" onSubmit={applyUserFilters}>
            <div>
              <span className="eyebrow">Usuarios</span>
              <h2>Filtros de administracion</h2>
              <p>Encuentra usuarios por rol, identidad, verificacion o busqueda libre.</p>
            </div>
            <div className="user-filter-grid">
              <label>Buscar<input value={userFilters.q} onChange={(event) => setUserFilters((current) => ({ ...current, q: event.target.value }))} placeholder="email o usuario" /></label>
              <label>Rol
                <select value={userFilters.role} onChange={(event) => setUserFilters((current) => ({ ...current, role: event.target.value }))}>
                  <option value="">Todos</option>
                  {roles.map((role) => <option value={role} key={role}>{role}</option>)}
                </select>
              </label>
              <label>Email
                <select value={userFilters.email_verified} onChange={(event) => setUserFilters((current) => ({ ...current, email_verified: event.target.value }))}>
                  <option value="">Todos</option>
                  <option value="true">Verificado</option>
                  <option value="false">Sin verificar</option>
                </select>
              </label>
              <label>Identidad
                <select value={userFilters.identity_level} onChange={(event) => setUserFilters((current) => ({ ...current, identity_level: event.target.value }))}>
                  <option value="">Todas</option>
                  <option value="guest">guest</option>
                  <option value="registered">registered</option>
                  <option value="verified">verified</option>
                  <option value="trusted">trusted</option>
                </select>
              </label>
            </div>
            <div className="action-row">
              <button className="primary-action" type="submit">Aplicar filtros</button>
              <button className="plain-action" type="button" onClick={clearUserFilters}>Limpiar</button>
            </div>
          </form>
          {loading && <article className="panel-section">Cargando usuarios...</article>}
          {users.map((item) => (
            <article className="panel-section user-row" key={item.id}>
              <div>
                <strong>{item.username}</strong>
                <span>{item.email || 'sin email'} · reputacion {item.reputation} · peso {item.review_weight.toFixed(2)}x</span>
              </div>
              <select value={item.role} onChange={(event) => updateUserRole(item.id, event.target.value)}>
                {roles.map((role) => <option value={role} key={role}>{role}</option>)}
              </select>
            </article>
          ))}
        </section>
      )}

      {toast && <button className="toast" type="button" onClick={() => setToast('')}>{toast}</button>}
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <article className="panel-section admin-metric">
      <strong>{value ?? 0}</strong>
      <span>{label}</span>
    </article>
  );
}

function BarChart({ title, description, data, keys }) {
  const max = Math.max(1, ...data.flatMap((item) => keys.map(([key]) => Number(item[key] || 0))));
  return (
    <article className="panel-section chart-card chart-card--wide">
      <ChartHeader title={title} description={description} />
      <div className="bar-chart">
        {data.map((month) => (
          <div className="bar-group" key={month.month}>
            <div className="bar-stack">
              {keys.map(([key, label]) => (
                <span
                  className={`bar-segment bar-segment--${key}`}
                  style={{ height: `${Math.max(4, (Number(month[key] || 0) / max) * 100)}%` }}
                  title={`${label}: ${month[key] || 0}`}
                  key={key}
                />
              ))}
            </div>
            <strong>{month.month?.slice(5)}</strong>
            <div className="bar-values" aria-label={`Valores de ${month.month}`}>
              {keys.map(([key, label]) => (
                <span className={`bar-value bar-value--${key}`} title={`${label}: ${month[key] || 0}`} key={key}>
                  <em>{label.slice(0, 3)}</em>
                  {month[key] || 0}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        {keys.map(([key, label]) => <span className={`legend-dot legend-dot--${key}`} key={key}>{label}</span>)}
      </div>
    </article>
  );
}

function DistributionChart({ title, description, data, labelKey }) {
  const total = data.reduce((sum, item) => sum + Number(item.total || 0), 0) || 1;
  return (
    <article className="panel-section chart-card">
      <ChartHeader title={title} description={description} />
      <div className="distribution-list">
        {data.map((item) => {
          const percent = Math.round((Number(item.total || 0) / total) * 100);
          return (
            <div className="distribution-row" key={item[labelKey]}>
              <div>
                <strong>{item[labelKey] || 'sin dato'}</strong>
                <span>{item.total} registros</span>
              </div>
              <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
              <em>{percent}%</em>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function LocalityChart({ title, description, data }) {
  const max = Math.max(1, ...data.map((item) => Number(item.total || 0)));
  return (
    <article className="panel-section chart-card">
      <ChartHeader title={title} description={description} />
      <div className="distribution-list">
        {data.map((item) => (
          <div className="distribution-row" key={item.locality}>
            <div>
              <strong>{item.locality}</strong>
              <span>{item.total} sitios · rating {item.rating}</span>
            </div>
            <div className="progress-track"><span style={{ width: `${(Number(item.total || 0) / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </article>
  );
}

function CategoryChart({ title, description, data }) {
  const max = Math.max(1, ...data.map((item) => Number(item.total || 0)));
  return (
    <article className="panel-section chart-card">
      <ChartHeader title={title} description={description} />
      <div className="distribution-list">
        {data.map((item) => (
          <div className="distribution-row" key={item.category}>
            <div>
              <strong>{item.category}</strong>
              <span>{item.total} sitios · rating {item.rating}</span>
            </div>
            <div className="progress-track"><span style={{ width: `${(Number(item.total || 0) / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ServiceHealthChart({ services }) {
  const entries = Object.entries(services);
  const total = entries.length || 1;
  const okCount = entries.filter(([, value]) => value === 'ok').length;
  const percent = Math.round((okCount / total) * 100);
  return (
    <article className="panel-section chart-card">
      <ChartHeader title="Salud de servicios" description="Disponibilidad actual de API, datos, tiempo real y busqueda." />
      <div className="health-ring" style={{ '--value': `${percent}%` }}>
        <strong>{percent}%</strong>
        <span>{okCount}/{total} ok</span>
      </div>
      <div className="service-list">
        {entries.map(([key, value]) => (
          <div className={value === 'ok' ? 'service-row service-row--ok' : 'service-row service-row--warn'} key={key}>
            <span>{key}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function ResourceChart({ resources }) {
  const heapTotal = Math.max(1, Number(resources.memory_heap_total_mb || 0));
  const heapUsed = Number(resources.memory_heap_used_mb || 0);
  const rss = Number(resources.memory_rss_mb || 0);
  const load = Number(resources.load_average_1m || 0);
  const cpuCount = Math.max(1, Number(resources.cpu_count || 1));
  const rows = [
    ['RAM RSS', rss, Math.max(rss, 256), 'MB'],
    ['Heap usado', heapUsed, heapTotal, 'MB'],
    ['Load 1m', load, cpuCount, ''],
    ['Uptime', Math.round(Number(resources.api_uptime_seconds || 0) / 60), 1440, 'min'],
  ];
  return (
    <article className="panel-section chart-card">
      <ChartHeader title="Consumo del API" description="Indicadores runtime del proceso Node que atiende Rolling." />
      <div className="resource-bars">
        {rows.map(([label, value, max, suffix]) => {
          const percent = Math.max(4, Math.min(100, (Number(value) / Number(max)) * 100));
          return (
            <div className="resource-row" key={label}>
              <div>
                <strong>{label}</strong>
                <span>{value} {suffix}</span>
              </div>
              <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
            </div>
          );
        })}
      </div>
      <div className="admin-meta">
        <span>CPU cores: {resources.cpu_count}</span>
        <span>Plataforma: {resources.platform}</span>
        <span>Uptime: {formatUptime(resources.api_uptime_seconds)}</span>
      </div>
    </article>
  );
}

function ChartHeader({ title, description }) {
  return (
    <div className="chart-header">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function formatUptime(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
