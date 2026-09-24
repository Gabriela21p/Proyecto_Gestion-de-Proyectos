import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest, buildQuery } from '../api';
import { colors, shadow } from '../theme';
import { BrandHeader, Button, Field, Notice, Pill } from '../components/Primitives';
import OsmMap from '../components/OsmMap';

// Explorar mantiene sincronizados mapa, lista y búsqueda de direcciones. Un
// punto consultado se trata aparte hasta que la persona decida registrarlo.
export default function ExploreScreen({ session, onOpenPlace, onRegister }) {
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

  const visibleSites = sites.filter((site) => Number.isFinite(Number(site.latitud)) && Number.isFinite(Number(site.longitud)));

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
        <OsmMap sites={visibleSites} selected={selected} location={location} onSelectSite={(id) => { setLocation(null); setSelected(sites.find((site) => site.id === id) || null); }} />
        <View style={styles.mapBadge}><Text style={styles.mapBadgeDot}>●</Text><Text style={styles.mapBadgeText}>{sites.length} lugares en comunidad</Text></View>
        {!location && selected ? (
          <Pressable onPress={() => onOpenPlace(selected.id)} style={({ pressed }) => [styles.mapPlaceCard, pressed && styles.mapPlaceCardPressed]}>
            <View style={styles.mapPlaceTop}>
              <View style={styles.mapPlaceIcon}><Text style={styles.mapPlaceIconText}>◆</Text></View>
              <View style={styles.mapPlaceBody}>
                <Text numberOfLines={1} style={styles.mapPlaceKicker}>{selected.categoria || 'Lugar local'} · {selected.barrio?.localidad || 'Bogotá'}</Text>
                <Text numberOfLines={2} style={styles.mapPlaceTitle}>{selected.nombre}</Text>
              </View>
              <View style={styles.mapPlaceArrow}><Text style={styles.mapPlaceArrowText}>›</Text></View>
            </View>
            <View style={styles.mapPlaceMeta}>
              <Text numberOfLines={1} style={styles.mapPlaceAddress}>{selected.direccion || 'Dirección por confirmar'}</Text>
              <Text style={styles.mapPlaceRating}>{Number(selected.rating_promedio || 0) ? `★ ${Number(selected.rating_promedio).toFixed(1)}` : 'Nuevo'}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      {!location && visibleSites.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mapRail}>
          {visibleSites.slice(0, 12).map((site) => (
            <Pressable key={site.id} onPress={() => setSelected(site)} style={[styles.mapRailItem, selected?.id === site.id && styles.mapRailItemActive]}>
              <Text numberOfLines={1} style={[styles.mapRailName, selected?.id === site.id && styles.mapRailNameActive]}>{site.nombre}</Text>
              <Text numberOfLines={1} style={[styles.mapRailCategory, selected?.id === site.id && styles.mapRailCategoryActive]}>{site.categoria || 'Lugar local'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {location && (
        <View style={styles.confirmCard}>
          <Text style={styles.kicker}>DIRECCIÓN ENCONTRADA</Text><Text style={styles.confirmTitle}>{location.direccion}</Text><Text style={styles.confirmCopy}>¿Este es el lugar que estabas buscando?</Text>
          {location.duplicates.length ? <Pressable onPress={() => onOpenPlace(location.duplicates[0].id)} style={styles.match}><Text style={styles.matchLabel}>Lugar cercano registrado</Text><Text style={styles.matchName}>{location.duplicates[0].nombre}</Text></Pressable> : <Text style={styles.newPlace}>Aún no hay un lugar registrado en este punto.</Text>}
          <Button onPress={() => onRegister(location)}>Registrar este lugar</Button>
          <Button kind="ghost" onPress={() => setLocation(null)}>Buscar otra dirección</Button>
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
  mapWrap: { height: 410, marginHorizontal: 14, marginTop: 18, overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: '#dce5dc', ...shadow },
  mapBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fffffff2', ...shadow },
  mapBadgeDot: { color: colors.green }, mapBadgeText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  mapPlaceCard: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 9, borderRadius: 20, padding: 14, backgroundColor: '#fffffff7', ...shadow },
  mapPlaceCardPressed: { transform: [{ scale: 0.985 }] }, mapPlaceTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  mapPlaceIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.coral }, mapPlaceIconText: { color: colors.white, fontSize: 14 },
  mapPlaceBody: { flex: 1, gap: 2 }, mapPlaceKicker: { color: colors.coral, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, mapPlaceTitle: { color: colors.ink, fontFamily: 'serif', fontSize: 20, lineHeight: 22, fontWeight: '700' },
  mapPlaceArrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green }, mapPlaceArrowText: { marginTop: -2, color: colors.white, fontSize: 26 },
  mapPlaceMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 }, mapPlaceAddress: { flex: 1, color: colors.muted, fontSize: 10 }, mapPlaceRating: { color: colors.green, fontSize: 11, fontWeight: '900' },
  mapRail: { gap: 8, paddingHorizontal: 14, paddingTop: 11 }, mapRailItem: { width: 145, gap: 2, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.white }, mapRailItemActive: { borderColor: colors.green, backgroundColor: colors.green },
  mapRailName: { color: colors.ink, fontFamily: 'serif', fontSize: 14, fontWeight: '700' }, mapRailNameActive: { color: colors.white }, mapRailCategory: { color: colors.coral, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' }, mapRailCategoryActive: { color: colors.lime },
  confirmCard: { gap: 11, margin: 16, marginBottom: 0, borderRadius: 19, padding: 18, backgroundColor: colors.white, ...shadow },
  kicker: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, confirmTitle: { color: colors.ink, fontFamily: 'serif', fontSize: 25, fontWeight: '700' }, confirmCopy: { color: colors.muted },
  newPlace: { borderRadius: 10, padding: 11, color: colors.green, backgroundColor: colors.greenSoft, fontSize: 12, fontWeight: '700' },
  match: { gap: 3, borderRadius: 12, padding: 12, backgroundColor: colors.warning }, matchLabel: { color: '#876325', fontSize: 10, fontWeight: '800' }, matchName: { color: colors.ink, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }, sectionTitle: { color: colors.ink, fontFamily: 'serif', fontSize: 21, fontWeight: '700' },
  list: { paddingHorizontal: 14, gap: 7 }, empty: { padding: 24, color: colors.muted, textAlign: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: 'transparent', borderRadius: 16, padding: 11 }, placeActive: { borderColor: colors.line, backgroundColor: colors.white },
  placeIcon: { width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft }, placeIconActive: { backgroundColor: colors.green }, placeIconText: { color: colors.green }, placeIconTextActive: { color: colors.white },
  placeBody: { flex: 1, gap: 2 }, placeKicker: { color: colors.coral, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }, placeName: { color: colors.ink, fontFamily: 'serif', fontSize: 17, fontWeight: '700' }, placeAddress: { color: colors.muted, fontSize: 11 }, arrow: { color: colors.muted, fontSize: 25 },
});
