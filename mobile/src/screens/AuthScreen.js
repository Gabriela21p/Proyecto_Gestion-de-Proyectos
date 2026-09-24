import { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../api';
import { colors, shadow } from '../theme';
import { Button, Field, Notice } from '../components/Primitives';

// Acceso y registro comparten contexto y campos, por eso viven en una misma
// pantalla en lugar de obligar a navegar entre dos formularios casi iguales.
export default function AuthScreen({ onAuthenticated }) {
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    // Validamos lo básico aquí para responder rápido; la API conserva las reglas
    // definitivas de identidad y seguridad.
    setError('');
    if (registering && username.trim().length < 2) return setError('Escribe un nombre de usuario.');
    if (!email.includes('@') || password.length < 8) return setError('Revisa el correo y usa una contraseña de mínimo 8 caracteres.');
    setLoading(true);
    try {
      const result = await apiRequest(registering ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST', body: { username: username.trim() || undefined, email: email.trim(), password },
      });
      await onAuthenticated({ token: result.token, user: result.user });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.mark}><Text style={styles.markText}>R</Text></View>
            <Text style={styles.kicker}>BOGOTÁ SE DESCUBRE EN COMUNIDAD</Text>
            <Text style={styles.title}>Encuentra lugares que vale la pena compartir.</Text>
            <Text style={styles.copy}>Explora, califica y registra espacios locales desde tu celular.</Text>
            <View style={styles.preview}><Text style={styles.previewDot}>●</Text><Text style={styles.previewText}>7 lugares listos para explorar</Text><Text style={styles.previewScore}>4.8</Text></View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{registering ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}</Text>
            <Text style={styles.cardCopy}>{registering ? 'Tu identidad da trazabilidad a cada aporte.' : 'Entra para ver el mapa comunitario.'}</Text>
            <View style={styles.form}>
              <Notice error>{error}</Notice>
              {registering && <Field label="Nombre de usuario" value={username} onChangeText={setUsername} placeholder="Tu nombre en Rolling" autoCapitalize="words" />}
              <Field label="Correo" value={email} onChangeText={setEmail} placeholder="tu@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <Field label="Contraseña" value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" secureTextEntry />
              <Button loading={loading} onPress={submit}>{registering ? 'Crear cuenta' : 'Entrar a Rolling'}</Button>
              <Button kind="ghost" onPress={() => { setRegistering(!registering); setError(''); }}>{registering ? 'Ya tengo una cuenta' : 'Crear una cuenta nueva'}</Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.forest },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 22 },
  hero: { paddingTop: 20 }, mark: { width: 52, height: 52, marginBottom: 20, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime },
  markText: { fontFamily: 'serif', fontSize: 25, fontWeight: '900', color: colors.ink },
  kicker: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { maxWidth: 370, marginTop: 10, color: colors.white, fontFamily: 'serif', fontSize: 37, fontWeight: '700', lineHeight: 39, letterSpacing: -1 },
  copy: { maxWidth: 350, marginTop: 10, color: '#b7c3bc', fontSize: 14, lineHeight: 21 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, borderWidth: 1, borderColor: '#30463b', borderRadius: 13, padding: 12 },
  previewDot: { color: colors.lime }, previewText: { flex: 1, color: '#cbd5cf', fontSize: 12, fontWeight: '700' }, previewScore: { color: colors.white, fontSize: 18, fontWeight: '900' },
  card: { borderRadius: 24, padding: 20, backgroundColor: colors.paper, ...shadow },
  cardTitle: { color: colors.ink, fontFamily: 'serif', fontSize: 27, fontWeight: '700' },
  cardCopy: { marginTop: 5, color: colors.muted, fontSize: 13, lineHeight: 19 },
  form: { gap: 13, marginTop: 20 },
});
