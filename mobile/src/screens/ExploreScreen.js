import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { apiRequest, buildQuery } from '../api';
import { colors, shadow } from '../theme';
import { BrandHeader, Button, Field, Notice, Pill } from '../components/Primitives';

const BOGOTA = { latitude: 4.6486, longitude: -74.0721, latitudeDelta: 0.18, longitudeDelta: 0.18 };

// Explorar mantiene sincronizados mapa, lista y búsqueda de direcciones. Un
// punto consultado se trata aparte hasta que la persona decida registrarlo.
export default function ExploreScreen({ session, onOpenPlace, onRegister }) {
  const map = useRef(null);
  const [sites, setSites] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [minRating, setMinRating] = useState(false);
  const [events, setEvents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Un pequeño debounce evita pedir resultados por cada pulsación rápida.
    const timeout = setTimeout(loadSites, 260);
    return () => clearTimeout(timeout);
  }, [query, minRating, events]);

  async function loadSites() {
    // El backend ordena y filtra; el móvil se concentra en presentar el resultado.
    setLoading(true);
    try {
      const data = await apiRequest(`/api/sites${buildQuery({ q: query, min_rating: minRating ? 4 : '', has_events: events, sort: 'recommended' })}`);
      setSites(data);
      if (!selected || !data.some((item) => item.id === selected.id)) setSelected(data[0] || null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    // Seleccionar un sitio o resolver una dirección centra el mapa sin saltos.
    const point = location || selected;
    if (!point?.latitud || !point?.longitud) return;
    map.current?.animateToRegion({ latitude: Number(point.latitud), longitude: Number(point.longitud), latitudeDelta: location ? 0.012 : 0.045, longitudeDelta: location ? 0.012 : 0.045 }, 500);
  }, [selected, location]);

  async function locateAddress() {
    // Esta consulta es sólo una vista previa: todavía no crea una sugerencia.
    if (query.trim().length < 5) return setError('Escribe una dirección más completa.');
    setLocating(true); setError(''); setLocation(null);
    try {
      const data = await apiRequest('/api/site-suggestions/preview', {
        token: session.token, method: 'POST',
        body: { nombre: 'Ubicación consultada', direccion: query.trim(), ciudad: 'Bogota', descripcion: 'Dirección consultada desde la app móvil de Rolling.' },
      });
      const suggestion = data.suggestion || {};
      if (!suggestion.latitud || !suggestion.longitud) throw new Error('No encontramos un punto preciso. Incluye vía, número y sector.');
      setSelected(null);
      setLocation({ direccion: suggestion.direccion || query.trim(), localidad: suggestion.localidad || '', latitud: Number(suggestion.latitud), longitud: Number(suggestion.longitud), duplicates: data.duplicates || [] });
    } catch (err) { setError(err.message); }
    finally { setLocating(false); }
  }

  const visibleSites = useMemo(() => sites.filter((site) => Number.isFinite(Number(site.latitud)) && Number.isFinite(Number(site.longitud))), [sites]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BrandHeader title="Encuentra tu próximo lugar favorito." subtitle="Recomendaciones locales, cultura y espacios elegidos por la comunidad." right={<View style={styles.count}><Text style={styles.countText}>{sites.length}</Text></View>} />
      <View style={styles.searchCard}>
        <Field value={query} onChangeText={(value) => { setQuery(value); setLocation(null); setError(''); }} placeholder="Lugar o dirección en Bogotá..." returnKeyType="search" onSubmitEditing={locateAddress} />
        <Button onPress={locateAddress} loading={locating} disabled={query.trim().length < 5}>Ubicar dirección</Button>
        <View style={styles.chips}><Pill active={minRating} onPress={() => setMinRating(!minRating)}>★ 4.0+</Pill><Pill active={events} onPress={() => setEvents(!events)}>Con eventos</Pill></View>
        <Notice error>{error}</Notice>
      </View>

      <View style={styles.mapWrap}>
        <MapView ref={map} style={styles.map} initialRegion={BOGOTA} toolbarEnabled={false}>
          {visibleSites.map((site) => <Marker key={site.id} coordinate={{ latitude: Number(site.latitud), longitude: Number(site.longitud) }} pinColor={selected?.id === site.id ? colors.coral : colors.green} title={site.nombre} description={site.categoria} onPress={() => { setLocation(null); setSelected(site); }} />)}
          {location && <Marker coordinate={{ latitude: location.latitud, longitude: location.longitud }} pinColor={colors.coral} title="Dirección encontrada" description={location.direccion} />}
        </MapView>
        <View style={styles.mapBadge}><Text style={styles.mapBadgeDot}>●</Text><Text style={styles.mapBadgeText}>{sites.length} lugares en comunidad</Text></View>
      </View>

      {location && (
        <View style={styles.confirmCard}>
          <Text style={styles.kicker}>DIRECCIÓN ENCONTRADA</Text><Text style={styles.confirmTitle}>{location.direccion}</Text><Text style={styles.confirmCopy}>¿Este es el lugar que estabas buscando?</Text>
          {location.duplicates.length ? <Pressable onPress={() => onOpenPlace(location.duplicates[0].id)} style={styles.match}><Text style={styles.matchLabel}>Lugar cercano registrado</Text><Text style={styles.matchName}>{location.duplicates[0].nombre}</Text></Pressable> : <Text style={styles.newPlace}>Aún no hay un lugar registrado en este punto.</Text>}
          <Button onPress={() => onRegister(location)}>Registrar este lugar</Button>
          <Button kind="ghost" onPress={() => setLocation(null)}>Buscar otra dirección</Button>
        </View>
      )}

      {!location && selected && (
        <View style={styles.selectedCard}>
          <Text style={styles.kicker}>{String(selected.categoria || 'LUGAR').toUpperCase()} · {String(selected.barrio?.localidad || 'BOGOTÁ').toUpperCase()}</Text>
          <Text style={styles.selectedTitle}>{selected.nombre}</Text><Text style={styles.address}>{selected.direccion || 'Dirección por confirmar'}</Text>
          <View style={styles.meta}><Pill>{Number(selected.rating_promedio || 0) ? `★ ${Number(selected.rating_promedio).toFixed(1)}` : 'Nuevo en Rolling'}</Pill><Pill>{selected.total_reviews || 0} reseñas</Pill></View>
          <Button onPress={() => onOpenPlace(selected.id)}>Ver ficha completa</Button>
        </View>
      )}

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Lugares para descubrir</Text>{loading && <ActivityIndicator color={colors.green} />}</View>
      <View style={styles.list}>
        {!loading && !sites.length ? <Text style={styles.empty}>No encontramos resultados. Prueba otra búsqueda.</Text> : null}
        {sites.map((site) => (
          <Pressable key={site.id} onPress={() => { setLocation(null); setSelected(site); }} style={[styles.place, selected?.id === site.id && styles.placeActive]}>
            <View style={[styles.placeIcon, selected?.id === site.id && styles.placeIconActive]}><Text style={[styles.placeIconText, selected?.id === site.id && styles.placeIconTextActive]}>◆</Text></View>
            <View style={styles.placeBody}><Text style={styles.placeKicker}>{site.categoria} · {site.barrio?.localidad || 'Bogotá'}</Text><Text numberOfLines={1} style={styles.placeName}>{site.nombre}</Text><Text numberOfLines={1} style={styles.placeAddress}>{site.direccion}</Text></View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, content: { paddingBottom: 28 },
  count: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green }, countText: { color: colors.white, fontWeight: '900' },
  searchCard: { gap: 10, marginHorizontal: 20, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.white, ...shadow },
  chips: { flexDirection: 'row', gap: 8 },
  mapWrap: { height: 310, marginTop: 18, overflow: 'hidden', backgroundColor: '#dce5dc' }, map: { flex: 1 },
  mapBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fffffff2', ...shadow },
  mapBadgeDot: { color: colors.green }, mapBadgeText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  confirmCard: { gap: 11, margin: 16, marginBottom: 0, borderRadius: 19, padding: 18, backgroundColor: colors.white, ...shadow },
  kicker: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, confirmTitle: { color: colors.ink, fontFamily: 'serif', fontSize: 25, fontWeight: '700' }, confirmCopy: { color: colors.muted },
  newPlace: { borderRadius: 10, padding: 11, color: colors.green, backgroundColor: colors.greenSoft, fontSize: 12, fontWeight: '700' },
  match: { gap: 3, borderRadius: 12, padding: 12, backgroundColor: colors.warning }, matchLabel: { color: '#876325', fontSize: 10, fontWeight: '800' }, matchName: { color: colors.ink, fontWeight: '900' },
  selectedCard: { gap: 10, margin: 16, marginBottom: 0, borderRadius: 19, padding: 18, backgroundColor: colors.white, ...shadow },
  selectedTitle: { color: colors.ink, fontFamily: 'serif', fontSize: 26, fontWeight: '700' }, address: { color: colors.muted, fontSize: 13 }, meta: { flexDirection: 'row', gap: 7 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }, sectionTitle: { color: colors.ink, fontFamily: 'serif', fontSize: 21, fontWeight: '700' },
  list: { paddingHorizontal: 14, gap: 7 }, empty: { padding: 24, color: colors.muted, textAlign: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: 'transparent', borderRadius: 16, padding: 11 }, placeActive: { borderColor: colors.line, backgroundColor: colors.white },
  placeIcon: { width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft }, placeIconActive: { backgroundColor: colors.green }, placeIconText: { color: colors.green }, placeIconTextActive: { color: colors.white },
  placeBody: { flex: 1, gap: 2 }, placeKicker: { color: colors.coral, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, placeName: { color: colors.ink, fontFamily: 'serif', fontSize: 17, fontWeight: '700' }, placeAddress: { color: colors.muted, fontSize: 11 }, arrow: { color: colors.muted, fontSize: 25 },
});
