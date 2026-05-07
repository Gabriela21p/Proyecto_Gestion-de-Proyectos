import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';

export const metadata = {
  title: 'Rolling Local',
  description: 'Mapa comunitario para descubrir, valorar y destacar negocios locales.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
