import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../api';
import { colors, shadow } from '../theme';
import { BrandHeader, Button, Field, Notice, Pill } from '../components/Primitives';

const categories = ['Café', 'Restaurante', 'Biblioteca', 'Museo', 'Mercado', 'Parque', 'Cultura', 'Comercio', 'Otro'];
const empty = { nombre: '', categoria: '', direccion: '', localidad: '', descripcion: '', contacto: '', latitud: '', longitud: '' };

// El formulario sigue el mismo recorrido de la web y deja claro que un lugar no
// se publica hasta pasar por moderación.
export default function RegisterScreen({ session, initialLocation, onDone }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    // Cuando llegamos desde Explorar ya tenemos un punto confiable; lo conservamos
    // mientras la persona completa el nombre y la historia del lugar.
    if (!initialLocation) return;
    setForm((current) => ({ ...current, direccion: initialLocation.direccion || '', localidad: initialLocation.localidad || '', latitud: String(initialLocation.latitud || ''), longitud: String(initialLocation.longitud || '') }));
    setPreview({ duplicates: initialLocation.duplicates || [] });
  }, [initialLocation]);

  function update(key, value) {
    // Cambiar la dirección invalida sus coordenadas para no enviar un punto viejo.
    setForm((current) => ({ ...current, [key]: value, ...(key === 'direccion' ? { latitud: '', longitud: '' } : {}) }));
    setMessage(''); setError(false);
  }

  const canContinue = useMemo(() => {
    // Cada paso revisa únicamente su información obligatoria.
    if (step === 0) return form.nombre.trim().length >= 3 && form.categoria;
    if (step === 1) return form.direccion.trim().length >= 5 && form.latitud && form.longitud;
    if (step === 2) return form.descripcion.trim().length >= 10;
    return true;
  }, [step, form]);

  async function validateAddress() {
    // Preview normaliza la dirección y avisa sobre lugares cercanos sin guardar.
    setLoading(true); setMessage('Validando la dirección...'); setError(false);
    try {
      const data = await apiRequest('/api/site-suggestions/preview', {
        token: session.token, method: 'POST', body: { nombre: form.nombre || 'Ubicación consultada', categoria: form.categoria || undefined, direccion: form.direccion, localidad: form.localidad || undefined, ciudad: 'Bogota', descripcion: form.descripcion || 'Dirección consultada desde la app móvil de Rolling.' },
      });
      const suggestion = data.suggestion || {};
      if (!suggestion.latitud || !suggestion.longitud) throw new Error('No obtuvimos coordenadas precisas. Revisa la nomenclatura.');
      setForm((current) => ({ ...current, direccion: suggestion.direccion || current.direccion, latitud: String(suggestion.latitud), longitud: String(suggestion.longitud) }));
      setPreview(data);
      setMessage(data.duplicates?.length ? 'Ubicación verificada; encontramos posibles duplicados.' : 'Dirección verificada dentro de Bogotá.');
    } catch (err) { setMessage(err.message); setError(true); }
    finally { setLoading(false); }
  }

  async function submit() {
    // El backend vuelve a validar coordenadas y crea una sugerencia pendiente.
    setLoading(true); setMessage('Enviando a moderación...'); setError(false);
    try {
      await apiRequest('/api/site-suggestions', {
        token: session.token, method: 'POST', body: { ...form, ciudad: 'Bogota', departamento: 'BOGOTA D.C.', divipola: '11001', suggested_by: session.user.username, latitud: Number(form.latitud), longitud: Number(form.longitud) },
      });
      setMessage('Lugar enviado. Quedó pendiente de moderación.');
      setTimeout(onDone, 900);
    } catch (err) { setMessage(err.message); setError(true); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandHeader eyebrow="REGISTRO COMUNITARIO · BOGOTÁ" title="Agrega un lugar a Rolling" subtitle="Validamos la dirección y evitamos duplicados antes de enviarlo a moderación." />
        <View style={styles.steps}>{['Lugar', 'Ubicación', 'Historia', 'Revisar'].map((label, index) => <View key={label} style={styles.step}><View style={[styles.stepDot, index <= step && styles.stepDotActive]}><Text style={[styles.stepNumber, index <= step && styles.stepNumberActive]}>{index < step ? '✓' : index + 1}</Text></View><Text style={[styles.stepLabel, index === step && styles.stepLabelActive]}>{label}</Text></View>)}</View>

        <View style={styles.card}>
          <Text style={styles.stepKicker}>PASO {step + 1}</Text>
          {step === 0 && <View style={styles.form}><Text style={styles.heading}>¿Qué lugar estás registrando?</Text><Field label="Nombre del lugar" value={form.nombre} onChangeText={(v) => update('nombre', v)} placeholder="Ej. Café Aurora" /><Text style={styles.label}>Categoría</Text><View style={styles.categoryGrid}>{categories.map((category) => <Pill key={category} active={form.categoria === category} onPress={() => update('categoria', category)}>{category}</Pill>)}</View></View>}
          {step === 1 && <View style={styles.form}><Text style={styles.heading}>Ubícalo en Bogotá</Text><Field label="Dirección" value={form.direccion} onChangeText={(v) => update('direccion', v)} placeholder="Cra 89 # 70 Sur - 28" /><Field label="Localidad (opcional)" value={form.localidad} onChangeText={(v) => update('localidad', v)} placeholder="Bosa" /><Button kind="secondary" loading={loading} disabled={form.direccion.length < 5} onPress={validateAddress}>Validar dirección</Button>{form.latitud ? <View style={styles.verified}><Text style={styles.verifiedTitle}>✓ Ubicación verificada</Text><Text style={styles.verifiedText}>{form.direccion}</Text><Text style={styles.coords}>{form.latitud}, {form.longitud}</Text></View> : null}{preview?.duplicates?.length ? <View style={styles.duplicates}><Text style={styles.duplicateTitle}>Posibles duplicados</Text>{preview.duplicates.slice(0, 3).map((item) => <Text key={item.id} style={styles.duplicateText}>{item.nombre} · {item.distancia_metros} m</Text>)}</View> : null}</View>}
          {step === 2 && <View style={styles.form}><Text style={styles.heading}>¿Qué lo hace especial?</Text><Field label="Descripción" multiline value={form.descripcion} onChangeText={(v) => update('descripcion', v)} placeholder="Cuenta qué ofrece, cómo es el ambiente y por qué lo recomendarías..." maxLength={1200} /><Text style={styles.counter}>{form.descripcion.length}/1200 · mínimo 10 caracteres</Text><Field label="Contacto o sitio web (opcional)" value={form.contacto} onChangeText={(v) => update('contacto', v)} placeholder="https://... o teléfono" /></View>}
          {step === 3 && <View style={styles.form}><Text style={styles.heading}>Revisa antes de enviar</Text><Summary label="LUGAR" title={form.nombre} body={form.categoria} /><Summary label="UBICACIÓN" title={form.direccion} body={form.localidad || 'Bogotá D.C.'} /><Summary label="DESCRIPCIÓN" body={form.descripcion} /></View>}
          <Notice error={error}>{message}</Notice>
          <View style={styles.actions}><Button kind="secondary" disabled={step === 0 || loading} onPress={() => setStep(step - 1)} style={styles.action}>Atrás</Button>{step < 3 ? <Button disabled={!canContinue || loading} onPress={() => setStep(step + 1)} style={styles.action}>Continuar</Button> : <Button loading={loading} onPress={submit} style={styles.action}>Enviar</Button>}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Summary({ label, title, body }) { return <View style={styles.summary}><Text style={styles.summaryLabel}>{label}</Text>{title ? <Text style={styles.summaryTitle}>{title}</Text> : null}<Text style={styles.summaryBody}>{body}</Text></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.paper }, content: { paddingBottom: 30 },
  steps: { flexDirection: 'row', paddingHorizontal: 18, paddingBottom: 17 }, step: { flex: 1, alignItems: 'center', gap: 5 }, stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7eae6' }, stepDotActive: { backgroundColor: colors.green }, stepNumber: { color: colors.muted, fontSize: 11, fontWeight: '900' }, stepNumberActive: { color: colors.white }, stepLabel: { color: '#929b96', fontSize: 9, fontWeight: '700' }, stepLabelActive: { color: colors.green },
  card: { gap: 17, marginHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 20, backgroundColor: colors.white, ...shadow }, stepKicker: { color: colors.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, heading: { color: colors.ink, fontFamily: 'serif', fontSize: 26, fontWeight: '700', lineHeight: 29 }, form: { gap: 14 }, label: { color: colors.ink, fontSize: 12, fontWeight: '800' }, categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 10 },
  verified: { gap: 4, borderRadius: 14, padding: 13, backgroundColor: colors.greenSoft }, verifiedTitle: { color: colors.green, fontWeight: '900' }, verifiedText: { color: colors.ink, fontSize: 12 }, coords: { color: colors.muted, fontSize: 10 },
  duplicates: { gap: 4, borderRadius: 14, padding: 13, backgroundColor: colors.warning }, duplicateTitle: { color: '#845d18', fontWeight: '900' }, duplicateText: { color: '#705f3d', fontSize: 12 },
  summary: { gap: 4, borderRadius: 14, padding: 14, backgroundColor: colors.field }, summaryLabel: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, summaryTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, summaryBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 4 }, action: { flex: 1 },
});
