import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../api';
import { colors, shadow } from '../theme';
import { Button, Field, Notice, Pill } from '../components/Primitives';

const ratingLabels = ['Muy mala', 'Mala', 'Bien', 'Muy buena', 'Excelente'];

// La ficha concentra datos y reseñas para que la persona no pierda el contexto
// del lugar mientras escribe su aporte.
export default function PlaceScreen({ siteId, session, onBack }) {
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [verified, setVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => { load(); }, [siteId]);

  async function load() {
    // Recargamos la ficha después de reseñar para mostrar el score actualizado.
    setLoading(true);
    try { setSite(await apiRequest(`/api/sites/${siteId}`)); }
    catch (err) { setMessage(err.message); setError(true); }
    finally { setLoading(false); }
  }

  async function submitReview() {
    // La confirmación de visita es voluntaria; nunca la marcamos por la persona.
    if (comment.trim().length < 12) { setError(true); setMessage('La experiencia debe tener mínimo 12 caracteres.'); return; }
    setSubmitting(true); setError(false); setMessage('Publicando tu reseña...');
    try {
      await apiRequest(`/api/sites/${siteId}/reviews`, { token: session.token, method: 'POST', body: { username: session.user.username, rating, titulo: title, comentario: comment, verificada: verified } });
      setMessage('Tu reseña quedó publicada y el Rolling Score fue actualizado.');
      setReviewing(false); setTitle(''); setComment(''); setVerified(false);
      await load();
    } catch (err) { setMessage(err.message); setError(true); }
    finally { setSubmitting(false); }
  }

  if (loading && !site) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.green} /><Text style={styles.loadingText}>Cargando lugar...</Text></View>;
  if (!site) return <View style={styles.loading}><Notice error>{message || 'No encontramos este lugar.'}</Notice><Button kind="secondary" onPress={onBack}>Volver</Button></View>;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>← Volver al mapa</Text></Pressable>
          <Text style={styles.kicker}>{site.barrio?.localidad || 'BOGOTÁ'} · {site.categoria}</Text>
          <Text style={styles.title}>{site.nombre}</Text>
          <Text style={styles.description}>{site.descripcion || 'Este lugar está empezando a construir su historia dentro de Rolling.'}</Text>
          <View style={styles.scoreRow}><View style={styles.score}><Text style={styles.scoreNumber}>{Number(site.rating_promedio || 0).toFixed(1)}</Text><Text style={styles.scoreLabel}>ROLLING SCORE</Text></View><View style={styles.facts}><Pill active>{site.total_reviews || 0} reseñas</Pill><Pill>{site.total_reviews_verificadas || 0} verificadas</Pill><Pill>Confianza {Number(site.trust_score || 0).toFixed(0)}</Pill></View></View>
        </View>

        <View style={styles.card}><Text style={styles.sectionKicker}>INFORMACIÓN</Text><Text style={styles.sectionTitle}>Datos del lugar</Text><Info label="Dirección" value={site.direccion || 'Sin dirección publicada'} /><Info label="Localidad" value={site.barrio?.localidad || 'Bogotá'} /><Info label="Categoría" value={site.categoria || 'Lugar local'} />{site.website ? <Button kind="secondary" onPress={() => Linking.openURL(site.website)}>Abrir sitio o Maps</Button> : null}</View>

        <View style={styles.card}>
          <View style={styles.sectionRow}><View><Text style={styles.sectionKicker}>COMUNIDAD</Text><Text style={styles.sectionTitle}>Reseñas recientes</Text></View><Button kind="ghost" onPress={() => { setReviewing(!reviewing); setMessage(''); }}>Agregar</Button></View>
          {reviewing && <View style={styles.reviewForm}><Text style={styles.reviewQuestion}>¿Cómo estuvo tu experiencia?</Text><View style={styles.ratings}>{ratingLabels.map((label, index) => { const value = index + 1; return <Pressable key={label} onPress={() => setRating(value)} style={[styles.rating, rating === value && styles.ratingActive]}><Text style={[styles.ratingNumber, rating === value && styles.ratingTextActive]}>{value}</Text><Text style={[styles.ratingLabel, rating === value && styles.ratingTextActive]}>{label}</Text></Pressable>; })}</View><Field label="Título (opcional)" value={title} onChangeText={setTitle} placeholder="Resume tu experiencia" maxLength={120} /><Field label="Tu experiencia" multiline value={comment} onChangeText={setComment} placeholder="Servicio, ambiente, detalles útiles..." maxLength={1200} /><Text style={styles.counter}>{comment.length}/1200 · mínimo 12</Text><Pressable onPress={() => setVerified(!verified)} style={[styles.verifyChoice, verified && styles.verifyChoiceActive]}><Text style={styles.verifyMark}>{verified ? '✓' : ''}</Text><View style={styles.verifyCopy}><Text style={styles.verifyTitle}>Confirmo que visité este lugar</Text><Text style={styles.verifyHint}>Esta señal mejora el peso de tu aporte.</Text></View></Pressable><Notice error={error}>{message}</Notice><Button loading={submitting} disabled={comment.trim().length < 12} onPress={submitReview}>Publicar reseña</Button></View>}
          {!reviewing && <Notice error={error}>{message}</Notice>}
          <View style={styles.reviews}>{(site.reviews || []).map((review) => <View key={review.id} style={styles.review}><View style={styles.reviewHead}><Text style={styles.reviewScore}>★ {review.rating}.0</Text><Text style={styles.reviewUser}>{review.user?.username || 'Vecino Rolling'}</Text></View><Text style={styles.reviewTitle}>{review.titulo || 'Experiencia comunitaria'}</Text><Text style={styles.reviewBody}>{review.comentario}</Text>{review.verificada ? <Text style={styles.verified}>✓ Visita verificada</Text> : null}</View>)}{!site.reviews?.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Sé la primera persona en clasificarlo</Text><Text style={styles.emptyText}>Tu experiencia ayuda a construir el ranking real de Bogotá.</Text></View> : null}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Info({ label, value }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.paper }, content: { gap: 14, paddingBottom: 32 },
  loading: { flex: 1, justifyContent: 'center', gap: 14, padding: 24, backgroundColor: colors.paper }, loadingText: { color: colors.muted, textAlign: 'center' },
  hero: { padding: 22, paddingBottom: 26, backgroundColor: colors.forest }, back: { alignSelf: 'flex-start', marginBottom: 34, paddingVertical: 8 }, backText: { color: '#b8c4bd', fontSize: 12, fontWeight: '800' }, kicker: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' }, title: { marginTop: 10, color: colors.white, fontFamily: 'serif', fontSize: 40, fontWeight: '700', lineHeight: 42, letterSpacing: -1.2 }, description: { marginTop: 12, color: '#b8c4bd', lineHeight: 21 }, scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 22 }, score: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime }, scoreNumber: { color: colors.ink, fontFamily: 'serif', fontSize: 32, fontWeight: '900' }, scoreLabel: { color: colors.green, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 }, facts: { flex: 1, gap: 6 },
  card: { gap: 11, marginHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 18, backgroundColor: colors.white, ...shadow }, sectionKicker: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, sectionTitle: { color: colors.ink, fontFamily: 'serif', fontSize: 25, fontWeight: '700' }, sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, info: { flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: '#eceeea', paddingVertical: 10 }, infoLabel: { width: 78, color: colors.muted, fontSize: 11, fontWeight: '900' }, infoValue: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700' },
  reviewForm: { gap: 12, borderRadius: 16, padding: 14, backgroundColor: colors.field }, reviewQuestion: { color: colors.ink, fontFamily: 'serif', fontSize: 20, fontWeight: '700' }, ratings: { flexDirection: 'row', gap: 5 }, rating: { flex: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: colors.line, borderRadius: 11, backgroundColor: colors.white }, ratingActive: { borderColor: colors.green, backgroundColor: colors.green }, ratingNumber: { color: colors.ink, fontFamily: 'serif', fontSize: 23, fontWeight: '900' }, ratingLabel: { color: colors.muted, fontSize: 7, fontWeight: '700', textAlign: 'center' }, ratingTextActive: { color: colors.white }, counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 10 },
  verifyChoice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, backgroundColor: colors.white }, verifyChoiceActive: { borderColor: colors.green, backgroundColor: colors.greenSoft }, verifyMark: { width: 21, height: 21, borderWidth: 2, borderColor: colors.green, borderRadius: 6, color: colors.green, textAlign: 'center', fontWeight: '900' }, verifyCopy: { flex: 1, gap: 2 }, verifyTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' }, verifyHint: { color: colors.muted, fontSize: 10 },
  reviews: { gap: 9 }, review: { gap: 7, borderRadius: 15, padding: 14, backgroundColor: colors.field }, reviewHead: { flexDirection: 'row', justifyContent: 'space-between' }, reviewScore: { color: '#c17b00', fontWeight: '900' }, reviewUser: { color: colors.muted, fontSize: 11 }, reviewTitle: { color: colors.ink, fontWeight: '900' }, reviewBody: { color: colors.muted, fontSize: 13, lineHeight: 19 }, verified: { color: colors.green, fontSize: 10, fontWeight: '800' }, empty: { alignItems: 'center', gap: 5, padding: 24 }, emptyTitle: { color: colors.ink, fontWeight: '900' }, emptyText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
