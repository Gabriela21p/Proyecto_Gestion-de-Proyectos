import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import './product-theme.css';
// Fuente de los títulos empaquetada con la app: funciona aunque no haya
// conexión a Google Fonts (por ejemplo, en la red de la universidad).
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import './typography.css';
import { AuthProvider } from '@/lib/AuthContext';

export const metadata = {
  title: 'Rolling Bogotá',
  description: 'Descubre, registra y clasifica lugares destacados de Bogotá.',
};

// El layout raíz carga estilos compartidos y deja la sesión disponible para
// cualquier ruta, incluida la pantalla de acceso.
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
