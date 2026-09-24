import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest, buildQuery } from '../api';
import { colors, shadow } from '../theme';
import { BrandHeader, Button, Field, Notice, Pill } from '../components/Primitives';

const roles = ['neighbor', 'moderator', 'admin'];
const suggestionStates = ['pending', 'approved', 'rejected', 'all'];

// El panel móvil conserva los mismos módulos y permisos de la web, pero presenta
// cada bloque como una tarea corta para que también sea cómodo operarlo con una mano.
export default function AdminScreen({ session }) {
  const canManageUsers = session.user?.role === 'admin';
  const [view, setView] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [users, setUsers] = useState([]);
  const [suggestionStatus, setSuggestionStatus] = useState('pending');
  const [dashboardFilters, setDashboardFilters] = useState({ from: '', to: '', localidad: '', categoria: '' });
  const [userQuery, setUserQuery] = useState('');
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingSuggestion, setProcessingSuggestion] = useState(null);
  const [processingUser, setProcessingUser] = useState(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => { loadCurrentView(); }, [view, suggestionStatus]);

  async function loadCurrentView() {
    setLoading(true); setMessage(''); setIsError(false);
    try {
      if (view === 'dashboard') {
        setDashboard(await apiRequest(`/api/admin/dashboard${buildQuery(dashboardFilters)}`, { token: session.token }));
      } else if (view === 'sites') {
        setSuggestions(await apiRequest(`/api/site-suggestions${buildQuery({ status: suggestionStatus })}`, { token: session.token }));
      } else if (canManageUsers) {
        setUsers(await apiRequest(`/api/admin/users${buildQuery({ q: userQuery, role: userRole })}`, { token: session.token }));
      }
    } catch (error) { setMessage(error.message); setIsError(true); }
    finally { setLoading(false); }
  }

  function confirmModeration(item, action) {
    const approve = action === 'approve';
    Alert.alert(
      approve ? '¿Publicar este lugar?' : '¿Rechazar esta sugerencia?',
      approve ? `${item.nombre} aparecerá en el mapa de Rolling.` : 'La sugerencia dejará la cola pendiente.',
      [{ text: 'Cancelar', style: 'cancel' }, { text: approve ? 'Aprobar' : 'Rechazar', style: approve ? 'default' : 'destructive', onPress: () => moderate(item.id, action) }],
    );
  }

  async function moderate(id, action) {
    setProcessingSuggestion({ id, action });
    try {
      await apiRequest(`/api/site-suggestions/${id}/${action}`, {
        token: session.token,
        method: 'POST',
        body: action === 'reject' ? { reason: 'No cumple criterios de publicación o parece duplicado.' } : {},
      });
      // En una cola filtrada el elemento desaparece; en "all" conserva su lugar
      // y cambia de estado para confirmar visualmente que la acción sí se guardó.
      setSuggestions((current) => suggestionStatus === 'all'
        ? current.map((item) => item.id === id ? { ...item, status: action === 'approve' ? 'approved' : 'rejected' } : item)
        : current.filter((item) => item.id !== id));
      setMessage(action === 'approve' ? 'Lugar aprobado y publicado en el mapa.' : 'Sugerencia rechazada.');
      setIsError(false);
    } catch (error) { setMessage(error.message); setIsError(true); }
    finally { setProcessingSuggestion(null); }
  }

  function confirmRole(user, role) {
    if (user.role === role) return;
    Alert.alert('Cambiar permisos', `${user.username} pasará de ${user.role} a ${role}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Actualizar', onPress: () => updateRole(user.id, role) },
    ]);
  }

  async function updateRole(id, role) {
    setProcessingUser({ id, role });
    try {
      const data = await apiRequest(`/api/admin/users/${id}/role`, { token: session.token, method: 'PATCH', body: { role } });
      setUsers((current) => current.map((item) => item.id === id ? data.user : item));
      setMessage(`Rol actualizado a ${role}.`); setIsError(false);
    } catch (error) { setMessage(error.message); setIsError(true); }
    finally { setProcessingUser(null); }
  }

  const tabs = useMemo(() => [
    { key: 'dashboard', label: 'Resumen' },
    { key: 'sites', label: 'Sugerencias' },
    ...(canManageUsers ? [{ key: 'users', label: 'Usuarios' }] : []),
  ], [canManageUsers]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadCurrentView} tintColor={colors.green} />}
    >
      <BrandHeader eyebrow="PANEL OPERATIVO" title="Control de plataforma" subtitle="Métricas, moderación y permisos con los mismos datos de la web." right={<View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{session.user.role}</Text></View>} />

      <View style={styles.tabs}>{tabs.map((tab) => <Pill key={tab.key} active={view === tab.key} onPress={() => setView(tab.key)}>{tab.label}</Pill>)}</View>
      <Notice error={isError}>{message}</Notice>
      {loading && !dashboard && !suggestions.length && !users.length ? <ActivityIndicator style={styles.loader} color={colors.green} /> : null}

      {view === 'dashboard' && <DashboardView data={dashboard} filters={dashboardFilters} setFilters={setDashboardFilters} onApply={loadCurrentView} />}
      {view === 'sites' && <SuggestionsView items={suggestions} status={suggestionStatus} setStatus={setSuggestionStatus} onModerate={confirmModeration} loading={loading} processing={processingSuggestion} />}
      {view === 'users' && canManageUsers && <UsersView items={users} query={userQuery} setQuery={setUserQuery} role={userRole} setRole={setUserRole} onApply={loadCurrentView} onChangeRole={confirmRole} processing={processingUser} />}
    </ScrollView>
  );
}

function DashboardView({ data, filters, setFilters, onApply }) {
  if (!data) return null;
  const metrics = [
    ['Usuarios', data.usuarios], ['Sitios', data.sitios], ['Reseñas', data.reviews], ['Pendientes', data.sugerencias_pendientes],
    ['Reportes', data.reportes_abiertos], ['Feed', data.feed_posts], ['Rating', data.rating_promedio], ['Confianza', data.confianza_promedio],
  ];
  return <View style={styles.stack}>
    <Section title="Filtros del reporte" copy="Segmenta por periodo, localidad o categoría.">
      <Field label="Desde" value={filters.from} onChangeText={(value) => setFilters((current) => ({ ...current, from: value }))} placeholder="2026-01-01" />
      <Field label="Hasta" value={filters.to} onChangeText={(value) => setFilters((current) => ({ ...current, to: value }))} placeholder="2026-12-31" />
      <Field label="Localidad" value={filters.localidad} onChangeText={(value) => setFilters((current) => ({ ...current, localidad: value }))} placeholder="Chapinero" />
      <Field label="Categoría" value={filters.categoria} onChangeText={(value) => setFilters((current) => ({ ...current, categoria: value }))} placeholder="Café" />
      <Button onPress={onApply}>Aplicar filtros</Button>
    </Section>
    <View style={styles.metrics}>{metrics.map(([label, value]) => <View key={label} style={styles.metric}><Text style={styles.metricValue}>{value ?? 0}</Text><Text style={styles.metricLabel}>{label}</Text></View>)}</View>
    <MonthlyChart data={data.monthly || []} />
    <Distribution title="Roles de usuarios" data={data.roles || []} labelKey="role" />
    <Distribution title="Estado de sugerencias" data={data.suggestion_statuses || []} labelKey="status" />
    <RankedList title="Localidades con más sitios" data={data.top_localities || []} labelKey="locality" />
    <RankedList title="Categorías destacadas" data={data.top_categories || []} labelKey="category" />
    <Services services={data.servicios || {}} resources={data.recursos || {}} />
  </View>;
}

function SuggestionsView({ items, status, setStatus, onModerate, loading, processing }) {
  return <View style={styles.stack}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}>{suggestionStates.map((item) => <Pill key={item} active={status === item} onPress={() => setStatus(item)}>{item}</Pill>)}</ScrollView>
    {!loading && !items.length ? <Empty title="No hay sugerencias en esta vista" copy="Las nuevas postulaciones aparecerán aquí con ubicación y señales de duplicado." /> : null}
    {items.map((item) => <View key={item.id} style={styles.card}>
      <Text style={styles.cardKicker}>{item.status} · {item.categoria || 'Sitio local'}</Text><Text style={styles.cardTitle}>{item.nombre}</Text><Text style={styles.cardBody}>{item.descripcion}</Text>
      <View style={styles.metaBox}><Text style={styles.metaText}>{item.direccion || 'Dirección por validar'}</Text><Text style={styles.metaText}>{item.localidad || 'Localidad por validar'} · por {item.suggested_by || 'comunidad'}</Text>{item.latitud && item.longitud ? <Text style={styles.coords}>{Number(item.latitud).toFixed(5)}, {Number(item.longitud).toFixed(5)}</Text> : null}</View>
      {item.duplicate_site_name ? <Notice error>Posible duplicado: {item.duplicate_site_name}</Notice> : null}
      {item.status === 'pending' ? <View style={styles.actions}><Button style={styles.action} loading={processing?.id === item.id && processing.action === 'approve'} disabled={processing?.id === item.id} onPress={() => onModerate(item, 'approve')}>Aprobar</Button><Button style={styles.action} kind="danger" loading={processing?.id === item.id && processing.action === 'reject'} disabled={processing?.id === item.id} onPress={() => onModerate(item, 'reject')}>Rechazar</Button></View> : <View style={[styles.savedState, item.status === 'rejected' && styles.savedStateRejected]}><Text style={[styles.savedStateText, item.status === 'rejected' && styles.savedStateTextRejected]}>{item.status === 'approved' ? '✓ Publicado en el mapa' : '× Sugerencia rechazada'}</Text></View>}
    </View>)}
  </View>;
}

function UsersView({ items, query, setQuery, role, setRole, onApply, onChangeRole, processing }) {
  return <View style={styles.stack}>
    <Section title="Buscar usuarios" copy="Filtra por nombre, correo o rol.">
      <Field value={query} onChangeText={setQuery} placeholder="Usuario o correo" returnKeyType="search" onSubmitEditing={onApply} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}><Pill active={!role} onPress={() => setRole('')}>Todos</Pill>{roles.map((item) => <Pill key={item} active={role === item} onPress={() => setRole(item)}>{item}</Pill>)}</ScrollView>
      <Button onPress={onApply}>Aplicar filtros</Button>
    </Section>
    {items.map((user) => <View key={user.id} style={styles.userCard}><View style={styles.avatar}><Text style={styles.avatarText}>{String(user.username || 'R')[0].toUpperCase()}</Text></View><View style={styles.userMain}><View style={styles.userTitleRow}><Text style={styles.userName}>{user.username}</Text><View style={styles.currentRole}><Text style={styles.currentRoleText}>{user.role}</Text></View></View><Text style={styles.userMeta}>{user.email || 'sin email'}</Text><Text style={styles.userMeta}>Reputación {user.reputation} · peso {Number(user.review_weight || 1).toFixed(2)}x</Text><Text style={styles.changeRoleLabel}>{processing?.id === user.id ? `Guardando ${processing.role}…` : 'Cambiar rol a'}</Text><View style={styles.roleRow}>{roles.filter((item) => item !== user.role).map((item) => <Pressable key={item} disabled={processing?.id === user.id} onPress={() => onChangeRole(user, item)} style={[styles.roleChoice, processing?.id === user.id && styles.roleChoiceDisabled]}><Text style={styles.roleChoiceText}>{item}</Text></Pressable>)}</View></View></View>)}
  </View>;
}

function MonthlyChart({ data }) {
  const rows = data.slice(-6);
  const max = Math.max(1, ...rows.map((item) => Number(item.users || 0) + Number(item.sites || 0) + Number(item.reviews || 0) + Number(item.suggestions || 0)));
  return <Section title="Actividad mensual" copy="Usuarios, sitios, reseñas y sugerencias por mes."><View style={styles.months}>{rows.map((item) => { const total = Number(item.users || 0) + Number(item.sites || 0) + Number(item.reviews || 0) + Number(item.suggestions || 0); return <View key={item.month} style={styles.month}><Text style={styles.monthValue}>{total}</Text><View style={styles.monthTrack}><View style={[styles.monthBar, { height: `${Math.max(8, (total / max) * 100)}%` }]} /></View><Text style={styles.monthLabel}>{item.month?.slice(5)}</Text></View>; })}</View></Section>;
}

function Distribution({ title, data, labelKey }) {
  const total = data.reduce((sum, item) => sum + Number(item.total || 0), 0) || 1;
  return <Section title={title}>{data.map((item) => <ProgressRow key={item[labelKey]} label={item[labelKey] || 'Sin dato'} value={Number(item.total || 0)} percent={(Number(item.total || 0) / total) * 100} />)}</Section>;
}

function RankedList({ title, data, labelKey }) {
  const max = Math.max(1, ...data.map((item) => Number(item.total || 0)));
  return <Section title={title}>{data.slice(0, 8).map((item) => <ProgressRow key={item[labelKey]} label={item[labelKey] || 'Sin dato'} value={Number(item.total || 0)} detail={item.rating ? `rating ${item.rating}` : ''} percent={(Number(item.total || 0) / max) * 100} />)}</Section>;
}

function Services({ services, resources }) {
  return <Section title="Estado técnico" copy="Servicios y consumo actual de la API."><View style={styles.serviceGrid}>{Object.entries(services).map(([key, value]) => <View key={key} style={styles.service}><Text style={styles.serviceName}>{key}</Text><Text style={[styles.serviceStatus, value === 'ok' && styles.serviceOk]}>{value}</Text></View>)}</View>{Object.entries(resources).map(([key, value]) => <ProgressRow key={key} label={key} value={typeof value === 'number' ? Math.round(value) : value} percent={Math.min(100, Number(value || 0))} />)}</Section>;
}

function ProgressRow({ label, value, detail, percent }) { return <View style={styles.progressRow}><View style={styles.progressHead}><Text style={styles.progressLabel}>{label}</Text><Text style={styles.progressValue}>{value}{detail ? ` · ${detail}` : ''}</Text></View><View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${Math.max(3, Math.min(100, percent))}%` }]} /></View></View>; }
function Section({ title, copy, children }) { return <View style={styles.card}><Text style={styles.cardKicker}>ADMINISTRACIÓN</Text><Text style={styles.cardTitle}>{title}</Text>{copy ? <Text style={styles.cardBody}>{copy}</Text> : null}<View style={styles.sectionBody}>{children}</View></View>; }
function Empty({ title, copy }) { return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{copy}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, content: { paddingBottom: 30 }, roleBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.forest }, roleBadgeText: { color: colors.lime, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 14 }, loader: { margin: 30 }, stack: { gap: 13, paddingHorizontal: 14 }, filterStrip: { gap: 7, paddingVertical: 2 },
  card: { gap: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 17, backgroundColor: colors.white, ...shadow }, cardKicker: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, cardTitle: { color: colors.ink, fontFamily: 'serif', fontSize: 23, fontWeight: '700' }, cardBody: { color: colors.muted, fontSize: 12, lineHeight: 18 }, sectionBody: { gap: 12, marginTop: 7 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, metric: { width: '48.5%', borderRadius: 17, padding: 16, backgroundColor: colors.forest }, metricValue: { color: colors.lime, fontFamily: 'serif', fontSize: 28, fontWeight: '900' }, metricLabel: { color: '#b8c4bd', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  months: { height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, month: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }, monthValue: { color: colors.muted, fontSize: 9 }, monthTrack: { width: '72%', height: 105, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 8, backgroundColor: colors.field }, monthBar: { width: '100%', borderRadius: 8, backgroundColor: colors.green }, monthLabel: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  progressRow: { gap: 6 }, progressHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, progressLabel: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' }, progressValue: { color: colors.muted, fontSize: 11 }, progressTrack: { height: 7, overflow: 'hidden', borderRadius: 99, backgroundColor: colors.field }, progressBar: { height: '100%', borderRadius: 99, backgroundColor: colors.green },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, service: { minWidth: '47%', flex: 1, flexDirection: 'row', justifyContent: 'space-between', borderRadius: 11, padding: 11, backgroundColor: colors.field }, serviceName: { color: colors.ink, fontSize: 11, fontWeight: '800' }, serviceStatus: { color: colors.coral, fontSize: 10, fontWeight: '900' }, serviceOk: { color: colors.green },
  metaBox: { gap: 3, borderRadius: 12, padding: 11, backgroundColor: colors.field }, metaText: { color: colors.muted, fontSize: 11 }, coords: { color: colors.green, fontSize: 10, fontWeight: '800' }, actions: { flexDirection: 'row', gap: 9, marginTop: 6 }, action: { flex: 1 },
  savedState: { alignItems: 'center', borderRadius: 12, padding: 12, backgroundColor: colors.greenSoft }, savedStateRejected: { backgroundColor: '#f9e8e3' }, savedStateText: { color: colors.green, fontSize: 11, fontWeight: '900' }, savedStateTextRejected: { color: colors.error },
  userCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, backgroundColor: colors.white }, avatar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.lime }, avatarText: { color: colors.ink, fontFamily: 'serif', fontSize: 18, fontWeight: '900' }, userMain: { flex: 1, gap: 3 }, userName: { color: colors.ink, fontSize: 15, fontWeight: '900' }, userMeta: { color: colors.muted, fontSize: 10 }, roleRow: { flexDirection: 'row', gap: 5, marginTop: 8 }, roleChoice: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingVertical: 7 }, roleChoiceActive: { borderColor: colors.green, backgroundColor: colors.green }, roleChoiceText: { color: colors.muted, fontSize: 8, fontWeight: '800' }, roleChoiceTextActive: { color: colors.white },
  userTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, currentRole: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.green }, currentRoleText: { color: colors.white, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }, changeRoleLabel: { marginTop: 8, color: colors.muted, fontSize: 9, fontWeight: '800' }, roleChoiceDisabled: { opacity: 0.4 },
  empty: { alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 28, backgroundColor: colors.white }, emptyTitle: { color: colors.ink, fontWeight: '900', textAlign: 'center' }, emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
