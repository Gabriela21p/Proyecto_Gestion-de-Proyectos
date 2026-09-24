import { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from './src/api';
import { colors } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import PlaceScreen from './src/screens/PlaceScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminScreen from './src/screens/AdminScreen';
import TabBar from './src/components/TabBar';

const SESSION_KEY = 'rolling.session';

// App mantiene una navegación pequeña a propósito. Para estas cuatro pantallas
// no necesitamos sumar un router nativo ni otra capa de estado global.
export default function App() {
  return <SafeAreaProvider><RollingApp /></SafeAreaProvider>;
}

function RollingApp() {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [route, setRoute] = useState({ name: 'explore', params: {} });

  useEffect(() => { restoreSession(); }, []);

  async function restoreSession() {
    // La copia local acelera el arranque, pero siempre confirmamos el token con
    // la API antes de dar acceso a la aplicación.
    try {
      const saved = await AsyncStorage.getItem(SESSION_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const result = await apiRequest('/api/auth/me', { token: parsed.token });
      setSession({ token: parsed.token, user: result.user });
    } catch {
      await AsyncStorage.removeItem(SESSION_KEY);
    } finally {
      setBooting(false);
    }
  }

  async function acceptSession(nextSession) {
    // Persistimos la sesión completa para que el siguiente arranque sea fluido.
    setSession(nextSession);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
  }

  async function logout() {
    await AsyncStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRoute({ name: 'explore', params: {} });
  }

  function navigate(name, params = {}) { setRoute({ name, params }); }

  if (booting) {
    return (
      <SafeAreaView style={styles.loading}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
        <View style={styles.loadingMark}><Text style={styles.loadingLetter}>R</Text></View>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.loadingText}>Preparando Rolling...</Text>
      </SafeAreaView>
    );
  }

  if (!session) return <AuthScreen onAuthenticated={acceptSession} />;

  let content;
  // El enrutado vive aquí para que cada pantalla sólo se ocupe de su propio flujo.
  if (route.name === 'place') {
    content = <PlaceScreen siteId={route.params.siteId} session={session} onBack={() => navigate('explore')} />;
  } else if (route.name === 'register') {
    content = <RegisterScreen session={session} initialLocation={route.params.location} onDone={() => navigate('explore')} />;
  } else if (route.name === 'profile') {
    content = <ProfileScreen session={session} onLogout={logout} />;
  } else if (route.name === 'admin') {
    content = <AdminScreen session={session} />;
  } else {
    content = <ExploreScreen session={session} onOpenPlace={(siteId) => navigate('place', { siteId })} onRegister={(location) => navigate('register', { location })} />;
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <View style={styles.content}>{content}</View>
      {route.name !== 'place' && <TabBar active={route.name} user={session.user} onNavigate={navigate} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.paper },
  loadingMark: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: colors.lime },
  loadingLetter: { color: colors.ink, fontFamily: 'serif', fontSize: 28, fontWeight: '900' },
  loadingText: { color: colors.muted, fontWeight: '700' },
});
