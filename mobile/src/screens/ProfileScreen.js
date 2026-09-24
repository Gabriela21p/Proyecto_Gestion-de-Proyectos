import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../api';
import { colors, shadow } from '../theme';
import { BrandHeader, Button, Pill } from '../components/Primitives';

export default function ProfileScreen({ session, onLogout }) {
  const user = session.user || {};
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <BrandHeader eyebrow="TU COMUNIDAD" title={`Hola, ${user.username || 'vecino'}.`} subtitle="Tus aportes ayudan a construir recomendaciones locales más confiables." />
      <View style={styles.card}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{String(user.username || 'R').slice(0, 1).toUpperCase()}</Text></View>
        <Text style={styles.name}>{user.username}</Text><Text style={styles.email}>{user.email}</Text>
        <View style={styles.pills}><Pill active>{user.reputation || 0} reputación</Pill><Pill>{user.role || 'neighbor'}</Pill></View>
      </View>
      <View style={styles.info}><Text style={styles.infoTitle}>Servidor conectado</Text><Text style={styles.infoValue}>{API_URL}</Text><Text style={styles.infoCopy}>El celular y el computador deben estar en la misma red mientras pruebas localmente.</Text></View>
      <Button kind="danger" onPress={onLogout}>Cerrar sesión</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, content: { paddingBottom: 30, paddingHorizontal: 20 },
  card: { alignItems: 'center', borderRadius: 22, padding: 24, backgroundColor: colors.white, ...shadow }, avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime }, avatarText: { color: colors.ink, fontFamily: 'serif', fontSize: 32, fontWeight: '900' }, name: { marginTop: 12, color: colors.ink, fontFamily: 'serif', fontSize: 25, fontWeight: '700' }, email: { marginTop: 3, color: colors.muted }, pills: { flexDirection: 'row', gap: 8, marginTop: 15 },
  info: { gap: 6, marginVertical: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 16, backgroundColor: colors.white }, infoTitle: { color: colors.ink, fontWeight: '900' }, infoValue: { color: colors.green, fontSize: 12, fontWeight: '800' }, infoCopy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
