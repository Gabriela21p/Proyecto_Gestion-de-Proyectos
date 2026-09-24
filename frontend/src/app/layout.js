import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import './product-theme.css';
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
