import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import './product-theme.css';
import { AuthProvider } from '@/lib/AuthContext';

export const metadata = {
  title: 'Rolling Bogotá',
  description: 'Descubre, registra y clasifica locales destacados de Bogotá.',
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
