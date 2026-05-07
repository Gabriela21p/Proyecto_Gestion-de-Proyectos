import { useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export default function App() {
  const [sites, setSites] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/sites`)
      .then((response) => response.json())
      .then((data) => {
        setSites(data);
        setSelected(data[0] || null);
      })
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>Rolling</Text>
        <Text style={styles.copy}>Sitios buenos elegidos por la comunidad</Text>
      </View>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: selected?.latitud || 4.6486,
          longitude: selected?.longitud || -74.0618,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {sites.map((site) => (
          <Marker
            key={site.id}
            coordinate={{ latitude: site.latitud, longitude: site.longitud }}
            title={site.nombre}
            description={`${site.rating_promedio} · ${site.categoria}`}
            onPress={() => setSelected(site)}
          />
        ))}
      </MapView>
      <FlatList
        style={styles.list}
        data={sites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, selected?.id === item.id && styles.cardActive]}>
            <Text style={styles.title}>{item.nombre}</Text>
            <Text style={styles.copy}>{item.barrio?.localidad} · {item.rating_promedio} · {item.total_reviews} reviews</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f1ea' },
  header: { padding: 18, gap: 4 },
  brand: { fontSize: 28, fontWeight: '800', color: '#17202a' },
  copy: { color: '#667085' },
  map: { height: 360 },
  list: { padding: 14 },
  card: { padding: 14, marginBottom: 10, borderRadius: 8, backgroundColor: '#fff' },
  cardActive: { borderWidth: 2, borderColor: '#2667ff' },
  title: { fontWeight: '800', color: '#17202a', marginBottom: 4 },
});
