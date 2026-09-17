'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };
  const canModerate = user && ['admin', 'moderator'].includes(user.role);

  if (loading || !user) {
    return (
      <main className="session-gate" aria-live="polite">
        <div className="session-gate__panel">
          <strong>Rolling Bogotá</strong>
          <span>Validando tu sesión...</span>
        </div>
      </main>
    );
  }

  const navItem = (href, label) => (
    <Link className={pathname === href || pathname.startsWith(`${href}/`) ? 'app-nav__link app-nav__link--active' : 'app-nav__link'} href={href}>
      {label}
    </Link>
  );

  return (
    <>
      <header className="app-header">
        <div className="app-header__content">
          <Link href="/app" className="app-header__brand">
            <span className="brand-mark">R</span>
            <span>
              <strong>Rolling Bogotá</strong>
              <small>Descubre lugares que sí valen la pena</small>
            </span>
          </Link>

          <nav className="app-nav" aria-label="Navegación principal">
            {navItem('/app', 'Explorar')}
            {navItem('/app/registrar', 'Registrar local')}
            {canModerate && navItem('/app/admin', 'Moderación')}
          </nav>

          <div className="app-header__actions">
            <div className="user-chip">
              <span className="user-chip__avatar">{user.username?.slice(0, 1).toUpperCase()}</span>
              <span><strong>{user.username}</strong><small>{user.reputation} pts · {user.role}</small></span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Salir</button>
          </div>
        </div>
      </header>
      {children}
      <style jsx>{`
        .app-header{position:sticky;top:0;z-index:1000;background:rgba(17,24,39,.96);backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.08);color:#fff}
        .app-header__content{max-width:1500px;margin:0 auto;padding:.8rem 1.5rem;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:2rem}
        .app-header__brand{display:flex;align-items:center;gap:.8rem;color:#fff;text-decoration:none;min-width:max-content}
        .brand-mark{width:40px;height:40px;border-radius:13px;background:linear-gradient(135deg,#7c3aed,#2563eb);display:grid;place-items:center;font-weight:900;box-shadow:0 8px 28px rgba(79,70,229,.35)}
        .app-header__brand>span:last-child{display:grid;gap:.1rem}.app-header__brand strong{font-size:.98rem}.app-header__brand small{font-size:.72rem;color:#9ca3af;font-weight:500}
        .app-nav{display:flex;justify-content:center;gap:.35rem}.app-nav :global(.app-nav__link){padding:.55rem .82rem;border-radius:10px;color:#cbd5e1;text-decoration:none;font-size:.87rem;font-weight:700}.app-nav :global(.app-nav__link:hover){background:rgba(255,255,255,.07);color:#fff}.app-nav :global(.app-nav__link--active){background:#fff;color:#111827}
        .app-header__actions{display:flex;align-items:center;gap:.75rem}.user-chip{display:flex;align-items:center;gap:.55rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);padding:.4rem .6rem;border-radius:12px}.user-chip__avatar{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#4f46e5;font-weight:800}.user-chip>span:last-child{display:grid;line-height:1.15}.user-chip strong{font-size:.78rem}.user-chip small{font-size:.66rem;color:#9ca3af}.logout-btn{border:1px solid rgba(255,255,255,.12);background:transparent;color:#d1d5db;padding:.58rem .72rem;border-radius:10px;cursor:pointer;font-weight:700}.logout-btn:hover{background:rgba(255,255,255,.07);color:#fff}
        @media(max-width:900px){.app-header__content{grid-template-columns:1fr auto;gap:.8rem}.app-nav{grid-column:1/-1;grid-row:2;justify-content:flex-start;overflow:auto}.app-header__brand small,.user-chip>span:last-child{display:none}}
      `}</style>
    </>
  );
}
