import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

// Leaflet corre dentro del WebView y pide las teselas como un navegador normal.
// Así Expo Go no depende del SDK de Google Maps para mostrar OpenStreetMap.
export default function OsmMap({ sites, selected, location, onSelectSite }) {
  const webView = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const payload = useMemo(() => ({
    sites: sites.map((site) => ({
      id: site.id,
      name: site.nombre,
      category: site.categoria,
      lat: Number(site.latitud),
      lng: Number(site.longitud),
    })),
    selectedId: selected?.id || null,
    location: location ? { address: location.direccion, lat: Number(location.latitud), lng: Number(location.longitud) } : null,
  }), [sites, selected?.id, location]);

  useEffect(() => {
    if (!ready || !webView.current) return;
    // Escapamos '<' para que nombres aportados por usuarios nunca puedan cerrar
    // accidentalmente el script que recibe los datos.
    const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');
    webView.current.injectJavaScript(`window.renderRolling(${serialized}); true;`);
  }, [payload, ready]);

  function handleMessage(event) {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') {
        setReady(true);
        setError('');
      }
      if (message.type === 'select' && message.id) onSelectSite(message.id);
      if (message.type === 'error') setError(message.message || 'No pudimos cargar OpenStreetMap.');
    } catch {
      // Ignoramos mensajes ajenos al pequeño puente del mapa.
    }
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webView}
        source={{ html: MAP_HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="never"
        scrollEnabled={false}
        onMessage={handleMessage}
        onError={() => setError('No pudimos abrir el mapa en este dispositivo.')}
        style={styles.webView}
      />
      {!ready && !error ? <View pointerEvents="none" style={styles.loading}><Text style={styles.loadingText}>Cargando OpenStreetMap...</Text></View> : null}
      {error ? <View pointerEvents="none" style={styles.error}><Text style={styles.errorTitle}>Mapa no disponible</Text><Text style={styles.errorText}>{error}</Text></View> : null}
    </View>
  );
}

const MAP_HTML = `<!doctype html>
<html lang="es">
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html,body,#map{height:100%;width:100%;margin:0;background:#e2e8e2}
    .leaflet-control-attribution{font:9px system-ui,sans-serif}
    .leaflet-tooltip{border:0;border-radius:8px;padding:6px 8px;box-shadow:0 5px 14px #17282033;font:700 11px system-ui,sans-serif;color:#19241f}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function () {
      function send(message) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }

      if (!window.L) {
        send({ type: 'error', message: 'No se pudo descargar el visor del mapa. Revisa la conexión a internet.' });
        return;
      }

      const map = L.map('map', { zoomControl: true, attributionControl: true }).setView([4.6486, -74.0721], 11);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      const markers = L.layerGroup().addTo(map);

      window.renderRolling = function (data) {
        markers.clearLayers();
        (data.sites || []).forEach(function (site) {
          const active = site.id === data.selectedId;
          L.circleMarker([site.lat, site.lng], {
            radius: active ? 10 : 8,
            color: '#ffffff',
            weight: 3,
            fillColor: active ? '#e25f3f' : '#225e49',
            fillOpacity: 1
          }).addTo(markers)
            .bindTooltip(site.name, { direction: 'top', offset: [0, -8] })
            .on('click', function () { send({ type: 'select', id: site.id }); });
        });

        if (data.location) {
          L.circleMarker([data.location.lat, data.location.lng], {
            radius: 11, color: '#ffffff', weight: 3, fillColor: '#e25f3f', fillOpacity: 1
          }).addTo(markers).bindTooltip(data.location.address, { direction: 'top', offset: [0, -9] });
          map.setView([data.location.lat, data.location.lng], 16, { animate: true });
        } else if (data.selectedId) {
          const current = (data.sites || []).find(function (site) { return site.id === data.selectedId; });
          if (current) map.setView([current.lat, current.lng], 14, { animate: true });
        }
      };

      send({ type: 'ready' });
    })();
  </script>
</body>
</html>`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e2e8e2' },
  webView: { flex: 1, backgroundColor: '#e2e8e2' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8e2' },
  loadingText: { color: colors.green, fontSize: 12, fontWeight: '800' },
  error: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 5, padding: 24, backgroundColor: '#edf0eb' },
  errorTitle: { color: colors.ink, fontWeight: '900' },
  errorText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
