'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function AppLayout({ children }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header__content">
          <div className="app-header__brand">
            <h1>Rolling</h1>
            {user && <span>Conectado como {user.username}</span>}
          </div>
          <div className="app-header__actions">
            {user && (
              <>
                <div className="user-info">
                  <span className="reputation">Reputación: {user.reputation}</span>
                  <span className="weight">Peso: {user.review_weight.toFixed(2)}x</span>
                </div>
                <button className="logout-btn" onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      {children}
      <style jsx>{`
        .app-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem 2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .app-header__content {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .app-header__brand {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .app-header__brand h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .app-header__brand span {
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .app-header__actions {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .user-info {
          display: flex;
          gap: 1rem;
          font-size: 0.875rem;
        }

        .user-info span {
          background: rgba(255, 255, 255, 0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
        }

        .logout-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.4);
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.6);
        }
      `}</style>
    </>
  );
}
