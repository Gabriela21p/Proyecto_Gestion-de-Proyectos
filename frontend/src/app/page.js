'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function Page() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // La portada sólo funciona como puerta de entrada: enviamos al usuario al
    // destino correcto cuando termina de restaurarse la sesión.
    if (!loading) {
      if (user) {
        router.push('/app');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p>Redirigiendo...</p>
    </main>
  );
}
