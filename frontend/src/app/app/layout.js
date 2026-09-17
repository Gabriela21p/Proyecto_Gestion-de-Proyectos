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

  const navItem = (href, label) => {
    const active = href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(`${href}/`);
    return <Link className={active ? 'rolling-nav__link rolling-nav__link--active' : 'rolling-nav__link'} href={href}>{label}</Link>;
  };

  return (
    <>
      <header className="rolling-header">
        <div className="rolling-header__glass">
          <Link className="rolling-brand" href="/app">
            <span className="rolling-brand__orb">R</span>
            <span className="rolling-brand__copy"><strong>Rolling</strong><small>Explora Bogotá</small></span>
          </Link>

          <nav className="rolling-nav" aria-label="Navegación principal">
            {navItem('/app', 'Explorar')}
            {navItem('/app/registrar', 'Registrar local')}
            {canModerate && navItem('/app/admin', 'Moderación')}
          </nav>

          <div className="rolling-user">
            <span className="rolling-user__stats"><b>{user.reputation}</b><small>reputación</small></span>
            <span className="rolling-user__identity"><strong>{user.username}</strong><small>{user.role}</small></span>
            <button className="rolling-logout" onClick={handleLogout} aria-label="Cerrar sesión">Salir</button>
          </div>
        </div>
      </header>
      {children}

      <style jsx>{`
        .rolling-header{position:sticky;top:0;z-index:1000;height:76px;padding:0 24px;background:#18231f;color:#f8f6f0}
        .rolling-header__glass{width:100%;height:76px;margin:auto;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:28px}
        .rolling-brand{display:flex;align-items:center;gap:10px;color:#fff}.rolling-brand__orb{display:grid;width:38px;height:38px;place-items:center;border:1px solid rgba(255,255,255,.18);border-radius:50%;color:#18231f;background:#dbe9b5;font-family:Georgia,"Times New Roman",serif;font-weight:900}.rolling-brand :global(.rolling-brand__copy){display:flex;flex-direction:column;align-items:flex-start;line-height:1}.rolling-brand :global(.rolling-brand__copy strong){display:block;font-family:Georgia,"Times New Roman",serif;font-size:1.05rem}.rolling-brand :global(.rolling-brand__copy small){display:block;margin-top:5px;color:#a9b4ae;font-size:.56rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em}
        .rolling-nav{display:flex;justify-content:center;gap:4px}.rolling-nav :global(.rolling-nav__link){padding:9px 13px;border-radius:999px;color:#adb8b2;font-size:.75rem;font-weight:800;transition:.18s}.rolling-nav :global(.rolling-nav__link:hover){color:#fff;background:rgba(255,255,255,.07)}.rolling-nav :global(.rolling-nav__link--active){color:#18231f;background:#f8f6f0}
        .rolling-user{display:flex;align-items:center;gap:11px}.rolling-user__stats,.rolling-user__identity{display:grid;line-height:1.05}.rolling-user__stats{text-align:right;padding-right:11px;border-right:1px solid rgba(255,255,255,.12)}.rolling-user__stats b{font-size:.8rem;color:#dbe9b5}.rolling-user small{margin-top:3px;color:#8f9d96;font-size:.55rem;text-transform:uppercase;letter-spacing:.08em}.rolling-user__identity strong{font-size:.76rem;max-width:120px;overflow:hidden;text-overflow:ellipsis}.rolling-logout{height:34px;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:0 12px;background:transparent;color:#e7ebe8;font-size:.68rem;font-weight:800}.rolling-logout:hover{border-color:#dbe9b5;color:#dbe9b5}
        @media(max-width:800px){.rolling-header{height:auto;padding:8px 12px}.rolling-header__glass{height:auto;grid-template-columns:auto 1fr;gap:8px}.rolling-nav{grid-column:1/-1;order:3;justify-content:flex-start;overflow:auto;padding-top:3px}.rolling-user__stats,.rolling-user__identity{display:none}.rolling-user{justify-self:end}.rolling-nav :global(.rolling-nav__link){white-space:nowrap;padding:8px 11px}}
      `}</style>
    </>
  );
}
